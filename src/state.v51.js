export const state = { employee: "", mode: "", path: [], destination: "", catalogRowsByMode: {}, treeByMode: {}, stockMap: {}, orderRows: [], saveInFlight: false, lastCacheStamp: "", admin: false, scheduleBadgeByPath: {}, instantReadyModes: {}, loadingModes: {}, diagnostics: null, infoBanner: "", nightlyCutoffHour: 22 };
export function resetNav() { state.path = []; state.destination = ""; }
export function setEmployee(v) { state.employee = v || ""; }
export function setMode(v) { state.mode = v || ""; resetNav(); }
