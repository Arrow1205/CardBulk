/* CardVault — app.js (Moteur Maître : Correction Modification, 3D Auto, Filtres & Contextes) */

// ==========================================
// 1. CONFIGURATION & ÉTAT GLOBAL
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };
window.activeBrand = 'all';
window.activeType = 'all';

// Initialisation des contextes pour éviter les ReferenceError (Captures 13.53.11 / 13.53.25)
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
// 2. REQUÊTES DB (RÉELLES)
// ==========================================
window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { 
    method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) 
  });
  return _safeJsonParse(await r.text());
};

window.sbDelete = async function(table, id){
  await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: SB_HDR });
  return true;
};

// ==========================================
// 3. CHARGEMENT ET RENDU GLOBAL
// ==========================================
window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    // Rendu automatique selon la page détectée (Fix TypeError Capture 14.03.21 / 14.11.44)
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { 
        window.renderCollection(); 
        window.renderFolders(); 
        window.initFilters();
    }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club'))   window.renderClubPage();
    if (document.getElementById('view-sport'))  window.renderSportPage();

  } catch (e) { console.error("Erreur DB:", e); }
};

window.populateYears = function(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  for (let i = 2026; i >= 1950; i--) {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = i; select.appendChild(opt);
  }
};

// ==========================================
// 4. ACCUEIL & CAROUSEL 3D AUTO
// ==========================================
window.renderHome = function() {
  const cards = window.db.cards || [];
  const elCount = document.getElementById('home-count');
  const elTotal = document.getElementById('home-total');
  if(elCount) elCount.textContent = `${cards.length} cartes`;
  if(elTotal) elTotal.textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

  const list = document.getElementById('recent-list');
  if (list) {
    list.innerHTML = cards.slice(0, 10).map(c => `
      <div class="list-item" onclick="location.href='card.html?id=${c.id}'">
        <div class="list-thumb">${c.photo_url ? `<img src="${c.photo_url}">` : `<span>🃏</span>`}</div>
        <div class="list-info">
          <div class="list-name">${c.prenom || ''} ${c.nom || 'INCONNU'}</div>
          <div class="list-meta">${c.marque || '—'} ${c.set_name ? ' • '+c.set_name : ''}</div>
          <div class="list-price">${c.price ? c.price + ' €' : '--'}</div>
        </div>
      </div>
    `).join('');
  }
  
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
  if(!cards.length) return;

  let currentIndex = Math.floor(cards.length / 2);
  let autoTimer = null;

  window.update3D = () => {
    cards.forEach((card, i) => {
      const diff = i - currentIndex;
      const absDiff = Math.abs(diff);
      const sign = Math.sign(diff);
      card.style.transform = `translateX(${diff * 65}%) translateZ(${absDiff * -120}px) rotateY(${sign * -25}deg)`;
      card.style.zIndex = 100 - absDiff;
      card.style.opacity = absDiff > 2 ? 0 : 1;
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
    const idx = parseInt(el.dataset.idx);
    if(idx === currentIndex) location.href = `card.html?id=${id}`;
    else { currentIndex = idx; window.update3D(); startAuto(); }
  };

  window.update3D();
  startAuto();
};

// ==========================================
// 5. COLLECTION & VALEUR (PIE CHART)
// ==========================================
window.renderCollection = function() {
  let filtered = window.db.cards || [];
  if (window.activeBrand !== 'all') filtered = filtered.filter(c => (c.marque || '').toLowerCase() === window.activeBrand.toLowerCase());
  const grid = document.getElementById('coll-grid');
  if(grid) {
    grid.innerHTML = filtered.map(c => `
      <div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'">
        <img src="${c.photo_url || ''}">
      </div>
    `).join('');
  }
  window.renderValueTab();
};

window.renderValueTab = function() {
  const cards = window.db.cards || [];
  const totalVal = cards.reduce((s, c) => s + Number(c.price || 0), 0);
  const elVal = document.getElementById('total-val');
  if(elVal) elVal.textContent = totalVal.toFixed(2) + " €";

  const brands = {};
  cards.forEach(c => { const b = c.marque || 'Autre'; brands[b] = (brands[b] || 0) + Number(c.price || 0); });
  
  const svg = document.getElementById('pie-svg');
  const legend = document.getElementById('pie-legend');
  if(!svg || totalVal === 0) return;

  let currentAngle = 0;
  const colors = ['#AFFF25', '#3d6fff', '#f87171', '#6ee7b7', '#f9a8d4'];
  let html = '', legHtml = '';

  Object.entries(brands).forEach(([name, val], i) => {
    const sliceAngle = (val / totalVal) * 360;
    const r = 40, cx = 45, cy = 45;
    const x1 = cx + r * Math.cos(Math.PI * currentAngle / 180);
    const y1 = cy + r * Math.sin(Math.PI * currentAngle / 180);
    currentAngle += sliceAngle;
    const x2 = cx + r * Math.cos(Math.PI * currentAngle / 180);
    const y2 = cy + r * Math.sin(Math.PI * currentAngle / 180);
    html += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sliceAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
    legHtml += `<div class="pie-legend-item"><span class="pie-legend-dot" style="background:${colors[i % colors.length]}"></span><span class="pie-legend-name">${name}</span><span class="pie-legend-val">${val.toFixed(0)}€</span></div>`;
  });
  svg.innerHTML = html; legend.innerHTML = legHtml;
  document.getElementById('home-pie-wrap').style.display = 'block';
};

// ==========================================
// 6. MODIFICATION & SUPPRESSION RÉELLE (Fix Capture 13.45.46)
// ==========================================
window.editCurrentCard = function() {
  const c = window.db.cards.find(x => String(x.id) === String(window.curCardId));
  if (!c) return;
  document.getElementById('e-prenom').value = c.prenom || '';
  document.getElementById('e-nom').value = c.nom || '';
  document.getElementById('e-marque').value = c.marque || '';
  document.getElementById('e-price').value = c.price || 0;
  const sheet = document.getElementById('edit-sheet');
  if (sheet) sheet.classList.add('open');
};

window.saveEdit = async function() {
    const prenom = document.getElementById('e-prenom').value;
    const nom = document.getElementById('e-nom').value;
    const marque = document.getElementById('e-marque').value;
    const price = Number(document.getElementById('e-price').value);

    const patch = { prenom, nom, marque, price };
    try {
        await sbUpdate("cards", window.curCardId, patch);
        const idx = window.db.cards.findIndex(c => c.id === window.curCardId);
        if (idx > -1) window.db.cards[idx] = { ...window.db.cards[idx], ...patch };
        location.reload(); 
    } catch (e) { alert("Erreur de sauvegarde."); }
};

// ==========================================
// 7. RENDU SOUS-PAGES (Fix Cards invisibles)
// ==========================================
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
// 8. COMPATIBILITÉ & UTILS (Fix ReferenceErrors)
// ==========================================
window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({});
window._loadPlayerPics = () => ({});
window._setPlayerHeroSrc = () => {};

window.renderFolders = function() {
    const grid = document.getElementById('folders-grid');
    if(!grid) return;
    grid.innerHTML = (window.db.folders || []).map(f => `<div class="folder-card" style="min-width:140px; flex-shrink:0;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>`).join('');
};

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

window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque-text', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");
  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
};

window.navBack = () => history.back();
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.openPlayer = (id) => {
    const c = window.db.cards.find(x => x.id === (id || window.curCardId));
    if(c) location.href = `player.html?name=${encodeURIComponent(`${c.prenom} ${c.nom}`.trim())}`;
};
window.setBrandFilter = (b, btn) => { window.activeBrand = b; window.renderCollection(); };
window.setTypeFilter = (t, btn) => { window.activeType = t; window.renderCollection(); };
window.switchCollectionTab = (t) => {
    document.getElementById('coll-tab-cards')?.classList.toggle('active', t==='cards');
    document.getElementById('coll-tab-value')?.classList.toggle('active', t==='value');
    document.getElementById('coll-panel-cards').style.display = t==='cards' ? 'block' : 'none';
    document.getElementById('coll-panel-value').style.display = t==='value' ? 'block' : 'none';
};

// Stubs restant pour compatibilité design
window.toggleSportDD = () => {}; window.setupImageViewer = () => {}; window.initSportDD = () => {}; window.setupLiveSearch = () => {}; window.homeSearch = () => {}; window.collSearch = () => {}; window.toggleFav = async () => {};
window.deleteCurrentCard = async () => { if(confirm("Supprimer ?")) { await sbDelete("cards", window.curCardId); location.href='collection.html'; } };
