import { ENABLE_SERVICE_WORKER } from "./config.v49.js";
import { state, setEmployee, setMode, resetNav } from "./state.v49.js";
import { restoreSession, persistSession, logoutSession } from "./auth.v49.js";
import { bindDom, renderSession, setHealth, showError, toast, renderAdmin, renderBreadcrumb, renderDestinationPicker, renderNodes, renderItems, renderSkeleton } from "./ui.v49.js";
import { getCatalog, getCurrentStock, getOrderView, health, submitAction, clearDataCaches, adminWarm, adminRebuild } from "./api.v49.js";
import { buildTree, getNodeByPath, needsDestination } from "./catalog.v49.js";
import { collectRows } from "./inventory.v49.js";
import { $, $$, createRequestId, params, debounce } from "./utils.v49.js";
import { setDraft, getDraft, clearDraft } from "./store.v49.js";

let dom;

function currentTree() { return state.treeByMode[state.mode] || { label: "หน้าแรก", children: {}, items: [] }; }
function currentNode() { return getNodeByPath(currentTree(), state.path) || currentTree(); }

function readInputValues() {
  return $$("[data-qty-index]", document).map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value.trim() }));
}
const autosaveDraft = debounce(() => {
  const values = readInputValues().filter((x) => x.value !== "");
  if (!values.length || !state.mode || !state.employee) return;
  setDraft({ employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination, values });
}, 250);

function attachInputAutosave() {
  $$("[data-qty-index]", document).forEach((el) => el.addEventListener("input", autosaveDraft));
  $("clearBtn")?.addEventListener("click", () => {
    $$("[data-qty-index]", document).forEach((el) => el.value = "");
    clearDraft();
    toast("ล้างค่าแล้ว");
  });
  $("restoreBtn")?.addEventListener("click", () => {
    const draft = getDraft()?.value;
    if (!draft || draft.mode !== state.mode) return toast("ไม่พบข้อมูลค้าง", "info");
    draft.values.forEach((row) => {
      const input = document.querySelector(`[data-qty-index="${row.index}"]`);
      if (input) input.value = row.value;
    });
    toast("กู้ข้อมูลค้างแล้ว", "success");
  });
}

async function refreshHealth() {
  try {
    const res = await health();
    setHealth(!!res?.ok, res?.ok ? `พร้อมใช้งาน • ${res.version || ""}` : `มีปัญหา • ${res?.message || ""}`);
  } catch (err) {
    setHealth(false, "เชื่อมต่อไม่สำเร็จ");
  }
}

async function ensureModeData(mode, force = false) {
  if (force || !state.catalogRowsByMode[mode]) {
    const catalog = await getCatalog(mode);
    if (!catalog?.ok) throw new Error(catalog?.message || "โหลด catalog ไม่สำเร็จ");
    state.catalogRowsByMode[mode] = catalog.rows || [];
    state.treeByMode[mode] = buildTree(catalog.rows || []);
    state.lastCacheStamp = catalog.cached ? "ใช้ cache" : "โหลดสด";
  }
  if (mode === "order") {
    const orderRes = await getOrderView();
    if (!orderRes?.ok) throw new Error(orderRes?.message || "โหลด order view ไม่สำเร็จ");
    state.orderRows = orderRes.rows || [];
    state.lastCacheStamp += " • order view";
  } else {
    const stockRes = await getCurrentStock();
    if (!stockRes?.ok) throw new Error(stockRes?.message || "โหลด stock ไม่สำเร็จ");
    state.stockMap = stockRes.stock || {};
    state.lastCacheStamp += " • current stock";
  }
}

function render() {
  renderSession();
  renderAdmin();
  renderBreadcrumb();
  renderDestinationPicker();
  if (!state.employee || !state.mode) return;
  const node = currentNode();
  const hasNodes = renderNodes(node, (key) => {
    state.path.push(key);
    showError("");
    render();
  });
  if (!hasNodes) {
    renderItems(node, state.stockMap, state.orderRows, handleSave);
    attachInputAutosave();
  }
}

async function chooseMode(mode) {
  setMode(mode);
  showError("");
  render();
  renderSkeleton();
  await ensureModeData(mode);
  render();
}

async function handleSave() {
  if (state.saveInFlight) return;
  try {
    showError("");
    const node = currentNode();
    if (needsDestination(state.mode, state.path) && !state.destination) throw new Error("กรุณาเลือกปลายทางการเบิก");
    const rows = collectRows(node, readInputValues());
    const requestId = createRequestId();
    state.saveInFlight = true;
    $("saveBtn").disabled = true;
    toast("Saving...", "info", 1500);
    const res = await submitAction(state.mode, requestId, rows);
    if (!res?.ok) throw new Error(res?.message || "บันทึกไม่สำเร็จ");
    clearDataCaches();
    if (state.mode === "order") {
      const orderView = await getOrderView();
      state.orderRows = orderView.rows || [];
    } else {
      const stock = await getCurrentStock();
      state.stockMap = stock.stock || {};
      const orderView = await getOrderView();
      state.orderRows = orderView.rows || [];
    }
    clearDraft();
    if (state.path.length) state.path.pop();
    render();
    toast(res.duplicate ? "บันทึกนี้เคยถูกส่งแล้ว" : "Saved", "success");
  } catch (err) {
    showError(err?.message || "บันทึกไม่สำเร็จ");
    toast("Error", "error");
  } finally {
    state.saveInFlight = false;
    $("saveBtn") && ($("saveBtn").disabled = false);
  }
}

function bindEvents() {
  $("loginBtn").addEventListener("click", () => {
    const name = $("employeeName").value.trim();
    if (!name) return showError("กรุณากรอกชื่อพนักงาน");
    setEmployee(name);
    persistSession(name);
    showError("");
    render();
  });
  $("employeeName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginBtn").click(); });
  $("logoutBtn").addEventListener("click", () => {
    logoutSession();
    resetNav();
    state.mode = "";
    render();
  });
  $$("[data-mode]").forEach((el) => el.addEventListener("click", () => chooseMode(el.dataset.mode)));
  $("homeBtn").addEventListener("click", () => { resetNav(); render(); });
  $("backBtn").addEventListener("click", () => { state.path.pop(); render(); });
  $("destinationButtons").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dest]");
    if (!btn) return;
    state.destination = btn.dataset.dest;
    renderDestinationPicker();
  });
  $("warmBtn")?.addEventListener("click", async () => {
    const res = await adminWarm();
    toast(res?.ok ? "Warm cache สำเร็จ" : "Warm cache ไม่สำเร็จ", res?.ok ? "success" : "error");
  });
  $("rebuildBtn")?.addEventListener("click", async () => {
    const res = await adminRebuild();
    toast(res?.ok ? "Rebuild สำเร็จ" : "Rebuild ไม่สำเร็จ", res?.ok ? "success" : "error", 2500);
  });
}

async function bootstrap() {
  dom = bindDom();
  state.admin = params().get("admin") === "1";
  restoreSession();
  bindEvents();
  render();
  refreshHealth();
  if (ENABLE_SERVICE_WORKER && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
bootstrap();
