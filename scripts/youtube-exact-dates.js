// ==UserScript==
// @name         YouTube Exact Stream Dates
// @namespace    joe.youtube.tools
// @version      1.3.0
// @description  Converts visible YouTube stream dates while manually scrolling. https://github.com/joetech/TamperMonkey-Scripts
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CACHE_PREFIX = 'yt-exact-stream-date:';
  const MAX_CONCURRENT_REQUESTS = 4;

  const relativeDatePattern =
    /(?:streamed|premiered|uploaded)?\s*(?:\d+|a|an)\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/i;

  const queue = [];
  let activeRequests = 0;
  let scanTimer;

  function formatLocalDate(isoDate) {
    const date = new Date(isoDate);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    const timePart = date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${datePart} ${timePart}`;
  }

  function getVideoId(url) {
    try {
      return new URL(url, location.origin)
        .searchParams.get('v');
    } catch {
      return null;
    }
  }

  function readCachedDate(videoId) {
    try {
      return localStorage.getItem(
        CACHE_PREFIX + videoId
      );
    } catch {
      return null;
    }
  }

  function cacheDate(videoId, isoDate) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + videoId,
        isoDate
      );
    } catch {
      // Continue without caching.
    }
  }

  function extractBroadcastDate(html) {
    const patterns = [
      /"startTimestamp":"([^"]+)"/,
      /itemprop="startDate"\s+content="([^"]+)"/,
      /itemprop="uploadDate"\s+content="([^"]+)"/,
      /"publishDate":"([^"]+)"/,
      /"uploadDate":"([^"]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return null;
  }

  async function fetchBroadcastDate(videoId) {
    const cached = readCachedDate(videoId);

    if (cached) {
      return cached;
    }

    const response = await fetch(
      `/watch?v=${encodeURIComponent(videoId)}`,
      {
        credentials: 'same-origin',
      }
    );

    if (!response.ok) {
      throw new Error(
        `YouTube returned HTTP ${response.status}`
      );
    }

    const html = await response.text();
    const isoDate = extractBroadcastDate(html);

    if (isoDate) {
      cacheDate(videoId, isoDate);
    }

    return isoDate;
  }

  function replaceDate(dateElement, isoDate) {
    const formattedDate = formatLocalDate(isoDate);

    if (!formattedDate || !dateElement.isConnected) {
      return;
    }

    const originalText = dateElement.textContent.trim();

    dateElement.title = originalText;
    dateElement.textContent = formattedDate;
  }

  function processQueue() {
    while (
      activeRequests < MAX_CONCURRENT_REQUESTS &&
      queue.length
    ) {
      const { dateElement, videoId } = queue.shift();

      activeRequests += 1;

      fetchBroadcastDate(videoId)
        .then(isoDate => {
          if (isoDate) {
            replaceDate(dateElement, isoDate);
          }
        })
        .catch(error => {
          console.warn(
            '[YouTube Exact Stream Dates]',
            videoId,
            error
          );

          delete dateElement.dataset.ytExactDateQueued;
        })
        .finally(() => {
          activeRequests -= 1;
          processQueue();
        });
    }
  }

  function scanPage() {
    const dateElements = [
      ...document.querySelectorAll('span'),
    ].filter(element =>
      element.dataset.ytExactDateQueued !== 'true' &&
      relativeDatePattern.test(
        element.textContent.trim()
      )
    );

    for (const dateElement of dateElements) {
      const card = dateElement.closest(
        'yt-lockup-view-model, ' +
        'ytd-rich-item-renderer, ' +
        'ytd-rich-grid-media, ' +
        'ytd-grid-video-renderer, ' +
        'ytd-video-renderer, ' +
        'ytd-playlist-video-renderer'
      );

      if (!card) {
        continue;
      }

      const videoLink = card.querySelector(
        'a[href*="/watch?v="]'
      );

      const videoId =
        videoLink && getVideoId(videoLink.href);

      if (!videoId) {
        continue;
      }

      dateElement.dataset.ytExactDateQueued = 'true';

      const cached = readCachedDate(videoId);

      if (cached) {
        replaceDate(dateElement, cached);
      } else {
        queue.push({
          dateElement,
          videoId,
        });
      }
    }

    processQueue();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);

    scanTimer = setTimeout(
      scanPage,
      250
    );
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener(
    'yt-navigate-finish',
    scanPage
  );

  scanPage();
})();
