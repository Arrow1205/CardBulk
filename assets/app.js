/* CardBulk — app.js (stable minimal)
   - Supabase REST helpers
   - Storage upload helper
   - Brand logos (local /brands/*.png)
   This file intentionally avoids any Gemini client calls.
*/

window.SB_URL = window.SB_URL || "https://tykayvplynkysqwmhkyt.supabase.co";
window.SB_KEY = window.SB_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5a2F5dnBseW5reXNxd21oa3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzQxNzYsImV4cCI6MjA4NzQxMDE3Nn0.sbRIHt_qvIBODeLLKS5DWULGmxaghUPYFtBvfFyA85o";

const SB_URL = window.SB_URL;
const SB_KEY = window.SB_KEY;

const SB_HDR = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": "Bearer " + SB_KEY,
  "Prefer": "return=representation"
};

// --- Brands (local fallback) ---
window.BRAND_LOGOS = window.BRAND_LOGOS || {
  "topps": "/brands/topps.png",
  "panini": "/brands/panini.png",
  "leaf": "/brands/leaf.png",
  "futera": "/brands/futera.png",
  "daka": "/brands/daka.png",
  "upper deck": "/brands/upper-deck.png",
  "upperdeck": "/brands/upper-deck.png",
  "upper-deck": "/brands/upper-deck.png",
};

window.loadBrandLogos = async function loadBrandLogos(){
  return window.BRAND_LOGOS;
};

function _safeJsonParse(txt){
  try{ return txt ? JSON.parse(txt) : null; }catch{ return { raw: txt }; }
}

window.sbGet = async function sbGet(table, opts={}){
  const params = opts.params || "select=*&order=created_at.desc";
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?${params}`;
  const r = await fetch(url, { headers: SB_HDR });
  const txt = await r.text();
  const d = _safeJsonParse(txt) || [];
  if(!r.ok) {
    console.error("sbGet", table, r.status, d);
    throw new Error(d?.message || `sbGet ${r.status}`);
  }
  return d;
};

window.sbInsert = async function sbInsert(table, row){
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: SB_HDR,
    body: JSON.stringify(row)
  });
  const txt = await r.text();
  const d = _safeJsonParse(txt);
  if(!r.ok) {
    console.error("sbInsert", table, r.status, d);
    throw new Error(d?.message || `sbInsert ${r.status}`);
  }
  return d;
};

window.sbUpdate = async function sbUpdate(table, id, patch){
  if(!id) throw new Error("sbUpdate: id manquant");
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: SB_HDR,
    body: JSON.stringify(patch)
  });
  const txt = await r.text();
  const d = _safeJsonParse(txt);
  if(!r.ok) {
    console.error("sbUpdate", table, r.status, d);
    throw new Error(d?.message || `sbUpdate ${r.status}`);
  }
  return d;
};

window.sbDelete = async function sbDelete(table, id){
  if(!id) throw new Error("sbDelete: id manquant");
  const url = `${SB_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: SB_HDR
  });
  if(!r.ok) {
    const txt = await r.text();
    const d = _safeJsonParse(txt);
    console.error("sbDelete", table, r.status, d);
    throw new Error(d?.message || `sbDelete ${r.status}`);
  }
  return true;
};

window.uploadPhoto = async function uploadPhoto(dataUrl, cardId, side){
  if(!dataUrl) return "";
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = (blob.type || "").includes("png") ? "png" : "jpg";
  const path = `cards/${cardId}_${side}.${ext}`;

  const putUrl = `${SB_URL}/storage/v1/object/card-photos/${path}`;
  const r = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": blob.type || "image/jpeg",
      "cache-control": "3600",
      "x-upsert": "true"
    },
    body: blob
  });
  if(!r.ok) {
    console.error("uploadPhoto", r.status, await r.text().catch(()=> ""));
    throw new Error("uploadPhoto failed");
  }
  return `${SB_URL}/storage/v1/object/public/card-photos/${path}`;
};

window.toSB = function toSB(card){
  return {
    id: card.id,
    prenom: card.prenom || "",
    nom: card.nom || "",
    club: card.club || "",
    club_emoji: card.clubEmoji || "",
    sport: card.sport || "",
    is_num: !!card.isNum,
    tags: Array.isArray(card.tags) ? card.tags : [],
    collection: card.collection || "",
    marque: card.marque || "",
    annee: card.annee || "",
    set_name: card.setName || "",
    price: Number.isFinite(card.price) ? card.price : 0,
    photo_url: card.photo || "",
    photo_verso_url: card.photoVerso || ""
  };
};

window.fromSB = function fromSB(c){
  return {
    id: String(c.id || ""),
    prenom: c.prenom || "",
    nom: c.nom || "",
    club: c.club || "",
    clubEmoji: c.club_emoji || "",
    sport: c.sport || "",
    isNum: !!c.is_num,
    tags: Array.isArray(c.tags) ? c.tags : [],
    collection: c.collection || "",
    marque: c.marque || "",
    annee: c.annee || "",
    setName: c.set_name || "",
    price: Number(c.price || 0),
    photo: c.photo_url || "",
    photoVerso: c.photo_verso_url || "",
    fav: !!c.fav,
    createdAt: c.created_at || ""
  };
};
