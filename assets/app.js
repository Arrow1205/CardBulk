/* CardVault — app.js (stable avec connecteurs DB et Moteur de Rendu) */

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
window.SB_URL = window.SB_URL || "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = window.SB_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;

const SB_HDR = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": "Bearer " + SB_KEY,
  "Prefer": "return=representation"
};

function _safeJsonParse(txt){
  try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; }
}

// ==========================================
// 2. REQUÊTES BASE DE DONNÉES (CRUD)
// ==========================================
window.sbGet = async function sbGet(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`;
  const r = await fetch(url, { headers: SB_HDR });
  const txt = await r.text();
  const d = _safeJsonParse(txt) || [];
  if(!r.ok) throw new Error(d?.message || `sbGet ${r.status}`);
  return d;
};

window.sbInsert = async function sbInsert(table, row){
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}`;
  const r = await fetch(url, { method: "POST", headers: SB_HDR, body: JSON.stringify(row) });
  const txt = await r.text();
  const d = _safeJsonParse(txt);
  if(!r.ok) throw new Error(d?.message || `sbInsert ${r.status}`);
  return d;
};

window.sbUpdate = async function sbUpdate(table, id, patch){
  if(!id) throw new Error("sbUpdate: id manquant");
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) });
  const txt = await r.text();
  const d = _safeJsonParse(txt);
  if(!r.ok) throw new Error(d?.message || `sbUpdate ${r.status}`);
  return d;
};

window.sbDelete = async function sbDelete(table, id){
  if(!id) throw new Error("sbDelete: id manquant");
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, { method: "DELETE", headers: SB_HDR });
  if(!r.ok) throw new Error(`sbDelete ${r.status}`);
  return true;
};

// ==========================================
// 3. GESTION DES IMAGES (STORAGE)
// ==========================================
window.uploadPhoto = async function uploadPhoto(dataUrl, cardId, side){
  if(!dataUrl) return "";
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = (blob.type || "").includes("png") ? "png" : "jpg";
  const path = `cards/${cardId}_${side}.${ext}`;

  const putUrl = `${SB_URL}/storage/v1/object/card-photos/${path}`;
  const r = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": blob.type || "image/jpeg",
      "cache-control": "3600",
      "x-upsert": "true"
    },
    body: blob
  });
  if(!r.ok) throw new Error("uploadPhoto failed");
  return `${SB_URL}/storage/v1/object/public/card-photos/${path}`;
};

window.toSB = function toSB(card){
  return {
    id: card.id,
    prenom: card.prenom || "",
    nom: card.nom || "",
    club: card.club || "",
    club_emoji: card.clubEmoji || "",
    sport: card.sport || "",
    is_num: !!card.isNum,
    tags: Array.isArray(card.tags) ? card.tags : [],
    collection: card.collection || "",
    marque: card.marque || "",
    annee: card.annee || "",
    set_name: card.setName || "",
    price: Number.isFinite(card.price) ? card.price : 0,
    photo_url: card.photo || "",
    photo_verso_url: card.photoVerso || ""
  };
};

// ==========================================
// 5. ETAT GLOBAL ET CHARGEMENT
// ==========================================
window.db = { cards: [], folders: [] };

window.loadFromDB = async function() {
  try {
    const cards = await sbGet("cards");
    window.db.cards = cards; // Sauvegarde en mémoire
    
    // DÉCLENCHEMENT DU RENDU VISUEL SELON LA PAGE
    if (document.getElementById('page-home')) renderHome();
    if (document.getElementById('page-collection')) renderCollection();
    
  } catch (e) {
    console.error("Erreur de chargement DB:", e);
  }
};

window.populateYears = function(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentYear = new Date().getFullYear() + 1;
  for (let i = currentYear; i >= 1950; i--) {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    select.appendChild(opt);
  }
};

window.navBack = function() {
  if (document.referrer && document.referrer.includes(location.host)) {
    history.back();
  } else {
    location.href = 'collection.html';
  }
};

// ==========================================
// 6. MOTEUR DE RENDU (INJECTION HTML)
// ==========================================

