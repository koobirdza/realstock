export function getRootNode(tree) {
  return {
    label: "root",
    icon: "📁",
    subcategories: tree || {}
  };
}

export function getNodeByPath(tree, path = []) {
  let node = getRootNode(tree);
  for (const key of path) {
    if (!node?.subcategories?.[key]) return null;
    node = node.subcategories[key];
  }
  return node;
}

export function getChildren(node) {
  if (!node?.subcategories) return [];
  return Object.entries(node.subcategories).map(([key, value]) => ({
    key,
    label: value.label || key,
    icon: value.icon || "📁"
  }));
}

export function getItems(node) {
  return Array.isArray(node?.items) ? node.items : [];
}

export function getPathLabels(tree, path = []) {
  const labels = [];
  let node = getRootNode(tree);
  for (const key of path) {
    if (!node?.subcategories?.[key]) break;
    node = node.subcategories[key];
    labels.push(node.label || key);
  }
  return labels.length ? labels : ["หน้าเลือกหมวด"];
}

export function needsDestination(mode, path = []) {
  return mode === "issue" && path.length >= 1;
}

export function getModeMeta(mode) {
  if (mode === "count") return { label: "โหมดนับสต๊อก", color: "green" };
  if (mode === "issue") return { label: "โหมดเบิกของ", color: "blue" };
  if (mode === "order") return { label: "โหมดสั่งของ", color: "orange" };
  if (mode === "receive") return { label: "โหมดรับของเข้า", color: "amber" };
  return { label: "ยังไม่ได้เลือกโหมด", color: "slate" };
}
