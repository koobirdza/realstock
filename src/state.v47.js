export const state = {
  employee: "",
  mode: "",
  path: [],
  destination: "",
  catalogs: {
    count: null,
    issue: null,
    order: null,
    receive: null
  },
  stockSummary: {},
  orderRows: []
};

export function setEmployee(name) {
  state.employee = name || "";
}

export function setMode(mode) {
  state.mode = mode || "";
  state.path = [];
  state.destination = "";
}

export function resetNavigation() {
  state.path = [];
  state.destination = "";
}
