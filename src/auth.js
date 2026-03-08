import { STORAGE_KEYS } from "./config.js";
import { state, setEmployee } from "./state.js";
import { safeParseJson } from "./utils.js";

export function saveSession() {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({
    employee: state.employee
  }));
}

export function restoreSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  const parsed = safeParseJson(raw, null);
  if (parsed?.employee) {
    setEmployee(parsed.employee);
    return parsed.employee;
  }
  return null;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.session);
}
