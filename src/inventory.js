import { MAX_QTY } from "./config.js";
import { state } from "./state.js";
import { getItems, getMainCategory, getNodeByPath, getSubCategory, getTargetCategory, needsDestination } from "./catalog.js";
import { buildItemKey, nowIso, todayIso } from "./utils.js";

export function validateBeforeSave() {
  if (!state.employee) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  if (!state.mode) throw new Error("ยังไม่ได้เลือกโหมด");
  if (needsDestination(state.mode, state.path) && !state.destination) {
    throw new Error("กรุณาเลือกปลายทางการเบิกก่อนบันทึก");
  }
}

function validateQty(qty, itemName) {
  if (Number.isNaN(qty)) throw new Error(`จำนวนไม่ถูกต้อง: ${itemName}`);
  if (qty < 0) throw new Error(`จำนวนต้องไม่ติดลบ: ${itemName}`);
  if (qty > MAX_QTY) throw new Error(`จำนวนมากเกินไป: ${itemName}`);
}

export function collectRecords(inputRows) {
  validateBeforeSave();

  const node = getNodeByPath(state.path);
  const items = getItems(node);
  const targetCategory = getTargetCategory({
    mode: state.mode,
    path: state.path,
    destination: state.destination
  });
  const mainCategory = getMainCategory(state.path);
  const subCategory = getSubCategory(state.path);

  const chosen = inputRows
    .filter((row) => row.value !== "")
    .map((row) => {
      const item = items[row.index];
      if (!item) return null;
      const qty = Number(row.value);
      validateQty(qty, item.name);
      if (state.mode === "issue" && qty === 0) return null;

      const minValue = state.mode === "count" ? item.minRemain : item.minIssue;
      const minType = state.mode === "count" ? "ขั้นต่ำคงเหลือ" : "ขั้นต่ำเบิกของ";

      return {
        timestamp: nowIso(),
        date: todayIso(),
        employee: state.employee,
        action: state.mode,
        category: state.path[0] || "",
        main_category: mainCategory,
        sub_category: subCategory,
        item: item.name,
        item_name: item.name,
        brand: item.brand || "-",
        qty,
        unit: item.unit || "",
        min: minValue || "",
        min_type: minType,
        note: "",
        from_category: state.mode === "issue" ? (state.path[0] || "") : "",
        to_category: state.mode === "issue" ? targetCategory : "",
        item_key: buildItemKey({
          targetCategory,
          mainCategory,
          subCategory,
          itemName: item.name,
          brand: item.brand || "",
          unit: item.unit || ""
        })
      };
    })
    .filter(Boolean);

  if (!chosen.length) {
    throw new Error(state.mode === "count" ? "กรุณากรอกยอดคงเหลืออย่างน้อย 1 รายการ" : "กรุณากรอกจำนวนที่เบิกอย่างน้อย 1 รายการ");
  }

  return chosen;
}
