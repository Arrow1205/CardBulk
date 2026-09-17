// ==UserScript==
// @name         CardBulk2 — Vinted Auto-fill
// @namespace    https://cardbulk.app
// @version      1.3
// @description  Pré-remplit le formulaire Vinted depuis un export CardBulk2
// @author       CardBulk2
// @match        https://www.vinted.fr/items/new*
// @match        https://vinted.fr/items/new*
// @match        https://www.vinted.be/items/new*
// @match        https://vinted.be/items/new*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ── Lecture des données depuis le hash de l'URL ────────────────────────────
  function getDraftFromHash() {
    const hash = window.location.hash; // ex: #vd=BASE64
    const match = hash.match(/#vd=([^&]+)/);
    if (!match) return null;
    try {
      return JSON.parse(decodeURIComponent(atob(match[1])));
    } catch {
      return null;
    }
  }

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

function tryFillForm(draft) {
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
    setTimeout(() => banner?.remove(), 10000);
  }

  function copyToClipboard(draft) {
    const text = [
      draft.title,
      '',
      draft.description,
      '',
      `Prix suggéré : ${draft.price} €`,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Logique principale : réessaie jusqu'à ce que le formulaire soit prêt ──
  function run() {
    const draft = getDraftFromHash();
    if (!draft) return; // Pas de données CardBulk2 dans l'URL

    // Nettoie le hash de l'URL sans recharger la page
    history.replaceState(null, '', window.location.pathname + window.location.search);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const filled = tryFillForm(draft);

      if (filled >= 2 || attempts >= 20) {
        clearInterval(interval);

        if (filled >= 2) {
          showBanner(
            `CardBulk2 ✓ — Annonce pré-remplie (${filled} champs). Ajoute les photos et vérifie le prix avant de publier.`,
            true
          );
        } else {
          copyToClipboard(draft);
          showBanner(
            'CardBulk2 — Impossible de remplir les champs automatiquement. Données copiées dans le presse-papier.',
            false
          );
        }
      }
    }, 500);
  }

  if (document.readyState === 'complete') {
    setTimeout(run, 800); // Petite attente pour que React hydrate
  } else {
    window.addEventListener('load', () => setTimeout(run, 800));
  }
})();
