import { ENABLE_SERVICE_WORKER } from "./config.v49.js";
import { state, setEmployee, setMode, resetNav } from "./state.v49.js";
import { restoreSession, persistSession, logoutSession } from "./auth.v49.js";
import { bindDom, renderSession, setHealth, showError, toast, renderAdmin, renderBreadcrumb, renderDestinationPicker, renderNodesFromHtml, renderItems, renderSkeleton, setSaveLocked } from "./ui.v49.js";
import { getCatalog, getCurrentStock, getOrderView, health, submitAction, clearDataCaches, adminWarm, adminRebuild, setCurrentStockCache, setOrderViewCache } from "./api.v49.js";
import { getNodeByPath, needsDestination, warmCatalogMode, getWarmMode } from "./catalog.v49.js";
import { collectRows } from "./inventory.v49.js";
import { $, $$, params, debounce } from "./utils.v49.js";
import { setDraft, getDraft, clearDraft } from "./store.v49.js";

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
    const res = await health();
    setHealth(!!res?.ok, res?.ok ? `พร้อมใช้งาน • ${res.version || ""}` : `มีปัญหา • ${res?.message || ""}`);
  } catch (err) {
    setHealth(false, 'เชื่อมต่อไม่สำเร็จ');
  }
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
    const [stockRes, orderRes] = await Promise.all([getCurrentStock(), getOrderView()]);
    if (!stockRes?.ok) throw new Error(stockRes?.message || 'โหลด stock ไม่สำเร็จ');
    if (!orderRes?.ok) throw new Error(orderRes?.message || 'โหลด order view ไม่สำเร็จ');
    state.stockMap = stockRes.stock || {};
    state.orderRows = orderRes.rows || [];
  }
}

async function prewarmOtherModes(activeMode) {
  if (prewarmPromise) return prewarmPromise;
  const otherModes = ['count', 'issue', 'receive', 'order'].filter((m) => m !== activeMode);
  prewarmPromise = (async () => {
    for (const mode of otherModes) {
      try { await ensureCatalogLoaded(mode); }
      catch (err) { console.warn('prewarm mode failed:', mode, err?.message || err); }
    }
  })();
  try { await prewarmPromise; } finally { prewarmPromise = null; }
}

function render() {
  renderSession();
  renderAdmin();
  renderDestinationPicker();
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

function patchStockState(stockPatched) {
  if (!stockPatched || typeof stockPatched !== 'object') return false;
  state.stockMap = { ...state.stockMap, ...stockPatched };
  setCurrentStockCache({ ok: true, stock: state.stockMap, rows: Object.values(state.stockMap) });
  return true;
}

function patchOrderState(orderPatchedRows) {
  if (!Array.isArray(orderPatchedRows)) return false;
  const map = new Map((state.orderRows || []).map((row) => [row.item_key, row]));
  orderPatchedRows.forEach((row) => {
    if (!row?.item_key) return;
    if (row.__deleted) map.delete(row.item_key);
    else map.set(row.item_key, row);
  });
  state.orderRows = [...map.values()];
  setOrderViewCache({ ok: true, rows: state.orderRows });
  return true;
}

async function refreshAfterSave(res) {
  if (state.mode === 'order') return;
  const stockPatched = !!res?.stockPatched && patchStockState(res.stockPatched);
  const orderPatched = Array.isArray(res?.orderPatchedRows) && patchOrderState(res.orderPatchedRows);
  if (stockPatched && orderPatched) return;
  clearDataCaches();
  const [stock, orderView] = await Promise.all([getCurrentStock(), getOrderView()]);
  state.stockMap = stock.stock || {};
  state.orderRows = orderView.rows || [];
}

async function handleSave() {
  if (state.saveInFlight) return;
  try {
    showError('');
    const node = currentNode();
    if (needsDestination(state.mode) && !state.destination) throw new Error('กรุณาเลือกปลายทางการเบิก');
    const rows = collectRows(node, readInputValues());
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    state.saveInFlight = true;
    setSaveLocked(true, 'Saving...');
    toast('Saving...', 'info', 1500);
    const res = await submitAction(state.mode, requestId, rows);
    if (!res?.ok) throw new Error(res?.message || 'บันทึกไม่สำเร็จ');
    await refreshAfterSave(res);
    clearDraft();
    if (state.path.length) state.path.pop();
    render();
    const speedText = Number.isFinite(Number(res?.elapsedMs)) ? ` • ${res.elapsedMs} ms` : '';
    toast(res.duplicate ? `บันทึกนี้เคยถูกส่งแล้ว${speedText}` : `Saved${speedText}`, 'success');
  } catch (err) {
    showError(err?.message || 'บันทึกไม่สำเร็จ');
    toast('Error', 'error');
  } finally {
    state.saveInFlight = false;
    setSaveLocked(false);
  }
}

function bindEvents() {
  $('loginBtn').addEventListener('click', () => {
    const name = $('employeeName').value.trim();
    if (!name) return showError('กรุณากรอกชื่อพนักงาน');
    setEmployee(name);
    persistSession(name);
    showError('');
    render();
  });
  $('employeeName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('logoutBtn').addEventListener('click', () => { logoutSession(); resetNav(); state.mode = ''; render(); });
  $$('[data-mode]').forEach((el) => el.addEventListener('click', () => chooseMode(el.dataset.mode)));
  $('homeBtn').addEventListener('click', () => { resetNav(); render(); });
  $('backBtn').addEventListener('click', () => { state.path.pop(); render(); });
  $('destinationButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dest]');
    if (!btn) return;
    state.destination = btn.dataset.dest;
    renderDestinationPicker();
  });
  $('warmBtn')?.addEventListener('click', async () => {
    const res = await adminWarm();
    toast(res?.ok ? 'Warm cache สำเร็จ' : (res?.message || 'Warm cache ไม่สำเร็จ'), res?.ok ? 'success' : 'error');
  });
  $('rebuildBtn')?.addEventListener('click', async () => {
    const res = await adminRebuild();
    toast(res?.ok ? 'Rebuild สำเร็จ' : (res?.message || 'Rebuild ไม่สำเร็จ'), res?.ok ? 'success' : 'error');
  });
}

async function boot() {
  dom = bindDom();
  restoreSession();
  state.admin = params().get('admin') === '1';
  bindEvents();
  render();
  refreshHealth();
  if (ENABLE_SERVICE_WORKER && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
boot();
