export function qs(id) {
  return document.getElementById(id);
}
export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function createRequestId() {
  return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
export function nowIso() {
  return new Date().toISOString();
}
export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
