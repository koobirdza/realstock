export const state = {
  employee: null,
  mode: null,
  path: [],
  destination: ""
};

export function resetNavigation() {
  state.path = [];
  state.destination = "";
}

export function setEmployee(name) {
  state.employee = name;
}

export function setMode(mode) {
  state.mode = mode;
  state.path = [];
  state.destination = "";
}
