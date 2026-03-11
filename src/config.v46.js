export const APP_VERSION = "v46-lite-fast";
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSOEIId8C7BVTxCYwiJoSG7N7k4OSy1TfZXJyDHSD2AWSJ7NWGboHYIqMtqbqP2ISn4Q/exec";

export const ENABLE_SERVICE_WORKER = false;
export const STORAGE_KEYS = {
  session: "realstock.session.v46",
  draft: "realstock.draft.v46"
};

export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" }
];

export const SAVE_TIMEOUT_MS = 90000;
export const MAX_QTY = 999999;
export const AUTOSAVE_DEBOUNCE_MS = 350;
export const CLIENT_CACHE_TTL_MS = 60 * 1000;

export const ADMIN_MODE = false;
export const ENABLE_DRAFT_FEATURES = false;
