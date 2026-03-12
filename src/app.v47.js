import { APP_VERSION, AUTOSAVE_DEBOUNCE_MS, ENABLE_SERVICE_WORKER, SAVE_TIMEOUT_MS } from './config.v47.js';
import { restoreSession, saveSession, clearSession } from './auth.v47.js';
import { saveDraft, readDraft, clearDraft } from './store.v47.js';
import { state, resetNavigation, setEmployee, setMode } from './state.v47.js';
import { bindDom, dom, renderMode, renderNavigation, renderSession, clearInlineError, pushToast, setDraftBadge, setHealth, setSaveDisabled, setVersion, showInlineError, setViewStatus } from './ui.v47.js';
import { getNodeByPath, getRootNode } from './catalog.v47.js';
import { collectRecords } from './inventory.v47.js';
import { clearClientCache, getCatalog, getCurrentStock, getOrderView, healthCheck, reloadViews, submitRecords } from './api.v47.js';
import { debounce, getQueryFlag } from './utils.v47.js';

function currentCatalogTree() { return state.catalogs[state.mode] || {}; }
function currentNode() { return getNodeByPath(currentCatalogTree(), state.path) || getRootNode(currentCatalogTree()); }
function modeAction() { return state.mode === 'count' ? 'count' : state.mode === 'issue' ? 'issue' : state.mode === 'receive' ? 'receive' : 'order'; }
function leafDepthReached() { return state.path.length >= 3; }

function updateDraftBadge() {
  const draft = readDraft();
  if (!draft?.savedAt) return setDraftBadge('');
  setDraftBadge(`มีข้อมูลค้างล่าสุด ${new Date(draft.savedAt).toLocaleString('th-TH')}`);
}

const autosaveDraft = debounce(() => {
  const inputs = [...document.querySelectorAll('[data-qty-index]')]
    .map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value }))
    .filter((x) => x.value !== '');
  if (!inputs.length) return;
  saveDraft([{ meta: { employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination }, inputs }]);
  updateDraftBadge();
}, AUTOSAVE_DEBOUNCE_MS);

function attachAutosave() {
  document.querySelectorAll('[data-qty-index]').forEach((el) => {
    el.addEventListener('input', () => {
      clearInlineError();
      autosaveDraft();
    });
  });
}

async function loadCatalogForMode(mode) {
  const res = await getCatalog(mode);
  if (!res?.ok) throw new Error(res?.message || 'โหลด catalog ไม่สำเร็จ');
  state.catalogs[mode] = res.catalog_tree || {};
}
async function ensureCatalogLoaded(mode) {
  if (!state.catalogs[mode]) await loadCatalogForMode(mode);
}
async function loadViewData(mode, { force = false } = {}) {
  if (force) {
    if (mode === 'order') clearClientCache('orderView::');
    else clearClientCache('currentStock::');
  }
  if (mode === 'order') {
    const res = await getOrderView();
    if (!res?.ok) throw new Error(res?.message || 'โหลด order view ไม่สำเร็จ');
    state.orderRows = res.rows || [];
    setViewStatus(`Order View ${res.rows?.length || 0} รายการ`);
  } else {
    const res = await getCurrentStock();
    if (!res?.ok) throw new Error(res?.message || 'โหลด current stock ไม่สำเร็จ');
    state.stockSummary = res.stock || {};
    setViewStatus(`Current Stock ${Object.keys(state.stockSummary).length} รายการ`);
  }
}

