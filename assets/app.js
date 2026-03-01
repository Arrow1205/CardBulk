/* CardVault — app.js (Version Stable Finale) */

// 1. CONFIGURATION
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";
const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };

// Contextes pour éviter les ReferenceError sur les pages Club/Sport/Player
window._ctxPlayer = { key: '', brand: 'all', spec: 'all' };
window._ctxClub   = { club: '', brand: 'all', spec: 'all' };
window._ctxSport  = { sport: '', brand: 'all', spec: 'all' };

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};
window.SPORT_ICONS = { football: '⚽', basketball: '🏀', baseball: '⚾', tennis: '🎾', f1: '🏎️' };

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// 2. ACTIONS BASE DE DONNÉES
window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${window.SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) });
  return _safeJsonParse(await r.text());
};

window.sbInsert = async function(table, row){
  const r = await fetch(`${window.SB_URL}/rest/v1/${table}`, { method: "POST", headers: SB_HDR, body: JSON.stringify(row) });
  return _safeJsonParse(await r.text());
};

window.uploadPhoto = async function(dataUrl, cardId, side){
  if(!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const path = `cards/${cardId}_${side}.jpg`;
  await fetch(`${window.SB_URL}/storage/v1/object/card-photos/${path}`, {
    method: "PUT", headers: { "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob
  });
  return `${window.SB_URL}/storage/v1/object/public/card-photos/${path}`;
};

window.toSB = (c) => ({
  prenom: c.prenom, nom: c.nom, club: c.club, sport: c.sport, 
  marque: c.marque, set_name: c.set_name || c.setName, 
  collection: c.collection, price: Number(c.price) || 0
});

// 3. CHARGEMENT ET NAVIGATION
window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) {}
    
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club'))   window.renderClubPage();
    if (document.getElementById('view-sport'))  window.renderSportPage();
  } catch (e) { console.error("Erreur DB", e); }
};

// Redirection vers le scanner en mode édition
window.editCurrentCard = function() {
    if(!window.curCardId) return;
    location.href = `scanner.html?edit=${window.curCardId}`;
};

// 4. RENDU DÉTAIL CARTE (card.html)
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");

  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

  const clubChip = document.getElementById('detail-club-chip');
  if(c.club && clubChip) { 
      const n = document.getElementById('detail-club-n');
      if(n) n.textContent = c.club;
      clubChip.style.display = 'inline-flex'; 
      clubChip.onclick = () => location.href = `club.html?name=${encodeURIComponent(c.club)}`;
  }
  const sportChip = document.getElementById('detail-sport-chip');
  if(c.sport && sportChip) { 
      const l = document.getElementById('detail-sport-label');
      if(l) l.textContent = c.sport.toUpperCase();
      sportChip.style.display = 'inline-flex'; 
      sportChip.onclick = () => location.href = `sports.html?key=${encodeURIComponent(c.sport)}`;
  }
};

// 5. STUBS DE SURVIE (Empêche les crashs des scripts inline)
window.populateYears = (id) => { const s=document.getElementById(id); if(s) for(let i=2026;i>=1950;i--) s.add(new Option(i,i)); };
window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({});
window._loadPlayerPics = () => ({});
window.renderHome = () => {}; window.renderCollection = () => {}; window.renderFolders = () => {};
window.setupImageViewer = () => {}; window.navBack = () => history.back();
