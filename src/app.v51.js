import { state, setEmployee, setMode, resetNav } from "./state.v51.js";
import { restoreSession, persistSession, logoutSession } from "./auth.v51.js";
import { bindDom, renderSession, setHealth, showError, toast, renderAdmin, renderBreadcrumb, renderDestinationPicker, renderNodesFromHtml, renderNodes, renderItems, renderSkeleton, setSaveLocked, renderInfoBanner } from "./ui.v51.js";
import { bootstrapData, health, submitAction, clearDataCaches, adminWarm, adminNightly, diagnostics, preflight, getCatalog, getCurrentStock, getOrderView } from "./api.v51.js";
import { getNodeByPath, needsDestination, warmCatalogMode, getWarmMode } from "./catalog.v51.js";
import { collectRows } from "./inventory.v51.js";
import { $, $$, createRequestId, params, debounce } from "./utils.v51.js";
import { setDraft, getDraft, clearDraft } from "./store.v51.js";

function currentWarm() { return getWarmMode(state.mode); }
function currentTree() { return currentWarm().tree; }
function currentNode() { return getNodeByPath(currentTree(), state.path) || currentTree(); }
function currentHtml() { return currentWarm().html; }
function readInputValues() { return $$('[data-qty-index]', document).map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value.trim() })); }

const autosaveDraft = debounce(() => {
  if (state.mode === 'order') return;
  const values = readInputValues().filter((x) => x.value !== "");
  if (!values.length || !state.mode || !state.employee) return;
  setDraft({ employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination, values });
}, 180);

function attachInputAutosave() {
  if (state.mode === 'order') return;
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
    state.nightlyCutoffHour = Number(res?.nightlyCutoffHour || 22);
    setHealth(!!res?.ok, res?.ok ? `พร้อมใช้งาน • คำนวณรอบ ${state.nightlyCutoffHour}:00` : `มีปัญหา • ${res?.message || ''}`);
  } catch (err) {
    setHealth(false, 'เชื่อมต่อไม่สำเร็จ');
  }
}

async function refreshDiagnostics() {
  if (!state.admin) return;
  try {
    const [diag, pf] = await Promise.all([diagnostics().catch(() => null), preflight().catch(() => null)]);
    const lines = [];
    if (diag?.ok) lines.push(`nightly runs: ${diag.diagnostics.nightlyRuns || 0} • last nightly: ${diag.diagnostics.lastNightlyAt || '-'}`);
    if (pf?.ok) lines.push(`preflight: ${pf.summary.status}`);
    state.infoBanner = lines.join(' | ') || 'Count/Issue/Receive = append log only • Order = nightly report';
    renderAdmin();
  } catch (err) {}
}

function applyWarmMode(mode, rows, cached = false) {
  const warmed = warmCatalogMode(mode, rows || []);
  state.catalogRowsByMode[mode] = rows || [];
  state.treeByMode[mode] = warmed.tree;
  state.instantReadyModes[mode] = true;
  if (state.mode === mode) {
    state.scheduleBadgeByPath = warmed.scheduleBadgeByPath;
    state.lastCacheStamp = cached ? 'ใช้ cache • snapshot ล่าสุดจากรอบ 22:00' : 'พร้อมใช้งาน • โหลดครั้งเดียวแล้วใช้ต่อ';
  }
}

