import { ENABLE_SERVICE_WORKER, SAVE_TIMEOUT_MS } from "./config.v47.js";
import { restoreSession, saveSession, clearSession } from "./auth.v47.js";
import { clearDraft } from "./store.v47.js";
import { state, resetNavigation, setEmployee, setMode } from "./state.v47.js";
import {
  bindDom,
  dom,
  renderMode,
  renderNavigation,
  renderSession,
  setHealth,
  setDraftBadge,
  showFatalError,
  showInlineError,
  clearInlineError,
  toast
} from "./ui.v47.js";
import { getNodeByPath, getRootNode } from "./catalog.v47.js";
import { collectRecords } from "./inventory.v47.js";
import {
  pingServer,
  submitRecords,
  getCatalog,
  clearApiCache,
  getCurrentStockSummary,
  getDailySnapshot,
  getOrderView
} from "./api.v47.js";

let saveInFlight = false;

const STOCK_TTL_MS = 60 * 1000;
const ORDER_TTL_MS = 60 * 1000;

const runtimeCache = {
  stockLoadedAt: 0,
  orderLoadedAt: 0
};

function currentCatalogTree() {
  return state.catalogs[state.mode] || {};
}

function currentNode() {
  return getNodeByPath(currentCatalogTree(), state.path) || getRootNode(currentCatalogTree());
}

function hasObjectData(obj) {
  return !!obj && Object.keys(obj).length > 0;
}

function isFresh(ts, ttl) {
  return ts && Date.now() - ts < ttl;
}

function updateDraftBadge() {
  setDraftBadge("");
}

