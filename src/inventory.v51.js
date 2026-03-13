import { MAX_QTY } from "./config.v51.js?v=51.4.6";
import { state } from "./state.v51.js?v=51.4.6";
import { getItems } from "./catalog.v51.js?v=51.4.6";
import { nowIso, todayIso, parseNumber } from "./utils.v51.js?v=51.4.6";

export function collectRows(node, values) {
  if (!state.employee) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  if (!state.mode) throw new Error("ยังไม่ได้เลือกโหมด");
  const items = getItems(node);
  const rows = values
    .filter((x) => x.value !== "")
    .map((x) => {
      const item = items[x.index];
      if (!item) return null;
      const qty = parseNumber(x.value, NaN);
      if (!Number.isFinite(qty) || qty < 0 || qty > MAX_QTY) throw new Error(`จำนวนไม่ถูกต้อง: ${item.item_name}`);
      if ((state.mode === "issue" || state.mode === "receive" || state.mode === "order") && qty === 0) return null;
      return {
        timestamp: nowIso(),
        date: todayIso(),
        employee: state.employee,
        item_key: item.item_key,
        item_name: item.item_name,
        brand: item.brand || "-",
        unit: item.unit || "",
        item_type: item.item_type || "",
        target_category: item.target_category || "",
        main_category: item.main_category || "",
        sub_category: item.sub_category || "",
        qty,
        from_category: state.mode === "issue" ? "stock" : "",
        to_category: state.mode === "issue" ? (state.destination || "") : (item.target_category || ""),
        stock_zone: state.mode === "count" ? (item.count_zone || item.stock_type || item.target_category || "") : state.mode === "receive" ? (item.receive_target || item.stock_type || item.target_category || "") : state.mode === "issue" ? (item.issue_source || item.stock_type || item.target_category || "") : (item.basis_zone || item.receive_target || item.stock_type || item.target_category || ""),
        snapshot_date: item.nightly_snapshot_date || ""
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    const msg = state.mode === "count" ? "กรุณากรอกยอดนับอย่างน้อย 1 รายการ" :
      state.mode === "issue" ? "กรุณากรอกจำนวนที่เบิกอย่างน้อย 1 รายการ" :
      state.mode === "receive" ? "กรุณากรอกจำนวนที่รับอย่างน้อย 1 รายการ" :
      "กรุณากรอกจำนวนที่สั่งอย่างน้อย 1 รายการ";
    throw new Error(msg);
  }
  return rows;
}
