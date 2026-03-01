/* CardVault — app.js (Moteur interactif complet et robuste) */

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { 
    "Content-Type": "application/json", 
    "apikey": window.SB_KEY, 
    "Authorization": "Bearer " + window.SB_KEY, 
    "Prefer": "return=representation" 
};

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};

// ==========================================
// 2. REQUÊTES DB
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
  await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { 
      method: "DELETE", headers: SB_HDR 
  });
  return true;
};

// ==========================================
// 3. CHARGEMENT ET RENDU
// ==========================================
window.db = { cards: [], folders: [] };

window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    // Auto-detect page and render
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { 
        window.renderCollection(); 
        window.renderFolders(); 
        window.initFilters();
    }
    if (document.getElementById('view-player')) window._pagePlayer();
    if (document.getElementById('view-club')) window._pageClub();
    if (document.getElementById('view-sport')) window._pageSports();
    
  } catch (e) { console.error("Erreur DB:", e); }
};

// --- Rendu Accueil (index.html) ---
window.renderHome = function() {
  const cards = window.db.cards || [];
  document.getElementById('home-count').textContent = `${cards.length} cartes`;
  document.getElementById('home-total').textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

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
  
  // Render 3D Carousel
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

// --- Moteur 3D Carousel ---
window.init3DCarousel = function() {
  const container = document.getElementById('fav-carousel');
  if(!container) return;
  const cards = container.querySelectorAll('.fav-card');
  let currentIndex = Math.floor(cards.length / 2);
  
  window.update3D = () => {
    cards.forEach((card, i) => {
      const diff = i - currentIndex;
      const absDiff = Math.abs(diff);
      const sign = Math.sign(diff);
      card.style.transform = `translateX(${diff * 60}%) translateZ(${absDiff * -100}px) rotateY(${sign * -20}deg)`;
      card.style.zIndex = 100 - absDiff;
      card.querySelector('.fav-card-dim').style.setProperty('--dim', absDiff * 0.4);
      card.classList.toggle('active', absDiff === 0);
    });
  };
  
  window.handleCarouselClick = (el, id) => {
    const idx = parseInt(el.dataset.idx);
    if(idx === currentIndex) location.href = `card.html?id=${id}`;
    else { currentIndex = idx; window.update3D(); }
  };
  window.update3D();
};

// --- Collection & Value (collection.html) ---
window.renderCollection = function() {
  const cards = window.db.cards || [];
  const grid = document.getElementById('coll-grid');
  if(grid) {
    grid.innerHTML = cards.map(c => `
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
  document.getElementById('total-val').textContent = totalVal.toFixed(2) + " €";
  document.getElementById('total-cards').textContent = `${cards.length} cartes`;

  // Draw Pie Chart SVG
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
    const x1 = 45 + 40 * Math.cos(Math.PI * currentAngle / 180);
    const y1 = 45 + 40 * Math.sin(Math.PI * currentAngle / 180);
    currentAngle += sliceAngle;
    const x2 = 45 + 40 * Math.cos(Math.PI * currentAngle / 180);
    const y2 = 45 + 40 * Math.sin(Math.PI * currentAngle / 180);
    
    html += `<path d="M 45 45 L ${x1} ${y1} A 40 40 0 ${sliceAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}"/>`;
    legHtml += `<div class="pie-legend-item"><span class="pie-legend-dot" style="background:${colors[i % colors.length]}"></span><span class="pie-legend-name">${name}</span><span class="pie-legend-val">${val.toFixed(0)}€</span></div>`;
  });
  svg.innerHTML = html;
  legend.innerHTML = legHtml;
  document.getElementById('home-pie-wrap').style.display = 'block';
};

// ==========================================
// 4. AFFICHAGE DÉTAIL (card.html)
// ==========================================
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque-text', c.marque || "—");
  set('d-annee', c.annee || "—");
  set('d-set', c.set_name || "—");
  set('d-coll', c.collection || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");

  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

  // Ordering: Club then Sport
  const clubChip = document.getElementById('detail-club-chip');
  if(c.club && clubChip) { 
      document.getElementById('detail-club-n').textContent = c.club; 
      clubChip.style.display = 'inline-flex'; 
  }
  const sportChip = document.getElementById('detail-sport-chip');
  if(c.sport && sportChip) { 
      document.getElementById('detail-sport-label').textContent = c.sport.toUpperCase(); 
      sportChip.style.display = 'inline-flex'; 
  }
};

// ==========================================
// 5. FONCTIONS INTERACTIVES
// ==========================================
window.switchCollectionTab = function(tab) {
  document.getElementById('coll-tab-cards').classList.toggle('active', tab === 'cards');
  document.getElementById('coll-tab-value').classList.toggle('active', tab === 'value');
  document.getElementById('coll-panel-cards').style.display = tab === 'cards' ? 'block' : 'none';
  document.getElementById('coll-panel-value').style.display = tab === 'value' ? 'block' : 'none';
};

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

window.saveEdit = async function() {
    const patch = {
        prenom: document.getElementById('e-prenom').value,
        nom: document.getElementById('e-nom').value,
        marque: document.getElementById('e-marque').value,
        price: Number(document.getElementById('e-price').value)
    };
    await sbUpdate("cards", window.curCardId, patch);
    location.reload();
};

window.deleteCurrentCard = async function() {
    if(confirm("Supprimer cette carte ?")) {
        await sbDelete("cards", window.curCardId);
        location.href = 'collection.html';
    }
};

// Global Navigation
window.openSport = (s) => location.href = `sports.html?key=${encodeURIComponent(s)}`;
window.openClub = (n) => location.href = `club.html?name=${encodeURIComponent(n)}`;
window.openPlayer = () => {
    const c = window.db.cards.find(x => x.id === window.curCardId);
    if(c) location.href = `player.html?name=${encodeURIComponent(`${c.prenom} ${c.nom}`)}`;
};

// Stubs to prevent crashes
window.initFilters = () => {};
window.setupImageViewer = () => {};
window.initSportDD = () => {};
window.setupLiveSearch = () => {};
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.toggleFav = async () => {
    const c = window.db.cards.find(x => x.id === window.curCardId);
    c.fav = !c.fav;
    await sbUpdate("cards", c.id, { fav: c.fav });
    location.reload();
};
