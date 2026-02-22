// ===== MAP.JS — Mapbox GL Map (ES module) =====

import { extractYear } from './utils.js';

let mapData;
let mapPersonsMap = {};
let mapMarkers    = [];
let migrationLines = [];
let activePopup   = null;

let layerFilters = { birth: true, death: true, marriage: true, migration: true };

const MAP_COLORS = { birth: '#2A4D6E', death: '#8B3A3A', marriage: '#6B7F3A' };

export function initMap(data) {
  // Sin token → mostrar mensaje en el contenedor y salir sin lanzar error
  if (!window.MAPBOX_TOKEN) {
    const container = document.getElementById('map-container');
    if (container) {
      container.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#1a1a20;';
      container.innerHTML = `
        <div style="text-align:center;color:rgba(255,255,255,0.45);font-family:Inter,sans-serif;font-size:0.85rem;line-height:1.7;padding:2rem;">
          <div style="font-size:1.8rem;margin-bottom:0.75rem;opacity:0.3;">🗺</div>
          <strong style="color:rgba(255,255,255,0.7);display:block;margin-bottom:0.3rem;">Mapa no disponible</strong>
          Falta el token de Mapbox.<br>
          Crea <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.4rem;border-radius:3px;">config.js</code> a partir de <code style="background:rgba(255,255,255,0.08);padding:0.1rem 0.4rem;border-radius:3px;">config.example.js</code>.
        </div>`;
    }
    return;
  }

  mapboxgl.accessToken = window.MAPBOX_TOKEN;

  mapData = data;
  // Build local lookup (avoids importing APP, no circular dep)
  data.persons.forEach(p => { mapPersonsMap[p.id] = p; });

  window.burnesMap = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-100.5, 24.0],
    zoom: 5.5,
    pitch: 0,
    attributionControl: false
  });

  window.burnesMap.addControl(
    new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right'
  );

  window.burnesMap.on('load', () => {
    addMapEvents(data);
    addMigrationLines(data);
  });

  setupLayerToggles();

  // Expose focus function globally
  window.focusMapOnPerson = focusMapOnPerson;
}

function addMapEvents(data) {
  const events = [];

  data.persons.forEach(p => {
    if (p.birthPlace && data.locations[p.birthPlace]) {
      events.push({ personId: p.id, personName: p.name, type: 'birth',
        label: 'Nacimiento', year: extractYear(p.birthDate),
        place: p.birthPlace, coords: { ...data.locations[p.birthPlace] } });
    }
    if (p.deathPlace && data.locations[p.deathPlace]) {
      events.push({ personId: p.id, personName: p.name, type: 'death',
        label: 'Defunción', year: extractYear(p.deathDate),
        place: p.deathPlace, coords: { ...data.locations[p.deathPlace] } });
    }
    if (p.marriagePlace && data.locations[p.marriagePlace]) {
      events.push({ personId: p.id, personName: p.name, type: 'marriage',
        label: 'Matrimonio', year: extractYear(p.marriageDate),
        place: p.marriagePlace, coords: { ...data.locations[p.marriagePlace] } });
    }
  });

  // Offset overlapping points
  const coordCounts = {};
  events.forEach(e => {
    const key = `${e.coords.lat.toFixed(2)},${e.coords.lng.toFixed(2)}`;
    coordCounts[key] = (coordCounts[key] || 0) + 1;
    const count = coordCounts[key];
    if (count > 1) {
      const angle = (count - 1) * (Math.PI * 2 / 8);
      e.coords = { lat: e.coords.lat + Math.sin(angle) * 0.06, lng: e.coords.lng + Math.cos(angle) * 0.06 };
    }
  });

  events.forEach(e => {
    const color = MAP_COLORS[e.type];
    const el = document.createElement('div');
    el.className = 'map-marker map-marker-' + e.type;
    Object.assign(el.style, {
      width: '16px', height: '16px', borderRadius: '50%',
      backgroundColor: color, boxShadow: `0 0 12px ${color}88`,
      border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer',
      transition: 'opacity 0.45s ease, transform 0.45s ease'
    });

    const popup = new mapboxgl.Popup({ offset: 14, closeButton: true, closeOnClick: true })
      .setHTML(`
        <div class="popup-title">${e.personName}</div>
        <div class="popup-event">${e.label}${e.year ? ' — ' + e.year : ''}</div>
        <div class="popup-event">${e.place}</div>
      `);

    popup.on('open', () => {
      if (activePopup && activePopup !== popup) activePopup.remove();
      activePopup = popup;
    });

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([e.coords.lng, e.coords.lat])
      .setPopup(popup)
      .addTo(window.burnesMap);

    mapMarkers.push({ marker, element: el, event: e });
  });
}

