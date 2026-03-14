export const APP_VERSION = "v51.5.0-stable";
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwSOEIId8C7BVTxCYwiJoSG7N7k4OSy1TfZXJyDHSD2AWSJ7NWGboHYIqMtqbqP2ISn4Q/exec";
export const ENABLE_SERVICE_WORKER = false;
export const CACHE_TTL = { bootstrap: 5 * 60 * 1000, catalog: 10 * 60 * 1000, stock: 5 * 60 * 1000, orderView: 5 * 60 * 1000, diagnostics: 15 * 1000 };
export const STORAGE_KEYS = { session: "realstock.v51_5_0.session", draft: "realstock.v51_5_0.draft", cachePrefix: "realstock.v51_5_0.cache." };
export const ISSUE_DESTINATIONS = [
  { key: "front", label: "หน้าร้าน" },
  { key: "kitchen", label: "ครัว" },
  { key: "bar", label: "บาร์น้ำ" },
  { key: "veg", label: "โซนผัก/ของสด" }
];
export const MODE_META = {
  count: { label: "🟢 นับสต๊อก", color: "count", saveLabel: "บันทึกยอดนับ", helper: "บันทึกยอดนับอย่างเดียว ไม่คำนวณทันที" },
  issue: { label: "🔵 เบิกของ", color: "issue", saveLabel: "บันทึกการเบิก", helper: "บันทึกรายการเบิกอย่างเดียว ไม่ตัด stock ทันที • พร้อมใช้กับ Make" },
  receive: { label: "🟠 รับของ", color: "receive", saveLabel: "บันทึกรับของ", helper: "ใช้กรอกของที่รับเข้าจริง ระบบจะอัปเดต view หลัง nightly 22:00 • พร้อมใช้กับ Make" },
  order: { label: "🟣 ควรสั่งอะไรบ้าง", color: "order", saveLabel: "", helper: "โหมดนี้เป็นรายงานจำนวนที่ควรสั่ง ไม่ต้องกรอกและไม่ต้องบันทึก ใช้ Receive ตอนของมาถึง" }
};
export const SAVE_TIMEOUT_MS = 12000;
export const MAX_QTY = 999999;
