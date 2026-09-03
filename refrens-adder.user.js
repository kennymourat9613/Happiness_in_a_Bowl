// ==UserScript==
// @name         Happiness in a Bowl → Refrens item adder
// @namespace    hib-refrens
// @version      1.0.0
// @description  Auto-creates queued catering items in the Refrens Items catalog, hands-free.
// @match        *://*.refrens.com/app/happiness-in-a-bowl-ltd/inventory*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var QKEY = 'hib_refrens_queue';
  var NEW_URL = 'https://www.refrens.com/app/happiness-in-a-bowl-ltd/inventory/new';
  var NEW_PATH_RE = /\/inventory\/new/;
  var FORM_READY_TIMEOUT_MS = 8000;
  var FORM_READY_POLL_MS = 150;
  var PRICING_EXPAND_TIMEOUT_MS = 4000;
  var PRICING_EXPAND_POLL_MS = 150;
  var SAVE_POLL_TIMEOUT_MS = 8000;
  var SAVE_POLL_INTERVAL_MS = 250;
  var MAX_CONSECUTIVE_ERRORS = 3;

  /* ─── Debug logger (visible in DevTools console) ─── */
  function hlog(msg) {
    try { console.log('[HIB adder] ' + msg); } catch (e) { /* ignore */ }
  }

  /* ─── Patch the page's own item-create save request in-flight ───
   * Refrens' React form will not reliably commit a programmatically-set
   * Selling Price by any DOM method, but item name and SKU DO save. Rather
   * than calling a separate (paid) API, we intercept the page's own
   * `POST .../inventories` request — the same one Save always sends, same
   * session/auth — and inject the correct sellingPrice into ITS body before
   * it goes out. Falls back to sending the original, unmodified body on any
   * error, so a bug here can never break the save. Never reads or logs
   * Authorization headers or tokens. ─── */
  (function installSaveLogger() {
    try {
      var origOpen = XMLHttpRequest.prototype.open;
      var origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__hibUrl = url;
        this.__hibMethod = method;
        return origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        try {
          if (this.__hibUrl && /\/inventories(\b|\?|$)/.test(this.__hibUrl) && (this.__hibMethod || '').toUpperCase() === 'POST') {
            try {
              var parsed = JSON.parse(body);
              var originalValue = parsed.sellingPrice;
              var q = getQueue();
              var match = null;
              if (q && Array.isArray(q.items)) {
                for (var i = 0; i < q.items.length; i++) {
                  if (q.items[i].n === parsed.name) { match = q.items[i]; break; }
                }
                if (!match) {
                  for (var j = 0; j < q.items.length; j++) {
                    if (q.items[j].status === 'active') { match = q.items[j]; break; }
                  }
                }
              }
              if (match && match.p !== undefined && match.p !== null && !isNaN(Number(match.p))) {
                parsed.sellingPrice = Number(match.p);
                hlog('SAVE patch: name=' + parsed.name + ' sellingPrice ' + JSON.stringify(originalValue) + ' -> ' + parsed.sellingPrice);
                return origSend.call(this, JSON.stringify(parsed));
              }
              hlog('SAVE patch: name=' + parsed.name + ' sellingPrice ' + JSON.stringify(originalValue) + ' -> (no queue match, unchanged)');
            } catch (e) {
              hlog('SAVE patch: skipped (parse/lookup error), sending original body');
            }
          }
        } catch (e) { /* ignore */ }
        return origSend.call(this, body);
      };
    } catch (e) { /* ignore */ }
  })();

  /* ─── React-safe native input setter ─── */
  function setNative(el, val) {
    try {
      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      /* ignore */
    }
  }

  /* ─── Enter a value the way a real user types it, via execCommand
   * insertText, which fires a native `input` event React reliably commits.
   * setNative's synthetic dispatch is not enough for some inputs (observed:
   * Selling Price saves blank even though DOM read-back shows the value).
   * Falls back to setNative if execCommand is unavailable/ineffective. ─── */
  function typeIntoInput(el, value) {
    try { el.focus(); } catch (e) {}
    try { el.select && el.select(); } catch (e) {}
    var typed = false;
    try {
      // select existing content and replace via execCommand insertText -> native input event
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      typed = document.execCommand('insertText', false, String(value));
    } catch (e) { typed = false; }
    // Fallback to the native setter if execCommand is unavailable/ineffective
    if (!typed || String(el.value) !== String(value)) {
      setNative(el, String(value));
    }
    try { el.blur(); } catch (e) {}
  }

  /* ─── Queue persistence (guarded) ─── */
  function getQueue() {
    try {
      var raw = localStorage.getItem(QKEY);
      if (!raw) return null;
      var q = JSON.parse(raw);
      if (q && Array.isArray(q.items)) return q;
      return null;
    } catch (e) {
      return null;
    }
  }

  function saveQueue(q) {
    try {
      localStorage.setItem(QKEY, JSON.stringify(q));
    } catch (e) {
      /* ignore */
    }
  }

  function clearQueue() {
    try {
      localStorage.removeItem(QKEY);
    } catch (e) {
      /* ignore */
    }
  }

  /* ─── Clipboard queue loader ─── */
  function loadFromClipboard() {
    try {
      navigator.clipboard.readText().then(
        function (text) {
          if (!text || text.indexOf('HIBQ:') !== 0) {
            setPanelNotice('Clipboard does not contain a HIBQ: queue. Copy items from the app first.');
            return;
          }
          try {
            var items = JSON.parse(text.slice(5));
            var q = {
              items: items.map(function (i) {
                return { n: i.n, s: i.s, p: i.p, status: 'pending' };
              }),
              running: false,
              startedAt: Date.now(),
            };
            saveQueue(q);
            setPanelNotice('Loaded ' + q.items.length + ' item(s) from clipboard.');
            renderPanel();
          } catch (e) {
            setPanelNotice('Could not parse clipboard queue: ' + (e && e.message ? e.message : e));
          }
        },
        function (err) {
          setPanelNotice('Clipboard read failed: ' + (err && err.message ? err.message : err) + '. Try copying the queue again.');
        }
      );
    } catch (e) {
      setPanelNotice('Clipboard API unavailable in this context.');
    }
  }

  var panelNotice = '';
  function setPanelNotice(msg) {
    panelNotice = msg || '';
    renderPanel();
  }

  /* ─── Form field discovery helpers ─── */
  function findNameInput() {
    return document.querySelector('input[placeholder="Enter name of your item"]');
  }

  function isTextLikeInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    var type = (el.getAttribute('type') || 'text').toLowerCase();
    return type === 'text' || type === '';
  }

  function findSkuInput() {
    // Strategy 1 (primary): the SKU input is the next text-like input in
    // document order immediately after the name input.
    var nameInput = findNameInput();
    if (nameInput) {
      var all = Array.prototype.slice.call(document.querySelectorAll('input'));
      var nameIdx = all.indexOf(nameInput);
      if (nameIdx !== -1) {
        for (var i = nameIdx + 1; i < all.length; i++) {
          if (isTextLikeInput(all[i])) return all[i];
        }
      }
    }

    // Strategy 2 (secondary): find a leaf labeled "SKU ID" and look for a
    // text-like input within a few ancestor levels of it.
    var label = findLeafByText(/^SKU\s*ID$/i);
    if (label) {
      var container = label;
      for (var level = 0; level < 4 && container; level++) {
        container = container.parentElement;
        if (!container) break;
        var input = container.querySelector('input');
        if (isTextLikeInput(input)) return input;
      }
    }

    // Strategy 3 (tertiary): fall back to the old numeric-auto-SKU heuristic
    // (covers the empty-name case where the auto-SKU is still numeric).
    var textInputs = Array.prototype.slice.call(document.querySelectorAll('input[type="text"]'));
    for (var j = 0; j < textInputs.length; j++) {
      if (/^\d{6,}$/.test(textInputs[j].value)) return textInputs[j];
    }
    return null;
  }

  function findLeafByText(re) {
    var allEls = document.querySelectorAll('*');
    for (var i = 0; i < allEls.length; i++) {
      var el = allEls[i];
      if (el.children.length === 0 && re.test(el.textContent || '')) return el;
    }
    return null;
  }

  function findSoldCheckbox() {
    var leaf = findLeafByText(/can be sold to customers/i);
    if (!leaf) return null;
    var container = leaf.closest('div');
    var cb = container ? container.querySelector('input[type="checkbox"]') : null;
    if (!cb && container && container.parentElement) cb = container.parentElement.querySelector('input[type="checkbox"]');
    return cb;
  }

  function findPricingToggle() {
    return findLeafByText(/2\.\s*Pricing\s*&\s*Taxation/i);
  }

  function findSellingPriceInput() {
    // The Pricing & Taxation number inputs are all rendered into the DOM even
    // while the section is collapsed (merely CSS-hidden), and their labels
    // are not in the inputs' ancestor chain (grid layout), so label-based
    // lookup does not work. Confirmed field order among the number inputs:
    // index 0 = Buying Price, index 1 = Selling Price.
    var numberInputs = document.querySelectorAll('input[type="number"]');
    return numberInputs.length > 1 ? numberInputs[1] : null;
  }

  function isVisible(el) {
    return !!(el && el.offsetParent !== null);
  }

  /* ─── Ancestor-based expanded check ───
   * The Selling Price input's OWN offsetHeight stays 36 even while the section
   * is collapsed (border-box, unaffected by an ancestor's overflow clipping),
   * so offsetParent/boundingRect checks on the input itself false-positive as
   * "visible" while collapsed. The reliable signal is an ancestor collapser
   * panel with height:0 (offsetHeight === 0). */
  function isPricingExpanded() {
    var el = findSellingPriceInput();
    if (!el) return false;
    var p = el.parentElement;
    for (var h = 0; h < 14 && p; h++, p = p.parentElement) {
      if (p.offsetHeight === 0) return false;
    }
    return true;
  }

  /* ─── Robustly expand the "2. Pricing & Taxation" collapsible ───
   * The section's click handler likely lives on the header row/arrow rather
   * than the text leaf itself, so a single leaf.click() can silently no-op.
   * We try the leaf, then walk up its ancestor chain clicking each candidate,
   * checking visibility of the Selling Price input after every attempt, and
   * finally fall back to a short poll in case a click triggered an async
   * render. Reports the outcome via cb(ok, detail) for observability. */
  function expandPricingSection(cb) {
    try {
      if (isPricingExpanded()) {
        hlog('pricing already expanded');
        cb(true, 'already expanded');
        return;
      }
    } catch (e) { /* ignore */ }

    var leaf;
    try {
      leaf = findPricingToggle();
    } catch (e) {
      leaf = null;
    }
    if (!leaf) {
      cb(false, 'pricing header not found');
      return;
    }

    var candidates = [leaf];
    var ancestor = leaf;
    for (var lvl = 0; lvl < 4; lvl++) {
      ancestor = ancestor.parentElement;
      if (!ancestor) break;
      candidates.push(ancestor);
    }

    var idx = 0;
    function describeTarget(t) {
      try {
        var tag = t.tagName ? t.tagName.toLowerCase() : 'unknown';
        var cls = t.className && typeof t.className === 'string' ? '.' + t.className.split(/\s+/).join('.') : '';
        return tag + cls;
      } catch (e) {
        return 'unknown';
      }
    }

    function tryNext() {
      if (idx >= candidates.length) {
        // All click candidates exhausted; do one final poll in case a click
        // triggered an async render that hasn't settled yet.
        pollUntil(
          function () {
            return isPricingExpanded() ? true : null;
          },
          PRICING_EXPAND_TIMEOUT_MS,
          PRICING_EXPAND_POLL_MS,
          function () {
            cb(true, 'expanded after final poll following ' + candidates.length + ' candidate click(s)');
          },
          function () {
            cb(false, 'clicked ' + candidates.length + ' candidates; selling field still hidden');
          }
        );
        return;
      }

      var n = idx + 1;
      var target = candidates[idx];
      idx++;
      try { target.click(); } catch (e) { /* ignore */ }
      hlog('clicked pricing candidate ' + n + ' ' + describeTarget(target));

      setTimeout(function () {
        var expanded;
        try {
          expanded = isPricingExpanded();
        } catch (e) {
          expanded = false;
        }
        if (expanded) {
          cb(true, 'expanded after click ' + n);
          return;
        }
        tryNext();
      }, 350);
    }

    tryNext();
  }

  function findSaveButton() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      if (/save\s*&\s*add\s*item/i.test(buttons[i].textContent || '')) return buttons[i];
    }
    return null;
  }

  function findVisibleErrorText() {
    try {
      var candidates = document.querySelectorAll('[class*="error" i], [class*="Error" i]');
      var texts = [];
      for (var i = 0; i < candidates.length && texts.length < 3; i++) {
        var t = (candidates[i].textContent || '').trim();
        if (t && t.length < 200) texts.push(t);
      }
      return texts.length ? texts.join(' | ') : null;
    } catch (e) {
      return null;
    }
  }

  /* ─── Poll helper ─── */
  function pollUntil(checkFn, timeoutMs, intervalMs, onReady, onTimeout) {
    var start = Date.now();
    (function tick() {
      var result;
      try {
        result = checkFn();
      } catch (e) {
        result = null;
      }
      if (result) {
        onReady(result);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        onTimeout();
        return;
      }
      setTimeout(tick, intervalMs);
    })();
  }

  /* ─── Process one pending item on the ready /inventory/new form ─── */
  function processItem(q, item) {
    item.status = 'active';
    saveQueue(q);
    renderPanel();

    var nameInput = findNameInput();
    if (!nameInput) {
      failItem(q, item, 'name field not found');
      return;
    }
    setNative(nameInput, item.n);

    // NOTE: SKU is intentionally NOT set here. Setting the item NAME makes
    // Refrens asynchronously (re)generate its numeric auto-SKU, which would
    // overwrite our SKU if we set it this early. We set the real SKU later,
    // immediately before clicking Save, once the auto-SKU has settled.

    var cb = findSoldCheckbox();
    if (cb && !cb.checked) {
      try { cb.click(); } catch (e) { /* ignore */ }
    }

    expandPricingSection(function (ok, detail) {
      hlog('expand result: ' + detail);
      if (!ok) {
        setPanelNotice('Pricing expand FAILED: ' + detail);
        failItem(q, item, 'pricing expand failed: ' + detail);
        return;
      }

      // Let the newly-revealed Pricing section settle before touching SKU or
      // price: React needs a beat after expansion to finish wiring the
      // freshly-mounted inputs' onChange handlers. A manual capture that
      // waited ~700ms here committed the price; the previous immediate
      // (~350ms) attempt did not, even though the DOM read-back looked fine.
      setTimeout(function () {
        // Set the SKU first, right after pricing expansion: the name-triggered
        // auto-SKU regeneration has settled by now, so our overwrite sticks.
        // SKU changes do not regenerate/clobber the price, so it's safe to set
        // SKU before price.
        var skuInput = findSkuInput();
        if (!skuInput) {
          failItem(q, item, 'SKU field not found');
          return;
        }
        setNative(skuInput, item.s);
        // Some React inputs momentarily reformat after setNative(); only treat
        // this as a hard failure if our value clearly didn't take (empty, or
        // still showing the numeric auto-generated SKU). A non-empty,
        // non-numeric mismatch is trusted as a cosmetic artifact.
        if (!skuInput.value || /^\d{6,}$/.test(skuInput.value)) {
          failItem(q, item, 'SKU field did not accept value (read back "' + skuInput.value + '")');
          return;
        }

        // Set the Selling Price once, best-effort, purely so the field also
        // shows the value visually — the save-request interceptor above
        // authoritatively injects the correct sellingPrice into the outgoing
        // payload regardless of whether this DOM type is actually committed
        // by React, so no repeated-typing window or re-check is needed here.
        var priceEl = findSellingPriceInput();
        if (priceEl) { typeIntoInput(priceEl, item.p); }

        var saveBtn = findSaveButton();
        if (!saveBtn) {
          failItem(q, item, '"Save & Add Item" button not found');
          return;
        }

        try {
          saveBtn.click();
        } catch (e) {
          failItem(q, item, 'clicking save threw: ' + (e && e.message ? e.message : e));
          return;
        }

        // The save is a background XHR; Refrens then client-side-routes away
        // from /inventory/new WITHOUT a full page reload. We can't rely on a
        // fresh document load to resolve this item, so poll for the outcome
        // in this same execution context and drive the next step ourselves.
        pollUntil(
          function () {
            if (!NEW_PATH_RE.test(location.pathname)) return { ok: true };
            var errText = findVisibleErrorText();
            if (errText) return { ok: false, err: errText };
            return null;
          },
          SAVE_POLL_TIMEOUT_MS,
          SAVE_POLL_INTERVAL_MS,
          function (result) {
            resolveSaveOutcome(item, result.ok, result.err);
          },
          function () {
            resolveSaveOutcome(item, false, 'save did not navigate');
          }
        );
      }, 700);
    });
  }

  /* ─── Resolve a save attempt (success or failure), self-driving the next step ───
   * Re-reads the queue fresh (rather than closing over the caller's `q`/`item`)
   * so this only ever acts on an item that is still genuinely `active` — this is
   * the guard against double-processing (e.g. racing with tickStateMachine's
   * safety-net resolution on a subsequent load). */
  function resolveSaveOutcome(itemRef, success, errText) {
    var freshQ = getQueue();
    if (!freshQ) return;
    var freshItem = null;
    for (var i = 0; i < freshQ.items.length; i++) {
      if (freshQ.items[i].n === itemRef.n && freshQ.items[i].status === 'active') { freshItem = freshQ.items[i]; break; }
    }
    if (!freshItem) return; // already resolved elsewhere; do not double-process

    if (success) {
      freshItem.status = 'done';
      freshQ._consecutiveErrors = 0;
      saveQueue(freshQ);
      renderPanel();

      var pendingRemains = freshQ.items.some(function (i) { return i.status === 'pending'; });
      if (freshQ.running && pendingRemains) {
        // Self-driven continuation: a real full reload re-fires boot(), which
        // will pick up the next pending item. This does NOT depend on Refrens
        // itself ever doing a full page load.
        location.href = NEW_URL;
        return;
      }

      freshQ.running = false;
      saveQueue(freshQ);
      renderPanel();
      return;
    }

    failItem(freshQ, freshItem, errText || 'save failed');
    location.href = NEW_URL;
  }

  function failItem(q, item, reason) {
    item.status = 'error';
    item.err = reason;
    q._consecutiveErrors = (q._consecutiveErrors || 0) + 1;
    if (q._consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      q.running = false;
      panelNotice = 'Paused after ' + MAX_CONSECUTIVE_ERRORS + ' consecutive errors. Review the error log below.';
    }
    saveQueue(q);
    renderPanel();
  }

  /* ─── Unattended state machine ─── */
  function tickStateMachine() {
    var q = getQueue();
    if (!q) return;

    // Step 1 (safety net only): resolve any in-flight ("active") item left over
    // from a previous load. Under normal operation this never fires — every
    // save's outcome is resolved synchronously by resolveSaveOutcome() (via the
    // in-page poll) BEFORE we ever navigate, so an item is 'done'/'error' by the
    // time a new page load happens. This only helps recover from an item stuck
    // 'active' because the user manually reloaded/navigated mid-save.
    var activeIdx = -1;
    for (var i = 0; i < q.items.length; i++) {
      if (q.items[i].status === 'active') { activeIdx = i; break; }
    }
    if (activeIdx !== -1) {
      if (!NEW_PATH_RE.test(location.pathname)) {
        // We're not on /inventory/new -> assume the previous save succeeded.
        q.items[activeIdx].status = 'done';
        q._consecutiveErrors = 0;
        saveQueue(q);
      } else {
        // Still on /inventory/new with a leftover 'active' item — this means the
        // in-page poll that owned it never got to resolve it (e.g. the user
        // manually reloaded mid-save). Leave it as 'active'; hasActive below will
        // block starting a second item on top of it rather than guessing at its
        // outcome. The user can Pause/Clear or reload again to let it settle.
      }
    }

    renderPanel();

    if (!q.running) return;

    // Recompute after potential 'done' resolution above.
    q = getQueue();
    if (!q || !q.running) return;

    var hasActive = q.items.some(function (i) { return i.status === 'active'; });
    if (hasActive) {
      // An item is stuck 'active' (see the safety-net branch above). Don't start
      // a second one concurrently — this guarantees at most one item is ever
      // processed at a time.
      return;
    }

    var pending = null;
    for (var j = 0; j < q.items.length; j++) {
      if (q.items[j].status === 'pending') { pending = q.items[j]; break; }
    }

    if (!pending) {
      q.running = false;
      saveQueue(q);
      renderPanel();
      return;
    }

    if (!NEW_PATH_RE.test(location.pathname)) {
      location.href = NEW_URL;
      return;
    }

    // On the /inventory/new form: wait for it to be ready, then process.
    pollUntil(
      findNameInput,
      FORM_READY_TIMEOUT_MS,
      FORM_READY_POLL_MS,
      function () {
        var freshQ = getQueue();
        if (!freshQ || !freshQ.running) return;
        var freshPending = null;
        for (var k = 0; k < freshQ.items.length; k++) {
          if (freshQ.items[k].status === 'pending') { freshPending = freshQ.items[k]; break; }
        }
        if (!freshPending) return;
        processItem(freshQ, freshPending);
      },
      function () {
        setPanelNotice('Form did not become ready within ' + (FORM_READY_TIMEOUT_MS / 1000) + 's. Reload the page.');
      }
    );
  }

  /* ─── Control panel UI ─── */
  var PANEL_ID = 'hib-refrens-panel';
  var panelMinimized = false;

  function renderPanel() {
    try {
      if (!document.body) {
        setTimeout(renderPanel, 200);
        return;
      }

      var q = getQueue();
      var old = document.getElementById(PANEL_ID);
      if (old) old.remove();

      var panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999999;background:#111827;color:#f3f4f6;' +
        'font:12px/1.5 -apple-system,Segoe UI,sans-serif;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.4);' +
        'width:300px;max-width:92vw;overflow:hidden;';

      var items = q && q.items ? q.items : [];
      var total = items.length;
      var doneCount = items.filter(function (i) { return i.status === 'done'; }).length;
      var errorCount = items.filter(function (i) { return i.status === 'error'; }).length;
      var activeItem = items.filter(function (i) { return i.status === 'active'; })[0];
      var running = !!(q && q.running);

      var headerHtml = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1f2937;cursor:pointer;" id="hib-panel-header">' +
        '<strong style="font-size:12.5px;">HIB Refrens adder</strong>' +
        '<span id="hib-panel-toggle" style="color:#9ca3af;font-size:11px;">' + (panelMinimized ? '▸ expand' : '▾ minimize') + '</span>' +
        '</div>';

      var bodyHtml = '';
      if (!panelMinimized) {
        bodyHtml += '<div style="padding:10px 12px;">';
        bodyHtml += '<div style="margin-bottom:6px;">Progress: <strong>' + doneCount + ' / ' + total + '</strong>' +
          (errorCount ? '  <span style="color:#f87171;">(' + errorCount + ' error' + (errorCount === 1 ? '' : 's') + ')</span>' : '') + '</div>';
        bodyHtml += '<div style="margin-bottom:8px;color:#d1d5db;">Status: ' + (running ? '<span style="color:#34d399;">running</span>' : '<span style="color:#fbbf24;">paused</span>') + '</div>';
        if (activeItem) {
          bodyHtml += '<div style="margin-bottom:8px;padding:6px 8px;background:#374151;border-radius:8px;">Current: <strong>' + escapeHtml(activeItem.n) + '</strong></div>';
        }
        if (panelNotice) {
          bodyHtml += '<div style="margin-bottom:8px;padding:6px 8px;background:#3730a3;border-radius:8px;">' + escapeHtml(panelNotice) + '</div>';
        }

        bodyHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">';
        bodyHtml += '<button id="hib-btn-start" style="' + btnStyle('#059669') + '">Start</button>';
        bodyHtml += '<button id="hib-btn-pause" style="' + btnStyle('#b45309') + '">Pause</button>';
        bodyHtml += '<button id="hib-btn-load" style="' + btnStyle('#374151') + '">Load from clipboard</button>';
        bodyHtml += '<button id="hib-btn-clear" style="' + btnStyle('#7f1d1d') + '">Clear queue</button>';
        bodyHtml += '</div>';

        var errorItems = items.filter(function (i) { return i.status === 'error'; });
        if (errorItems.length) {
          bodyHtml += '<details style="margin-top:4px;">';
          bodyHtml += '<summary style="cursor:pointer;color:#fca5a5;">Error log (' + errorItems.length + ')</summary>';
          bodyHtml += '<div style="max-height:120px;overflow-y:auto;margin-top:4px;">';
          errorItems.forEach(function (it) {
            bodyHtml += '<div style="padding:4px 0;border-top:1px solid #374151;">' +
              '<div style="color:#f87171;font-weight:600;">' + escapeHtml(it.n) + '</div>' +
              '<div style="color:#9ca3af;">' + escapeHtml(it.err || 'unknown error') + '</div></div>';
          });
          bodyHtml += '</div></details>';
        }
        bodyHtml += '</div>';
      }

      panel.innerHTML = headerHtml + bodyHtml;
      document.body.appendChild(panel);

      var header = document.getElementById('hib-panel-header');
      if (header) header.onclick = function () { panelMinimized = !panelMinimized; renderPanel(); };

      var btnStart = document.getElementById('hib-btn-start');
      if (btnStart) btnStart.onclick = function (e) { e.stopPropagation(); onStart(); };
      var btnPause = document.getElementById('hib-btn-pause');
      if (btnPause) btnPause.onclick = function (e) { e.stopPropagation(); onPause(); };
      var btnLoad = document.getElementById('hib-btn-load');
      if (btnLoad) btnLoad.onclick = function (e) { e.stopPropagation(); loadFromClipboard(); };
      var btnClear = document.getElementById('hib-btn-clear');
      if (btnClear) btnClear.onclick = function (e) { e.stopPropagation(); onClear(); };
    } catch (e) {
      /* never let panel rendering throw and break the page */
    }
  }

  function btnStyle(bg) {
    return 'background:' + bg + ';color:#fff;border:none;border-radius:8px;padding:5px 9px;font-size:11px;font-weight:600;cursor:pointer;';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function onStart() {
    var q = getQueue();
    if (!q || !q.items.length) {
      setPanelNotice('No queue loaded — click "Load from clipboard" first.');
      return;
    }
    q.running = true;
    q._consecutiveErrors = 0;
    panelNotice = '';
    saveQueue(q);
    renderPanel();
    tickStateMachine();
  }

  function onPause() {
    var q = getQueue();
    if (!q) return;
    q.running = false;
    saveQueue(q);
    renderPanel();
  }

  function onClear() {
    clearQueue();
    panelNotice = '';
    renderPanel();
  }

  /* ─── Boot ─── */
  function boot() {
    renderPanel();
    tickStateMachine();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }

  // TODO optional dedupe: cross-check against Refrens' existing catalog before creating.
})();
