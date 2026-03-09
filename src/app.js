import { AUTOSAVE_DEBOUNCE_MS, ENABLE_SERVICE_WORKER, SAVE_TIMEOUT_MS } from "./config.js";
import { restoreSession, saveSession, clearSession } from "./auth.js";
import { saveDraft, clearDraft, readDraft } from "./store.js";
import { state, resetNavigation, setEmployee, setMode } from "./state.js";
import { bindDom, dom, renderMode, renderNavigation, renderSession, setHealth, setDraftBadge, showFatalError, showInlineError, clearInlineError, toast } from "./ui.js";
import { getNodeByPath } from "./catalog.js";
import { collectRecords } from "./inventory.js";
import { pingServer, submitRecords, refreshWeeklyUsage, exportDebugLog, getCurrentStockSummary, getDailyReport, testLineOA, exportLineTargets } from "./api.js";
import { debounce } from "./utils.js";

let currentStockSummary = {};

function bootCheck() {
  bindDom();
  const checks = [
    ["window.fetch", typeof window.fetch === "function"],
    ["submitRecords", typeof submitRecords === "function"],
    ["collectRecords", typeof collectRecords === "function"]
  ];
  const failed = checks.filter((x) => !x[1]);
  if (failed.length) throw new Error("Boot check failed: " + failed.map((x) => x[0]).join(", "));
}

function updateDraftBadge() {
  const draft = readDraft();
  if (draft?.savedAt) setDraftBadge("มีข้อมูลค้าง: " + new Date(draft.savedAt).toLocaleString("th-TH"));
  else setDraftBadge("");
}

const autosaveDraft = debounce(() => {
  const inputs = [...document.querySelectorAll("[data-qty-index]")].map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value })).filter((x) => x.value !== "");
  if (!inputs.length) return;
  saveDraft([{ meta: { employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination }, inputs }]);
  updateDraftBadge();
}, AUTOSAVE_DEBOUNCE_MS);

function attachAutosave() {
  document.querySelectorAll("[data-qty-index]").forEach((el) => {
    el.addEventListener("input", () => {
      clearInlineError();
      autosaveDraft();
    });
  });
}

async function loadStockSummary() {
  try {
    const result = await getCurrentStockSummary();
    if (result?.ok && result.stock) currentStockSummary = result.stock;
  } catch (err) {
    console.error(err);
  }
}

function renderAll() {
  renderSession();
  renderMode();
  updateDraftBadge();
  if (state.mode) {
    renderNavigation(getNodeByPath(state.path), {
      onOpenChild: (key) => { state.path.push(key); renderAll(); },
      onPickDestination: (dest) => { state.destination = dest; renderAll(); },
      onSave: handleSave,
      onClear: () => {
        document.querySelectorAll("[data-qty-index]").forEach((el) => el.value = "");
        clearDraft(); updateDraftBadge(); clearInlineError();
      },
      onRestoreDraft: restoreDraftIntoForm
    }, currentStockSummary);
    attachAutosave();
  }
}

async function refreshHealth() {
  const result = await pingServer();
  if (result?.ok) setHealth(true, `เซิร์ฟเวอร์พร้อมใช้งาน • ${result.version || ""}`);
  else setHealth(false, "เซิร์ฟเวอร์ยังไม่พร้อม • เข้าระบบได้ แต่บันทึกอาจไม่สำเร็จ");
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function rowsToCsv(rows = []) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
  return lines.join("\n");
}

