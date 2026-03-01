/* CardVault — app.js (Moteur complet : 3D, Filtres & Correction Tags) */

// ==========================================
// 1. CONFIGURATION & ETAT GLOBAL
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };

// Contextes globaux pour les pages de filtrage (Fix ReferenceError)
window._ctxPlayer = { key: '', brand: 'all', spec: 'all' };
window._ctxClub = { club: '', brand: 'all', spec: 'all' };
window._ctxSport = { sport: '', brand: 'all', spec: 'all' };

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// ==========================================
// 2. REQUÊTES DB
// ==========================================
window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) });
  return _safeJsonParse(await r.text());
};

// ==========================================
// 3. CHARGEMENT ET RENDU
// ==========================================
window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    // Auto-détection de la page pour lancer le bon rendu
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { 
        window.renderCollection(); 
        window.renderFolders(); 
        window.initFilters();
    }
    // Lancement des fonctions de pages spécifiques si présentes
    if (typeof _pagePlayer === 'function' && document.getElementById('view-player')) _pagePlayer();
    if (typeof _pageClub === 'function' && document.getElementById('view-club')) _pageClub();
    if (typeof _pageSports === 'function' && document.getElementById('view-sport')) _pageSports();

  } catch (e) { console.error("Erreur DB:", e); }
};

// ==========================================
// 4. MOTEUR DE RENDU DES SOUS-PAGES (Fix Cartes invisibles)
// ==========================================

// Rendu des cartes pour la page Club
window.renderClubPage = function() {
  const grid = document.getElementById('club-cards-grid');
  if (!grid) return;
  
  const filtered = window.db.cards.filter(c => 
    c.club === window._ctxClub.club &&
    (window._ctxClub.brand === 'all' || (c.marque||'').toLowerCase() === window._ctxClub.brand.toLowerCase())
  );

  grid.innerHTML = filtered.map(c => `
    <div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'">
      <img src="${c.photo_url || ''}">
    </div>
  `).join('');
};

// Rendu des cartes pour la page Sport
window.renderSportPage = function() {
  const grid = document.getElementById('sport-cards-grid');
  if (!grid) return;

  const filtered = window.db.cards.filter(c => 
    c.sport === window._ctxSport.sport &&
    (window._ctxSport.brand === 'all' || (c.marque||'').toLowerCase() === window._ctxSport.brand.toLowerCase())
  );

  grid.innerHTML = filtered.map(c => `
    <div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'">
      <img src="${c.photo_url || ''}">
    </div>
  `).join('');
};

// ==========================================
// 5. CARD DETAIL (Correction Liens & Tags)
// ==========================================
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque-text', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");

  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

  // Fix : On s'assure que le clic sur le tag redirige avec la bonne valeur
  const clubChip = document.getElementById('detail-club-chip');
  if(c.club && clubChip) { 
      document.getElementById('detail-club-n').textContent = c.club; 
      clubChip.style.display = 'inline-flex'; 
      clubChip.onclick = () => location.href = `club.html?name=${encodeURIComponent(c.club)}`;
  }
  
  const sportChip = document.getElementById('detail-sport-chip');
  if(c.sport && sportChip) { 
      const label = document.getElementById('detail-sport-label');
      if(label) label.textContent = c.sport.toUpperCase(); 
      sportChip.style.display = 'inline-flex'; 
      sportChip.onclick = () => location.href = `sports.html?key=${encodeURIComponent(c.sport)}`;
  }
};

// ==========================================
// 6. ACCUEIL & CAROUSEL 3D
// ==========================================
window.renderHome = function() {
  const cards = window.db.cards || [];
  const elCount = document.getElementById('home-count');
  const elTotal = document.getElementById('home-total');
  if(elCount) elCount.textContent = `${cards.length} cartes`;
  if(elTotal) elTotal.textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

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

  const autoTimer = setInterval(() => {
    currentIndex = (currentIndex + 1) % cards.length;
    window.update3D();
  }, 5000);

  window.handleCarouselClick = (el, id) => {
    clearInterval(autoTimer);
    const idx = parseInt(el.dataset.idx);
    if(idx === currentIndex) location.href = `card.html?id=${id}`;
    else { currentIndex = idx; window.update3D(); }
  };
  window.update3D();
};

// ==========================================
// 7. COMPATIBILITÉ & FILTRES
// ==========================================
window.initFilters = function() {
  document.querySelectorAll('.brand-filter-btn').forEach(btn => {
    const oc = btn.getAttribute('onclick');
    if(oc) {
      const match = oc.match(/'([^']+)'/);
      if(match && window.BRAND_LOGOS[match[1].toLowerCase()]) {
        btn.innerHTML = `<img src="${window.BRAND_LOGOS[match[1].toLowerCase()]}" style="height:14px;">`;
      }
    }
  });
};

window.renderFolders = function() {
    const grid = document.getElementById('folders-grid');
    if(grid) grid.innerHTML = (window.db.folders || []).map(f => `<div class="folder-card" style="min-width:140px;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>`).join('');
};

window.populateYears = function(id) {
    const s = document.getElementById(id);
    if(!s) return;
    for(let i=2026; i>=1950; i--) s.add(new Option(i,i));
};

window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({});
window.navBack = () => history.back();
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.openPlayer = (id) => location.href = `player.html?name=${encodeURIComponent(document.getElementById('detail-nom').textContent)}`;
