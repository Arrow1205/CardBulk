/* CardVault — app.js (Moteur interactif complet) */

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
window.SB_URL = window.SB_URL || "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = window.SB_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;
const SB_HDR = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=representation" };

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// --- LOGOS DES MARQUES ---
window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};
window.loadBrandLogos = async function(){ return window.BRAND_LOGOS; };

// ==========================================
// 2. REQUÊTES DB & STORAGE
// ==========================================
window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  if(!r.ok) throw new Error(`sbGet ${r.status}`);
  return _safeJsonParse(await r.text()) || [];
};

window.sbInsert = async function(table, row){
  const r = await fetch(`${SB_URL}/rest/v1/${encodeURIComponent(table)}`, { method: "POST", headers: SB_HDR, body: JSON.stringify(row) });
  if(!r.ok) throw new Error(`sbInsert ${r.status}`);
  return _safeJsonParse(await r.text());
};

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) });
  if(!r.ok) throw new Error(`sbUpdate ${r.status}`);
  return _safeJsonParse(await r.text());
};

window.sbDelete = async function(table, id){
  const r = await fetch(`${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: SB_HDR });
  if(!r.ok) throw new Error(`sbDelete ${r.status}`);
  return true;
};

window.uploadPhoto = async function(dataUrl, cardId, side){
  if(!dataUrl) return "";
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type || "").includes("png") ? "png" : "jpg";
  const path = `cards/${cardId}_${side}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/card-photos/${path}`, {
    method: "PUT", headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": blob.type || "image/jpeg", "x-upsert": "true" }, body: blob
  });
  if(!r.ok) throw new Error("uploadPhoto failed");
  return `${SB_URL}/storage/v1/object/public/card-photos/${path}`;
};

window.toSB = function(card){
  return {
    id: card.id, prenom: card.prenom || "", nom: card.nom || "", club: card.club || "", sport: card.sport || "",
    is_num: !!card.isNum, tags: Array.isArray(card.tags) ? card.tags : [], collection: card.collection || "",
    marque: card.marque || "", annee: card.annee || "", set_name: card.setName || "", price: Number(card.price) || 0,
    photo_url: card.photo || "", photo_verso_url: card.photoVerso || "", fav: !!card.fav
  };
};

// ==========================================
// 3. CHARGEMENT GLOBAL ET ÉTAT
// ==========================================
window.db = { cards: [], folders: [] };
window.activeBrand = 'all';
window.activeType = 'all';

window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; } // Charge les dossiers si la table existe
    
    initFilters(); // Injecte les logos dans les boutons

    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
  } catch (e) { console.error("Erreur DB:", e); }
};

window.populateYears = function(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentYear = new Date().getFullYear() + 1;
  for (let i = currentYear; i >= 1950; i--) {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = i; select.appendChild(opt);
  }
};

window.navBack = function() {
  if (document.referrer && document.referrer.includes(location.host)) history.back();
  else location.href = 'collection.html';
};

// ==========================================
// 4. MOTEUR DE RENDU (VUES)
// ==========================================
window.renderHome = function() {
  const cards = window.db.cards || [];
  const countEl = document.getElementById('home-count');
  const totalEl = document.getElementById('home-total');
  const recentList = document.getElementById('recent-list');

  if (countEl) countEl.textContent = cards.length + (cards.length > 1 ? " cartes" : " carte");
  if (totalEl) totalEl.textContent = cards.reduce((sum, c) => sum + Number(c.price || 0), 0).toFixed(2) + " €";

  if (recentList) {
    recentList.innerHTML = cards.slice(0, 10).map(c => `
      <div class="list-item" onclick="location.href='card.html?id=${encodeURIComponent(c.id)}'">
        <div class="list-thumb">${c.photo_url ? `<img src="${c.photo_url}">` : `<span>🃏</span>`}</div>
        <div class="list-info">
          <div class="list-name">${c.prenom ? c.prenom + ' ' : ''}${c.nom || 'INCONNU'}</div>
          <div class="list-meta">${c.marque || '—'} ${c.set_name ? ' • ' + c.set_name : ''}</div>
          <div class="list-price">${c.price ? c.price + ' €' : '--'}</div>
        </div>
      </div>
    `).join('');
  }
  
  // Rendu du carrousel Favoris (Scroll horizontal optimisé)
  const carousel = document.getElementById('fav-carousel');
  if (carousel) {
    const favs = cards.filter(c => c.fav);
    if (favs.length === 0) {
      carousel.innerHTML = '<div class="fav-empty">Aucun favori. Cliquez sur l\'étoile d\'une carte !</div>';
    } else {
      carousel.style.display = 'flex'; carousel.style.overflowX = 'auto'; carousel.style.gap = '14px'; 
      carousel.style.justifyContent = 'flex-start'; carousel.style.padding = '10px 20px'; carousel.style.height = 'auto';
      carousel.innerHTML = favs.map(c => `
        <div style="width:200px; aspect-ratio:2.5/3.5; flex-shrink:0; border-radius:12px; overflow:hidden; background:#18181d; border:1px solid rgba(255,255,255,0.1); cursor:pointer;" onclick="location.href='card.html?id=${c.id}'">
          ${c.photo_url ? `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:30px;">🃏</div>`}
        </div>
      `).join('');
    }
  }
};

window.renderCollection = function() {
  let filtered = window.db.cards || [];
  
  // Applique les filtres visuels
  if (window.activeBrand !== 'all') filtered = filtered.filter(c => (c.marque || '').toLowerCase() === window.activeBrand.toLowerCase());
  if (window.activeType === 'auto') filtered = filtered.filter(c => c.tags && c.tags.includes('auto'));
  if (window.activeType === 'patch') filtered = filtered.filter(c => c.tags && c.tags.includes('patch'));
  if (window.activeType === 'rookie') filtered = filtered.filter(c => c.tags && c.tags.includes('rookie'));
  if (window.activeType === 'num') filtered = filtered.filter(c => c.is_num);

  const grid = document.getElementById('coll-grid');
  const empty = document.getElementById('coll-empty');
  
  if(grid) {
    grid.innerHTML = filtered.map(c => `
      <div class="coll-thumb" onclick="location.href='card.html?id=${encodeURIComponent(c.id)}'">
        ${c.photo_url ? `<img src="${c.photo_url}">` : `<div class="coll-thumb-empty">🃏</div>`}
      </div>
    `).join('');
    if(empty) empty.style.display = filtered.length === 0 ? 'block' : 'none';
  }
};

window._displayCard = function(c) {
  window.curCardId = c.id;
  document.getElementById('detail-prenom').textContent = c.prenom || "";
  document.getElementById('detail-nom').textContent = c.nom || "INCONNU";
  document.getElementById('d-marque-text').textContent = c.marque || "—";
  document.getElementById('d-set').textContent = c.set_name || "—";
  document.getElementById('d-annee').textContent = c.annee || "—";
  document.getElementById('d-coll').textContent = c.collection || "—";
  document.getElementById('d-price').textContent = c.price ? c.price + " €" : "—";

  // Image 3D Front
  const imgFront = document.getElementById('card-face-front');
  if (imgFront && c.photo_url) imgFront.innerHTML = `<img src="${c.photo_url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;

  // Étoile Favori
  const favBtn = document.getElementById('detail-fav-btn');
  if (favBtn) {
    favBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" class="fav-star"></path></svg>`;
    if (c.fav) favBtn.classList.add('active'); else favBtn.classList.remove('active');
  }

  // Activation dynamique des Gélules (Chips) Club et Sport
  const clubChip = document.getElementById('detail-club-chip');
  const clubN = document.getElementById('detail-club-n');
  if (c.club && clubChip && clubN) { clubN.textContent = c.club; clubChip.style.display = 'inline-flex'; }

  const sportChip = document.getElementById('detail-sport-chip');
  const sportL = document.getElementById('detail-sport-label');
  if (c.sport && sportChip && sportL) { sportL.textContent = c.sport.toUpperCase(); sportChip.style.display = 'inline-flex'; }
  
  // Tags (Auto, Patch, Num...)
  const tagsVal = document.getElementById('d-tags-val');
  if (tagsVal) {
    let tagsHtml = '';
    if(c.is_num) tagsHtml += '<span class="badge num">NUM</span>';
    if(c.tags) {
       if(c.tags.includes('auto')) tagsHtml += '<span class="badge auto">AUTO</span>';
       if(c.tags.includes('patch')) tagsHtml += '<span class="badge patch">PATCH</span>';
       if(c.tags.includes('rookie')) tagsHtml += '<span class="badge rookie">RC</span>';
    }
    tagsVal.innerHTML = tagsHtml || '—';
  }
};

// ==========================================
// 5. FONCTIONS INTERACTIVES
// ==========================================

// Favoris
window.toggleFav = async function() {
  const c = window.db.cards.find(x => String(x.id) === String(window.curCardId));
  if (!c) return;
  c.fav = !c.fav; 
  const favBtn = document.getElementById('detail-fav-btn');
  if (favBtn) { if (c.fav) favBtn.classList.add('active'); else favBtn.classList.remove('active'); }
  try { await sbUpdate("cards", c.id, { fav: c.fav }); } catch (e) { console.error("Erreur save fav", e); }
};

// Bascule Onglets (Cartes / Valeur) sur Collection
window.switchCollectionTab = function(tab) {
  document.getElementById('coll-tab-cards').classList.toggle('active', tab === 'cards');
  document.getElementById('coll-tab-value').classList.toggle('active', tab === 'value');
  document.getElementById('coll-panel-cards').style.display = tab === 'cards' ? 'block' : 'none';
  document.getElementById('coll-panel-value').style.display = tab === 'value' ? 'block' : 'none';
};

// Filtres
window.initFilters = async function() {
  const logos = await loadBrandLogos();
  document.querySelectorAll('.brand-filter-btn').forEach(btn => {
    const match = btn.getAttribute('onclick').match(/'([^']+)'/);
    if(match && match[1] !== 'all') {
      const b = match[1].toLowerCase();
      if(logos[b]) { btn.innerHTML = `<img src="${logos[b]}" style="height:14px;display:block;">`; btn.style.padding = '4px 10px'; }
      else btn.textContent = match[1];
    }
  });
};

