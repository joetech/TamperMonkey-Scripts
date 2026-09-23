// ==UserScript==
// @name         District Product List Tools
// @namespace    joe.district.tools
// @version      1.1.0
// @description  Shows complete, wrapped product titles and adds a quick-edit column in District product lists. https://github.com/joetech/TamperMonkey-Scripts
// @match        https://dashboard.district.net/*/products*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  /* ---------------------------------------------------------------------
   * Full title display
   * Injected at document-start so titles never flash truncated.
   * Note: the edit column below inserts a new first cell in each row,
   * so the Product cell shifts from nth-child(2) to nth-child(3).
   * ------------------------------------------------------------------- */

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
      tbody tr > td:nth-child(3) {
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
      tbody tr > td:nth-child(3)
      div.flex.w-full.flex-col,
    table[data-index-table="true"]
      tbody tr > td:nth-child(3)
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

  /* ---------------------------------------------------------------------
   * Quick-edit column
   * Adds a pencil-icon column linking straight to each product's edit
   * page. Requires document.body, so it's set up once the DOM is ready.
   * ------------------------------------------------------------------- */

  const EDIT_COL_CLASS = 'mbb-edit-col';
  const EDIT_COL_WIDTH = 'minmax(2.5rem, 2.5rem)';

  const PENCIL_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>' +
    '<path d="m15 5 4 4"/>' +
    '</svg>';

  function ensureGridTrack(table) {
    const template = table.style.gridTemplateColumns;
    if (!template || template.startsWith(EDIT_COL_WIDTH)) return;

    table.style.gridTemplateColumns = `${EDIT_COL_WIDTH} ${template}`;

    const colCount = parseInt(table.style.getPropertyValue('--col-count'), 10);
    if (!isNaN(colCount)) {
      table.style.setProperty('--col-count', String(colCount + 1));
    }
  }

  function addHeaderCell(table) {
    const headRow = table.querySelector('thead tr');
    if (!headRow || headRow.querySelector(`.${EDIT_COL_CLASS}`)) return;

    const th = document.createElement('th');
    th.className =
      `${EDIT_COL_CLASS} group sticky top-(--th-sticky-top) z-10 flex shrink-0 items-center ` +
      'justify-center truncate border-b border-separator bg-view px-2 typo-body-tiny ' +
      'font-semibold tracking-wider text-tertiary uppercase first:pl-4';
    th.innerHTML = PENCIL_SVG;
    headRow.insertBefore(th, headRow.firstChild);
  }

  function addFooterCell(table) {
    const footRow = table.querySelector('tfoot tr');
    if (!footRow || footRow.querySelector(`.${EDIT_COL_CLASS}`)) return;

    const td = document.createElement('td');
    td.className =
      `${EDIT_COL_CLASS} group/td flex items-center truncate border-border-subtle px-2 ` +
      'border-b-0 bg-ghost-hover! py-2.5 font-semibold justify-center first:pl-4';
    footRow.insertBefore(td, footRow.firstChild);
  }

  function addBodyCell(row) {
    if (row.querySelector(`.${EDIT_COL_CLASS}`)) return;

    const link = row.querySelector('a[href*="/products/details/"]');
    if (!link) return;

    const editHref = link.getAttribute('href').replace('/details/', '/edit/');

    const td = document.createElement('td');
    td.className =
      `${EDIT_COL_CLASS} group/td flex items-center truncate border-b border-border-subtle ` +
      'px-2 group-hover:bg-ghost-hover justify-center first:pl-4';

    const a = document.createElement('a');
    a.href = editHref;
    a.setAttribute('aria-label', 'Edit product');
    a.title = 'Edit product';
    a.className = 'flex items-center justify-center rounded-md p-1 text-secondary hover:bg-view hover:text-primary';
    a.innerHTML = PENCIL_SVG;

    td.appendChild(a);
    row.insertBefore(td, row.firstChild);
  }

  function processTable(table) {
    ensureGridTrack(table);
    addHeaderCell(table);
    addFooterCell(table);
    table.querySelectorAll('tbody tr').forEach(addBodyCell);
  }

  function scan() {
    document.querySelectorAll('table[data-index-table]').forEach(processTable);
  }

  function initEditColumn() {
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    scan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditColumn);
  } else {
    initEditColumn();
  }
})();
