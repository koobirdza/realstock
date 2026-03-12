export const APP_VERSION = "v49.2-instant-nav";
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSOEIId8C7BVTxCYwiJoSG7N7k4OSy1TfZXJyDHSD2AWSJ7NWGboHYIqMtqbqP2ISn4Q/exec";
export const ENABLE_SERVICE_WORKER = true;
export const CACHE_TTL = {
  catalog: 10 * 60 * 1000,
  stock: 5 * 60 * 1000,
  orderView: 2 * 60 * 1000
};
export const STORAGE_KEYS = {
  session: "realstock.v49.session",
  draft: "realstock.v49.draft",
  cachePrefix: "realstock.v49.cache."
};
export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" }
];
export const MODE_META = {
  count: { label: "🟢 นับสต๊อก", color: "count", saveLabel: "บันทึกยอดคงเหลือ" },
  issue: { label: "🔵 เบิกของ", color: "issue", saveLabel: "บันทึกการเบิก" },
  receive: { label: "🟠 รับของ", color: "receive", saveLabel: "บันทึกรับของ" },
  order: { label: "🟣 สั่งของ", color: "order", saveLabel: "บันทึกคำสั่งซื้อ" }
};
export const SAVE_TIMEOUT_MS = 20000;
export const MAX_QTY = 999999;
