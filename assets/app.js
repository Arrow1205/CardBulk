/* CardVault — app.js (Moteur Maître Stable) */

// 1. CONFIGURATION
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";
const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };
window._ctxPlayer = { key: '' }; window._ctxClub = { club: '' }; window._ctxSport = { sport: '' };

// 2. DÉCLARATION DES FONCTIONS (En priorité pour éviter les TypeError)
window.populateYears = (id) => { 
  const s = document.getElementById(id); 
  if(s) { s.innerHTML = ""; for(let i=2026; i>=1950; i--) s.add(new Option(i,i)); } 
};

window.renderFolders = () => {
  const grid = document.getElementById('folders-grid');
  if(grid) grid.innerHTML = (window.db.folders || []).map(f => `<div class="folder-card" style="min-width:140px;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>`).join('');
};

window.renderCollection = () => {
  const grid = document.getElementById('coll-grid');
  if(grid) grid.innerHTML = window.db.cards.map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

// 3. CHARGEMENT DB
window.loadFromDB = async function() {
  try {
    const r = await fetch(`${window.SB_URL}/rest/v1/cards?select=*&order=created_at.desc`, { headers: SB_HDR });
    window.db.cards = await r.json();
    try { const rf = await fetch(`${window.SB_URL}/rest/v1/folders?select=*`, { headers: SB_HDR }); window.db.folders = await rf.json(); } catch(e){}
    
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club'))   window.renderClubPage();
    if (document.getElementById('view-sport'))  window.renderSportPage();
  } catch (e) { console.log("Erreur DB"); }
};

// 4. LOGIQUE DE MODIFICATION (C'est ici que la magie opère)
window.editCurrentCard = function() {
    const id = new URLSearchParams(window.location.search).get('id');
    if(!id) return;
    // On ferme manuellement le tiroir s'il est ouvert par erreur
    const sheet = document.getElementById('edit-sheet');
    if(sheet) sheet.classList.remove('open');
    // On redirige vers le scanner
    location.href = `scanner.html?edit=${id}`;
};

// 5. STUBS & COMPATIBILITÉ (Pour stopper les erreurs console)
window.setupImageViewer = () => {}; 
window.initSportDD = () => {}; 
window.setupLiveSearch = () => {};
window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({}); 
window._loadPlayerPics = () => ({});
window.navBack = () => history.back();
window.sbUpdate = async (t, id, p) => fetch(`${window.SB_URL}/rest/v1/${t}?id=eq.${id}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(p) });
window.sbInsert = async (t, r) => fetch(`${window.SB_URL}/rest/v1/${t}`, { method: "POST", headers: SB_HDR, body: JSON.stringify(r) });
window.toSB = (c) => ({ prenom:c.prenom, nom:c.nom, club:c.club, sport:c.sport, marque:c.marque, set_name:c.set_name, collection:c.collection, price:c.price });

// 6. CARD DETAIL (Tags Fix)
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");
  if(c.photo_url) {
      const img = document.getElementById('card-face-front');
      if(img) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
  }
};