async function ensureBootstrapLoaded(force = false) {
  if (state.bootstrapped && !force) return;
  const boot = await bootstrapData();
  if (!boot?.ok) throw new Error(boot?.message || 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ');
  ['count','issue','receive','order'].forEach((mode) => applyWarmMode(mode, boot.catalogs?.[mode] || [], true));
  state.stockMap = boot.stock || {};
  state.orderRows = boot.orderView || [];
  state.nightlyCutoffHour = Number(boot.nightlyCutoffHour || 22);
  state.bootstrapped = true;
  state.lastCacheStamp = 'พร้อมใช้งาน • โหลดครั้งเดียวแล้วใช้ต่อ';
}

async function ensureModeLoaded(mode) {
  if (state.instantReadyModes[mode] && state.treeByMode[mode]) return;
  const [catalogRes, stockRes, orderRes] = await Promise.all([
    getCatalog(mode),
    mode === 'order' ? Promise.resolve(null) : getCurrentStock().catch(() => null),
    mode === 'order' ? getOrderView().catch(() => null) : Promise.resolve(null)
  ]);
  if (!catalogRes?.ok) throw new Error(catalogRes?.message || `โหลดหมวด ${mode} ไม่สำเร็จ`);
  applyWarmMode(mode, catalogRes.rows || [], !!catalogRes.cached);
  if (stockRes?.ok && stockRes.stock) state.stockMap = stockRes.stock;
  if (orderRes?.ok && orderRes.rows) state.orderRows = orderRes.rows;
  state.lastCacheStamp = 'fallback load • โหลดรายโหมด';
}

function render() {
  renderSession();
  renderAdmin();
  renderDestinationPicker();
  renderInfoBanner();
  if (!state.employee || !state.mode) return;

  document.documentElement.dataset.mode = state.mode || '';
  renderBreadcrumb(currentTree());
  const node = currentNode();
  const html = currentHtml();

  if (state.path.length === 0) {
    if (html.targets) {
      renderNodesFromHtml(html.targets, (key) => { state.path.push(key); showError(''); render(); });
      return;
    }
    renderNodes(currentTree(), (key) => { state.path.push(key); showError(''); render(); });
    return;
  }

  if (state.path.length === 1) {
    const subHtml = html.subsByTarget?.[state.path[0]] || '';
    if (subHtml) {
      renderNodesFromHtml(subHtml, (key) => { state.path.push(key); showError(''); render(); });
      return;
    }
    renderNodes(node, (key) => { state.path.push(key); showError(''); render(); });
    return;
  }

  const children = Object.keys(node?.children || {});
  if (children.length) {
    renderNodes(node, (key) => { state.path.push(key); showError(''); render(); });
    return;
  }

  renderItems(node, state.stockMap, state.orderRows, handleSave);
  attachInputAutosave();
  setSaveLocked(state.saveInFlight);
}

async function chooseMode(mode) {
  setMode(mode);
  showError('');
  render();
  renderSkeleton();
  try {
    await ensureBootstrapLoaded();
  } catch (bootErr) {
    console.warn('bootstrap failed, fallback to mode load', bootErr);
    clearDataCaches();
    state.bootstrapped = false;
    await ensureModeLoaded(mode);
  }
  state.scheduleBadgeByPath = getWarmMode(mode).scheduleBadgeByPath;
  render();
}

async function handleSave() {
  if (state.saveInFlight || state.mode === 'order') return;
  try {
    showError('');
    const node = currentNode();
    if (needsDestination(state.mode) && !state.destination) throw new Error('กรุณาเลือกปลายทางการเบิก');
    const rows = collectRows(node, readInputValues());
    const requestId = createRequestId();
    state.saveInFlight = true;
    setSaveLocked(true, 'Saving...');
    toast('รับรายการแล้ว • ยังไม่คำนวณทันที', 'info', 900);
    const res = await submitAction(state.mode, requestId, rows);
    if (!res?.ok) throw new Error(res?.message || 'บันทึกไม่สำเร็จ');
    clearDraft();
    if (state.path.length) state.path.pop();
    render();
    toast(`Accepted • คำนวณรอบ ${state.nightlyCutoffHour}:00`, 'success', 2000);
  } catch (err) {
    showError(err?.message || 'บันทึกไม่สำเร็จ');
    toast('Error', 'error');
  } finally {
    state.saveInFlight = false;
    setSaveLocked(false);
  }
}

function bindEvents() {
  $('loginBtn').addEventListener('click', async () => {
    const name = $('employeeName').value.trim();
    if (!name) return showError('กรุณากรอกชื่อพนักงาน');
    try {
      setEmployee(name);
      persistSession(name);
      showError('');
      render();
      await ensureBootstrapLoaded();
    } catch (err) {
      console.error(err);
      showError('เข้าสู่ระบบไม่สำเร็จ');
    }
  });
  $('employeeName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click(); });
  $('logoutBtn').addEventListener('click', () => { logoutSession(); resetNav(); state.mode = ''; state.bootstrapped = false; render(); });
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
    toast(res?.ok ? 'Warm cache สำเร็จ' : 'Warm cache ไม่สำเร็จ', res?.ok ? 'success' : 'error');
    refreshDiagnostics();
  });
  $('nightlyBtn')?.addEventListener('click', async () => {
    const res = await adminNightly();
    toast(res?.ok ? `Nightly สำเร็จ • ${res.orderRows} รายการคำนวณแล้ว` : 'Nightly ไม่สำเร็จ', res?.ok ? 'success' : 'error', 2500);
    if (res?.ok) {
      clearDataCaches();
      state.bootstrapped = false;
      await ensureBootstrapLoaded(true);
      render();
    }
    refreshDiagnostics();
  });
  $('preflightBtn')?.addEventListener('click', async () => {
    const pf = await preflight();
    toast(pf?.ok ? `Preflight ${pf.summary.status}` : 'Preflight ไม่สำเร็จ', pf?.ok ? 'success' : 'error', 2500);
    state.infoBanner = pf?.ok ? `preflight: ${pf.summary.status}` : 'preflight failed';
    renderAdmin();
  });
}

async function bootstrap() {
  bindDom();
  state.admin = params().get('admin') === '1';
  restoreSession();
  bindEvents();
  render();
  await refreshHealth();
  if (state.employee) {
    try {
      await ensureBootstrapLoaded();
    } catch (err) {
      console.warn('bootstrap preload failed', err);
      clearDataCaches();
    }
  }
  await refreshDiagnostics();
}
bootstrap();
