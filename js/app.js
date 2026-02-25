// ===== APP.JS — Main module controller =====

import { extractYear } from './utils.js';
import { initPanel, openPanel, closePanel } from './panel.js';
import { initSearch } from './search.js';
import { initTree, updateTreeForYear } from './tree.js';
import { initMap, updateMapForYear } from './map.js';
import { initSources } from './sources.js';

export const APP = {
  data: null,
  currentView: 'tree',
  currentYear: 2023,
  personsMap: {},
  evidenciasMap: {},
};

// ---- Load data and initialize ----
async function init() {
  try {
    let data;
    try {
      const resp = await fetch('data.json');
      data = await resp.json();
    } catch (e) {
      if (window.BURNES_DATA) {
        data = window.BURNES_DATA;
      } else {
        throw new Error('No se pudo cargar data.json. Abre desde un servidor local.');
      }
    }

    APP.data = data;
    data.persons.forEach(p => { APP.personsMap[p.id] = p; });

    // Índice de evidencias por persona: personId → [evidencia, ...]
    APP.evidenciasMap = {};
    (data.evidencias || []).forEach(ev => {
      (ev.personas || []).forEach(pid => {
        if (!APP.evidenciasMap[pid]) APP.evidenciasMap[pid] = [];
        APP.evidenciasMap[pid].push(ev);
      });
    });

    // Init sub-systems — initMap se aísla para que un token ausente
    // no impida que el árbol y el panel funcionen
    initTree(data);
    try { initMap(data); } catch (e) { console.warn('Mapa no disponible:', e); }
    initPanel(APP, highlightTreeNode);
    initSearch(APP, openPanel);
    initSources(APP, openPanel);

    setupTabs();
    setupTimeline();
    renderTimelinePeriods();

  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// ---- Tab navigation with directional slide transition ----
function setupTabs() {
  const viewOrder = ['tree', 'map', 'sources'];

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.view;
      if (next === APP.currentView) return;

      const prev    = APP.currentView;
      const prevIdx = viewOrder.indexOf(prev);
      const nextIdx = viewOrder.indexOf(next);
      const goRight = nextIdx > prevIdx;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const prevEl = document.getElementById(prev + '-view');
      const nextEl = document.getElementById(next + '-view');

      // Exit current
      prevEl.classList.remove('active');
      prevEl.classList.add(goRight ? 'slide-exit-left' : 'slide-exit-right');

      // Prepare incoming (off-screen)
      nextEl.classList.add(goRight ? 'slide-enter-right' : 'slide-enter-left');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          nextEl.classList.remove('slide-enter-right', 'slide-enter-left');
          nextEl.classList.add('active');
        });
      });

      setTimeout(() => {
        prevEl.classList.remove('slide-exit-left', 'slide-exit-right');
      }, 550);

      APP.currentView = next;
      document.getElementById('header').classList.toggle('header-map', next === 'map');

      if (next === 'map' && window.burnesMap) window.burnesMap.resize();

      closePanel();
    });
  });
}

// ---- Timeline slider with tooltip ----
function setupTimeline() {
  const slider  = document.getElementById('timeline-slider');
  const current = document.getElementById('timeline-current');
  const tooltip = document.getElementById('timeline-tooltip');

  function updateTooltipPos(val) {
    if (!tooltip || !slider) return;
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const pct = (val - min) / (max - min);
    const thumbW = 18;
    const trackW = slider.offsetWidth;
    tooltip.style.left = (pct * (trackW - thumbW) + thumbW / 2) + 'px';
    tooltip.textContent = val;
  }

  slider.addEventListener('input', () => {
    const year = parseInt(slider.value);
    APP.currentYear = year;
    current.textContent = year;
    slider.setAttribute('aria-valuenow', year);
    if (tooltip) updateTooltipPos(year);
    updateTreeForYear(year);
    updateMapForYear(year);
  });

  const showTooltip = () => {
    if (tooltip) { tooltip.classList.add('visible'); updateTooltipPos(parseInt(slider.value)); }
  };
  const hideTooltip = () => { if (tooltip) tooltip.classList.remove('visible'); };

  slider.addEventListener('mousedown',  showTooltip);
  slider.addEventListener('touchstart', showTooltip, { passive: true });
  slider.addEventListener('mouseup',    hideTooltip);
  slider.addEventListener('touchend',   hideTooltip);
}

// ---- Timeline period marks ----
function renderTimelinePeriods() {
  const container = document.getElementById('timeline-periods');
  if (!container) return;
  const minYear = 1757, maxYear = 2023, range = maxYear - minYear;

  APP.data.persons.forEach(p => {
    const birth    = extractYear(p.birthDate);
    const death    = extractYear(p.deathDate);
    const marriage = extractYear(p.marriageDate);
    const years    = [birth, death, marriage].filter(y => y !== null);
    if (!years.length) return;
    const start = birth || Math.min(...years);
    const end   = death || (start ? start + 70 : Math.max(...years));
    const bar = document.createElement('div');
    bar.className = 'period-bar';
    bar.style.left  = Math.max(0, (start - minYear) / range * 100) + '%';
    bar.style.width = Math.max(0.5, (end - start) / range * 100) + '%';
    container.appendChild(bar);
  });
}

// ---- Highlight tree node callback (passed to panel.js) ----
function highlightTreeNode(personId) {
  if (window.zoomToTreeNode) window.zoomToTreeNode(personId);
}

document.addEventListener('DOMContentLoaded', init);
