import { STORAGE_KEYS } from "./config.v49.js";

function k(key) { return STORAGE_KEYS.cachePrefix + key; }

export function setSession(employee) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ employee }));
}
export function getSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null"); }
  catch (err) { return null; }
}
export function clearSessionStore() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

export function setDraft(value) {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ value, savedAt: Date.now() }));
}
export function getDraft() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.draft) || "null"); }
  catch (err) { return null; }
}
export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}

export function setCache(name, value, ttlMs) {
  localStorage.setItem(k(name), JSON.stringify({ value, expiresAt: Date.now() + ttlMs, savedAt: Date.now() }));
}
export function getCache(name) {
  try {
    const obj = JSON.parse(localStorage.getItem(k(name)) || "null");
    if (!obj) return null;
    if (Date.now() > Number(obj.expiresAt || 0)) {
      localStorage.removeItem(k(name));
      return null;
    }
    return obj;
  } catch (err) {
    return null;
  }
}
export function clearCache(prefix = "") {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(STORAGE_KEYS.cachePrefix + prefix)) localStorage.removeItem(key);
  });
}
