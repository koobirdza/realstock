import {
  AUTOSAVE_DEBOUNCE_MS,
  ENABLE_SERVICE_WORKER,
  SAVE_TIMEOUT_MS,
  ADMIN_MODE,
  ENABLE_DRAFT_FEATURES
} from "./config.v46.js";
import { restoreSession, saveSession, clearSession } from "./auth.v46.js";
import { saveDraft, clearDraft, readDraft } from "./store.v46.js";
import { state, resetNavigation, setEmployee, setMode } from "./state.v46.js";
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
} from "./ui.v46.js";
import { getNodeByPath, getRootNode } from "./catalog.v46.js";
import { collectRecords } from "./inventory.v46.js";
import {
  pingServer,
  submitRecords,
  getCatalog,
  exportDebugLog,
  clearApiCache,
  getCurrentStockSummary,
  getDailySnapshot,
  testLineOA,
  exportLineTargets,
  getOrderView,
  refreshLineSummary,
  previewLineSummary,
  sendLineSummary
} from "./api.v46.js";
import { debounce } from "./utils.v46.js";

let saveInFlight = false;
let autosaveBound = false;

const STOCK_TTL_MS = 60 * 1000;
const ORDER_TTL_MS = 60 * 1000;

const runtimeCache = {
  stockLoadedAt: 0,
  orderLoadedAt: 0,
  catalogLoadedAt: {}
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

function isFresh(timestamp, ttlMs) {
  return timestamp && Date.now() - timestamp < ttlMs;
}

function updateDraftBadge() {
  if (!ENABLE_DRAFT_FEATURES) {
    setDraftBadge("");
    return;
  }

  const draft = readDraft();
  if (draft?.savedAt) {
    setDraftBadge("มีข้อมูลค้าง: " + new Date(draft.savedAt).toLocaleString("th-TH"));
  } else {
    setDraftBadge("");
  }
}

const autosaveDraft = debounce(() => {
  if (!ENABLE_DRAFT_FEATURES) return;

  const inputs = [...document.querySelectorAll("[data-qty-index]")]
    .map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value }))
    .filter((x) => x.value !== "");

  if (!inputs.length) return;

  saveDraft([
    {
      meta: {
        employee: state.employee,
        mode: state.mode,
        path: [...state.path],
        destination: state.destination
      },
      inputs
    }
  ]);

  updateDraftBadge();
}, AUTOSAVE_DEBOUNCE_MS);

function attachAutosaveDelegation() {
  if (autosaveBound || !ENABLE_DRAFT_FEATURES) return;
  autosaveBound = true;

  document.addEventListener("input", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("[data-qty-index]")) return;

    clearInlineError();
    autosaveDraft();
  });
}

function setupAdminToolsVisibility() {
  const el = dom();

  const adminNodes = [
    el.healthCheckBtn,
    el.dailySnapshotBtn,
    el.refreshLineSummaryBtn,
    el.previewLineSummaryBtn,
    el.sendLineSummaryBtn,
    el.testLineOABtn,
    el.exportDebugBtn,
    el.exportTargetsBtn
  ].filter(Boolean);

  adminNodes.forEach((node) => {
    node.style.display = ADMIN_MODE ? "" : "none";
  });

  if (el.systemToolsCard) {
    el.systemToolsCard.style.display = ADMIN_MODE ? "" : "none";
  }
}

async function loadCatalogForMode(mode, force = false) {
  if (force) clearApiCache(`catalog::${mode}`);

  const result = await getCatalog(mode, force);
  if (!result?.ok) throw new Error(result?.message || "โหลดรายการไม่สำเร็จ");

  state.catalogs[mode] = result.catalog_tree || {};
  runtimeCache.catalogLoadedAt[mode] = Date.now();
}

async function ensureCatalogLoaded(mode) {
  if (!state.catalogs[mode]) {
    await loadCatalogForMode(mode);
  }
}

async function loadStockSummary(force = false) {
  if (force) clearApiCache("currentStock::");

  const result = await getCurrentStockSummary(force);
  if (!result?.ok) throw new Error(result?.message || "โหลดสรุปสต๊อกไม่สำเร็จ");

  state.stockSummary = result.stock || {};
  runtimeCache.stockLoadedAt = Date.now();
}

async function loadOrderViewData(force = false) {
  if (force) clearApiCache("orderView::");

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
        renderAll();
      },
      onPickDestination: (dest) => {
        state.destination = dest;
        renderAll();
      },
      onSave: handleSave,
      onClear: null,
      onRestoreDraft: null
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
  }
}

function snapshotText(snapshot) {
  return [
    `วันที่: ${snapshot.report_date || "-"}`,
    `นับสต๊อกวันนี้: ${snapshot.count_count || 0} รายการ`,
    `เบิกของวันนี้: ${snapshot.withdraw_count || 0} รายการ`,
    `รับของวันนี้: ${snapshot.receive_count || 0} รายการ`,
    `ของในห้องสต๊อกต่ำกว่าขั้นต่ำ: ${snapshot.low_stock_count || 0} รายการ`,
    `ของสดที่ควรสั่งพรุ่งนี้: ${snapshot.order_count || 0} รายการ`
  ].join("\n");
}

