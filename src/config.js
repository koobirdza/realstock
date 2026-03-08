export const APP_VERSION = "v32-production-final";
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSOEIId8C7BVTxCYwiJoSG7N7k4OSy1TfZXJyDHSD2AWSJ7NWGboHYIqMtqbqP2ISn4Q/exec";
export const ENABLE_SERVICE_WORKER = false; // keep off until system is stable
export const STORAGE_KEYS = {
  session: "realstock.session.v30",
  draft: "realstock.draft.v30"
};
export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" }
];

export const SAVE_TIMEOUT_MS = 15000;
export const MAX_QTY = 999999;
export const AUTOSAVE_DEBOUNCE_MS = 350;

export const ENABLE_WEEKLY_REFRESH_BUTTON = true;
export const ENABLE_EXPORT_DEBUG = true;
