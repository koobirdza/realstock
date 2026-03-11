
export const APP_VERSION = "v46-speed-optimized";
export const GOOGLE_SCRIPT_URL = "PUT_YOUR_WEB_APP_EXEC_URL_HERE";
export const ENABLE_SERVICE_WORKER = false;
export const STORAGE_KEYS = { session: "realstock.session.v46", draft: "realstock.draft.v46" };
export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" }
];
export const SAVE_TIMEOUT_MS = 90000;
export const MAX_QTY = 999999;
export const AUTOSAVE_DEBOUNCE_MS = 350;
export const CLIENT_CACHE_TTL_MS = 60 * 1000;
