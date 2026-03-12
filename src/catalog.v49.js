function labelOf(row, keys = [], fallback = "") {
  for (const key of keys) {
    const value = String(row?.[key] ?? "").trim();
    if (value) return value;
  }
  return fallback;
}

function categoryKey(label = "") {
  return String(label || "ไม่ระบุ").trim() || "ไม่ระบุ";
}

export function buildTree(rows = []) {
  const root = { key: "root", label: "หน้าแรก", children: {}, items: [] };

  rows.forEach((row) => {
    const targetLabel = categoryKey(labelOf(row, ["target_category_label", "target_category"], "ไม่ระบุโซน"));
    const subLabel = categoryKey(labelOf(
      row,
      ["sub_category_label", "sub_category", "main_category_label", "main_category"],
      "ทั่วไป"
    ));

    root.children[targetLabel] ||= { key: targetLabel, label: targetLabel, children: {}, items: [] };
    root.children[targetLabel].children[subLabel] ||= { key: subLabel, label: subLabel, children: {}, items: [] };

    const bucket = root.children[targetLabel].children[subLabel].items;
    if (!bucket.find((x) => x.item_key === row.item_key)) bucket.push(row);
  });

  Object.values(root.children).forEach((targetNode) => {
    Object.values(targetNode.children).forEach((subNode) => {
      subNode.items.sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || ""), "th"));
    });
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
  return Object.values(node?.children || {}).sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "th"));
}

export function getItems(node) {
  return [...(node?.items || [])].sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || ""), "th"));
}

export function pathLabels(path = []) {
  return ["หน้าแรก", ...path];
}

export function needsDestination(mode) {
  return mode === "issue";
}
