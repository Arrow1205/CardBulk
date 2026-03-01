/* CardVault — app.js (Version Finale Stabilisée) */

// 1. CONFIGURATION ET VARIABLES GLOBALES
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";
const SB_HDR = { "Content-Type": "application/json", "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Prefer": "return=representation" };

window.db = { cards: [], folders: [] };
window._ctxPlayer = { key: '' }; window._ctxClub = { club: '' }; window._ctxSport = { sport: '' };

window.BRAND_LOGOS = {
  "topps": "/brands/topps.png", "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png", "futera": "/brands/futera.png",
  "daka": "/brands/daka.png", "upper deck": "/brands/upper-deck.png"
};
window.SPORT_ICONS = { football: '⚽', basketball: '🏀', baseball: '⚾', tennis: '🎾', f1: '🏎️' };

function _safeJsonParse(txt){ try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; } }

// 2. FONCTIONS DE RENDU (Déclarées en haut pour éviter les erreurs TypeError)
window.renderFolders = function() {
    const grid = document.getElementById('folders-grid');
    if(grid) grid.innerHTML = (window.db.folders || []).map(f => `<div class="folder-card" style="min-width:140px;"><div class="folder-emoji">${f.emoji || '📁'}</div><div class="folder-name">${f.name}</div></div>`).join('');
};

window.renderCollection = function() {
    const grid = document.getElementById('coll-grid');
    if(grid) grid.innerHTML = (window.db.cards || []).map(c => `<div class="coll-thumb" onclick="location.href='card.html?id=${c.id}'"><img src="${c.photo_url || ''}"></div>`).join('');
};

// 3. CHARGEMENT BASE DE DONNÉES
window.loadFromDB = async function() {
    try {
        const r = await fetch(`${window.SB_URL}/rest/v1/cards?select=*&order=created_at.desc`, { headers: SB_HDR });
        window.db.cards = await r.json();
        try { const rf = await fetch(`${window.SB_URL}/rest/v1/folders?select=*`, { headers: SB_HDR }); window.db.folders = await rf.json(); } catch(e){}
        
        if (document.getElementById('page-home')) window.renderHome();
        if (document.getElementById('page-collection')) { window.renderCollection(); window.renderFolders(); }
        if (document.getElementById('view-player')) window.renderPlayerPage();
        if (document.getElementById('view-club')) window.renderClubPage();
        if (document.getElementById('view-sport')) window.renderSportPage();
    } catch (e) { console.error("Erreur DB", e); }
};

// 4. DÉTAIL CARTE ET NAVIGATION
window._displayCard = function(c) {
    window.curCardId = c.id;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set('detail-prenom', c.prenom || "");
    set('detail-nom', c.nom || "INCONNU");
    set('d-marque', c.marque || "—");
    set('d-price', (Number(c.price) || 0).toFixed(2) + " €");

    const img = document.getElementById('card-face-front');
    if(img && c.photo_url) img.innerHTML = `<img src="${c.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;

    // Gestion des tags Club et Sport (cliquables)
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

// 5. MODIFICATION (Redirection vers le Scanner)
window.editCurrentCard = function() {
    const id = new URLSearchParams(window.location.search).get('id');
    if(!id) return;
    location.href = `scanner.html?edit=${id}`;
};

// 6. UTILITAIRES ET COMPATIBILITÉ (Stubs pour stopper les ReferenceError)
window.populateYears = (id) => { const s=document.getElementById(id); if(s) for(let i=2026;i>=1950;i--) s.add(new Option(i,i)); };
window.sportL = (s) => String(s).toUpperCase();
window._loadClubLogos = () => ({}); 
window._loadPlayerPics = () => ({});
window.setupImageViewer = () => {}; 
window.initSportDD = () => {};
window.setupLiveSearch = () => {};
window.navBack = () => history.back();
window.sbUpdate = async (t, id, p) => fetch(`${window.SB_URL}/rest/v1/${t}?id=eq.${id}`, { method: "PATCH", headers: SB_HDR, body: JSON.stringify(p) });
window.sbInsert = async (t, r) => fetch(`${window.SB_URL}/rest/v1/${t}`, { method: "POST", headers: SB_HDR, body: JSON.stringify(r) });
window.toSB = (c) => ({ prenom:c.prenom, nom:c.nom, club:c.club, sport:c.sport, marque:c.marque, set_name:c.set_name, collection:c.collection, price:c.price });
window.uploadPhoto = async (d, id, s) => {
  if(!d || !d.startsWith('data:')) return d;
  const blob = await (await fetch(d)).blob();
  const path = `cards/${id}_${s}.jpg`;
  await fetch(`${window.SB_URL}/storage/v1/object/card-photos/${path}`, {
    method: "PUT", headers: { "apikey": window.SB_KEY, "Authorization": "Bearer " + window.SB_KEY, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob
  });
  return `${window.SB_URL}/storage/v1/object/public/card-photos/${path}`;
};
