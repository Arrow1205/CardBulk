/* CardVault — app.js (Moteur Central) */
window.SB_URL = "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_HDR = { 
    "Content-Type": "application/json", 
    "apikey": window.SB_KEY, 
    "Authorization": "Bearer " + window.SB_KEY, 
    "Prefer": "return=representation" 
};

window.db = { cards: [], folders: [] };
window._ctxPlayer = { key: '' }; 
window._ctxClub = { club: '' }; 
window._ctxSport = { sport: '' };
window.SPORT_ICONS = { football:'⚽', basketball:'🏀', baseball:'⚾', tennis:'🎾', f1:'🏎️' };

// Bouchons de sécurité (Stubs) pour stopper les erreurs console
window.setupImageViewer = () => {}; 
window.initSportDD = () => {}; 
window.setupLiveSearch = () => {};
window._loadClubLogos = () => ({}); 
window._loadPlayerPics = () => ({});
window.sportL = (s) => String(s || '').toUpperCase();

// Logique de chargement DB
window.loadFromDB = async function() {
    try {
        const r = await fetch(`${window.SB_URL}/rest/v1/cards?select=*&order=created_at.desc`, { headers: SB_HDR });
        window.db.cards = await r.json();
        try {
            const rf = await fetch(`${window.SB_URL}/rest/v1/folders?select=*`, { headers: SB_HDR });
            window.db.folders = await rf.json();
        } catch(e) {}
        window.dispatchEvent(new CustomEvent('dbReady'));
    } catch (e) { console.error("Erreur DB:", e); }
};

window.sbUpdate = async (table, id, patch) => {
    return fetch(`${window.SB_URL}/rest/v1/${table}?id=eq.${id}`, { 
        method: "PATCH", headers: SB_HDR, body: JSON.stringify(patch) 
    });
};

document.addEventListener('DOMContentLoaded', window.loadFromDB);
