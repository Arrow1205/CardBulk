/* CardVault — app.js (Stable & Fix Tags/Edit) */

// --- CONFIG ---
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";
const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };
window._ctxPlayer = { key: '' }; window._ctxClub = { club: '' }; window._ctxSport = { sport: '' };

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// --- DB ACTIONS ---
window.sbGet = async function(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`, { headers: SB_HDR });
  return _safeJsonParse(await r.text()) || [];
};

window.sbUpdate = async function(table, id, patch){
  const r = await fetch(`${window.SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) });
  return _safeJsonParse(await r.text());
};

// --- CHARGEMENT ---
window.loadFromDB = async function() {
  try {
    window.db.cards = await sbGet("cards");
    try { window.db.folders = await sbGet("folders"); } catch(e) {}
    
    if (document.getElementById('page-home')) window.renderHome();
    if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
    if (document.getElementById('view-player')) window.renderPlayerPage();
    if (document.getElementById('view-club')) window.renderClubPage();
    if (document.getElementById('view-sport')) window.renderSportPage();
  } catch (e) { console.error("DB Error", e); }
};

// --- CARD DETAIL & TAGS (FIX DISPARITION) ---
window._displayCard = function(c) {
  window.curCardId = c.id;
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  
  set('detail-prenom', c.prenom || "");
  set('detail-nom', c.nom || "INCONNU");
  set('d-marque', c.marque || "—");
  set('d-price', (c.price || 0).toFixed(2) + " €");

  const img = document.getElementById('card-face-front');
  if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

  // Ré-affichage forcé des tags
  const clubChip = document.getElementById('detail-club-chip');
  if(c.club && clubChip) { 
      const n = document.getElementById('detail-club-n');
      if(n) n.textContent = c.club;
      clubChip.style.display = 'inline-flex'; 
  }
  
  const sportChip = document.getElementById('detail-sport-chip');
  if(c.sport && sportChip) { 
      const l = document.getElementById('detail-sport-label');
      if(l) l.textContent = c.sport.toUpperCase();
      sportChip.style.display = 'inline-flex'; 
  }
};

// --- MODIFICATION (VIA SCANNER) ---
window.editCurrentCard = function() {
  // On passe l'ID à la page scanner pour qu'elle passe en mode "Edition"
  location.href = `scanner.html?edit=${window.curCardId}`;
};

// --- STUBS & COMPATIBILITÉ ---
window.navBack = () => history.back();
window.closeDetail = () => location.href='collection.html';
window.populateYears = (id) => { const s=document.getElementById(id); if(s) for(let i=2026;i>=1950;i--) s.add(new Option(i,i)); };
window.renderHome = () => {}; window.renderCollection = () => {}; window.renderFolders = () => {};
window.sportL = (s) => String(s).toUpperCase(); window._loadClubLogos = () => ({});
