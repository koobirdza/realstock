import { STORAGE_KEYS } from "./config.v51.js";
function k(key) { return STORAGE_KEYS.cachePrefix + key; }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (err) {} }
function safeGet(key) { try { return localStorage.getItem(key); } catch (err) { return null; } }
function safeRemove(key) { try { localStorage.removeItem(key); } catch (err) {} }
export function setSession(employee) { safeSet(STORAGE_KEYS.session, JSON.stringify({ employee })); }
export function getSession() { try { return JSON.parse(safeGet(STORAGE_KEYS.session) || "null"); } catch (err) { return null; } }
export function clearSessionStore() { safeRemove(STORAGE_KEYS.session); }
export function setDraft(value) { safeSet(STORAGE_KEYS.draft, JSON.stringify({ value, savedAt: Date.now() })); }
export function getDraft() { try { return JSON.parse(safeGet(STORAGE_KEYS.draft) || "null"); } catch (err) { return null; } }
export function clearDraft() { safeRemove(STORAGE_KEYS.draft); }
export function setCache(name, value, ttlMs) { safeSet(k(name), JSON.stringify({ value, expiresAt: Date.now() + ttlMs })); }
export function getCache(name) { try { const obj = JSON.parse(safeGet(k(name)) || "null"); if (!obj) return null; if (Date.now() > Number(obj.expiresAt || 0)) { safeRemove(k(name)); return null; } return obj; } catch (err) { return null; } }
export function clearCache(prefix = "") { try { Object.keys(localStorage).forEach((key) => { if (key.startsWith(STORAGE_KEYS.cachePrefix + prefix)) localStorage.removeItem(key); }); } catch (err) {} }