window.setBrandFilter = function(brand, btn) {
  document.querySelectorAll('.brand-filter-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  window.activeBrand = brand;
  window.renderCollection();
};

window.setTypeFilter = function(type, btn) {
  document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  window.activeType = type;
  window.renderCollection();
};

// Menu de recherche AJAX (Accueil et Collection)
window.homeSearch = function(val) {
  const ddHome = document.getElementById('home-search-dropdown');
  const ddColl = document.getElementById('coll-search-dropdown');
  const targetDd = ddHome || ddColl; // Gère les deux pages
  if (!targetDd) return;
  if (!val) { targetDd.classList.remove('open'); return; }
  
  const term = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hits = window.db.cards.filter(c => {
    const fullName = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const club = (c.club || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return fullName.includes(term) || club.includes(term);
  }).slice(0, 5);

  targetDd.innerHTML = hits.map(c => `
    <div class="search-drop-item" onclick="location.href='card.html?id=${c.id}'">
      <div class="search-drop-thumb" style="width:36px;height:48px;overflow:hidden;border-radius:4px;">${c.photo_url ? `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : '🃏'}</div>
      <div>
        <div class="search-drop-name">${c.prenom || ''} ${c.nom || ''}</div>
        <div class="search-drop-sub" style="font-size:12px;opacity:0.6;">${c.marque || '—'} • ${c.club || ''}</div>
      </div>
    </div>
  `).join('');
  targetDd.classList.toggle('open', hits.length > 0);
};
window.collSearch = window.homeSearch;

// Création de Dossiers
window.openNewFolder = function() {
  const sheet = document.getElementById('folder-sheet');
  if (sheet) sheet.classList.add('open');
};

window.createFolder = async function() {
  const nameEl = document.getElementById('new-folder-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { alert('Saisis un nom de dossier'); return; }
  
  const folder = { id: String(Date.now()), name: name, emoji: '📁' };
  window.db.folders.push(folder);
  try { await sbInsert('folders', folder); } catch(e) { console.log("Sauvegarde dossier local."); }
  
  if (nameEl) nameEl.value = '';
  window.closeSheet('folder-sheet');
  window.renderFolders();
};

window.renderFolders = function() {
  const grid = document.getElementById('folders-grid');
  if (!grid) return;
  grid.innerHTML = window.db.folders.map(f => `
    <div class="folder-card" style="flex-shrink:0; min-width:140px; cursor:pointer;" onclick="alert('Vue dossier en dev')">
      <div class="folder-emoji">${f.emoji || '📁'}</div>
      <div class="folder-name">${f.name}</div>
    </div>
  `).join('');
};

// Fenêtres (Sheets)
window.closeSheet = function(id, event) {
  if (event && event.target !== document.getElementById(id)) return;
  const sheet = document.getElementById(id);
  if (sheet) sheet.classList.remove('open');
};

window.editCurrentCard = function() {
  const c = window.db.cards.find(x => String(x.id) === String(window.curCardId));
  if (!c) return;
  document.getElementById('e-prenom').value = c.prenom || '';
  document.getElementById('e-nom').value = c.nom || '';
  document.getElementById('e-marque').value = c.marque || '';
  document.getElementById('e-price').value = c.price || 0;
  document.getElementById('edit-sheet').classList.add('open');
};

// Redirections Pages Gélules
window.openPlayer = function(id) {
  const c = window.db.cards.find(x => String(x.id) === String(id));
  if(c) location.href = `player.html?name=${encodeURIComponent((c.prenom+' '+c.nom).trim())}`;
};
window.openClub = function(clubName) {
  if(clubName) location.href = `club.html?name=${encodeURIComponent(clubName)}`;
};
window.openSport = function(sportName) {
  if(sportName) location.href = `sports.html?key=${encodeURIComponent(sportName)}`;
};

// ==========================================
// 6. BOUCHONS (ÉVITE LES PLANTAGES)
// ==========================================
const stubs = [
  "setupImageViewer", "initSportDD", "setupLiveSearch", "toggleSportDD", "flipCard", "openPlayerStats", 
  "cancelBulk", "executeBulk", "deleteCurrentCard", "switchEditSide", "handleEditPhoto", "openCrop", 
  "onEditSportChange", "clubSearch", "eTogTag", "onMarqueChange", "onEditCollChange", "saveEdit", "selEmoji", 
  "cropResetEnhance", "closeCrop", "applyCrop", "triggerPlayerPhoto", "onPlayerPhotoPicked", "openSportFromChip", 
  "openClubFromChip", "triggerClubLogo", "onClubLogoPicked", "toggleBulk", "onSportChange", "updateSportIcon", 
  "showCreateClubForm", "createClub", "toggleTag", "toggleNum", "sportL", "getClubLogoB64"
];
stubs.forEach(fn => { window[fn] = window[fn] || function() { console.log(`Fonction ${fn}() en cours de dev.`); }; });