function bindEvents() {
  const el = dom();
  el.loginBtn.addEventListener("click", handleLogin);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.countModeBtn.addEventListener("click", async () => { setMode("count"); clearInlineError(); await loadStockSummary(); renderAll(); });
  el.issueModeBtn.addEventListener("click", async () => { setMode("issue"); clearInlineError(); await loadStockSummary(); renderAll(); });
  el.receiveModeBtn.addEventListener("click", async () => { setMode("receive"); clearInlineError(); await loadStockSummary(); renderAll(); });
  el.homeBtn.addEventListener("click", () => { resetNavigation(); clearInlineError(); renderAll(); });
  el.backBtn.addEventListener("click", () => { if (state.path.length) state.path.pop(); clearInlineError(); renderAll(); });
  el.employeeName.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

  el.healthCheckBtn?.addEventListener("click", async () => { toast("กำลังเช็กเซิร์ฟเวอร์...", "info"); await refreshHealth(); toast("เช็กเซิร์ฟเวอร์เสร็จแล้ว", "success"); });

  el.refreshWeeklyBtn?.addEventListener("click", async () => {
    try {
      toast("กำลังรีเฟรช Weekly...", "info");
      const result = await refreshWeeklyUsage();
      if (!result?.ok) throw new Error(result?.message || "รีเฟรชไม่สำเร็จ");
      toast(`รีเฟรชสำเร็จ • ${result.rowCount || 0} แถว`, "success", 3500);
    } catch (err) {
      showInlineError(err?.message || "รีเฟรช Weekly ไม่สำเร็จ");
      toast(err?.message || "รีเฟรชไม่สำเร็จ", "error");
    }
  });

  el.dailyReportBtn?.addEventListener("click", async () => {
    try {
      toast("กำลังดึงรายงานรายวัน...", "info");
      const result = await getDailyReport();
      if (!result?.ok) throw new Error(result?.message || "ดึงรายงานไม่สำเร็จ");
      const low = result.low_stock_count || 0;
      toast(`รายงานวันนี้พร้อมแล้ว • ใกล้หมด ${low} รายการ`, low > 0 ? "warn" : "success", 4500);
      if (low > 0) showInlineError(`วันนี้มีรายการใกล้หมด ${low} รายการ กรุณาเช็ก Daily_Report_View หรือใช้ Export Excel`);
      else clearInlineError();
    } catch (err) {
      showInlineError(err?.message || "ดึงรายงานรายวันไม่สำเร็จ");
      toast(err?.message || "ดึงรายงานไม่สำเร็จ", "error");
    }
  });

  el.exportExcelBtn?.addEventListener("click", async () => {
    try {
      toast("กำลังเตรียมไฟล์สำหรับ Excel...", "info");
      const result = await getDailyReport();
      if (!result?.ok) throw new Error(result?.message || "Export ไม่สำเร็จ");
      const csv = rowsToCsv(result.rows || []);
      downloadTextFile(`daily_report_${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv;charset=utf-8");
      toast(`Export สำหรับ Excel สำเร็จ • ${(result.rows || []).length} แถว`, "success", 4500);
    } catch (err) {
      showInlineError(err?.message || "Export Excel ไม่สำเร็จ");
      toast(err?.message || "Export ไม่สำเร็จ", "error");
    }
  });

  el.exportDebugBtn?.addEventListener("click", async () => {
    try {
      toast("กำลังดึง Debug Log...", "info");
      const result = await exportDebugLog();
      if (!result?.ok) throw new Error(result?.message || "ดึง Debug ไม่สำเร็จ");
      downloadTextFile("realstock_debug_log.json", JSON.stringify(result.rows || [], null, 2), "application/json");
      toast(`Export Debug สำเร็จ • ${(result.rows || []).length} rows`, "success", 3500);
    } catch (err) {
      showInlineError(err?.message || "Export Debug ไม่สำเร็จ");
      toast(err?.message || "Export ไม่สำเร็จ", "error");
    }
  });
}

function handleLogin() {
  const name = dom().employeeName.value.trim();
  if (!name) {
    showInlineError("กรุณากรอกชื่อพนักงานก่อนเข้าสู่ระบบ");
    toast("กรุณากรอกชื่อพนักงาน", "warn");
    dom().employeeName.focus();
    return;
  }
  setEmployee(name); saveSession(); clearInlineError(); renderAll(); toast("เข้าสู่ระบบแล้ว", "success");
}

function handleLogout() {
  clearSession(); setEmployee(null); setMode(null); resetNavigation(); clearInlineError(); renderAll(); toast("ออกจากระบบแล้ว", "info");
}

function restoreDraftIntoForm() {
  const draft = readDraft();
  const payload = draft?.payload?.[0];
  if (!payload?.inputs?.length) { toast("ไม่พบข้อมูลค้าง", "warn"); return; }
  const meta = payload.meta || {};
  if (meta.mode && meta.mode !== state.mode) { showInlineError("ข้อมูลค้างเป็นคนละโหมด กรุณาเลือกโหมดให้ตรงก่อนกู้ข้อมูล"); return; }
  const inputs = [...document.querySelectorAll("[data-qty-index]")];
  payload.inputs.forEach((saved) => {
    const input = inputs.find((el) => Number(el.dataset.qtyIndex) === Number(saved.index));
    if (input) input.value = saved.value;
  });
  toast("กู้ค่าค้างกลับมาแล้ว", "success");
}

async function handleSave() {
  try {
    clearInlineError();
    const inputRows = [...document.querySelectorAll("[data-qty-index]")].map((el) => ({ index: Number(el.dataset.qtyIndex), value: el.value }));
    const records = collectRecords(inputRows);
    saveDraft([{ meta: { employee: state.employee, mode: state.mode, path: [...state.path], destination: state.destination }, records }]);
    updateDraftBadge();
    toast("กำลังบันทึกข้อมูล...", "info", 1500);
    const result = await submitRecords(records, SAVE_TIMEOUT_MS);
    if (!result?.ok) throw new Error(result?.message || "บันทึกไม่สำเร็จ");
    clearDraft(); updateDraftBadge();
    document.querySelectorAll("[data-qty-index]").forEach((el) => el.value = "");
    await loadStockSummary();
    renderAll();
    toast(`บันทึกสำเร็จ • count ${result.count_saved || 0} • issue ${result.issue_saved || 0} • receive ${result.receive_saved || 0}`, "success", 4000);
    const report = await getDailyReport();
    if (report?.ok && report.low_stock_count > 0) showInlineError(`มี ${report.low_stock_count} รายการใกล้หมด ระบบอัปเดตรายงานรายวันแล้ว`);
  } catch (err) {
    console.error(err);
    const msg = err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก";
    showInlineError(msg);
    toast(msg, "error", 4500);
  }
}

async function main() {
  try {
    bootCheck();
    bindEvents();
    restoreSession();
    renderAll();
    await refreshHealth();
    await loadStockSummary();
    if (ENABLE_SERVICE_WORKER && "serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
  } catch (err) {
    console.error(err);
    showFatalError(err?.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", main);