function addMigrationLines(data) {
  data.persons.forEach(p => {
    let coordinates = [];
    let earliestYear = null, latestYear = null;

    if (p.migration && p.migration.length >= 2) {
      coordinates = p.migration
        .filter(place => data.locations[place])
        .map(place => [data.locations[place].lng, data.locations[place].lat]);
      const years = [extractYear(p.birthDate), extractYear(p.marriageDate), extractYear(p.deathDate)].filter(y => y !== null);
      earliestYear = years.length ? Math.min(...years) : null;
      latestYear   = years.length ? Math.max(...years) : null;
    } else {
      const eventCoords = [];
      if (p.birthPlace    && data.locations[p.birthPlace])                                                              eventCoords.push({ coords: data.locations[p.birthPlace],    year: extractYear(p.birthDate) });
      if (p.marriagePlace && data.locations[p.marriagePlace] && p.marriagePlace !== p.birthPlace)                       eventCoords.push({ coords: data.locations[p.marriagePlace], year: extractYear(p.marriageDate) });
      if (p.deathPlace    && data.locations[p.deathPlace]    && p.deathPlace !== p.birthPlace && p.deathPlace !== p.marriagePlace) eventCoords.push({ coords: data.locations[p.deathPlace],    year: extractYear(p.deathDate) });
      if (eventCoords.length < 2) return;
      coordinates  = eventCoords.map(ec => [ec.coords.lng, ec.coords.lat]);
      const years  = eventCoords.map(ec => ec.year).filter(y => y);
      earliestYear = years.length ? Math.min(...years) : null;
      latestYear   = years.length ? Math.max(...years) : null;
    }

    if (coordinates.length < 2) return;

    const sourceId = `migration-${p.id}`;
    const layerId  = `migration-line-${p.id}`;

    window.burnesMap.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates } }
    });

    window.burnesMap.addLayer({
      id: layerId, type: 'line', source: sourceId,
      paint: { 'line-color': '#C4A35A', 'line-opacity': 0.3, 'line-width': 1.5, 'line-dasharray': [4, 4] }
    });

    migrationLines.push({ layerId, personId: p.id, earliestYear, latestYear });
  });
}

function setupLayerToggles() {
  const legend = document.getElementById('map-legend');
  if (!legend) return;

  legend.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const toggle = e.target.closest('.legend-toggle');
    if (!toggle) return;
    const layer = toggle.dataset.layer;
    if (!layer) return;
    layerFilters[layer] = !layerFilters[layer];
    toggle.classList.toggle('legend-off', !layerFilters[layer]);
    // Read current year from slider
    const year = parseInt(document.getElementById('timeline-slider')?.value ?? 2023);
    applyMapVisibility(year);
  });

  legend.addEventListener('mousedown',  e => e.stopPropagation());
  legend.addEventListener('pointerdown', e => e.stopPropagation());
}

export function updateMapForYear(year) {
  applyMapVisibility(year);
}

function applyMapVisibility(year) {
  mapMarkers.forEach(({ element, event }) => {
    const typeVisible = layerFilters[event.type];
    const eventYear   = event.year;
    if (!typeVisible) {
      element.style.opacity = '0'; element.style.transform = 'scale(0)'; element.style.pointerEvents = 'none';
    } else if (eventYear === null) {
      element.style.opacity = '0.4'; element.style.transform = 'scale(0.8)'; element.style.pointerEvents = 'auto';
    } else if (eventYear > year) {
      element.style.opacity = '0'; element.style.transform = 'scale(0.3)'; element.style.pointerEvents = 'none';
    } else {
      element.style.opacity = '1'; element.style.transform = 'scale(1)'; element.style.pointerEvents = 'auto';
    }
  });

  migrationLines.forEach(({ layerId, earliestYear, latestYear }) => {
    if (!window.burnesMap.getLayer(layerId)) return;
    const visible = layerFilters.migration;
    if (!visible)                  { window.burnesMap.setPaintProperty(layerId, 'line-opacity', 0); return; }
    if (earliestYear === null)       window.burnesMap.setPaintProperty(layerId, 'line-opacity', 0.1);
    else if (year >= latestYear)     window.burnesMap.setPaintProperty(layerId, 'line-opacity', 0.3);
    else if (year >= earliestYear)   window.burnesMap.setPaintProperty(layerId, 'line-opacity', 0.15);
    else                             window.burnesMap.setPaintProperty(layerId, 'line-opacity', 0);
  });
}

function focusMapOnPerson(personId) {
  const person = mapPersonsMap[personId];
  if (!person) return;
  const place = person.birthPlace || person.deathPlace || person.marriagePlace;
  if (place && mapData.locations[place]) {
    const loc = mapData.locations[place];
    window.burnesMap.flyTo({ center: [loc.lng, loc.lat], zoom: 8, duration: 1500 });
  }
}
