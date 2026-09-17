// ==UserScript==
// @name         CardBulk2 — Vinted Auto-fill
// @namespace    https://cardbulk.app
// @version      1.4
// @description  Pré-remplit le formulaire Vinted depuis un export CardBulk2
// @author       CardBulk2
// @match        https://www.vinted.fr/items/new*
// @match        https://vinted.fr/items/new*
// @match        https://www.vinted.be/items/new*
// @match        https://vinted.be/items/new*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ── Lit le hash IMMÉDIATEMENT (avant que le routeur SPA le nettoie) ────────
  const rawHash = window.location.hash;
  const hashMatch = rawHash.match(/#vd=([^&]+)/);
  if (!hashMatch) return; // Pas de données CardBulk2 → on quitte

  let draft = null;
  try {
    draft = JSON.parse(decodeURIComponent(atob(hashMatch[1])));
  } catch {
    return;
  }
  if (!draft) return;

  // Nettoie le hash de l'URL immédiatement
  history.replaceState(null, '', window.location.pathname + window.location.search);

  // ── Setter React-compatible ────────────────────────────────────────────────
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function tryFillForm() {
    let filled = 0;

    const title = document.querySelector('input[name="title"], input#title, input[data-testid="title--input"]');
    if (title) { setNativeValue(title, draft.title); filled++; }

    const desc = document.querySelector('textarea[name="descr_ut"], textarea[name="description"]');
    if (desc) { setNativeValue(desc, draft.description); filled++; }

    if (draft.price > 0) {
      const price = document.querySelector('input[name="price"], input#price, input[data-testid="price--input"]');
      if (price) { setNativeValue(price, String(draft.price)); filled++; }
    }

    return filled;
  }

  function showBanner(message, isSuccess) {
    const existing = document.getElementById('cardbulk-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'cardbulk-banner';
    banner.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 99999;
      background: ${isSuccess ? '#00b4b4' : '#f59e0b'};
      color: white; padding: 14px 20px; border-radius: 12px;
      font-family: sans-serif; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 360px;
      line-height: 1.5; cursor: pointer;
    `;
    banner.textContent = message;
    banner.onclick = () => banner.remove();
    document.body.appendChild(banner);
    setTimeout(() => banner?.remove(), 12000);
  }

  function copyToClipboard() {
    const text = [draft.title, '', draft.description, '', `Prix suggéré : ${draft.price} €`].join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  // ── Attend que le DOM soit prêt puis remplit ───────────────────────────────
  function startFilling() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const filled = tryFillForm();

      if (filled >= 2 || attempts >= 30) {
        clearInterval(interval);

        if (filled >= 2) {
          showBanner(
            `CardBulk2 ✓ — Annonce pré-remplie (${filled} champs). Ajoute les photos et vérifie avant de publier.`,
            true
          );
        } else {
          copyToClipboard();
          showBanner(
            'CardBulk2 — Champs non trouvés. Données copiées dans le presse-papier.',
            false
          );
        }
      }
    }, 400);
  }

  // Lance le remplissage dès que le body existe
  if (document.body) {
    startFilling();
  } else {
    document.addEventListener('DOMContentLoaded', startFilling);
  }

})();
