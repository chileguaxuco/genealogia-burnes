// ===== PANEL.JS — Detail panel logic =====

import { formatDate, extractYear } from './utils.js';

// APP reference injected by app.js after data load
let _app = null;
let _onNavigate = null; // callback(personId) for tree zoom

export function initPanel(app, onNavigate) {
  _app = app;
  _onNavigate = onNavigate;

  document.getElementById('panel-close').addEventListener('click', closePanel);

  // Event delegation for family chips
  document.getElementById('panel-content').addEventListener('click', e => {
    const chip = e.target.closest('.family-chip');
    if (chip && chip.dataset.id) {
      openPanel(chip.dataset.id);
    }
  });

  document.getElementById('panel-map-link').addEventListener('click', () => {
    const personId = document.getElementById('detail-panel').dataset.personId;
    if (personId) {
      document.querySelector('.tab-btn[data-view="map"]').click();
      if (window.focusMapOnPerson) window.focusMapOnPerson(personId);
    }
  });
}

export function openPanel(personId) {
  const person = _app.personsMap[personId];
  if (!person) return;

  const panel = document.getElementById('detail-panel');
  panel.dataset.personId = personId;

  // Hero
  renderHero(person);

  // Lifeline
  renderLifeline(person);

  // Content sections
  document.getElementById('panel-dates').innerHTML   = buildDatesHtml(person);
  document.getElementById('panel-places').innerHTML  = buildPlacesHtml(person);
  document.getElementById('panel-family').innerHTML  = buildFamilyHtml(person);
  document.getElementById('panel-notes').innerHTML   = buildNotesHtml(person);
  document.getElementById('panel-refs').innerHTML    = buildRefsHtml(person);

  const hasPlaces = person.birthPlace || person.deathPlace || person.marriagePlace;
  document.getElementById('panel-map-link').style.display = hasPlaces ? 'inline-block' : 'none';

  panel.classList.add('panel-open');

  // Stagger-reveal panel sections
  requestAnimationFrame(() => {
    const sections = panel.querySelectorAll('.panel-section');
    sections.forEach((s, i) => {
      s.classList.remove('panel-revealed');
      s.style.transitionDelay = '';
    });
    requestAnimationFrame(() => {
      sections.forEach((s, i) => {
        s.style.transitionDelay = `${i * 55}ms`;
        s.classList.add('panel-revealed');
      });
    });
  });

  // Optionally trigger tree zoom/highlight
  if (_onNavigate) _onNavigate(personId);
}

export function closePanel() {
  document.getElementById('detail-panel').classList.remove('panel-open');
}

// ── Hero (avatar + name + lifespan) ──
function renderHero(person) {
  const initials = getInitials(person.name);
  const avatarBg = genAvatarColor(person.generation ?? 0);

  document.getElementById('panel-avatar').textContent = initials;
  document.getElementById('panel-avatar').style.background = avatarBg;
  document.getElementById('panel-name').textContent = person.name;

  const birth = extractYear(person.birthDate);
  const death = extractYear(person.deathDate);
  let lifespan = '';
  if (birth && death) lifespan = `${birth} – ${death}`;
  else if (birth) lifespan = `n. ${birth}`;
  else if (death) lifespan = `† ${death}`;
  document.querySelector('.panel-lifespan').textContent = lifespan;
}

// ── Lifeline ──
function renderLifeline(person) {
  const container = document.getElementById('panel-lifeline-inner');
  if (!container) return;

  const events = [];
  const birth    = extractYear(person.birthDate);
  const marriage = extractYear(person.marriageDate);
  const death    = extractYear(person.deathDate);

  if (birth)    events.push({ type: 'birth',    year: birth });
  if (marriage) events.push({ type: 'marriage', year: marriage });
  if (death)    events.push({ type: 'death',    year: death });

  if (events.length < 2) {
    container.innerHTML = '';
    return;
  }

  const minY = events[0].year;
  const maxY = events[events.length - 1].year;
  const range = maxY - minY || 1;

  const pct = y => ((y - minY) / range * 100).toFixed(1) + '%';

  const filledWidth = pct(maxY);

  const dots = events.map(ev => `
    <div class="lifeline-dot" data-type="${ev.type}" style="left:${pct(ev.year)}" title="${ev.year}"></div>
    <span class="lifeline-year-label" style="left:${pct(ev.year)}">${ev.year}</span>
  `).join('');

  container.innerHTML = `
    <div class="lifeline-bar-wrap">
      <div class="lifeline-track"></div>
      <div class="lifeline-filled" style="width:${filledWidth}"></div>
      ${dots}
    </div>
  `;
}

// ── Content builders ──
function buildDatesHtml(p) {
  const lines = [];
  if (p.birthDate)    lines.push(row('Nacimiento', formatDate(p.birthDate)));
  if (p.deathDate)    lines.push(row('Defunción',  formatDate(p.deathDate)));
  if (p.marriageDate) lines.push(row('Matrimonio', formatDate(p.marriageDate)));
  if (!lines.length) return '';
  return section('Fechas', `<div class="panel-section-content">${lines.join('')}</div>`);
}

function buildPlacesHtml(p) {
  const lines = [];
  if (p.birthPlace)    lines.push(row('Nacimiento', p.birthPlace));
  if (p.deathPlace)    lines.push(row('Defunción',  p.deathPlace));
  if (p.marriagePlace) lines.push(row('Matrimonio', p.marriagePlace));
  if (!lines.length) return '';
  return section('Lugares', `<div class="panel-section-content">${lines.join('')}</div>`);
}

function buildFamilyHtml(p) {
  const chips = [];

  if (p.father) {
    const f = _app.personsMap[p.father];
    if (f) chips.push(chip(p.father, f.name, 'Padre'));
  }
  if (p.mother) {
    const m = _app.personsMap[p.mother];
    if (m) chips.push(chip(p.mother, m.name, 'Madre'));
  }
  if (p.spouseId) {
    const s = _app.personsMap[p.spouseId];
    if (s) chips.push(chip(p.spouseId, s.name, 'Cónyuge'));
  }
  if (p.children && p.children.length) {
    p.children.forEach(cid => {
      const c = _app.personsMap[cid];
      if (c) chips.push(chip(cid, c.name, 'Hijo/a'));
    });
  }

  if (!chips.length) return '';
  return section('Familia', `<div class="family-chips-row">${chips.join('')}</div>`);
}

function buildNotesHtml(p) {
  if (!p.notes) return '';
  return section('Notas', `<div class="panel-section-content">${p.notes}</div>`);
}

function buildRefsHtml(p) {
  if (!p.references) return '';
  return section('Referencias',
    `<div class="panel-section-content" style="font-size:0.78rem;color:var(--text-secondary)">${p.references}</div>`
  );
}

// ── Helpers ──
function row(label, value) {
  return `<span><span class="label">${label}:</span> ${value}</span>`;
}

function section(title, content) {
  return `<div class="panel-section-title">${title}</div>${content}`;
}

function chip(id, name, role) {
  return `<button class="family-chip" data-id="${id}">
    <span class="family-chip-role">${role}</span>${name}
  </button>`;
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function genAvatarColor(gen) {
  const hue = (gen * 37 + 200) % 360;
  return `hsl(${hue}, 22%, 88%)`;
}
