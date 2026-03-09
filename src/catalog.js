import { stockData } from "./data.js";

export function getNodeByPath(path = []) {
  if (!path.length) return { subcategories: stockData };
  let node = stockData[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!node?.subcategories) return null;
    node = node.subcategories[path[i]];
  }
  return node || null;
}

export function getChildren(node) {
  if (!node?.subcategories) return [];
  return Object.entries(node.subcategories).map(([key, value]) => ({ key, ...value }));
}

export function getItems(node) {
  return Array.isArray(node?.items) ? node.items : [];
}

export function getPathLabels(path = []) {
  if (!path.length) return ["หน้าแรก"];
  const labels = ["หน้าแรก"];
  let node = { subcategories: stockData };
  for (const key of path) {
    const next = node?.subcategories?.[key];
    labels.push(next?.label || key);
    node = next;
  }
  return labels;
}

export function getTopCategoryKey(path = []) {
  return path[0] || "";
}

export function getTargetCategory({ mode, path, destination }) {
  const top = getTopCategoryKey(path);
  if (mode === "issue" && top === "stock") return destination || "";
  return top || "";
}

export function getMainCategory(path = []) {
  return path[1] || "";
}

export function getSubCategory(path = []) {
  return path[2] || "";
}

export function needsDestination(mode, path = []) {
  return mode === "issue" && getTopCategoryKey(path) === "stock";
}

export function getModeMeta(mode) {
  if (mode === "count") return { label: "🟢 นับสต๊อก", color: "green" };
  if (mode === "issue") return { label: "🔵 เบิกของ", color: "blue" };
  if (mode === "receive") return { label: "🟠 รับของเข้า", color: "orange" };
  return { label: "ยังไม่ได้เลือกโหมด", color: "slate" };
}
