import { getSession, setSession, clearSessionStore } from "./store.v51.51.4.7.js";
import { setEmployee } from "./state.v51.51.4.7.js";
export function restoreSession() { const session = getSession(); if (session?.employee) setEmployee(session.employee); }
export function persistSession(employee) { setSession(employee); }
export function logoutSession() { clearSessionStore(); setEmployee(""); }