function downloadTextFile(filename, text, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

  el.healthCheckBtn?.addEventListener("click", async () => {
    try {
      await refreshHealth();
      toast("เช็กเซิร์ฟเวอร์เสร็จแล้ว", "success");
    } catch (err) {
      showInlineError(err?.message || "เช็กเซิร์ฟเวอร์ไม่สำเร็จ");
    }
  });

  el.dailySnapshotBtn?.addEventListener("click", async () => {
    try {
      const result = await getDailySnapshot();
      if (!result?.ok) throw new Error(result?.message || "ดึงภาพรวมไม่สำเร็จ");
      clearInlineError();
      toast(snapshotText(result), "success", 5500);
    } catch (err) {
      showInlineError(err?.message || "ดึงภาพรวมไม่สำเร็จ");
    }
  });

  el.refreshLineSummaryBtn?.addEventListener("click", async () => {
    try {
      const result = await refreshLineSummary();
      if (!result?.ok) throw new Error(result?.message || "รีเฟรชไม่สำเร็จ");

      clearApiCache("orderView::");
      clearApiCache("currentStock::");
      runtimeCache.stockLoadedAt = 0;
      runtimeCache.orderLoadedAt = 0;

      toast(`รีเฟรช LINE Summary สำเร็จ • ${result.row_count || 0} แถว`, "success", 4500);

      if (state.mode === "order") {
        await loadOrderViewData(true);
      } else if (state.mode) {
        await loadStockSummary(true);
      }

      if (state.mode) renderAll();
    } catch (err) {
      showInlineError(err?.message || "รีเฟรช LINE Summary ไม่สำเร็จ");
    }
  });

  el.previewLineSummaryBtn?.addEventListener("click", async () => {
    try {
      const result = await previewLineSummary();
      if (!result?.ok) throw new Error(result?.message || "Preview ไม่สำเร็จ");
      showInlineError(result.message_text || "ไม่พบข้อความสำหรับส่ง LINE");
      toast("Preview LINE พร้อมแล้ว", "success", 3000);
    } catch (err) {
      showInlineError(err?.message || "Preview LINE ไม่สำเร็จ");
    }
  });

  el.sendLineSummaryBtn?.addEventListener("click", async () => {
    try {
      const result = await sendLineSummary();
      if (!result?.ok) throw new Error(result?.message || "ส่ง LINE ไม่สำเร็จ");
      clearInlineError();
      toast("ส่ง LINE สรุปสำเร็จ", "success", 4000);
    } catch (err) {
      showInlineError(err?.message || "ส่ง LINE สรุปไม่สำเร็จ");
    }
  });

  el.testLineOABtn?.addEventListener("click", async () => {
    try {
      const result = await testLineOA();
      if (!result?.ok) throw new Error(result?.message || "ทดสอบ LINE OA ไม่สำเร็จ");
      clearInlineError();
      toast("ส่งข้อความทดสอบ LINE OA สำเร็จ", "success", 4000);
    } catch (err) {
      showInlineError(err?.message || "ทดสอบ LINE OA ไม่สำเร็จ");
    }
  });

  el.exportDebugBtn?.addEventListener("click", async () => {
    try {
      const result = await exportDebugLog();
      if (!result?.ok) throw new Error(result?.message || "ดึง Debug ไม่สำเร็จ");
      downloadTextFile("realstock_debug_log.json", JSON.stringify(result.rows || [], null, 2), "application/json");
      toast(`Export Debug สำเร็จ • ${(result.rows || []).length} rows`, "success", 3500);
    } catch (err) {
      showInlineError(err?.message || "Export Debug ไม่สำเร็จ");
    }
  });

  el.exportTargetsBtn?.addEventListener("click", async () => {
    try {
      const result = await exportLineTargets();
      if (!result?.ok) throw new Error(result?.message || "ดึง Target IDs ไม่สำเร็จ");
      downloadTextFile("line_targets.json", JSON.stringify(result.rows || [], null, 2), "application/json");
      toast(`Export Target IDs สำเร็จ • ${(result.rows || []).length} rows`, "success", 3500);
    } catch (err) {
      showInlineError(err?.message || "Export Target IDs ไม่สำเร็จ");
    }
  });
}

function handleLogin() {
  const name = dom().employeeName.value.trim();

  if (!name) {
    showInlineError("กรุณากรอกชื่อพนักงานก่อนเข้าสู่ระบบ");
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
  setEmployee(null);
  setMode(null);
  resetNavigation();
  clearInlineError();
  renderAll();
  toast("ออกจากระบบแล้ว", "info");
}

async function handleSave() {
  if (saveInFlight) return;

  saveInFlight = true;

  try {
    clearInlineError();

    const inputRows = [...document.querySelectorAll("[data-qty-index]")].map((el) => ({
      index: Number(el.dataset.qtyIndex),
      value: el.value
    }));

    const records = collectRecords(currentCatalogTree(), inputRows);

    if (ENABLE_DRAFT_FEATURES) {
      saveDraft([
        {
          meta: {
            employee: state.employee,
            mode: state.mode,
            path: [...state.path],
            destination: state.destination
          },
          inputs: inputRows.filter((x) => x.value !== "")
        }
      ]);
      updateDraftBadge();
    }

    const result = await submitRecords(records, SAVE_TIMEOUT_MS);
    if (!result?.ok) throw new Error(result?.message || "บันทึกไม่สำเร็จ");

    clearDraft();
    updateDraftBadge();

    document.querySelectorAll("[data-qty-index]").forEach((el) => {
      el.value = "";
    });

    runtimeCache.stockLoadedAt = 0;
    runtimeCache.orderLoadedAt = 0;
    clearApiCache("currentStock::");
    clearApiCache("orderView::");

    if (state.mode === "order") {
      await loadOrderViewData(true);
    } else if (shouldUseStockData(state.mode)) {
      await loadStockSummary(true);
    }

    renderAll();
    toast(`บันทึกสำเร็จ • ${result.saved || 0} รายการ`, "success", 4500);
  } catch (err) {
    showInlineError(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก");
  } finally {
    saveInFlight = false;
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
  } catch (_) {
    // silent
  }
}

async function init() {
  try {
    bindDom();
    setupAdminToolsVisibility();
    restoreSession();
    updateDraftBadge();
    attachAutosaveDelegation();
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
