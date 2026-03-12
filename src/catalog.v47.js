export function getRootNode(catalogTree = {}) {
  return { key: 'root', label: 'หน้าแรก', subcategories: catalogTree };
}
export function getNodeByPath(catalogTree = {}, path = []) {
  let node = getRootNode(catalogTree);
  for (const key of path) {
    node = node?.subcategories?.[key];
    if (!node) return null;
  }
  return node;
}
export function getChildren(node) {
  if (!node?.subcategories) return [];
  return Object.entries(node.subcategories).map(([key, value]) => ({ key, ...value }));
}
export function getItems(node) {
  return Array.isArray(node?.items) ? node.items : [];
}
export function getPathLabels(catalogTree = {}, path = []) {
  const labels = ['หน้าแรก'];
  let node = getRootNode(catalogTree);
  for (const key of path) {
    const next = node?.subcategories?.[key];
    labels.push(next?.label || key);
    node = next;
  }
  return labels;
}
export function getTopCategoryKey(path = []) { return path[0] || ''; }
export function needsDestination(mode, path = []) { return mode === 'issue' && getTopCategoryKey(path) === 'stock'; }
export function getModeMeta(mode) {
  if (mode === 'count') return { label: '🟢 นับสต๊อก', badge: 'badge-green', button: 'btn-count', panel: 'mode-count' };
  if (mode === 'issue') return { label: '🔵 เบิกของ', badge: 'badge-blue', button: 'btn-issue', panel: 'mode-issue' };
  if (mode === 'receive') return { label: '🟠 รับของ', badge: 'badge-orange', button: 'btn-receive', panel: 'mode-receive' };
  if (mode === 'order') return { label: '🟣 สั่งของ', badge: 'badge-purple', button: 'btn-order', panel: 'mode-order' };
  return { label: 'ยังไม่ได้เลือกโหมด', badge: 'badge-slate', button: 'btn-primary', panel: '' };
}
