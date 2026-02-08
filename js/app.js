// ===== APP.JS — Main controller =====

let APP = {
  data: null,
  currentView: 'tree',
  currentYear: 2023,
  personsMap: {},
};

// ---- Load data and initialize ----
async function init() {
  try {
    // Try fetch first (works on server), fallback to inline data (works on file://)
    let data;
    try {
      const resp = await fetch('data.json');
      data = await resp.json();
    } catch (e) {
      if (window.BURNES_DATA) {
        data = window.BURNES_DATA;
      } else {
        throw new Error('No se pudo cargar data.json. Abre desde un servidor local o usa la versión inline.');
      }
    }
    APP.data = data;

    // Build lookup map
    APP.data.persons.forEach(p => {
      APP.personsMap[p.id] = p;
    });

    // Init views
    initTree(APP.data);
    initMap(APP.data);

    // Setup UI
    setupTabs();
    setupTimeline();
    setupPanel();
    renderTimelinePeriods();

  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// ---- Tab navigation ----
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === APP.currentView) return;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(view + '-view').classList.add('active');

      APP.currentView = view;

      // Toggle header style for map (dark bg)
      document.getElementById('header').classList.toggle('header-map', view === 'map');

      if (view === 'map' && window.burnesMap) {
        window.burnesMap.resize();
      }

      closePanel();
    });
  });
}

// ---- Timeline slider ----
function setupTimeline() {
  const slider = document.getElementById('timeline-slider');
  const currentLabel = document.getElementById('timeline-current');

  slider.addEventListener('input', () => {
    const year = parseInt(slider.value);
    APP.currentYear = year;
    currentLabel.textContent = year;

    updateTreeForYear(year);
    updateMapForYear(year);
  });
}

// ---- Timeline period marks ----
function renderTimelinePeriods() {
  const container = document.getElementById('timeline-periods');
  if (!container) return;

  const minYear = 1757;
  const maxYear = 2023;
  const range = maxYear - minYear;

  // Compute lifespans for each person
  const lifespans = [];
  APP.data.persons.forEach(p => {
    const birth = extractYear(p.birthDate);
    const death = extractYear(p.deathDate);
    const marriage = extractYear(p.marriageDate);
    const years = [birth, death, marriage].filter(y => y !== null);

    if (years.length === 0) return;

    const start = birth || Math.min(...years);
    const end = death || (start ? start + 70 : Math.max(...years));

    lifespans.push({ start, end, id: p.id });
  });

  // Render a thin bar for each lifespan
  lifespans.forEach(ls => {
    const bar = document.createElement('div');
    bar.className = 'period-bar';
    const left = ((ls.start - minYear) / range) * 100;
    const width = ((ls.end - ls.start) / range) * 100;
    bar.style.left = Math.max(0, left) + '%';
    bar.style.width = Math.max(0.5, width) + '%';
    container.appendChild(bar);
  });
}

// ---- Detail panel ----
function setupPanel() {
  document.getElementById('panel-close').addEventListener('click', closePanel);

  document.getElementById('panel-map-link').addEventListener('click', () => {
    const personId = document.getElementById('detail-panel').dataset.personId;
    if (personId) {
      document.querySelector('.tab-btn[data-view="map"]').click();
      focusMapOnPerson(personId);
    }
  });
}

function openPanel(personId) {
  const person = APP.personsMap[personId];
  if (!person) return;

  const panel = document.getElementById('detail-panel');
  panel.dataset.personId = personId;

  document.getElementById('panel-name').textContent = person.name;
  document.getElementById('panel-dates').innerHTML = buildDatesHtml(person);
  document.getElementById('panel-places').innerHTML = buildPlacesHtml(person);
  document.getElementById('panel-family').innerHTML = buildFamilyHtml(person);
  document.getElementById('panel-notes').innerHTML = buildNotesHtml(person);
  document.getElementById('panel-refs').innerHTML = buildRefsHtml(person);

  const hasPlaces = person.birthPlace || person.deathPlace || person.marriagePlace;
  document.getElementById('panel-map-link').style.display = hasPlaces ? 'inline-block' : 'none';

  panel.classList.add('panel-open');
}

function closePanel() {
  document.getElementById('detail-panel').classList.remove('panel-open');
}