function renderAll() {
  renderSession();
  renderMode();
  if (!state.employee || !state.mode) return;
  renderNavigation(currentNode(), {
    catalogTree: currentCatalogTree(),
    onOpenChild: (key) => {
      state.path.push(key);
      renderAll();
      attachAutosave();
    },
    onPickDestination: (dest) => {
      state.destination = dest;
      renderAll();
      attachAutosave();
    },
    onSave: handleSave,
    onClear: () => {
      document.querySelectorAll('[data-qty-index]').forEach((el) => { el.value = ''; });
      clearDraft();
      updateDraftBadge();
      pushToast('ล้างค่าแล้ว', 'info');
    },
    onRestoreDraft: restoreDraftIntoForm,
    onQuickSet: (index, value, mode) => {
      const input = document.querySelector(`[data-qty-index="${index}"]`);
      if (!input) return;
      if (mode === 'replace') input.value = String(value);
      else input.value = String((Number(input.value || 0) + Number(value)).toString());
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, state.stockSummary, state.orderRows);
  attachAutosave();
}

async function prepareMode(mode) {
  setMode(mode);
  clearInlineError();
  state.loadingView = true;
  renderAll();
  const startedAt = performance.now();
  try {
    await ensureCatalogLoaded(mode);
    renderAll();
    await loadViewData(mode);
  } finally {
    state.loadingView = false;
    renderAll();
    setViewStatus(`${mode} ready • ${Math.round(performance.now() - startedAt)} ms`);
  }
}

async function refreshHealth() {
  const res = await healthCheck();
  setHealth(!!res?.ok, res?.ok ? `Server ready • ${res.version || ''}` : `Server error • ${res?.message || ''}`);
}

function restoreDraftIntoForm() {
  const draft = readDraft();
  const payload = draft?.payload?.[0];
  if (!payload?.inputs?.length) return pushToast('ไม่พบข้อมูลค้าง', 'warn');
  const meta = payload.meta || {};
  if (meta.mode !== state.mode) return showInlineError('ข้อมูลค้างอยู่คนละโหมด');
  payload.inputs.forEach((saved) => {
    const input = document.querySelector(`[data-qty-index="${saved.index}"]`);
    if (input) input.value = saved.value;
  });
  pushToast('กู้ค่าค้างแล้ว', 'success');
}

async function handleSave() {
  if (state.saveInFlight) return;
  state.saveInFlight = true;
  try {
    clearInlineError();
    setSaveDisabled(true, 'Saving...');
    pushToast('Saving...', 'info', 1200);

    const inputRows = [...document.querySelectorAll('[data-qty-index]')].map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value }));
    const records = collectRecords(currentCatalogTree(), inputRows, state.orderRows);
    saveDraft([{ meta: { employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination }, inputs: inputRows.filter((x) => x.value !== '') }]);
    updateDraftBadge();

    const result = await submitRecords(modeAction(), records, SAVE_TIMEOUT_MS);
    if (!result?.ok) throw new Error(result?.message || 'บันทึกไม่สำเร็จ');

    clearDraft();
    updateDraftBadge();
    document.querySelectorAll('[data-qty-index]').forEach((el) => { el.value = ''; });
    await loadViewData('order', { force: true }).catch(() => {});
    if (state.mode !== 'order') await loadViewData(state.mode, { force: true });
    if (leafDepthReached()) state.path.pop();
    renderAll();
    pushToast(result.duplicate ? 'Saved (duplicate prevented)' : 'Saved', 'success');
  } catch (err) {
    showInlineError(err?.message || 'เกิดข้อผิดพลาดระหว่างบันทึก');
    pushToast('Error', 'error');
  } finally {
    state.saveInFlight = false;
    setSaveDisabled(false, state.mode === 'order' ? 'ยืนยันสั่งของ' : 'บันทึก');
  }
}

function handleLogin() {
  const name = dom().employeeName.value.trim();
  if (!name) return showInlineError('กรุณากรอกชื่อพนักงาน');
  setEmployee(name);
  saveSession();
  clearInlineError();
  renderAll();
  pushToast('เข้าสู่ระบบแล้ว', 'success');
}
function handleLogout() {
  clearSession();
  clearDraft();
  setEmployee(null);
  setMode(null);
  resetNavigation();
  renderAll();
  pushToast('ออกจากระบบแล้ว', 'info');
}

function bindEvents() {
  const el = dom();
  el.loginBtn.addEventListener('click', handleLogin);
  el.employeeName.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  el.logoutBtn.addEventListener('click', handleLogout);
  el.countModeBtn.addEventListener('click', () => prepareMode('count'));
  el.issueModeBtn.addEventListener('click', () => prepareMode('issue'));
  el.receiveModeBtn.addEventListener('click', () => prepareMode('receive'));
  el.orderModeBtn.addEventListener('click', () => prepareMode('order'));
  el.homeBtn.addEventListener('click', () => { resetNavigation(); renderAll(); });
  el.backBtn.addEventListener('click', () => { if (state.path.length) state.path.pop(); renderAll(); });
  el.healthCheckBtn?.addEventListener('click', async () => {
    await refreshHealth();
    pushToast('Health checked', 'success');
  });
  el.clearClientCacheBtn?.addEventListener('click', () => {
    clearClientCache();
    pushToast('Client cache cleared', 'success');
  });
  el.reloadViewsBtn?.addEventListener('click', async () => {
    const res = await reloadViews();
    if (!res?.ok) throw new Error(res?.message || 'Reload views ไม่สำเร็จ');
    clearClientCache();
    pushToast('Views reloaded', 'success');
  });
}

async function init() {
  bindDom();
  setVersion(APP_VERSION);
  state.adminMode = getQueryFlag('admin');
  dom().adminPanel.classList.toggle('hidden', !state.adminMode);
  restoreSession();
  updateDraftBadge();
  bindEvents();
  renderAll();
  try { await refreshHealth(); } catch {}
  if (ENABLE_SERVICE_WORKER && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
