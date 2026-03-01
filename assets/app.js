/* CardVault — app.js (Moteur complet corrigé : Carousel Auto, Filtres & Contextes) */

// ==========================================
// 1. CONFIGURATION & ETAT GLOBAL
// ==========================================
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };

// --- Correction ReferenceError (Captures 13.53.11 / 13.53.25) ---
window._ctxPlayer = { key: '', brand: 'all', spec: 'all' };
window._ctxClub = { club: '', brand: 'all', spec: 'all' };
window._ctxSport = { sport: '', brand: 'all', spec: 'all' };

window.activeBrand = 'all';
window.activeType = 'all';

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

window.sbDelete = async function(table, id){
  await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: SB_HDR });
  return true;
};

// ==========================================
// 3. CHARGEMENT INITIAL (Capture 13.47.00)
// ==========================================
window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { 
        window.renderCollection(); 
        window.renderFolders(); 
    }
  } catch (e) { console.error("Erreur DB:", e); }
};

// --- Correction ReferenceError (Capture 13.54.38) ---
window.populateYears = function(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentYear = new Date().getFullYear() + 1;
  for (let i = currentYear; i >= 1950; i--) {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = i; select.appendChild(opt);
  }
};

// ==========================================
// 4. ACCUEIL & CAROUSEL 3D AUTO
// ==========================================
window.renderHome = function() {
  const cards = window.db.cards || [];
  const homeCount = document.getElementById('home-count');
  const homeTotal = document.getElementById('home-total');
  
  if (homeCount) homeCount.textContent = `${cards.length} cartes`;
  if (homeTotal) homeTotal.textContent = cards.reduce((s, c) => s + Number(c.price || 0), 0).toFixed(2) + " €";

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
    autoTimer = setInterval(() => {
      currentIndex = (currentIndex + 1) % cards.length;
      window.update3D();
    }, 5000); // 5 sec
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
// 5. FILTRES & COLLECTION (Capture 13.55.18)
// ==========================================
window.renderCollection = function() {
  let filtered = window.db.cards || [];
  if (window.activeBrand !== 'all') filtered = filtered.filter(c => (c.marque || '').toLowerCase() === window.activeBrand.toLowerCase());
  if (window.activeType === 'auto') filtered = filtered.filter(c => c.tags && c.tags.includes('auto'));
  if (window.activeType === 'patch') filtered = filtered.filter(c => c.tags && c.tags.includes('patch'));
  if (window.activeType === 'rookie') filtered = filtered.filter(c => c.tags && c.tags.includes('rookie'));
  if (window.activeType === 'num') filtered = filtered.filter(c => c.is_num);

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

window.setBrandFilter = function(brand, btn) {
    document.querySelectorAll('.brand-filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    window.activeBrand = brand; window.renderCollection();
};

window.setTypeFilter = function(type, btn) {
    document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    window.activeType = type; window.renderCollection();
};

window.toggleSportDD = function(e) {
    const menu = document.getElementById('sport-dd-menu');
    if(menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

// ==========================================
// 6. VALEUR & PIE CHART
// ==========================================
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
  svg.innerHTML = html;
  legend.innerHTML = legHtml;
  document.getElementById('home-pie-wrap').style.display = 'block';
};

window.renderFolders = function() {
    const grid = document.getElementById('folders-grid');
    if(!grid) return;
    grid.innerHTML = (window.db.folders || []).map(f => `
        <div class="folder-card" style="min-width:140px; flex-shrink:0;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>
    `).join('');
};

// ==========================================
// 7. CARD DETAIL (card.html)
// ==========================================
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque-text', c.marque || "—");
  set('d-marque', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");

  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

  const clubChip = document.getElementById('detail-club-chip');
  if(c.club && clubChip) { 
      document.getElementById('detail-club-n').textContent = c.club; 
      clubChip.style.display = 'inline-flex'; 
      clubChip.onclick = () => location.href = `club.html?name=${encodeURIComponent(c.club)}`;
  }
  const sportChip = document.getElementById('detail-sport-chip');
  if(c.sport && sportChip) { 
      document.getElementById('detail-sport-label').textContent = c.sport.toUpperCase(); 
      sportChip.style.display = 'inline-flex'; 
      sportChip.onclick = () => location.href = `sports.html?key=${encodeURIComponent(c.sport)}`;
  }
};

// ==========================================
// 8. NAVIGATION & UTILS
// ==========================================
window.navBack = () => history.back();
window.closeSheet = (id) => document.getElementById(id).classList.remove('open');
window.openPlayer = (id) => {
    const c = window.db.cards.find(x => x.id === (id || window.curCardId));
    if(c) location.href = `player.html?name=${encodeURIComponent(`${c.prenom} ${c.nom}`.trim())}`;
};

window.switchCollectionTab = (tab) => {
    document.getElementById('coll-tab-cards')?.classList.toggle('active', tab === 'cards');
    document.getElementById('coll-tab-value')?.classList.toggle('active', tab === 'value');
    document.getElementById('coll-panel-cards').style.display = tab === 'cards' ? 'block' : 'none';
    document.getElementById('coll-panel-value').style.display = tab === 'value' ? 'block' : 'none';
};

// Stubs techniques
window.initFilters = () => {}; window.setupImageViewer = () => {}; window.initSportDD = () => {}; window.setupLiveSearch = () => {}; window.homeSearch = () => {}; window.collSearch = () => {}; window.toggleFav = async () => {};