function setSaveButtonState(isSaving) {
  const btn = document.getElementById("saveBtn");
  if (!btn) return;

  if (isSaving) {
    btn.disabled = true;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent || "บันทึก";
    btn.textContent = "กำลังบันทึก...";
    btn.classList.add("opacity-60", "cursor-not-allowed");
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || "บันทึก";
    btn.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function navigateBackToSubcategorySelection() {
  if (!Array.isArray(state.path) || !state.path.length) {
    resetNavigation();
    return;
  }
  state.path = [state.path[0]];
  state.destination = "";
}

async function ensureCatalogLoaded(mode) {
  if (!state.catalogs[mode]) {
    const result = await getCatalog(mode);
    if (!result?.ok) throw new Error(result?.message || "โหลดรายการไม่สำเร็จ");
    state.catalogs[mode] = result.catalog_tree || {};
  }
}

async function loadStockSummary(force = false) {
  const result = await getCurrentStockSummary(force);
  if (!result?.ok) throw new Error(result?.message || "โหลดสรุปสต๊อกไม่สำเร็จ");
  state.stockSummary = result.stock || {};
  runtimeCache.stockLoadedAt = Date.now();
}

async function loadOrderViewData(force = false) {
  const result = await getOrderView(force);
  if (!result?.ok) throw new Error(result?.message || "โหลดรายการสั่งของไม่สำเร็จ");
  state.orderRows = result.rows || [];
  runtimeCache.orderLoadedAt = Date.now();
}

function hasFreshStockSummary() {
  return hasObjectData(state.stockSummary) && isFresh(runtimeCache.stockLoadedAt, STOCK_TTL_MS);
}

function hasFreshOrderView() {
  return Array.isArray(state.orderRows) && state.orderRows.length > 0 && isFresh(runtimeCache.orderLoadedAt, ORDER_TTL_MS);
}

function shouldUseStockData(mode) {
  return mode === "count" || mode === "issue" || mode === "receive";
}

function renderAll() {
  renderSession();
  renderMode();

  if (!state.employee || !state.mode) return;

  renderNavigation(
    currentNode(),
    {
      catalogTree: currentCatalogTree(),
      onOpenChild: (key) => {
        state.path.push(key);
        clearInlineError();
        renderAll();
      },
      onPickDestination: (dest) => {
        state.destination = dest;
        clearInlineError();
        renderAll();
      },
      onSave: handleSave
    },
    state.stockSummary,
    state.orderRows
  );
}

async function refreshHealth() {
  try {
    const result = await pingServer();
    setHealth(
      !!result?.ok,
      result?.ok
        ? `เซิร์ฟเวอร์พร้อม • ${result.version || ""}`
        : `เซิร์ฟเวอร์มีปัญหา • ${result?.message || ""}`
    );
  } catch (err) {
    setHealth(false, `เซิร์ฟเวอร์มีปัญหา • ${err?.message || "เชื่อมต่อไม่ได้"}`);
  }
}

async function prepareMode(mode) {
  setMode(mode);
  clearInlineError();

  await ensureCatalogLoaded(mode);
  renderAll();

  const hasUsableCache =
    mode === "order"
      ? hasFreshOrderView()
      : shouldUseStockData(mode)
      ? hasFreshStockSummary()
      : true;

  if (hasUsableCache) return;

  try {
    if (mode === "order") {
      await loadOrderViewData(false);
    } else if (shouldUseStockData(mode)) {
      await loadStockSummary(false);
    }
    renderAll();
  } catch (err) {
    showInlineError(err?.message || "โหลดข้อมูลไม่สำเร็จ");
    toast(err?.message || "โหลดข้อมูลไม่สำเร็จ", "error", 3500);
  }
}

function bindEvents() {
  const el = dom();

  el.loginBtn?.addEventListener("click", handleLogin);
  el.logoutBtn?.addEventListener("click", handleLogout);

  el.countModeBtn?.addEventListener("click", async () => prepareMode("count"));
  el.issueModeBtn?.addEventListener("click", async () => prepareMode("issue"));
  el.orderModeBtn?.addEventListener("click", async () => prepareMode("order"));
  el.receiveModeBtn?.addEventListener("click", async () => prepareMode("receive"));

  el.homeBtn?.addEventListener("click", () => {
    resetNavigation();
    clearInlineError();
    renderAll();
  });

  el.backBtn?.addEventListener("click", () => {
    if (state.path.length) state.path.pop();
    clearInlineError();
    renderAll();
  });

  el.employeeName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
}

function handleLogin() {
  const name = dom().employeeName.value.trim();

  if (!name) {
    showInlineError("กรุณากรอกชื่อพนักงานก่อนเข้าสู่ระบบ");
    toast("กรุณากรอกชื่อพนักงานก่อนเข้าสู่ระบบ", "warn", 3000);
    return;
  }

  setEmployee(name);
  saveSession();
  clearInlineError();
  renderAll();
  toast("เข้าสู่ระบบแล้ว", "success");

  warmupCoreData();
}

function handleLogout() {
  clearSession();
  clearDraft();
  setEmployee("");
  setMode("");
  resetNavigation();
  clearInlineError();
  renderAll();
  toast("ออกจากระบบแล้ว", "info");
}

async function handleSave() {
  if (saveInFlight) {
    toast("กำลังบันทึกอยู่ กรุณารอสักครู่", "warn", 2500);
    return;
  }

  saveInFlight = true;
  setSaveButtonState(true);

  try {
    clearInlineError();
    toast("กำลังบันทึกข้อมูล...", "info", 1800);

    const inputRows = [...document.querySelectorAll("[data-qty-index]")]
      .map((el) => ({
        index: Number(el.dataset.qtyIndex),
        value: el.value
      }));

    const records = collectRecords(currentNode(), inputRows, {
      employee: state.employee,
      mode: state.mode,
      destination: state.destination
    });

    if (!records.length) {
      throw new Error("กรุณากรอกจำนวนอย่างน้อย 1 รายการก่อนบันทึก");
    }

    const result = await submitRecords(records, SAVE_TIMEOUT_MS);
    if (!result?.ok) throw new Error(result?.message || "บันทึกไม่สำเร็จ");

    runtimeCache.stockLoadedAt = 0;
    runtimeCache.orderLoadedAt = 0;
    clearApiCache("currentStock::");
    clearApiCache("orderView::");

    if (shouldUseStockData(state.mode)) {
      await loadStockSummary(true);
    } else if (state.mode === "order") {
      await loadOrderViewData(true);
    }

    navigateBackToSubcategorySelection();
    renderAll();

    toast(`บันทึกสำเร็จ • ${result.saved || records.length} รายการ`, "success", 3500);
  } catch (err) {
    showInlineError(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก");
    toast(err?.message || "บันทึกไม่สำเร็จ", "error", 4000);
  } finally {
    saveInFlight = false;
    setSaveButtonState(false);
  }
}

async function warmupCoreData() {
  try {
    if (!state.employee) return;

    if (!state.catalogs.count) {
      await ensureCatalogLoaded("count");
    }

    if (!hasFreshStockSummary()) {
      loadStockSummary(false).catch(() => {});
    }

    setTimeout(() => {
      ensureCatalogLoaded("issue").catch(() => {});
      ensureCatalogLoaded("receive").catch(() => {});
      ensureCatalogLoaded("order").catch(() => {});
      if (!hasFreshOrderView()) loadOrderViewData(false).catch(() => {});
    }, 800);
  } catch (_) {}
}

async function init() {
  try {
    bindDom();
    restoreSession();
    updateDraftBadge();
    bindEvents();

    renderAll();
    refreshHealth();

    if (state.employee) {
      warmupCoreData();
    }

    if (ENABLE_SERVICE_WORKER && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (err) {
    console.error(err);
    showFatalError(err?.message || "ไม่สามารถเริ่มต้นระบบได้");
  }
}

init();
