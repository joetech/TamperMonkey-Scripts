// ==UserScript==
// @name         District Product List Full Title Display
// @namespace    joe.district.tools
// @version      1.0.0
// @description  Shows complete, wrapped product titles in District product lists. https://github.com/joetech/TamperMonkey-Scripts
// @match        https://dashboard.district.net/*/products*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const style = document.createElement('style');

  style.textContent = `
    /*
     * District defines each product row as a fixed 3.75rem grid row.
     * Allow rows to grow when product titles wrap.
     */
    table[data-index-table="true"] {
      --rowHeight: minmax(3.75rem, auto) !important;
    }

    /*
     * Remove truncation from the Product column cell.
     */
    table[data-index-table="true"]
      tbody tr > td:nth-child(2) {
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
      min-width: 0 !important;
      padding-top: 0.5rem !important;
      padding-bottom: 0.5rem !important;
    }

    /*
     * Remove truncation from the title container and title.
     */
    table[data-index-table="true"]
      tbody tr > td:nth-child(2)
      div.flex.w-full.flex-col,
    table[data-index-table="true"]
      tbody tr > td:nth-child(2)
      strong {
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
      min-width: 0 !important;
      overflow-wrap: anywhere !important;
    }
  `;

  (document.head || document.documentElement)
    .appendChild(style);
})();