// ---- Panel content builders ----
function buildDatesHtml(p) {
  let lines = [];
  if (p.birthDate) lines.push(`<span><span class="label">Nacimiento:</span> ${formatDate(p.birthDate)}</span>`);
  if (p.deathDate) lines.push(`<span><span class="label">Defunción:</span> ${formatDate(p.deathDate)}</span>`);
  if (p.marriageDate) lines.push(`<span><span class="label">Matrimonio:</span> ${formatDate(p.marriageDate)}</span>`);
  if (lines.length === 0) return '';
  return `<div class="panel-section-title">Fechas</div><div class="panel-section-content">${lines.join('')}</div>`;
}

function buildPlacesHtml(p) {
  let lines = [];
  if (p.birthPlace) lines.push(`<span><span class="label">Nacimiento:</span> ${p.birthPlace}</span>`);
  if (p.deathPlace) lines.push(`<span><span class="label">Defunción:</span> ${p.deathPlace}</span>`);
  if (p.marriagePlace) lines.push(`<span><span class="label">Matrimonio:</span> ${p.marriagePlace}</span>`);
  if (lines.length === 0) return '';
  return `<div class="panel-section-title">Lugares</div><div class="panel-section-content">${lines.join('')}</div>`;
}

function buildFamilyHtml(p) {
  let lines = [];
  if (p.father) {
    const father = APP.personsMap[p.father];
    if (father) lines.push(`<span><span class="label">Padre:</span> <a class="family-link" data-id="${p.father}">${father.name}</a></span>`);
  }
  if (p.mother) {
    const mother = APP.personsMap[p.mother];
    if (mother) lines.push(`<span><span class="label">Madre:</span> <a class="family-link" data-id="${p.mother}">${mother.name}</a></span>`);
  }
  if (p.spouseId) {
    const spouse = APP.personsMap[p.spouseId];
    if (spouse) lines.push(`<span><span class="label">Cónyuge:</span> <a class="family-link" data-id="${p.spouseId}">${spouse.name}</a></span>`);
  }
  if (p.children && p.children.length) {
    const childNames = p.children.map(cid => {
      const c = APP.personsMap[cid];
      return c ? `<a class="family-link" data-id="${cid}">${c.name}</a>` : cid;
    });
    lines.push(`<span><span class="label">Hijos:</span> ${childNames.join(', ')}</span>`);
  }
  if (lines.length === 0) return '';

  // Add click handlers after render
  setTimeout(() => {
    document.querySelectorAll('.family-link').forEach(link => {
      link.style.color = 'var(--accent)';
      link.style.cursor = 'pointer';
      link.style.textDecoration = 'underline';
      link.style.textDecorationColor = 'var(--border)';
      link.addEventListener('click', () => {
        openPanel(link.dataset.id);
      });
    });
  }, 50);

  return `<div class="panel-section-title">Familia</div><div class="panel-section-content">${lines.join('')}</div>`;
}

function buildNotesHtml(p) {
  if (!p.notes) return '';
  return `<div class="panel-section-title">Notas</div><div class="panel-section-content">${p.notes}</div>`;
}

function buildRefsHtml(p) {
  if (!p.references) return '';
  return `<div class="panel-section-title">Referencias</div><div class="panel-section-content" style="font-size:0.8rem; color:var(--text-secondary)">${p.references}</div>`;
}

// ---- Utilities ----
function formatDate(d) {
  if (!d) return '';
  if (d.includes('-') && d.length > 4) {
    const parts = d.split('-');
    const months = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    if (parts.length === 3) {
      return `${parseInt(parts[2])} de ${months[parseInt(parts[1])]} de ${parts[0]}`;
    }
  }
  return d;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.toString().match(/\d{4}/);
  return match ? parseInt(match[0]) : null;
}

function getPersonEarliestYear(p) {
  const years = [
    extractYear(p.birthDate),
    extractYear(p.deathDate),
    extractYear(p.marriageDate)
  ].filter(y => y !== null);
  return years.length > 0 ? Math.min(...years) : null;
}

function getPersonLatestYear(p) {
  const years = [
    extractYear(p.birthDate),
    extractYear(p.deathDate),
    extractYear(p.marriageDate)
  ].filter(y => y !== null);
  return years.length > 0 ? Math.max(...years) : null;
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
