export function qs(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: ${id}`);
  return el;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugifyPart(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[^\p{L}\p{N}\- ]/gu, "")
    .trim();
}

export function buildItemKey({ targetCategory = "", mainCategory = "", subCategory = "", itemName = "", brand = "", unit = "" }) {
  return [targetCategory, mainCategory, subCategory, itemName, brand !== "-" ? brand : "", unit]
    .map(slugifyPart)
    .join("|");
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function createRequestId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function safeParseJson(text, fallback = null) {
  try { return JSON.parse(text); } catch (e) { return fallback; }
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
