import { STORAGE_KEYS } from "./config.v47.js";

export function saveDraft(payload) {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({
    savedAt: Date.now(),
    payload
  }));
}

export function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.draft);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}
