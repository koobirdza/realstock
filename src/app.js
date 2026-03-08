import { ENABLE_EXPORT_DEBUG, ENABLE_SERVICE_WORKER, ENABLE_WEEKLY_REFRESH_BUTTON, SAVE_TIMEOUT_MS } from "./config.js";
import { restoreSession, saveSession, clearSession } from "./auth.js";
import { saveDraft, clearDraft, readDraft } from "./store.js";
import { state, resetNavigation, setEmployee, setMode } from "./state.js";
import { bindDom, dom, renderMode, renderNavigation, renderSession, setHealth, setDraftBadge, showFatalError, showInlineError, clearInlineError, toast } from "./ui.js";
import { getNodeByPath } from "./catalog.js";
import { collectRecords } from "./inventory.js";
import { pingServer, submitRecords, refreshWeeklyUsage, exportDebugLog } from "./api.js";
import { debounce } from "./utils.js";

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
  if (draft?.savedAt) {
    setDraftBadge("มีข้อมูลค้าง: " + new Date(draft.savedAt).toLocaleString("th-TH"));
  } else {
    setDraftBadge("");
  }
}

const autosaveDraft = debounce(() => {
  const inputs = [...document.querySelectorAll("[data-qty-index]")].map((el) => ({
    index: Number(el.dataset.qtyIndex),
    value: el.value
  })).filter((x) => x.value !== "");

  if (!inputs.length) return;
  saveDraft([{
    meta: {
      employee: state.employee,
      mode: state.mode,
      path: [...state.path],
      destination: state.destination
    },
    inputs
  }]);
  updateDraftBadge();
}, 350);

function attachAutosave() {
  document.querySelectorAll("[data-qty-index]").forEach((el) => {
    el.addEventListener("input", () => {
      clearInlineError();
      autosaveDraft();
    });
  });
}

function renderAll() {
  renderSession();
  renderMode();
  updateDraftBadge();

  if (state.mode) {
    renderNavigation(getNodeByPath(state.path), {
      onOpenChild: (key) => {
        state.path.push(key);
        renderAll();
      },
      onPickDestination: (dest) => {
        state.destination = dest;
        renderAll();
      },
      onSave: handleSave,
      onClear: () => {
        document.querySelectorAll("[data-qty-index]").forEach((el) => el.value = "");
        clearDraft();
        updateDraftBadge();
        clearInlineError();
      },
      onRestoreDraft: restoreDraftIntoForm
    });
    attachAutosave();
  }
}

async function refreshHealth() {
  const result = await pingServer();
  if (result?.ok) {
    setHealth(true, `เซิร์ฟเวอร์พร้อมใช้งาน • ${result.version || ""}`);
  } else {
    setHealth(false, "เซิร์ฟเวอร์ยังไม่พร้อม • เข้าระบบได้ แต่บันทึกอาจไม่สำเร็จ");
  }
}

function bindEvents() {
  const el = dom();
  el.loginBtn.addEventListener("click", handleLogin);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.countModeBtn.addEventListener("click", () => {
    setMode("count");
    clearInlineError();
    renderAll();
  });
  el.issueModeBtn.addEventListener("click", () => {
    setMode("issue");
    clearInlineError();
    renderAll();
  });
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

  if (el.healthCheckBtn) {
    el.healthCheckBtn.addEventListener("click", async () => {
      toast("กำลังเช็กเซิร์ฟเวอร์...", "info");
      await refreshHealth();
      toast("เช็กเซิร์ฟเวอร์เสร็จแล้ว", "success");
    });
  }

  if (el.refreshWeeklyBtn) {
    el.refreshWeeklyBtn.addEventListener("click", async () => {
      try {
        toast("กำลังรีเฟรช Weekly Usage...", "info");
        const result = await refreshWeeklyUsage();
        if (!result?.ok) throw new Error(result?.message || "รีเฟรชไม่สำเร็จ");
        toast(`รีเฟรชสำเร็จ • ${result.rowCount || 0} แถว`, "success", 3500);
      } catch (err) {
        showInlineError(err?.message || "รีเฟรช Weekly Usage ไม่สำเร็จ");
        toast(err?.message || "รีเฟรชไม่สำเร็จ", "error");
      }
    });
  }

  if (el.exportDebugBtn) {
    el.exportDebugBtn.addEventListener("click", async () => {
      try {
        toast("กำลังดึง Debug Log...", "info");
        const result = await exportDebugLog();
        if (!result?.ok) throw new Error(result?.message || "ดึง Debug Log ไม่สำเร็จ");
        const blob = new Blob([JSON.stringify(result.rows || [], null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "realstock_debug_log.json";
        a.click();
        URL.revokeObjectURL(a.href);
        toast(`Export สำเร็จ • ${result.rows?.length || 0} rows`, "success", 3500);
      } catch (err) {
        showInlineError(err?.message || "Export Debug ไม่สำเร็จ");
        toast(err?.message || "Export ไม่สำเร็จ", "error");
      }
    });
  }
}

function handleLogin() {
  const name = dom().employeeName.value.trim();
  if (!name) {
    showInlineError("กรุณากรอกชื่อพนักงานก่อนเข้าสู่ระบบ");
    toast("กรุณากรอกชื่อพนักงาน", "warn");
    dom().employeeName.focus();
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
    const input = inputs.find((el) => Number(el.dataset.qtyIndex) === Number(saved.index));
    if (input) input.value = saved.value;
  });
  toast("กู้ค่าค้างกลับมาแล้ว", "success");
}

async function handleSave() {
  try {
    clearInlineError();
    const inputRows = [...document.querySelectorAll("[data-qty-index]")].map((el) => ({
      index: Number(el.dataset.qtyIndex),
      value: el.value
    }));

    const records = collectRecords(inputRows);
    saveDraft([{
      meta: {
        employee: state.employee,
        mode: state.mode,
        path: [...state.path],
        destination: state.destination
      },
      records
    }]);
    updateDraftBadge();
    toast("กำลังบันทึกข้อมูล...", "info", 1500);

    const result = await submitRecords(records, SAVE_TIMEOUT_MS);
    if (!result?.ok) {
      throw new Error(result?.message || "บันทึกไม่สำเร็จ");
    }

    clearDraft();
    updateDraftBadge();
    document.querySelectorAll("[data-qty-index]").forEach((el) => el.value = "");
    toast(`บันทึกสำเร็จ • count ${result.count_saved || 0} • issue ${result.issue_saved || 0}`, "success", 3500);
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

    if (ENABLE_SERVICE_WORKER && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    }
  } catch (err) {
    console.error(err);
    showFatalError(err?.message || String(err));
  }
}

document.addEventListener("DOMContentLoaded", main);
