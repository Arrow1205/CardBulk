/* CardVault — app.js (Moteur interactif complet et ultra-robuste) */

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
window.SB_URL = window.SB_URL || "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = window.SB_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;
const SB_HDR = { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Prefer": "return=representation" };

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};
window.loadBrandLogos = async function(){ return window.BRAND_LOGOS; };

// ==========================================
// 2. REQUÊTES DB
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

window._ctxPlayer = { key: '', club: '', sport: '', brand: 'all', spec: 'all' };
window._ctxClub = { club: '', brand: 'all', spec: 'all' };
window._ctxSport = { sport: '', brand: 'all', spec: 'all' };

window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) { window.db.folders = []; }
    
    initFilters(); 

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
// 4. MOTEUR DE RENDU PRINCIPAL
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
        <div class="list-thumb">${c.photo_url ? `<img src="${c.photo_url}">` : `<span style="font-size:24px;">🃏</span>`}</div>
        <div class="list-info">
          <div class="list-name">${c.prenom ? c.prenom + ' ' : ''}${c.nom || 'INCONNU'}</div>
          <div class="list-meta">${c.marque || '—'} ${c.set_name ? ' • ' + c.set_name : ''}</div>
          <div class="list-price">${c.price ? c.price + ' €' : '--'}</div>
        </div>
      </div>
    `).join('');
  }
  
  const carousel = document.getElementById('fav-carousel');
  if (carousel) {
    const favs = cards.filter(c => c.fav);
    if (favs.length === 0) {
      carousel.innerHTML = '<div class="fav-empty">Aucun favori. Cliquez sur l\'étoile d\'une carte !</div>';
    } else {
      carousel.innerHTML = favs.map((c, i) => `
        <div class="fav-card" data-idx="${i}" onclick="if(this.classList.contains('active')) location.href='card.html?id=${c.id}'">
          ${c.photo_url ? `<img src="${c.photo_url}">` : `<div>🃏</div>`}
          <div class="fav-card-dim"></div>
        </div>
      `).join('');
      setTimeout(() => window.init3DCarousel(), 50); 
    }
  }
};

window.init3DCarousel = function() {
  const container = document.getElementById('fav-carousel');
  if(!container) return;
  const cards = container.querySelectorAll('.fav-card');
  if(!cards.length) return;
  let currentIndex = Math.floor(cards.length / 2);
  
  function update() {
    cards.forEach((card, i) => {
      const diff = i - currentIndex;
      const absDiff = Math.abs(diff);
      const sign = Math.sign(diff);
      const tx = diff * 70; 
      const tz = absDiff * -80; 
      const ry = sign * -25; 
      
      card.style.transform = `translateX(${tx}%) translateZ(${tz}px) rotateY(${ry}deg)`;
      card.style.zIndex = 100 - absDiff;
      const dim = card.querySelector('.fav-card-dim');
      if(dim) dim.style.setProperty('--dim', absDiff * 0.35); 
      
      if(absDiff === 0) card.classList.add('active');
      else card.classList.remove('active');
    });
  }
  update();
  cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if(i !== currentIndex) { e.preventDefault(); currentIndex = i; update(); }
    });
  });
};

// ==========================================
// 5. AFFICHAGE CARTE INDIVIDUELLE (SÉCURISÉ)
// ==========================================
window._displayCard = function(c) {
  window.curCardId = c.id;

  // Fonction sécurisée qui ne plante JAMAIS même si l'ID HTML est absent ou mal nommé
  const safeText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  safeText('detail-prenom', c.prenom || "");
  safeText('detail-nom', c.nom || "INCONNU");
  safeText('d-marque', c.marque || "—"); 
  safeText('d-marque-text', c.marque || "—"); // Sécurité pour tes 2 versions HTML
  safeText('d-set', c.set_name || "—");
  safeText('d-annee', c.annee || "—");
  safeText('d-coll', c.collection || "—");
  safeText('d-price', c.price ? c.price + " €" : "—");

  const imgFront = document.getElementById('card-face-front');
  if (imgFront && c.photo_url) {
    imgFront.innerHTML = `<img src="${c.photo_url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
  }

  const favBtn = document.getElementById('detail-fav-btn');
  if (favBtn) {
    favBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" class="fav-star"></path></svg>`;
    if (c.fav) favBtn.classList.add('active'); else favBtn.classList.remove('active');
  }

  const clubChip = document.getElementById('detail-club-chip');
  const clubN = document.getElementById('detail-club-n') || document.getElementById('detail-club-n-chip');
  if (c.club && clubChip && clubN) { clubN.textContent = c.club; clubChip.style.display = 'inline-flex'; }

  const sportChip = document.getElementById('detail-sport-chip');
  const sportL = document.getElementById('detail-sport-label') || document.getElementById('detail-sport-label-chip');
  if (c.sport && sportChip && sportL) { sportL.textContent = c.sport.toUpperCase(); sportChip.style.display = 'inline-flex'; }

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
// 6. MOTEUR SOUS-PAGES (PLAYER, CLUB, SPORT)
// ==========================================
window.renderGenericSubPage = function(ctx, elements) {
  let filtered = window.db.cards || [];
  
  if (ctx.type === 'player') filtered = filtered.filter(c => ((c.prenom||'')+' '+c.nom).trim() === ctx.key);
  else if (ctx.type === 'club') filtered = filtered.filter(c => c.club === ctx.club);
  else if (ctx.type === 'sport') filtered = filtered.filter(c => c.sport === ctx.sport);
  
  if (ctx.brand !== 'all') filtered = filtered.filter(c => (c.marque||'').toLowerCase() === ctx.brand.toLowerCase());
  if (ctx.spec === 'auto') filtered = filtered.filter(c => c.tags && c.tags.includes('auto'));
  if (ctx.spec === 'patch') filtered = filtered.filter(c => c.tags && c.tags.includes('patch'));
  if (ctx.spec === 'rookie') filtered = filtered.filter(c => c.tags && c.tags.includes('rookie'));
  if (ctx.spec === 'num') filtered = filtered.filter(c => c.is_num);
  
  const brandRow = document.getElementById(elements.brandRow);
  if (brandRow) {
      const brands = ['all', 'Topps', 'Panini', 'Leaf', 'Daka', 'Futera'];
      brandRow.innerHTML = brands.map(b => {
          const isActive = ctx.brand === b || (ctx.brand==='all' && b==='all');
          const logo = window.BRAND_LOGOS[b.toLowerCase()];
          const content = logo ? `<img src="${logo}" class="brand-logo">` : (b==='all'?'TOUT':b);
          return `<div class="pill-tag ${isActive?'on':''}" onclick="window.setSubFilter('${ctx.type}', 'brand', '${b}')">${content}</div>`;
      }).join('');
  }
  
  const specRow = document.getElementById(elements.specRow);
  if (specRow) {
      const specs = [{k:'all',l:'TOUT'}, {k:'auto',l:'AUTO'}, {k:'patch',l:'PATCH'}, {k:'rookie',l:'ROOKIE'}, {k:'num',l:'NUMÉROTÉE'}];
      specRow.innerHTML = specs.map(s => {
          const isActive = ctx.spec === s.k;
          return `<div class="pill-tag ${isActive?'on':''}" onclick="window.setSubFilter('${ctx.type}', 'spec', '${s.k}')">${s.l}</div>`;
      }).join('');
  }
  
  const grid = document.getElementById(elements.grid);
  if (grid) {
      grid.innerHTML = filtered.map(c => `
         <div class="card-thumb" onclick="location.href='card.html?id=${c.id}'">
            ${c.photo_url ? `<img src="${c.photo_url}">` : `<div>🃏</div>`}
         </div>
      `).join('');
  }
};

