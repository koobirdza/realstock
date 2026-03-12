import { STORAGE_KEYS } from './config.v47.js';

export function saveDraft(payload) {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ payload, savedAt: Date.now() }));
}
export function readDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.draft);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}
