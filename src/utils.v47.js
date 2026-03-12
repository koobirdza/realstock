export const qs = (id) => document.getElementById(id);
export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
export function createRequestId() {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `req_${Date.now()}_${rnd}`;
}
export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return new Date().toISOString().slice(0, 10); }
export function getQueryFlag(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) === '1';
}
