const TARGET_ICONS = {
  "ห้องสต๊อก": "📦",
  "ครัว": "🍳",
  "บาร์น้ำ": "🥤",
  "หน้าร้าน": "🏪",
  "ห้องเย็น": "🧊",
  "แช่แข็ง": "❄️",
  "ทั่วไป": "📁",
  "ไม่ระบุโซน": "📁"
};

const SUB_ICONS = {
  "เครื่องปรุง": "🧂",
  "เส้น / ข้าว": "🍜",
  "เส้น/ข้าว": "🍜",
  "ผัก": "🥬",
  "เนื้อสัตว์": "🥩",
  "ลูกชิ้น": "🍢",
  "ของแห้ง": "🥫",
  "ของสด": "🛒",
  "เครื่องดื่ม": "🥤",
  "น้ำจิ้ม": "🥣",
  "ของหวาน": "🍮",
  "ทั่วไป": "📄"
};

const catalogRuntime = {
  rawByMode: {},
  treeByMode: {},
  htmlByMode: {},
  scheduleBadgeByMode: {}
};

function normalizeLabel(value, fallback = "") {
  return String(value || "").trim() || fallback;
}

function normalizeSchedule(value) {
  const v = normalizeLabel(value, "");
  return v || "";
}

function pickTargetLabel(row) {
  return normalizeLabel(row.target_category_label || row.target_category, "ไม่ระบุโซน");
}

function pickSubLabel(row) {
  return normalizeLabel(
    row.sub_category_label || row.sub_category || row.main_category_label || row.main_category,
    "ทั่วไป"
  );
}

function buildDedupKey(row) {
  return [
    normalizeLabel(row.item_key, ""),
    pickTargetLabel(row),
    pickSubLabel(row),
    normalizeLabel(row.item_name, "ไม่มีชื่อ")
  ].join("|");
}

function sortItems(items = []) {
  return [...items].sort((a, b) => {
    const ao = Number(a.sort_order || 999999);
    const bo = Number(b.sort_order || 999999);
    if (ao !== bo) return ao - bo;
    return String(a.item_name || "").localeCompare(String(b.item_name || ""), "th");
  });
}

function targetIcon(label) {
  return TARGET_ICONS[label] || TARGET_ICONS["ทั่วไป"];
}

function subIcon(label) {
  return SUB_ICONS[label] || SUB_ICONS["ทั่วไป"];
}

function nodeTemplate(key, label, type, icon, badge = "") {
  return { key, label, type, icon, badge, children: {}, items: [] };
}

export function buildTree(rows = []) {
  const root = nodeTemplate("root", "หน้าแรก", "root", "🏠");
  const seen = new Set();

  rows.forEach((row) => {
    const dedupKey = buildDedupKey(row);
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    const target = pickTargetLabel(row);
    const sub = pickSubLabel(row);
    const schedule = normalizeSchedule(row.schedule_group || row.main_category_label || row.main_category);

    root.children[target] ||= nodeTemplate(target, target, "target", targetIcon(target), schedule);
    root.children[target].children[sub] ||= nodeTemplate(sub, sub, "sub", subIcon(sub), schedule);

    const cleanRow = {
      ...row,
      __targetLabel: target,
      __subLabel: sub,
      __scheduleBadge: schedule
    };
    root.children[target].children[sub].items.push(cleanRow);
  });

  Object.values(root.children).forEach((targetNode) => {
    Object.values(targetNode.children).forEach((subNode) => {
      subNode.items = sortItems(subNode.items);
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
  return Object.values(node?.children || {}).sort((a, b) => {
    return String(a.label || "").localeCompare(String(b.label || ""), "th");
  });
}

export function getItems(node) {
  return sortItems(node?.items || []);
}

export function pathLabels(tree, path = []) {
  const out = [{ label: "หน้าแรก", icon: "🏠", key: "root" }];
  let node = tree;
  for (const key of path) {
    node = node?.children?.[key];
    if (!node) break;
    out.push({ label: node.label, icon: node.icon || "📁", key: node.key });
  }
  return out;
}

export function getScheduleBadge(node) {
  return normalizeSchedule(node?.badge || "");
}

export function needsDestination(mode) {
  return mode === "issue";
}

function renderNodeCard(node) {
  const badgeHtml = node.badge ? `<span class="mini-badge">${node.badge}</span>` : "";
  return `
    <button class="nav-btn nav-card ${node.type}" data-node="${escapeAttr(node.key)}">
      <div class="nav-top">
        <span class="nav-icon">${node.icon || "📁"}</span>
        ${badgeHtml}
      </div>
      <div class="nav-title">${escapeHtml(node.label)}</div>
      <div class="hint">เปิดหมวด</div>
    </button>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

export function warmCatalogMode(mode, rows = []) {
  const tree = buildTree(rows);
  const rootChildren = getChildren(tree);
  const targetHtml = rootChildren.map(renderNodeCard).join("");
  const subsByTarget = {};
  const scheduleByPath = {};

  rootChildren.forEach((targetNode) => {
    scheduleByPath[targetNode.key] = getScheduleBadge(targetNode);
    const subChildren = getChildren(targetNode);
    subsByTarget[targetNode.key] = subChildren.map(renderNodeCard).join("");
    subChildren.forEach((subNode) => {
      scheduleByPath[`${targetNode.key}__${subNode.key}`] = getScheduleBadge(subNode);
    });
  });

  catalogRuntime.rawByMode[mode] = rows;
  catalogRuntime.treeByMode[mode] = tree;
  catalogRuntime.htmlByMode[mode] = {
    targets: targetHtml,
    subsByTarget
  };
  catalogRuntime.scheduleBadgeByMode[mode] = scheduleByPath;

  return { tree, html: catalogRuntime.htmlByMode[mode], scheduleBadgeByPath: scheduleByPath };
}

export function getWarmMode(mode) {
  return {
    rows: catalogRuntime.rawByMode[mode] || [],
    tree: catalogRuntime.treeByMode[mode] || nodeTemplate("root", "หน้าแรก", "root", "🏠"),
    html: catalogRuntime.htmlByMode[mode] || { targets: "", subsByTarget: {} },
    scheduleBadgeByPath: catalogRuntime.scheduleBadgeByMode[mode] || {}
  };
}