window.setSubFilter = function(type, filterType, val) {
  if (type === 'player') { window._ctxPlayer[filterType] = val; window.renderPlayerPage(); }
  if (type === 'club') { window._ctxClub[filterType] = val; window.renderClubPage(); }
  if (type === 'sport') { window._ctxSport[filterType] = val; window.renderSportPage(); }
};

window.renderPlayerPage = function() {
  renderGenericSubPage({type: 'player', ...window._ctxPlayer}, { brandRow: 'player-brand-row', specRow: 'player-spec-row', grid: 'player-cards-grid' });
  const clubsRow = document.getElementById('player-clubs-row');
  if (clubsRow) {
      const baseCards = window.db.cards.filter(c => ((c.prenom||'')+' '+c.nom).trim() === window._ctxPlayer.key);
      const clubs = [...new Set(baseCards.map(c=>c.club).filter(Boolean))];
      clubsRow.innerHTML = clubs.map(cl => `<div class="club-chip" onclick="openClub('${cl}')">🛡️ ${cl}</div>`).join('');
  }
};

window.renderClubPage = function() {
  renderGenericSubPage({type: 'club', ...window._ctxClub}, { brandRow: 'club-brand-row', specRow: 'club-spec-row', grid: 'club-cards-grid' });
  const playersRow = document.getElementById('club-players-row');
  if (playersRow) {
       const baseCards = window.db.cards.filter(c => c.club === window._ctxClub.club);
       const players = [...new Set(baseCards.map(c=>((c.prenom||'')+' '+c.nom).trim()).filter(Boolean))];
       playersRow.innerHTML = players.map(p => `<div class="club-chip" onclick="location.href='player.html?name=${encodeURIComponent(p)}'">${p}</div>`).join('');
  }
};

