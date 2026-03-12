export const state = {
  employee: "",
  mode: "",
  path: [],
  destination: "",
  catalogRowsByMode: {},
  treeByMode: {},
  stockMap: {},
  orderRows: [],
  saveInFlight: false,
  lastCacheStamp: "",
  admin: false,
  scheduleBadgeByPath: {},
  instantReadyModes: {},
  loadingModes: {},
  runtimeVersions: null,
  diagnostics: null,
  syncStatus: 'idle',
  optimisticPending: {},
  lastTraceId: ''
};
export function resetNav() {
  state.path = [];
  state.destination = "";
}
export function setEmployee(v) { state.employee = v || ""; }
export function setMode(v) { state.mode = v || ""; resetNav(); }
export function setSyncStatus(v) { state.syncStatus = v || 'idle'; }
export function setRuntimeVersions(v) { state.runtimeVersions = v || null; }
export function setDiagnostics(v) { state.diagnostics = v || null; }
