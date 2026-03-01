/* CardVault — app.js (Moteur Maître Stable) */

// ==========================================
// 1. CONFIGURATION & ÉTAT GLOBAL
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };

// Contextes obligatoires pour éviter les ReferenceError (Fix Captures 13.53.11 / 16.26.21)
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

// ==========================================
// 2. FONCTIONS DE RENDU (Déclarées en haut pour Fix TypeError)
// ==========================================

window.populateYears = function(id) { // Fix Capture 13.54.38
    const s = document.getElementById(id);
    if(s) { s.innerHTML = ""; for(let i=2026; i>=1950; i--) s.add(new Option(i,i)); }
};

window.renderFolders = function() { // Fix Capture 13.52.21
    const grid = document.getElementById('folders-grid');
    if(grid) grid.innerHTML = (window.db.folders || []).map(f => `<div class="folder-card" style="min-width:140px;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>`).join('');
};

window.renderCollection = function() { // Fix Capture 14.03.21
    const grid = document.getElementById('coll-grid');
    if(grid) grid.innerHTML = (window.db.cards || []).map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

window.renderPlayerPage = function() { // Fix Capture 16.26.21
    const grid = document.getElementById('player-cards-grid');
    if(grid) grid.innerHTML = window.db.cards.filter(c => ((c.prenom||'')+' '+(c.nom||'')).trim() === window._ctxPlayer.key).map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

window.renderClubPage = function() {
    const grid = document.getElementById('club-cards-grid');
    if(grid) grid.innerHTML = window.db.cards.filter(c => c.club === window._ctxClub.club).map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

window.renderSportPage = function() {
    const grid = document.getElementById('sport-cards-grid');
    if(grid) grid.innerHTML = window.db.cards.filter(c => c.sport === window._ctxSport.sport).map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

// ==========================================
// 3. LOGIQUE DB ET CHARGEMENT
// ==========================================

window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) {}
    
    // Dispatch des rendus selon la page
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club'))   window.renderClubPage();
    if (document.getElementById('view-sport'))  window.renderSportPage();
  } catch (e) { console.error("DB Error", e); }
};

// ==========================================
// 4. ACCUEIL ET CAROUSEL (3D Auto - Fix Capture 13.35.44)
// ==========================================

window.renderHome = function() {
  const cards = window.db.cards || [];
  const elC = document.getElementById('home-count');
  const elT = document.getElementById('home-total');
  if(elC) elC.textContent = `${cards.length} cartes`;
  if(elT) elT.textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

  const carousel = document.getElementById('fav-carousel');
  const favs = cards.filter(c => c.fav);
  if (carousel && favs.length > 0) {
    carousel.innerHTML = favs.map((c, i) => `
      <div class="fav-card" data-idx="${i}" onclick="window.handleCarouselClick(this, '${c.id}')">
        ${c.photo_url ? `<img src="${c.photo_url}">` : `<div>🃏</div>`}
        <div class="fav-card-dim"></div>
      </div>
    `).join('');
    setTimeout(window.init3DCarousel, 50);
  }
};

window.init3DCarousel = function() {
  const container = document.getElementById('fav-carousel');
  if(!container) return;
  const cards = container.querySelectorAll('.fav-card');
  let currentIndex = Math.floor(cards.length / 2);

  window.update3D = () => {
    cards.forEach((card, i) => {
      const diff = i - currentIndex;
      const absDiff = Math.abs(diff);
      card.style.transform = `translateX(${diff * 65}%) translateZ(${absDiff * -120}px) rotateY(${Math.sign(diff) * -25}deg)`;
      card.style.zIndex = 100 - absDiff;
      card.querySelector('.fav-card-dim').style.setProperty('--dim', absDiff * 0.45);
      card.classList.toggle('active', absDiff === 0);
    });
  };

  let timer = setInterval(() => { currentIndex = (currentIndex + 1) % cards.length; window.update3D(); }, 5000);

  window.handleCarouselClick = (el, id) => {
    clearInterval(timer);
    const idx = parseInt(el.dataset.idx);
    if(idx === currentIndex) location.href = `card.html?id=${id}`;
    else { currentIndex = idx; window.update3D(); }
  };
  window.update3D();
};

// ==========================================
// 5. STUBS & NAVIGATION (Fix ReferenceError Captures 14.20.46 / 14.07.22)
// ==========================================

window.setupImageViewer = function() {}; // Stub vide pour index.html:600
window.initSportDD = function() {};     // Stub vide pour index.html:601
window.setupLiveSearch = function() {};
window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({});
window._loadPlayerPics = () => ({});
window._setPlayerHeroSrc = () => {};
window.navBack = () => history.back();
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.openPlayer = () => location.href = `player.html?name=${encodeURIComponent(document.getElementById('detail-nom').textContent)}`;

// CRUD SQL
window.sbUpdate = async (t, id, p) => { 
  const r = await fetch(`${window.SB_URL}/rest/v1/${t}?id=eq.${id}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(p) });
  return _safeJsonParse(await r.text());
};
window.sbInsert = async (t, r) => { 
  const res = await fetch(`${window.SB_URL}/rest/v1/${t}`, { method: "POST", headers: SB_HDR, body: JSON.stringify(r) });
  return _safeJsonParse(await res.text());
};
window.toSB = (c) => ({ prenom:c.prenom, nom:c.nom, club:c.club, sport:c.sport, marque:c.marque, set_name:c.set_name, collection:c.collection, price:c.price });

// Modification Réelle via Scanner (Capture 14.09.04)
window.editCurrentCard = function() {
    if(!window.curCardId) return;
    location.href = `scanner.html?edit=${window.curCardId}`;
};

// ==========================================
// 6. CARD DETAIL (Fix Tags)
// ==========================================
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
