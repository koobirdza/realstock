import { getSession, setSession, clearSessionStore } from "./store.v51.js?v=51.4.6";
import { setEmployee } from "./state.v51.js?v=51.4.6";
export function restoreSession() { const session = getSession(); if (session?.employee) setEmployee(session.employee); }
export function persistSession(employee) { setSession(employee); }
export function logoutSession() { clearSessionStore(); setEmployee(""); }
