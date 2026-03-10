export const state = {
  employee: null,
  mode: null,
  path: [],
  destination: "",
  catalogs: {},
  orderRows: [],
  stockSummary: {}
};
export function resetNavigation() {
  state.path = [];
  state.destination = "";
}
export function setEmployee(name) {
  state.employee = name || null;
}
export function setMode(mode) {
  state.mode = mode || null;
  resetNavigation();
}
