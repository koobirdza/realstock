import { AUTOSAVE_DEBOUNCE_MS, ENABLE_SERVICE_WORKER, SAVE_TIMEOUT_MS } from "./config.v46.js";
import { restoreSession, saveSession, clearSession } from "./auth.v46.js";
import { saveDraft, clearDraft, readDraft } from "./store.v46.js";
import { state, resetNavigation, setEmployee, setMode } from "./state.v46.js";
import { bindDom, dom, renderMode, renderNavigation, renderSession, setHealth, setDraftBadge, showFatalError, showInlineError, clearInlineError, toast } from "./ui.v46.js";
import { getNodeByPath, getRootNode } from "./catalog.v46.js";
import { collectRecords } from "./inventory.v46.js";
import { pingServer, submitRecords, getCatalog, exportDebugLog, clearApiCache, getCurrentStockSummary, getDailySnapshot, testLineOA, exportLineTargets, getOrderView, refreshLineSummary, previewLineSummary, sendLineSummary } from "./api.v46.js";
import { debounce } from "./utils.v46.js";

let saveInFlight = false;

function currentCatalogTree() {
  return state.catalogs[state.mode] || {};
}

function currentNode() {
  return getNodeByPath(currentCatalogTree(), state.path) || getRootNode(currentCatalogTree());
}

function updateDraftBadge() {
  const draft = readDraft();
  if (draft?.savedAt) {
    setDraftBadge("มีข้อมูลค้าง: " + new Date(draft.savedAt).toLocaleString("th-TH"));
  } else {
    setDraftBadge("");
  }
}

const autosaveDraft = debounce(() => {
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

function attachAutosave() {
  document.querySelectorAll("[data-qty-index]").forEach((el) =>
    el.addEventListener("input", () => {
      clearInlineError();
      autosaveDraft();
    })
  );
}

async function loadCatalogForMode(mode) {
  const result = await getCatalog(mode);
  if (!result?.ok) throw new Error(result?.message || "โหลดรายการไม่สำเร็จ");
  state.catalogs[mode] = result.catalog_tree || {};
}

async function ensureCatalogLoaded(mode) {
  if (!state.catalogs[mode]) {
    await loadCatalogForMode(mode);
  }
}

async function loadStockSummary(force = false) {
  if (force) clearApiCache("currentStock::");
  const result = await getCurrentStockSummary();
  if (!result?.ok) throw new Error(result?.message || "โหลดสรุปสต๊อกไม่สำเร็จ");
  state.stockSummary = result.stock || {};
}

async function loadOrderViewData(force = false) {
  if (force) clearApiCache("orderView::");
  const result = await getOrderView();
  if (!result?.ok) throw new Error(result?.message || "โหลดรายการสั่งของไม่สำเร็จ");
  state.orderRows = result.rows || [];
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
        attachAutosave();
      },
      onPickDestination: (dest) => {
        state.destination = dest;
        renderAll();
        attachAutosave();
      },
      onSave: handleSave,
      onClear: () => {
        document.querySelectorAll("[data-qty-index]").forEach((el) => {
          el.value = "";
        });
        clearDraft();
        updateDraftBadge();
        toast("ล้างค่าในฟอร์มแล้ว", "info");
      },
      onRestoreDraft: restoreDraftIntoForm
    },
    state.stockSummary,
    state.orderRows
  );

  attachAutosave();
}

async function refreshHealth() {
  const result = await pingServer();
  setHealth(
    !!result?.ok,
    result?.ok
      ? `เซิร์ฟเวอร์พร้อม • ${result.version || ""}`
      : `เซิร์ฟเวอร์มีปัญหา • ${result?.message || ""}`
  );
}

async function prepareMode(mode) {
  setMode(mode);
  clearInlineError();
  await ensureCatalogLoaded(mode);

  if (mode === "order") {
    await loadOrderViewData();
  } else {
    await loadStockSummary();
  }

  renderAll();
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

  el.loginBtn.addEventListener("click", handleLogin);
  el.logoutBtn.addEventListener("click", handleLogout);

  el.countModeBtn.addEventListener("click", async () => prepareMode("count"));
  el.issueModeBtn.addEventListener("click", async () => prepareMode("issue"));
  el.orderModeBtn.addEventListener("click", async () => prepareMode("order"));
  el.receiveModeBtn.addEventListener("click", async () => prepareMode("receive"));

  el.homeBtn.addEventListener("click", () => {
    resetNavigation();
    clearInlineError();
    renderAll();
  });

  el.backBtn.addEventListener("click", () => {
    if (state.path.length) state.path.pop();
    clearInlineError();
    renderAll();
  });

  el.employeeName.addEventListener("keydown", (e) => {
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

function restoreDraftIntoForm() {
  const draft = readDraft();
  const payload = draft?.payload?.[0];

  if (!payload?.inputs?.length) {
    toast("ไม่พบข้อมูลค้าง", "warn");
    return;
  }

  const meta = payload.meta || {};

  if (meta.mode && meta.mode !== state.mode) {
    showInlineError("ข้อมูลค้างเป็นคนละโหมด กรุณาเลือกโหมดให้ตรงก่อนกู้ข้อมูล");
    return;
  }

  const inputs = [...document.querySelectorAll("[data-qty-index]")];

  payload.inputs.forEach((saved) => {
    const input = inputs.find(
      (inputEl) => Number(inputEl.dataset.qtyIndex) === Number(saved.index)
    );
    if (input) input.value = saved.value;
  });

  toast("กู้ค่าค้างกลับมาแล้ว", "success");
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

    const result = await submitRecords(records, SAVE_TIMEOUT_MS);
    if (!result?.ok) throw new Error(result?.message || "บันทึกไม่สำเร็จ");

    clearDraft();
    updateDraftBadge();

    document.querySelectorAll("[data-qty-index]").forEach((el) => {
      el.value = "";
    });

    if (state.mode === "order") {
      await loadOrderViewData(true);
    } else {
      await loadStockSummary(true);
      await loadOrderViewData(true);
    }

    renderAll();
    toast(`บันทึกสำเร็จ • ${result.saved || 0} รายการ`, "success", 4500);
  } catch (err) {
    showInlineError(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก");
  } finally {
    saveInFlight = false;
  }
}

async function init() {
  try {
    bindDom();
    restoreSession();
    updateDraftBadge();
    bindEvents();
    await refreshHealth();
    renderAll();

    if (ENABLE_SERVICE_WORKER && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  } catch (err) {
    console.error(err);
    showFatalError(err?.message || "ไม่สามารถเริ่มต้นระบบได้");
  }
}

init();
