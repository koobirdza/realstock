export function buildTree(rows = []) {
  const root = { label: "หน้าแรก", children: {}, items: [] };
  rows.forEach((row) => {
    const main = String(row.main_category || "ไม่ระบุ");
    const sub = String(row.sub_category || "ทั่วไป");
    root.children[main] ||= { key: main, label: main, children: {}, items: [] };
    root.children[main].children[sub] ||= { key: sub, label: sub, children: {}, items: [] };
    const bucket = root.children[main].children[sub].items;
    if (!bucket.find((x) => x.item_key === row.item_key)) bucket.push(row);
  });
  return root;
}
export function getNodeByPath(tree, path = []) {
  let node = tree;
  for (const key of path) {
    node = node?.children?.[key];
    if (!node) return null;
  }
  return node;
}
export function getChildren(node) {
  return Object.values(node?.children || {});
}
export function getItems(node) {
  return [...(node?.items || [])].sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || "")));
}
export function pathLabels(path = []) {
  return ["หน้าแรก", ...path];
}
export function needsDestination(mode, path = []) {
  return mode === "issue" && path[0] === "stock";
}
