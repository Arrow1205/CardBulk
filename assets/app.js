/* CardVault — app.js (Moteur Maître Définitif) */

// ==========================================
// 1. ÉTAT GLOBAL ET CONFIGURATION
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { 
    "Content-Type": "application/json", 
    "apikey": window.SB_KEY, 
    "Authorization": "Bearer " + window.SB_KEY, 
    "Prefer": "return=representation" 
};

window.db = { cards: [], folders: [] };

// Initialisation des contextes pour les pages (Fix ReferenceError)
window._ctxPlayer = { key: '', brand: 'all', spec: 'all' };
window._ctxClub   = { club: '', brand: 'all', spec: 'all' };
window._ctxSport  = { sport: '', brand: 'all', spec: 'all' };

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// ==========================================
// 2. LOGIQUE DE RENDU (Déclarée avant l'appel)
// ==========================================

window.renderFolders = function() {
    const grid = document.getElementById('folders-grid');
    if(!grid) return;
    grid.innerHTML = (window.db.folders || []).map(f => `
        <div class="folder-card" style="min-width:140px; flex-shrink:0;">
            <div class="folder-emoji">${f.emoji || '📁'}</div>
            <div class="folder-name">${f.name}</div>
        </div>
    `).join('');
};

window.renderCollection = function() {
  const cards = window.db.cards || [];
  const grid = document.getElementById('coll-grid');
  if(!grid) return;
  grid.innerHTML = cards.map(c => `
      <div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'">
        <img src="${c.photo_url || ''}" loading="lazy">
      </div>
  `).join('');
  window.renderValueTab();
};

window.renderPlayerPage = function() {
    const grid = document.getElementById('player-cards-grid');
    if(!grid) return;
    const filtered = window.db.cards.filter(c => ((c.prenom||'')+' '+(c.nom||'')).trim() === window._ctxPlayer.key);
    grid.innerHTML = filtered.map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

window.renderClubPage = function() {
    const grid = document.getElementById('club-cards-grid');
    if(!grid) return;
    const filtered = window.db.cards.filter(c => c.club === window._ctxClub.club);
    grid.innerHTML = filtered.map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

window.renderSportPage = function() {
    const grid = document.getElementById('sport-cards-grid');
    if(!grid) return;
    const filtered = window.db.cards.filter(c => c.sport === window._ctxSport.sport);
    grid.innerHTML = filtered.map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

// ==========================================
// 3. REQUÊTES DB ET CHARGEMENT
// ==========================================

window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    // Rendu auto (Fix TypeError)
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club'))   window.renderClubPage();
    if (document.getElementById('view-sport'))  window.renderSportPage();

  } catch (e) { console.error("DB Load Error:", e); }
};

// ==========================================
// 4. ACCUEIL ET CAROUSEL 3D (AUTO-PLAY)
// ==========================================

window.renderHome = function() {
  const cards = window.db.cards || [];
  const countEl = document.getElementById('home-count');
  const totalEl = document.getElementById('home-total');
  if(countEl) countEl.textContent = `${cards.length} cartes`;
  if(totalEl) totalEl.textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

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
  let autoTimer = null;

  window.update3D = () => {
    cards.forEach((card, i) => {
      const diff = i - currentIndex;
      const absDiff = Math.abs(diff);
      card.style.transform = `translateX(${diff * 60}%) translateZ(${absDiff * -120}px) rotateY(${Math.sign(diff) * -25}deg)`;
      card.style.zIndex = 100 - absDiff;
      card.querySelector('.fav-card-dim').style.setProperty('--dim', absDiff * 0.45);
      card.classList.toggle('active', absDiff === 0);
    });
  };

  const startAuto = () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      currentIndex = (currentIndex + 1) % cards.length;
      window.update3D();
    }, 5000);
  };

  window.handleCarouselClick = (el, id) => {
    clearInterval(autoTimer);
    const idx = parseInt(el.dataset.idx);
    if(idx === currentIndex) location.href = `card.html?id=${id}`;
    else { currentIndex = idx; window.update3D(); startAuto(); }
  };

  window.update3D();
  startAuto();
};

// ==========================================
// 5. MODIFICATION RÉELLE (Fix Capture 14.09.04)
// ==========================================

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { 
    method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) 
  });
  return _safeJsonParse(await r.text());
};

window.saveEdit = async function() {
    const patch = {
        prenom: document.getElementById('e-prenom').value,
        nom: document.getElementById('e-nom').value,
        marque: document.getElementById('e-marque').value,
        price: Number(document.getElementById('e-price').value)
    };
    try {
        await sbUpdate("cards", window.curCardId, patch);
        location.reload(); 
    } catch (e) { alert("Erreur de sauvegarde."); }
};

// ==========================================
// 6. UTILS ET STUBS (Fix ReferenceError)
// ==========================================

window.setupImageViewer = function() {}; // Stub pour index.html:600
window.populateYears = function(id) {
    const s = document.getElementById(id);
    if(s) for(let i=2026; i>=1950; i--) s.add(new Option(i,i));
};

window.renderValueTab = function() {
    const svg = document.getElementById('pie-svg');
    if(svg) svg.innerHTML = `<circle cx="45" cy="45" r="40" fill="#AFFF25" />`; // Placeholder Chart
};

window.navBack = () => history.back();
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.openPlayer = (id) => location.href = `player.html?name=${encodeURIComponent(document.getElementById('detail-nom').textContent)}`;
window.openClub = (n) => location.href = `club.html?name=${encodeURIComponent(n)}`;
window.openSport = (s) => location.href = `sports.html?key=${encodeURIComponent(s)}`;
window.toggleFav = async () => {
    const c = window.db.cards.find(x => x.id === window.curCardId);
    c.fav = !c.fav;
    await sbUpdate("cards", c.id, { fav: c.fav });
    location.reload();
};

// Bouchons de compatibilité restants
window.initSportDD = () => {}; window.setupLiveSearch = () => {}; window.homeSearch = () => {}; window.collSearch = () => {}; window.initFilters = () => {};
window.sportL = (s) => String(s).toUpperCase(); window._loadClubLogos = () => ({}); window._loadPlayerPics = () => ({});
