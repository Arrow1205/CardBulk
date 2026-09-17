// ==UserScript==
// @name         CardBulk2 — Vinted Auto-fill
// @namespace    https://cardbulk.app
// @version      1.0
// @description  Pré-remplit le formulaire Vinted depuis un export CardBulk2
// @author       CardBulk2
// @match        https://www.vinted.fr/items/new*
// @match        https://www.vinted.be/items/new*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'vinted_draft';

  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findInput(labelText) {
    // Cherche par placeholder
    const byPlaceholder = document.querySelector(`input[placeholder*="${labelText}"], textarea[placeholder*="${labelText}"]`);
    if (byPlaceholder) return byPlaceholder;

    // Cherche par label associé
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      if (label.textContent.includes(labelText)) {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el) return el;
        }
        const sibling = label.nextElementSibling;
        if (sibling && (sibling.tagName === 'INPUT' || sibling.tagName === 'TEXTAREA')) return sibling;
        const child = label.querySelector('input, textarea');
        if (child) return child;
      }
    }
    return null;
  }

  function tryFillForm(draft) {
    let filled = 0;

    // Titre
    const titleSelectors = [
      'input[name="title"]',
      'input[id*="title"]',
      'input[data-testid*="title"]',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) { setNativeValue(el, draft.title); filled++; break; }
    }
    if (filled === 0) {
      const el = findInput('titre') || findInput('Titre') || findInput('title');
      if (el) { setNativeValue(el, draft.title); filled++; }
    }

    // Description
    const descSelectors = [
      'textarea[name="description"]',
      'textarea[id*="description"]',
      'textarea[data-testid*="description"]',
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (el) { setNativeValue(el, draft.description); filled++; break; }
    }
    if (filled < 2) {
      const el = findInput('description') || findInput('Description');
      if (el) { setNativeValue(el, draft.description); filled++; }
    }

    // Prix
    if (draft.price > 0) {
      const priceSelectors = [
        'input[name="price"]',
        'input[id*="price"]',
        'input[data-testid*="price"]',
        'input[type="number"]',
      ];
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el) { setNativeValue(el, String(draft.price)); filled++; break; }
      }
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
      color: white; padding: 12px 18px; border-radius: 10px;
      font-family: sans-serif; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25); max-width: 340px;
      line-height: 1.4;
    `;
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 6000);
  }

  function run() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return; // Rien à remplir

    let draft;
    try {
      draft = JSON.parse(raw);
    } catch {
      return;
    }

    // Essaie immédiatement, puis réessaie jusqu'à 5s si le DOM n'est pas prêt
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const filled = tryFillForm(draft);

      if (filled >= 2 || attempts >= 10) {
        clearInterval(interval);
        localStorage.removeItem(STORAGE_KEY);

        if (filled >= 2) {
          showBanner('CardBulk2 — Annonce pré-remplie ! Vérifie les champs et ajoute les photos avant de publier.', true);
        } else {
          showBanner('CardBulk2 — Impossible de remplir automatiquement. Données copiées dans le presse-papier.', false);
          const text = `${draft.title}\n\n${draft.description}\n\nPrix suggéré : ${draft.price} €`;
          navigator.clipboard.writeText(text).catch(() => {});
        }
      }
    }, 500);
  }

  // Lance après le chargement complet de la page
  if (document.readyState === 'complete') {
    run();
  } else {
    window.addEventListener('load', run);
  }
})();
