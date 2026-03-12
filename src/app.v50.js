import { ENABLE_SERVICE_WORKER, APP_VERSION } from "./config.v50.js";
import { state, setEmployee, setMode, resetNav, setSyncStatus, setRuntimeVersions, setDiagnostics } from "./state.v50.js";
import { restoreSession, persistSession, logoutSession } from "./auth.v50.js";
import { bindDom, renderSession, setHealth, showError, toast, renderAdmin, renderBreadcrumb, renderDestinationPicker, renderNodesFromHtml, renderItems, renderSkeleton, setSaveLocked, setSyncBadge, renderRuntime, renderDiagnostics } from "./ui.v50.js";
import { getCatalog, getCurrentStock, getOrderView, health, submitAction, clearDataCaches, adminWarm, adminRebuild, versions, diagnostics } from "./api.v50.js";
import { getNodeByPath, needsDestination, warmCatalogMode, getWarmMode } from "./catalog.v50.js";
import { collectRows } from "./inventory.v50.js";
import { $, $$, createRequestId, params, debounce, deepClone } from "./utils.v50.js";
import { setDraft, getDraft, clearDraft, setRuntime } from "./store.v50.js";

let dom;
let prewarmPromise = null;

function currentWarm() { return getWarmMode(state.mode); }
function currentTree() { return currentWarm().tree; }
function currentNode() { return getNodeByPath(currentTree(), state.path) || currentTree(); }
function currentHtml() { return currentWarm().html; }
function readInputValues() {
  return $$('[data-qty-index]', document).map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value.trim() }));
}
const autosaveDraft = debounce(() => {
  const values = readInputValues().filter((x) => x.value !== "");
  if (!values.length || !state.mode || !state.employee) return;
  setDraft({ employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination, values });
}, 250);
function attachInputAutosave() {
  $$('[data-qty-index]', document).forEach((el) => el.addEventListener('input', autosaveDraft));
  $('clearBtn')?.addEventListener('click', () => {
    $$('[data-qty-index]', document).forEach((el) => el.value = '');
    clearDraft();
    toast('ล้างค่าแล้ว');
  });
  $('restoreBtn')?.addEventListener('click', () => {
    const draft = getDraft()?.value;
    if (!draft || draft.mode !== state.mode) return toast('ไม่พบข้อมูลค้าง', 'info');
    draft.values.forEach((row) => {
      const input = document.querySelector(`[data-qty-index="${row.index}"]`);
      if (input) input.value = row.value;
    });
    toast('กู้ข้อมูลค้างแล้ว', 'success');
  });
}
async function refreshHealth() {
  try {
    const [res, ver] = await Promise.all([health(), versions().catch(() => null)]);
    setHealth(!!res?.ok, res?.ok ? `พร้อมใช้งาน • ${res.version || ''}` : `มีปัญหา • ${res?.message || ''}`);
    if (ver?.ok) {
      setRuntimeVersions(ver.versions || null);
      setRuntime(ver.versions || null);
      renderRuntime();
    }
  } catch (err) {
    setHealth(false, 'เชื่อมต่อไม่สำเร็จ');
  }
}
async function refreshDiagnostics() {
  if (!state.admin) return;
  try {
    const res = await diagnostics();
    if (res?.ok) {
      setDiagnostics(res.diagnostics || {});
      renderDiagnostics();
    }
  } catch (err) {}
}
function applyWarmMode(mode, rows, cached = false) {
  const warmed = warmCatalogMode(mode, rows || []);
  state.catalogRowsByMode[mode] = rows || [];
  state.treeByMode[mode] = warmed.tree;
  state.instantReadyModes[mode] = true;
  if (state.mode === mode) {
    state.scheduleBadgeByPath = warmed.scheduleBadgeByPath;
    state.lastCacheStamp = cached ? 'ใช้ cache • instant nav' : 'โหลดสด • instant nav';
  }
}
async function ensureCatalogLoaded(mode, force = false) {
  if (!force && state.instantReadyModes[mode]) return;
  if (state.loadingModes[mode]) return state.loadingModes[mode];
  state.loadingModes[mode] = (async () => {
    const catalog = await getCatalog(mode);
    if (!catalog?.ok) throw new Error(catalog?.message || 'โหลด catalog ไม่สำเร็จ');
    applyWarmMode(mode, catalog.rows || [], !!catalog.cached);
  })();
  try { await state.loadingModes[mode]; } finally { delete state.loadingModes[mode]; }
}
async function ensureSideData(mode) {
  if (mode === 'order') {
    const orderRes = await getOrderView();
    if (!orderRes?.ok) throw new Error(orderRes?.message || 'โหลด order view ไม่สำเร็จ');
    state.orderRows = orderRes.rows || [];
  } else {
    const stockRes = await getCurrentStock();
    if (!stockRes?.ok) throw new Error(stockRes?.message || 'โหลด stock ไม่สำเร็จ');
    state.stockMap = stockRes.stock || {};
  }
}
async function prewarmOtherModes(activeMode) {
  if (prewarmPromise) return prewarmPromise;
  const otherModes = ['count','issue','receive','order'].filter((m) => m !== activeMode);
  prewarmPromise = (async () => {
    for (const mode of otherModes) {
      try { await ensureCatalogLoaded(mode); } catch (err) { console.warn('prewarm mode failed:', mode, err?.message || err); }
    }
  })();
  try { await prewarmPromise; } finally { prewarmPromise = null; }
}
function render() {
  renderSession();
  renderAdmin();
  renderRuntime();
  renderDiagnostics();
  renderDestinationPicker();
  setSyncBadge(state.syncStatus === 'saving' ? 'กำลังบันทึก...' : state.syncStatus === 'error' ? 'sync error' : state.syncStatus === 'synced' ? 'sync แล้ว' : 'พร้อม', state.syncStatus);
  if (!state.employee || !state.mode) return;
  renderBreadcrumb(currentTree());
  const node = currentNode();
  const html = currentHtml();
  if (state.path.length === 0 && html.targets) {
    renderNodesFromHtml(html.targets, (key) => { state.path.push(key); showError(''); render(); });
    return;
  }
  if (state.path.length === 1 && html.subsByTarget?.[state.path[0]]) {
    renderNodesFromHtml(html.subsByTarget[state.path[0]], (key) => { state.path.push(key); showError(''); render(); });
    return;
  }
  const children = Object.keys(node?.children || {});
  if (children.length) { renderNodesFromHtml('', () => {}); return; }
  renderItems(node, state.stockMap, state.orderRows, handleSave);
  attachInputAutosave();
  setSaveLocked(state.saveInFlight);
}
async function chooseMode(mode) {
  setMode(mode);
  showError('');
  render();
  renderSkeleton();
  await ensureCatalogLoaded(mode);
  state.scheduleBadgeByPath = getWarmMode(mode).scheduleBadgeByPath;
  await ensureSideData(mode);
  render();
  prewarmOtherModes(mode);
}
function applyOptimistic(rows) {
  const prev = { stockMap: deepClone(state.stockMap), orderRows: deepClone(state.orderRows) };
  rows.forEach((row) => {
    state.optimisticPending[row.item_key] = { qty: row.qty, action: state.mode };
    if (state.mode === 'count') {
      state.stockMap[row.item_key] = { ...(state.stockMap[row.item_key] || {}), item_key: row.item_key, current_stock: row.qty, unit: row.unit || state.stockMap[row.item_key]?.unit || '' };
    } else if (state.mode === 'issue') {
      const current = Number(state.stockMap[row.item_key]?.current_stock || 0);
      state.stockMap[row.item_key] = { ...(state.stockMap[row.item_key] || {}), item_key: row.item_key, current_stock: Math.max(0, current - Number(row.qty || 0)), unit: row.unit || state.stockMap[row.item_key]?.unit || '' };
    } else if (state.mode === 'receive') {
      const current = Number(state.stockMap[row.item_key]?.current_stock || 0);
      state.stockMap[row.item_key] = { ...(state.stockMap[row.item_key] || {}), item_key: row.item_key, current_stock: current + Number(row.qty || 0), unit: row.unit || state.stockMap[row.item_key]?.unit || '' };
    } else if (state.mode === 'order') {
      const idx = state.orderRows.findIndex((x) => x.item_key === row.item_key);
      const item = idx >= 0 ? state.orderRows[idx] : { item_key: row.item_key, item_name: row.item_name, unit: row.unit || '' };
      const patched = { ...item, suggested_order_qty: row.qty };
      if (idx >= 0) state.orderRows[idx] = patched; else state.orderRows.push(patched);
    }
  });
  return prev;
}
function rollbackOptimistic(prev) {
  state.stockMap = prev.stockMap || {};
  state.orderRows = prev.orderRows || [];
  state.optimisticPending = {};
}
function applyServerPatch(res) {
  (res.stockPatched || []).forEach((row) => {
    state.stockMap[row.item_key] = row;
    delete state.optimisticPending[row.item_key];
  });
  if (Array.isArray(res.orderPatchedRows) && res.orderPatchedRows.length) {
    const orderMap = Object.fromEntries(state.orderRows.map((x) => [x.item_key, x]));
    res.orderPatchedRows.forEach((row) => {
      orderMap[row.item_key] = row;
      delete state.optimisticPending[row.item_key];
    });
    state.orderRows = Object.values(orderMap);
  }
  Object.keys(state.optimisticPending).forEach((key) => {
    if (!(res.stockPatched || []).some((x) => x.item_key === key) && !(res.orderPatchedRows || []).some((x) => x.item_key === key)) delete state.optimisticPending[key];
  });
}
async function hardRefreshAfterSave() {
  if (state.mode === 'order') {
    const orderView = await getOrderView();
    state.orderRows = orderView.rows || [];
  } else {
    const [stock, orderView] = await Promise.all([getCurrentStock(), getOrderView()]);
    state.stockMap = stock.stock || {};
    state.orderRows = orderView.rows || [];
  }
}
async function handleSave() {
  if (state.saveInFlight) return;
  let prev = null;
  try {
    showError('');
    const node = currentNode();
    if (needsDestination(state.mode) && !state.destination) throw new Error('กรุณาเลือกปลายทางการเบิก');
    const rows = collectRows(node, readInputValues());
    const requestId = createRequestId();
    state.saveInFlight = true;
    setSyncStatus('saving');
    setSaveLocked(true, 'Saving...');
    prev = applyOptimistic(rows);
    render();
    toast('Saving...', 'info', 1500);
    const res = await submitAction(state.mode, requestId, rows);
    if (!res?.ok) throw new Error(res?.message || 'บันทึกไม่สำเร็จ');
    clearDataCaches();
    state.lastTraceId = res.traceId || '';
    if ((res.stockPatched && res.stockPatched.length) || (res.orderPatchedRows && res.orderPatchedRows.length)) {
      applyServerPatch(res);
    } else {
      await hardRefreshAfterSave();
    }
    if (res.versions) {
      setRuntimeVersions(res.versions);
      setRuntime(res.versions);
    }
    state.optimisticPending = {};
    clearDraft();
    if (state.path.length) state.path.pop();
    setSyncStatus('synced');
    render();
    refreshDiagnostics();
    toast(res.duplicate ? 'บันทึกนี้เคยถูกส่งแล้ว' : `Saved • ${res.elapsedMs || 0} ms`, 'success', 2200);
  } catch (err) {
    if (prev) rollbackOptimistic(prev);
    setSyncStatus('error');
    render();
    showError(err?.message || 'บันทึกไม่สำเร็จ');
    toast('Error', 'error');
  } finally {
    state.saveInFlight = false;
    setSaveLocked(false);
    if (state.syncStatus !== 'error') setTimeout(() => { setSyncStatus('idle'); render(); }, 1500);
  }
}
function bindEvents() {
  $('loginBtn').addEventListener('click', () => {
    const name = $('employeeName').value.trim();
    if (!name) return showError('กรุณากรอกชื่อพนักงาน');
    setEmployee(name); persistSession(name); showError(''); render();
  });
  $('employeeName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('logoutBtn').addEventListener('click', () => { logoutSession(); resetNav(); state.mode = ''; render(); });
  $$('[data-mode]').forEach((el) => el.addEventListener('click', () => chooseMode(el.dataset.mode)));
  $('homeBtn').addEventListener('click', () => { resetNav(); render(); });
  $('backBtn').addEventListener('click', () => { state.path.pop(); render(); });
  $('destinationButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dest]');
    if (!btn) return;
    state.destination = btn.dataset.dest; renderDestinationPicker();
  });
  $('warmBtn')?.addEventListener('click', async () => {
    const res = await adminWarm();
    toast(res?.ok ? 'Warm cache สำเร็จ' : 'Warm cache ไม่สำเร็จ', res?.ok ? 'success' : 'error');
    refreshDiagnostics();
  });
  $('rebuildBtn')?.addEventListener('click', async () => {
    const res = await adminRebuild();
    toast(res?.ok ? 'Rebuild สำเร็จ' : 'Rebuild ไม่สำเร็จ', res?.ok ? 'success' : 'error', 2500);
    refreshDiagnostics();
  });
  $('refreshDiagBtn')?.addEventListener('click', refreshDiagnostics);
}
async function bootstrap() {
  dom = bindDom();
  state.admin = params().get('admin') === '1';
  restoreSession();
  bindEvents();
  render();
  await refreshHealth();
  await refreshDiagnostics();
  if (ENABLE_SERVICE_WORKER && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  console.info('RealStock booted', APP_VERSION);
}
bootstrap();
