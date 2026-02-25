// ===== LIGHTBOX.JS — Visor inline de evidencias =====

let _evidencias = [];  // lista de evidencias de la persona actual
let _currentIdx = 0;

const overlay  = () => document.getElementById('lightbox-overlay');
const content  = () => document.getElementById('lightbox-content');
const metaTit  = () => document.getElementById('lightbox-titulo');
const metaFue  = () => document.getElementById('lightbox-fuente');
const metaCol  = () => document.getElementById('lightbox-coleccion');
const metaFec  = () => document.getElementById('lightbox-fecha');
const metaUrl  = () => document.getElementById('lightbox-url');
const btnPrev  = () => document.getElementById('lightbox-prev');
const btnNext  = () => document.getElementById('lightbox-next');

export function initLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

  overlay().addEventListener('click', e => {
    if (e.target === overlay()) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (overlay().hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  btnPrev().addEventListener('click', () => navigate(-1));
  btnNext().addEventListener('click', () => navigate(1));
}

export function openLightbox(evidencias, startIdx = 0) {
  _evidencias = evidencias;
  _currentIdx = startIdx;
  overlay().hidden = false;
  document.body.style.overflow = 'hidden';
  renderSlide();
}

function closeLightbox() {
  overlay().hidden = true;
  document.body.style.overflow = '';
  content().innerHTML = '';
}

function navigate(dir) {
  const newIdx = _currentIdx + dir;
  if (newIdx < 0 || newIdx >= _evidencias.length) return;
  _currentIdx = newIdx;
  renderSlide();
}

function renderSlide() {
  const ev = _evidencias[_currentIdx];
  if (!ev) return;

  // Navegación visible solo si hay más de una evidencia
  const multi = _evidencias.length > 1;
  btnPrev().style.display = multi && _currentIdx > 0 ? 'flex' : 'none';
  btnNext().style.display = multi && _currentIdx < _evidencias.length - 1 ? 'flex' : 'none';

  // Contenido
  if (ev.tipo === 'imagen') {
    content().innerHTML = `<img src="${ev.archivo}" alt="${ev.titulo}" class="lightbox-img">`;
  } else if (ev.tipo === 'pdf') {
    content().innerHTML = `<embed src="${ev.archivo}" type="application/pdf" class="lightbox-pdf">`;
  }

  // Metadatos
  metaTit().textContent = ev.titulo || '';
  metaTit().hidden = !ev.titulo;

  metaFue().textContent = ev.fuente ? `Fuente: ${ev.fuente}` : '';
  metaFue().hidden = !ev.fuente;

  metaCol().textContent = ev.coleccion ? `Colección: ${ev.coleccion}` : '';
  metaCol().hidden = !ev.coleccion;

  metaFec().textContent = ev.fecha ? `Fecha: ${ev.fecha}` : '';
  metaFec().hidden = !ev.fecha;

  if (ev.url) {
    metaUrl().href = ev.url;
    metaUrl().hidden = false;
  } else {
    metaUrl().hidden = true;
  }
}
