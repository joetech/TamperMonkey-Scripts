// ==UserScript==
// @name         District Order Item eBay Search Links
// @namespace    joe.district.tools
// @version      1.0.0
// @description  Hover any word in a sold item's title in a District order to get an eBay active-listings search bubble. https://github.com/joetech/TamperMonkey-Scripts
// @match        https://dashboard.district.net/*/orders*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const CFG = {
    // "#311" -> search "311"
    STRIP_HASH: true,
    // grace period so you can move from the word to the bubble
    HIDE_DELAY_MS: 250,
    LABEL: 'eBay',
    searchUrl: (kw) =>
      'https://www.ebay.com/sh/lst/active?keyword=' +
      encodeURIComponent(kw) +
      '&source=filterbar&action=search',
  };

  const TITLE_SELECTOR =
    'table[id^="OrderItemsTable"] tbody a[href*="/products/details/"] strong';

  const LEADING = CFG.STRIP_HASH ? /^[(\[{"'#]+/ : /^[(\[{"']+/;
  const TRAILING = /[)\]}"',;:!?.]+$/;

  let bubble = null;
  let activeTitle = null;
  let hideTimer = null;
  let lastEvent = null;
  let rafPending = false;

  // ---------- bubble ----------
  function getBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('a');
    bubble.target = '_blank';
    bubble.rel = 'noopener noreferrer';
    bubble.textContent = CFG.LABEL;
    Object.assign(bubble.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '2147483647',
      padding: '6px 14px',
      background: '#fff',
      color: '#2563eb',
      border: '1px solid #d0d0d8',
      borderRadius: '10px',
      boxShadow: '0 2px 8px rgba(0,0,0,.18)',
      font: '500 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      textDecoration: 'none',
      cursor: 'pointer',
      transform: 'translateX(-50%)',
    });
    bubble.addEventListener('mouseenter', cancelHide);
    bubble.addEventListener('mouseleave', scheduleHide);
    document.body.appendChild(bubble);
    return bubble;
  }

  function showBubble(word, rect, titleEl) {
    const b = getBubble();
    cancelHide();
    activeTitle = titleEl;
    const centerX = Math.min(
      Math.max(rect.left + rect.width / 2, 40),
      window.innerWidth - 40
    );
    b.href = CFG.searchUrl(word);
    b.title = 'Search eBay listings for "' + word + '"';
    b.dataset.word = word;
    b.style.left = centerX + 'px';
    b.style.top = rect.bottom + 4 + 'px';
    b.style.display = 'block';
  }

  function hideNow() {
    cancelHide();
    if (bubble) {
      bubble.style.display = 'none';
      bubble.dataset.word = '';
    }
    activeTitle = null;
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideNow, CFG.HIDE_DELAY_MS);
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  // ---------- word detection ----------
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      return p ? { node: p.offsetNode, offset: p.offset } : null;
    }
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      return r ? { node: r.startContainer, offset: r.startOffset } : null;
    }
    return null;
  }

  function wordUnderPoint(titleEl, x, y) {
    const caret = caretAt(x, y);
    if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null;
    if (!titleEl.contains(caret.node)) return null;

    const text = caret.node.data;
    const offset = Math.min(caret.offset, text.length);

    let s = offset;
    while (s > 0 && !/\s/.test(text[s - 1])) s--;
    let e = offset;
    while (e < text.length && !/\s/.test(text[e])) e++;
    if (s === e) return null;

    const raw = text.slice(s, e);
    const lead = (raw.match(LEADING) || [''])[0].length;
    const rest = raw.slice(lead);
    const trail = (rest.match(TRAILING) || [''])[0].length;
    const start = s + lead;
    const end = e - trail;
    if (end <= start) return null;

    const word = text.slice(start, end);
    if (!/[\p{L}\p{N}]/u.test(word)) return null; // skip "-", "/", etc.

    const range = document.createRange();
    range.setStart(caret.node, start);
    range.setEnd(caret.node, end);

    const tol = 2;
    for (const r of range.getClientRects()) {
      if (
        x >= r.left - tol && x <= r.right + tol &&
        y >= r.top - tol && y <= r.bottom + tol
      ) {
        return { word, rect: r };
      }
    }
    return null; // cursor is in whitespace next to the word
  }

  // ---------- events ----------
  function handleMove() {
    rafPending = false;
    const e = lastEvent;
    if (!e) return;
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (bubble && (t === bubble || bubble.contains(t))) {
      cancelHide();
      return;
    }

    const titleEl = t.closest(TITLE_SELECTOR);
    if (!titleEl) {
      if (bubble && bubble.style.display !== 'none') scheduleHide();
      return;
    }

    const hit = wordUnderPoint(titleEl, e.clientX, e.clientY);
    if (!hit) {
      if (bubble && bubble.style.display !== 'none') scheduleHide();
      return;
    }

    if (bubble && bubble.dataset.word === hit.word && bubble.style.display !== 'none') {
      cancelHide();
      return;
    }
    showBubble(hit.word, hit.rect, titleEl);
  }

  document.addEventListener(
    'mousemove',
    (e) => {
      lastEvent = e;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(handleMove);
      }
    },
    { passive: true }
  );

  // Bubble is position:fixed, so hide it if the drawer/page scrolls.
  window.addEventListener('scroll', hideNow, true);

  // Drawer closed or order swapped while the bubble is showing.
  new MutationObserver(() => {
    if (activeTitle && !activeTitle.isConnected) hideNow();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
