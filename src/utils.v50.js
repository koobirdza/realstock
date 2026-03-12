export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return new Date().toISOString().slice(0, 10); }
export function createRequestId() {
  return "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}
export function parseNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
export function withTimeout(promise, ms, label = "timeout") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}
export function params() { return new URLSearchParams(location.search); }

export function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
