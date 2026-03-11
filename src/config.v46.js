export const APP_VERSION = "v47-clean-optimized";
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSOEIId8C7BVTxCYwiJoSG7N7k4OSy1TfZXJyDHSD2AWSJ7NWGboHYIqMtqbqP2ISn4Q/exec";

export const ENABLE_SERVICE_WORKER = false;
export const STORAGE_KEYS = {
  session: "realstock.v47.session",
  draft: "realstock.v47.draft"
};

export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" }
];

export const SAVE_TIMEOUT_MS = 90000;
export const AUTOSAVE_DEBOUNCE_MS = 350;
export const CLIENT_CACHE_TTL_MS = 60 * 1000;
