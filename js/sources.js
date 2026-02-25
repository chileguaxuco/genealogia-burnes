// ===== SOURCES.JS — Vista general de fuentes primarias =====

import { openLightbox } from './lightbox.js';

let _app = null;
let _openPanelFn = null;

export function initSources(app, openPanelFn) {
  _app = app;
  _openPanelFn = openPanelFn;
  renderSources();
}

function renderSources() {
  const container = document.getElementById('sources-container');
  if (!container) return;

  const todas = (_app.data.evidencias || []);

  if (!todas.length) {
    container.innerHTML = `<div class="sources-empty">
      <p>Aún no hay evidencias cargadas. Agrega documentos en <code>data.json</code> dentro del array <code>"evidencias"</code> con el campo <code>"personas"</code> listando los IDs vinculados.</p>
    </div>`;
    return;
  }

  container.innerHTML = todas.map(ev => buildCard(ev)).join('');

  // Event delegation
  container.addEventListener('click', e => {
    // Clic en chip de persona → abrir panel
    const chip = e.target.closest('.source-person-chip');
    if (chip && chip.dataset.id && _openPanelFn) {
      _openPanelFn(chip.dataset.id);
      return;
    }

    // Clic en preview de tarjeta → abrir lightbox
    const card = e.target.closest('.source-card');
    if (card) {
      // No abrir lightbox si se hizo clic en un chip o enlace externo
      if (e.target.closest('.source-person-chip') || e.target.closest('.source-card-url')) return;
      const evId = card.dataset.evId;
      const idx = todas.findIndex(ev => ev.id === evId);
      if (idx !== -1) openLightbox(todas, idx);
    }
  });
}

function buildCard(ev) {
  const preview = ev.tipo === 'imagen'
    ? `<img src="${ev.archivo}" alt="${ev.titulo}" class="source-card-img">`
    : `<div class="source-card-pdf-icon" aria-hidden="true">PDF</div>`;

  const coleccion = ev.coleccion ? `<span class="source-card-meta">${ev.coleccion}</span>` : '';
  const fecha     = ev.fecha     ? `<span class="source-card-meta">${ev.fecha}</span>` : '';
  const urlLink   = ev.url
    ? `<a class="source-card-url" href="${ev.url}" target="_blank" rel="noopener noreferrer">Ver en archivo ↗</a>`
    : '';

  const chips = (ev.personas || []).map(pid => {
    const person = _app.personsMap[pid];
    const label = person ? person.name : pid;
    return `<button class="source-person-chip" data-id="${pid}">${label}</button>`;
  }).join('');

  const personasRow = chips
    ? `<div class="source-card-personas">${chips}</div>`
    : '';

  return `<div class="source-card" data-ev-id="${ev.id}" role="button" tabindex="0" aria-label="Ver evidencia: ${ev.titulo}">
    <div class="source-card-preview">${preview}</div>
    <div class="source-card-body">
      <p class="source-card-titulo">${ev.titulo}</p>
      <p class="source-card-fuente">${ev.fuente}</p>
      ${coleccion}${fecha}${urlLink}${personasRow}
    </div>
  </div>`;
}
