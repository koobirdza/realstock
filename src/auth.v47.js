import { STORAGE_KEYS } from "./config.v47.js";
import { state, setEmployee } from "./state.v47.js";

export function saveSession() {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
    employee: state.employee
  }));
}

export function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.employee) setEmployee(parsed.employee);
  } catch (_) {}
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}
