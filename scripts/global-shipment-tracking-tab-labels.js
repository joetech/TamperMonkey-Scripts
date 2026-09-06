// ==UserScript==
// @name         Shipment Tracking Tab Labels
// @namespace    joe.tracking.tools
// @version      1.0.0
// @description  Adds persistent custom tab labels and live shipment statuses to USPS and UPS tracking pages. https://github.com/joetech/TamperMonkey-Scripts
// @match        https://tools.usps.com/tracking/*
// @match        https://www.ups.com/track*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const pageWindow = unsafeWindow;

  const carrier =
    location.hostname === 'tools.usps.com'
      ? 'USPS'
      : 'UPS';

  const state = {
    trackingNumber: getTrackingNumberFromUrl(),
    status: '',
    delivered: false,
    deliveredPrompted: false,
    originalTitle: '',
    appliedTitle: '',
  };

  function getTrackingNumberFromUrl() {
    if (carrier === 'USPS') {
      return (
        location.pathname.match(
          /\/tracking\/([A-Za-z0-9]+)/i
        )?.[1] || ''
      );
    }

    const value =
      new URL(location.href).searchParams.get(
        'trackNums'
      ) || '';

    return value.split(/[\/,]/)[0].trim();
  }

  function storageKey() {
    if (!state.trackingNumber) {
      return '';
    }

    return (
      `shipment-label:${carrier}:` +
      state.trackingNumber.toUpperCase()
    );
  }

  function getSavedLabel() {
    const key = storageKey();

    return key
      ? String(GM_getValue(key, '')).trim()
      : '';
  }

  function rememberOriginalTitle() {
    if (
      document.title &&
      document.title !== state.appliedTitle
    ) {
      state.originalTitle = document.title;
    }
  }

  function updateTabTitle() {
    const label = getSavedLabel();

    if (!label) {
      return;
    }

    rememberOriginalTitle();

    const title = state.status
      ? `${label} — ${state.status}`
      : label;

    if (document.title !== title) {
      state.appliedTitle = title;
      document.title = title;
    }
  }

  function restoreOriginalTitle() {
    state.appliedTitle = '';

    if (state.originalTitle) {
      document.title = state.originalTitle;
    }
  }

  function handleDeliveredLabel() {
    const label = getSavedLabel();

    if (
      !state.delivered ||
      !label ||
      state.deliveredPrompted
    ) {
      return;
    }

    state.deliveredPrompted = true;

    const remove = pageWindow.confirm(
      `This shipment has been delivered.\n\n` +
      `Remove the saved label “${label}”?`
    );

    if (remove) {
      GM_deleteValue(storageKey());
      restoreOriginalTitle();
    }
  }

  function setStatus(status, delivered = false) {
    const cleanedStatus = String(status || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedStatus) {
      return;
    }

    state.status = cleanedStatus;

    state.delivered =
      delivered ||
      /^delivered\b/i.test(cleanedStatus);

    updateTabTitle();
    handleDeliveredLabel();
  }

  function setTrackingNumber(trackingNumber) {
    const cleaned = String(trackingNumber || '')
      .trim();

    if (cleaned) {
      state.trackingNumber = cleaned;
    }
  }

  function inspectUspsStatus() {
    const statusElement =
      document.querySelector('p.tb-status');

    if (statusElement) {
      setStatus(statusElement.textContent);
    }
  }

  function handleUpsStatusResponse(payload) {
    const details = payload?.trackDetails;

    if (!Array.isArray(details) || !details.length) {
      return;
    }

    const currentNumber =
      state.trackingNumber.toUpperCase();

    const shipment =
      details.find(item =>
        [
          item?.trackingNumber,
          item?.requestedTrackingNumber,
        ]
          .filter(Boolean)
          .some(number =>
            String(number).toUpperCase() ===
            currentNumber
          )
      ) || details[0];

    setTrackingNumber(
      shipment.trackingNumber ||
      shipment.requestedTrackingNumber
    );

    setStatus(
      shipment.packageStatus,
      shipment.packageStatusType === 'D' ||
        /^delivered$/i.test(
          shipment.progressBarType || ''
        )
    );
  }

  function isUpsStatusUrl(url) {
    try {
      return (
        new URL(String(url), location.href)
          .pathname ===
        '/track/api/Track/GetStatus'
      );
    } catch {
      return false;
    }
  }

  function interceptUpsFetch() {
    const originalFetch = pageWindow.fetch;

    if (typeof originalFetch !== 'function') {
      return;
    }

    pageWindow.fetch = async function (...args) {
      const response =
        await originalFetch.apply(this, args);

      const requestUrl =
        args[0]?.url || args[0];

      if (isUpsStatusUrl(requestUrl)) {
        response
          .clone()
          .json()
          .then(handleUpsStatusResponse)
          .catch(() => {});
      }

      return response;
    };
  }

  function interceptUpsXhr() {
    const xhrPrototype =
      pageWindow.XMLHttpRequest?.prototype;

    if (!xhrPrototype) {
      return;
    }

    const originalOpen = xhrPrototype.open;

    xhrPrototype.open = function (
      method,
      url,
      ...rest
    ) {
      if (isUpsStatusUrl(url)) {
        this.addEventListener('load', () => {
          try {
            const payload =
              this.responseType === 'json'
                ? this.response
                : JSON.parse(this.responseText);

            handleUpsStatusResponse(payload);
          } catch {
            // Ignore inaccessible or non-JSON responses.
          }
        });
      }

      return originalOpen.call(
        this,
        method,
        url,
        ...rest
      );
    };
  }

  function setLabel() {
    if (!state.trackingNumber) {
      pageWindow.alert(
        'The tracking number has not loaded yet. ' +
        'Try again shortly.'
      );

      return;
    }

    if (state.delivered) {
      pageWindow.alert(
        'This shipment is already delivered, ' +
        'so a new label was not saved.'
      );

      return;
    }

    const existingLabel = getSavedLabel();

    const label = pageWindow.prompt(
      'Enter the label to show in this browser tab:',
      existingLabel
    );

    if (label === null) {
      return;
    }

    const cleanedLabel = label.trim();

    if (!cleanedLabel) {
      pageWindow.alert(
        'The label was empty, so nothing was saved.'
      );

      return;
    }

    GM_setValue(storageKey(), cleanedLabel);
    updateTabTitle();
  }

  function removeLabel() {
    if (
      !state.trackingNumber ||
      !getSavedLabel()
    ) {
      pageWindow.alert(
        'There is no saved label for this shipment.'
      );

      return;
    }

    GM_deleteValue(storageKey());
    restoreOriginalTitle();
  }

  GM_registerMenuCommand(
    'Set tracking tab label',
    setLabel
  );

  GM_registerMenuCommand(
    'Remove tracking tab label',
    removeLabel
  );

  if (carrier === 'UPS') {
    interceptUpsFetch();
    interceptUpsXhr();
  }

  const pageObserver = new MutationObserver(() => {
    if (carrier === 'USPS') {
      inspectUspsStatus();
    }

    updateTabTitle();
  });

  function startWatching() {
    rememberOriginalTitle();
    updateTabTitle();

    if (carrier === 'USPS') {
      inspectUspsStatus();
    }

    pageObserver.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
      }
    );
  }

  if (document.documentElement) {
    startWatching();
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      startWatching,
      { once: true }
    );
  }
})();