window.renderSportPage = function() {
  renderGenericSubPage({type: 'sport', ...window._ctxSport}, { brandRow: 'sport-brand-row', specRow: 'sport-spec-row', grid: 'sport-cards-grid' });
  const clubsRow = document.getElementById('sport-clubs-row');
  if (clubsRow) {
       const baseCards = window.db.cards.filter(c => c.sport === window._ctxSport.sport);
       const clubs = [...new Set(baseCards.map(c=>c.club).filter(Boolean))];
       clubsRow.innerHTML = clubs.map(cl => `<div class="club-chip" onclick="openClub('${cl}')">🛡️ ${cl}</div>`).join('');
  }
};

// ==========================================
// 7. UTILITAIRES & AUTRES FONCTIONS
// ==========================================
window.renderCollection = function() {
  let filtered = window.db.cards || [];
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

window.switchCollectionTab = function(tab) {
  try {
    document.getElementById('coll-tab-cards')?.classList.toggle('active', tab === 'cards');
    document.getElementById('coll-tab-value')?.classList.toggle('active', tab === 'value');
    document.getElementById('coll-panel-cards').style.display = (tab === 'cards') ? 'block' : 'none';
    document.getElementById('coll-panel-value').style.display = (tab === 'value') ? 'block' : 'none';
  } catch(e) {}
};

window.initFilters = async function() {
  try {
    const logos = await loadBrandLogos();
    document.querySelectorAll('.brand-filter-btn').forEach(btn => {
      const oc = btn.getAttribute('onclick');
      if(!oc) return;
      const match = oc.match(/'([^']+)'/);
      if(match && match[1] !== 'all') {
        const b = match[1].toLowerCase();
        if(logos[b]) { btn.innerHTML = `<img src="${logos[b]}" class="brand-logo">`; btn.style.padding = '4px 10px'; }
        else btn.textContent = match[1];
      }
    });
  } catch(e) {}
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

window.homeSearch = function(val) {
  const ddHome = document.getElementById('home-search-dropdown');
  const ddColl = document.getElementById('coll-search-dropdown');
  const targetDd = ddHome || ddColl;
  if (!targetDd) return;
  if (!val) { targetDd.classList.remove('open'); return; }
  
  const term = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hits = window.db.cards.filter(c => {
    const fullName = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const club = (c.club || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return fullName.includes(term) || club.includes(term);
  }).slice(0, 5);

  targetDd.innerHTML = hits.map(c => {
    const playerName = encodeURIComponent(((c.prenom||'')+' '+(c.nom||'')).trim());
    return `
    <div class="search-drop-item" onclick="location.href='player.html?name=${playerName}'">
      <div class="search-drop-thumb" style="width:36px;height:48px;overflow:hidden;border-radius:4px;">${c.photo_url ? `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : '🃏'}</div>
      <div>
        <div class="search-drop-name">${c.prenom || ''} ${c.nom || ''}</div>
        <div class="search-drop-sub" style="font-size:12px;opacity:0.6;">${c.marque || '—'} • ${c.club || ''}</div>
      </div>
    </div>
  `}).join('');
  targetDd.classList.toggle('open', hits.length > 0);
};
window.collSearch = window.homeSearch;

document.addEventListener('click', (e) => {
  if(!e.target.closest('.search-wrap')) {
    document.getElementById('home-search-dropdown')?.classList.remove('open');
    document.getElementById('coll-search-dropdown')?.classList.remove('open');
  }
});

// REDIRECTIONS ET BOUCHONS RESTANTS
window.toggleFav = async function() {
  const c = window.db.cards.find(x => String(x.id) === String(window.curCardId));
  if (!c) return;
  c.fav = !c.fav; 
  const favBtn = document.getElementById('detail-fav-btn');
  if (favBtn) { if (c.fav) favBtn.classList.add('active'); else favBtn.classList.remove('active'); }
  try { await sbUpdate("cards", c.id, { fav: c.fav }); } catch (e) { console.error("Erreur save fav", e); }
};

window.openPlayer = function(id) {
  if(!id && !window.curCardId) return;
  const targetId = id || window.curCardId;
  const c = window.db.cards.find(x => String(x.id) === String(targetId));
  if(c) location.href = `player.html?name=${encodeURIComponent(((c.prenom||'')+' '+(c.nom||'')).trim())}`;
};
window.openClub = function(club) {
  if(club) location.href = `club.html?name=${encodeURIComponent(club)}`;
};
window.openSport = function(sport) {
  if(sport) location.href = `sports.html?key=${encodeURIComponent(sport)}`;
};

window.sportL = function(s) { return String(s).toUpperCase(); };
window._loadPlayerPics = function() { return {}; };
window._loadClubLogos = function() { return {}; };
window.getClubLogoB64 = function() { return ""; };
window._setPlayerHeroSrc = function(src) {
  const img = document.getElementById('player-hero-img');
  if(img && src) img.src = src;
};
window.showToast = function(msg) { console.log(msg); };

const stubs = [
  "setupImageViewer", "initSportDD", "setupLiveSearch", "toggleSportDD", "flipCard", "openPlayerStats", 
  "cancelBulk", "executeBulk", "deleteCurrentCard", "handleEditPhoto", "openCrop", "editCurrentCard",
  "onEditSportChange", "clubSearch", "eTogTag", "onMarqueChange", "onEditCollChange", "saveEdit", "selEmoji", 
  "cropResetEnhance", "closeCrop", "applyCrop", "triggerPlayerPhoto", "onPlayerPhotoPicked", "openSportFromChip", 
  "openClubFromChip", "triggerClubLogo", "onClubLogoPicked", "toggleBulk", "onSportChange", "updateSportIcon", 
  "showCreateClubForm", "createFolder", "toggleTag", "toggleNum"
];
stubs.forEach(fn => { window[fn] = window[fn] || function() { console.log(`Fonction ${fn}() en cours de dev.`); }; });