// --- Rendu Accueil (index.html) ---
window.renderHome = function() {
  const cards = window.db.cards || [];
  
  const countEl = document.getElementById('home-count');
  const totalEl = document.getElementById('home-total');
  const recentList = document.getElementById('recent-list');

  // Mise à jour des compteurs et de la valeur
  if (countEl) countEl.textContent = cards.length + (cards.length > 1 ? " cartes" : " carte");
  
  const total = cards.reduce((sum, c) => sum + Number(c.price || 0), 0);
  if (totalEl) totalEl.textContent = total.toFixed(2) + " €";

  // Génération de la liste des 10 dernières cartes
  if (recentList) {
    recentList.innerHTML = cards.slice(0, 10).map(c => `
      <div class="list-item" onclick="location.href='card.html?id=${encodeURIComponent(c.id)}'">
        <div class="list-thumb">
          ${c.photo_url ? `<img src="${c.photo_url}" alt="">` : `<span style="font-size:20px">🃏</span>`}
        </div>
        <div class="list-info">
          <div class="list-name" style="font-family:'Barlow Condensed', sans-serif; font-size: 17px; font-weight:800; text-transform:uppercase;">
            ${c.prenom ? c.prenom + ' ' : ''}${c.nom || 'INCONNU'}
          </div>
          <div class="list-meta">${c.marque || '—'} ${c.set_name ? ' • ' + c.set_name : ''}</div>
          <div class="list-price">${c.price ? c.price + ' €' : '--'}</div>
        </div>
      </div>
    `).join('');
  }
};

// --- Rendu Collection (collection.html) ---
window.renderCollection = function() {
  const cards = window.db.cards || [];
  
  const grid = document.getElementById('coll-grid');
  const totalCards = document.getElementById('total-cards');
  const totalVal = document.getElementById('total-val');

  if (totalCards) totalCards.textContent = cards.length + (cards.length > 1 ? " cartes" : " carte");
  
  const total = cards.reduce((sum, c) => sum + Number(c.price || 0), 0);
  if (totalVal) totalVal.textContent = total.toFixed(2) + " €";

  // Génération de la grille d'images (3 colonnes via CSS)
  if (grid) {
    grid.innerHTML = cards.map(c => `
      <div class="coll-thumb" onclick="location.href='card.html?id=${encodeURIComponent(c.id)}'">
        ${c.photo_url ? `<img src="${c.photo_url}" alt="">` : `<div class="coll-thumb-empty">🃏</div>`}
      </div>
    `).join('');
  }
};

// --- Rendu Détail (card.html) ---
window._displayCard = function(c) {
  const elPrenom = document.getElementById('detail-prenom');
  const elNom = document.getElementById('detail-nom');
  const elMarque = document.getElementById('d-marque-text');
  const elSet = document.getElementById('d-set');
  const elPrice = document.getElementById('d-price');
  const imgFront = document.getElementById('card-face-front');
  const elAnnee = document.getElementById('d-annee');
  const elColl = document.getElementById('d-coll');
  
  if (elPrenom) elPrenom.textContent = c.prenom || "";
  if (elNom) elNom.textContent = c.nom || "INCONNU";
  if (elMarque) elMarque.textContent = c.marque || "—";
  if (elSet) elSet.textContent = c.set_name || "—";
  if (elAnnee) elAnnee.textContent = c.annee || "—";
  if (elColl) elColl.textContent = c.collection || "—";
  if (elPrice) elPrice.textContent = c.price ? c.price + " €" : "—";

  if (imgFront && c.photo_url) {
    imgFront.innerHTML = `<img src="${c.photo_url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
  }
};

// ==========================================
// 7. BOUCHONS (ÉVITE LES PLANTAGES)
// ==========================================
window._loadClubLogos = function() { return {}; };
window.getClubLogoB64 = function(club) { return ""; };
window.sportL = function(s) { return s; };
window._loadPlayerPics = function() { return {}; };
window._setPlayerHeroSrc = function(src) {
  const img = document.getElementById('player-hero-img');
  if(img && src) img.src = src;
};

window.renderClubPage = function() {};
window.renderPlayerPage = function() {};
window.renderSportPage = function() {};
window.renderFolders = function() {};
window.showToast = function(msg) { console.log("Toast:", msg); };

const stubs = [
  "setupImageViewer", "initSportDD", "setupLiveSearch", "switchCollectionTab", "collSearch", 
  "toggleSportDD", "setSportFilter", "setBrandFilter", "setTypeFilter", 
  "toggleFav", "flipCard", "openPlayer", "openClub", "openSport", "editCurrentCard", 
  "openPlayerStats", "cancelBulk", "executeBulk", "closeSheet", 
  "deleteCurrentCard", "switchEditSide", "handleEditPhoto", "openCrop", "onEditSportChange", 
  "clubSearch", "eTogTag", "onMarqueChange", "onEditCollChange", "saveEdit", "selEmoji", 
  "cropResetEnhance", "closeCrop", "applyCrop", "triggerPlayerPhoto", 
  "onPlayerPhotoPicked", "openSportFromChip", "openClubFromChip", "triggerClubLogo", 
  "onClubLogoPicked", "homeSearch", "toggleBulk", "onSportChange", "updateSportIcon", 
  "showCreateClubForm", "createClub", "toggleTag", "toggleNum"
];

stubs.forEach(fn => {
  window[fn] = window[fn] || function() { 
    console.log(`Fonction ${fn}() en cours de développement.`); 
  };
});
