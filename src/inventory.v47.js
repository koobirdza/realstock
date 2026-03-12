import { MAX_QTY } from './config.v47.js';
import { state } from './state.v47.js';
import { getItems, getNodeByPath, needsDestination } from './catalog.v47.js';
import { nowIso, todayIso } from './utils.v47.js';

export function collectRecords(catalogTree, inputRows, orderRows = []) {
  if (!state.employee) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  if (!state.mode) throw new Error('ยังไม่ได้เลือกโหมด');
  if (needsDestination(state.mode, state.path) && !state.destination) throw new Error('กรุณาเลือกปลายทางการเบิกก่อนบันทึก');

  const node = getNodeByPath(catalogTree, state.path);
  if (!node) throw new Error('ไม่พบหมวดรายการปัจจุบัน');
  const items = getItems(node);
  const orderMap = Object.fromEntries((orderRows || []).map((r) => [r.item_key, r]));

  const records = inputRows
    .filter((x) => x.value !== '')
    .map(({ index, value }) => {
      const item = items[index];
      if (!item) return null;
      const qty = Number(value);
      if (Number.isNaN(qty) || qty < 0 || qty > MAX_QTY) throw new Error(`จำนวนไม่ถูกต้อง: ${item.item_name}`);
      if ((state.mode === 'issue' || state.mode === 'receive' || state.mode === 'order') && qty === 0) return null;
      const orderInfo = orderMap[item.item_key] || {};
      return {
        timestamp: nowIso(),
        date: todayIso(),
        employee: state.employee,
        action: state.mode,
        category: item.target_category || state.path[0] || '',
        main_category: item.main_category || '',
        sub_category: item.sub_category || '',
        item_key: item.item_key,
        item_name: item.item_name,
        brand: item.brand || '-',
        qty,
        unit: item.unit || '',
        item_type: item.item_type || '',
        note: state.mode === 'order' ? `suggested:${orderInfo.suggested_order_qty ?? 0}|stock:${orderInfo.current_stock ?? 0}|par:${orderInfo.target_par ?? 0}` : '',
        from_category: state.mode === 'issue' ? 'stock' : '',
        to_category: state.mode === 'issue' ? (state.destination || '') : (item.target_category || state.path[0] || '')
      };
    })
    .filter(Boolean);

  if (!records.length) throw new Error('กรุณากรอกจำนวนอย่างน้อย 1 รายการ');
  return records;
}
