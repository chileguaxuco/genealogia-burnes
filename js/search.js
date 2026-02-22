// ===== SEARCH.JS — Fuzzy person search =====

import { normalizeStr, debounce, extractYear } from './utils.js';

let _app        = null;
let _openPanel  = null;

export function initSearch(app, openPanelFn) {
  _app       = app;
  _openPanel = openPanelFn;

  const input    = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  if (!input || !dropdown) return;

  // Debounced search
  const doSearch = debounce(query => {
    const results = searchPersons(query);
    renderDropdown(results, query);
  }, 150);

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (!val) { hideDropdown(); return; }
    doSearch(val);
  });

  // Keyboard navigation
  input.addEventListener('keydown', e => handleKeydown(e, input, dropdown));

  // Close on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) hideDropdown();
  });

  // "/" shortcut for focus
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== input &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && dropdown.classList.contains('search-visible')) {
      hideDropdown();
      input.blur();
    }
  });

  // Mobile search toggle
  const toggleBtn = document.querySelector('.search-toggle-btn');
  const wrapper   = document.querySelector('.search-wrapper');
  if (toggleBtn && wrapper) {
    toggleBtn.addEventListener('click', () => {
      wrapper.classList.add('search-mobile-open');
      setTimeout(() => input.focus(), 50);
    });
    // Close mobile search on Escape
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') wrapper.classList.remove('search-mobile-open');
    });
  }
}

// ---- Search logic ----
function searchPersons(query) {
  if (!_app || !_app.data) return [];
  const q = normalizeStr(query);

  return _app.data.persons
    .filter(p => normalizeStr(p.name).includes(q))
    .slice(0, 6);
}

// ---- Dropdown rendering ----
let activeIndex = -1;

function renderDropdown(results, query) {
  const dropdown = document.getElementById('search-dropdown');
  activeIndex = -1;

  if (!results.length) {
    dropdown.innerHTML = `<div class="search-empty">Sin resultados para "${query}"</div>`;
    dropdown.classList.add('search-visible');
    return;
  }

  dropdown.innerHTML = results.map((p, i) => {
    const year = extractYear(p.birthDate);
    const highlighted = highlightMatch(p.name, query);
    return `
      <div class="search-result" data-id="${p.id}" data-index="${i}" tabindex="-1">
        <span class="search-result-name">${highlighted}</span>
        <span class="search-result-meta">${year ? 'n. ' + year : 'fecha desconocida'} · Gen. ${(p.generation ?? 0) + 1}</span>
      </div>
    `;
  }).join('');

  dropdown.classList.add('search-visible');

  // Click handlers via delegation
  dropdown.querySelectorAll('.search-result').forEach(el => {
    el.addEventListener('click', () => selectResult(el.dataset.id));
  });
}

function hideDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  if (dropdown) dropdown.classList.remove('search-visible');
  activeIndex = -1;
}

function selectResult(personId) {
  hideDropdown();
  const input = document.getElementById('search-input');
  if (input) {
    const person = _app.personsMap[personId];
    if (person) input.value = person.name;
    input.blur();
  }

  // Open detail panel
  _openPanel(personId);

  // Fly map to person's location if map view is active
  if (window.focusMapOnPerson && document.getElementById('map-view').classList.contains('active')) {
    window.focusMapOnPerson(personId);
  }

  // Zoom tree node (works regardless of current view)
  if (window.zoomToTreeNode) window.zoomToTreeNode(personId);

  // Close mobile search
  const wrapper = document.querySelector('.search-wrapper');
  if (wrapper) wrapper.classList.remove('search-mobile-open');
}

// ---- Keyboard navigation ----
function handleKeydown(e, input, dropdown) {
  const items = Array.from(dropdown.querySelectorAll('.search-result'));
  if (!dropdown.classList.contains('search-visible') || !items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    updateActive(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    updateActive(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      selectResult(items[activeIndex].dataset.id);
    } else if (items.length === 1) {
      selectResult(items[0].dataset.id);
    }
  }
}

function updateActive(items) {
  items.forEach((item, i) => {
    item.classList.toggle('search-active', i === activeIndex);
  });
  if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
}

// ---- Match highlight ----
function highlightMatch(name, query) {
  const normName  = normalizeStr(name);
  const normQuery = normalizeStr(query);
  const idx = normName.indexOf(normQuery);
  if (idx === -1) return escHtml(name);

  // Map normalized index back to original name (length may differ due to multi-char accents)
  // Since NFD is character-by-character for basic Latin+diacritics, index roughly matches
  const start = idx;
  const end   = idx + query.length;
  return escHtml(name.slice(0, start)) +
    `<mark>${escHtml(name.slice(start, end))}</mark>` +
    escHtml(name.slice(end));
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
