// ===== UTILS.JS — Shared utility functions =====

export function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.toString().match(/\d{4}/);
  return match ? parseInt(match[0]) : null;
}

export function formatDate(d) {
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

export function getPersonEarliestYear(p) {
  const years = [
    extractYear(p.birthDate),
    extractYear(p.deathDate),
    extractYear(p.marriageDate)
  ].filter(y => y !== null);
  return years.length > 0 ? Math.min(...years) : null;
}

export function getPersonLatestYear(p) {
  const years = [
    extractYear(p.birthDate),
    extractYear(p.deathDate),
    extractYear(p.marriageDate)
  ].filter(y => y !== null);
  return years.length > 0 ? Math.max(...years) : null;
}

/** Strip accents for fuzzy search normalization */
export function normalizeStr(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Debounce helper */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
