export const APP_VERSION = 'v47.2-restaurant-build';
export const GOOGLE_SCRIPT_URL = 'PUT_YOUR_WEB_APP_EXEC_URL_HERE';
export const ENABLE_SERVICE_WORKER = true;
export const SAVE_TIMEOUT_MS = 30000;
export const MAX_QTY = 999999;
export const AUTOSAVE_DEBOUNCE_MS = 250;
export const STORAGE_KEYS = {
  session: 'realstock.session.v47_2',
  draft: 'realstock.draft.v47_2'
};
export const CACHE_TTL_MS = {
  catalog: 10 * 60 * 1000,
  stock: 5 * 60 * 1000,
  orderView: 2 * 60 * 1000
};
export const ISSUE_DESTINATIONS = [
  { key: 'front', label: 'หน้าร้าน' },
  { key: 'kitchen', label: 'ครัว' },
  { key: 'bar', label: 'บาร์น้ำ' }
];
export const QUICK_QTY_PRESETS = [1, 5, 10];
