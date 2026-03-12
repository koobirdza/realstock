import { getSession, setSession, clearSessionStore } from "./store.v50.js";
import { setEmployee } from "./state.v50.js";

export function restoreSession() {
  const session = getSession();
  if (session?.employee) setEmployee(session.employee);
}
export function persistSession(employee) { setSession(employee); }
export function logoutSession() {
  clearSessionStore();
  setEmployee("");
}
