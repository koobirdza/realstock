import { STORAGE_KEYS } from "./config.js";
import { safeParseJson } from "./utils.js";

export function saveDraft(payload) {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({
    savedAt: new Date().toISOString(),
    payload
  }));
}

export function readDraft() {
  return safeParseJson(localStorage.getItem(STORAGE_KEYS.draft), null);
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}

export function hasDraft() {
  return !!readDraft()?.payload?.length;
}
