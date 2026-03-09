import { APP_VERSION, ISSUE_DESTINATIONS } from "./config.js";
import { state } from "./state.js";
import { getChildren, getItems, getPathLabels, needsDestination, getModeMeta } from "./catalog.js";
import { escapeHtml, qs } from "./utils.js";

const els = {};

function modeBadgeClasses(color) {
  const map = {
    green: "bg-emerald-200 border-emerald-500 text-emerald-950 shadow-sm",
    blue: "bg-blue-200 border-blue-500 text-blue-950 shadow-sm",
    orange: "bg-orange-200 border-orange-500 text-orange-950 shadow-sm",
    slate: "bg-slate-200 border-slate-400 text-slate-900 shadow-sm"
  };
  return map[color] || map.slate;
}

export function bindDom() {
  [
    "versionLabel","healthBadge","fatalError","errorPanel","toast","draftBadge",
    "loginPage","appPage","employeeName","loginBtn","employeeDisplay","logoutBtn",
    "countModeBtn","issueModeBtn","receiveModeBtn","currentModeBadge",
    "navPanel","breadcrumb","homeBtn","backBtn",
    "destinationWrap","destinationButtons","nodeList","itemPanel",
    "healthCheckBtn","refreshWeeklyBtn","dailyReportBtn","exportExcelBtn","exportDebugBtn",
    "testLineOABtn","exportTargetsBtn"
  ].forEach((id) => {
    const found = document.getElementById(id);
    if (found) els[id] = found;
  });
  els.versionLabel.textContent = APP_VERSION;
}

export function dom() { return els; }

export function showFatalError(message) {
  els.fatalError.textContent = message;
  els.fatalError.classList.remove("hidden");
}

export function showInlineError(message) {
  els.errorPanel.textContent = message || "";
  els.errorPanel.classList.toggle("hidden", !message);
}

export function clearInlineError() { showInlineError(""); }

export function setHealth(ok, text) {
  els.healthBadge.textContent = text;
  els.healthBadge.className = ok ? "text-emerald-600" : "text-amber-600";
}

export function setDraftBadge(text = "") {
  els.draftBadge.textContent = text;
  els.draftBadge.className = text ? "text-blue-600" : "text-slate-400";
}

export function toast(message, type = "info", timeout = 2600) {
  const map = { info: "bg-slate-800", success: "bg-emerald-600", error: "bg-red-600", warn: "bg-amber-600" };
  els.toast.textContent = message;
  els.toast.className = `fixed top-4 right-4 z-50 rounded-2xl px-4 py-3 shadow-xl text-white ${map[type] || map.info}`;
  els.toast.classList.remove("hidden");
  clearTimeout(els.toastTimer);
  els.toastTimer = setTimeout(() => els.toast.classList.add("hidden"), timeout);
}

export function renderSession() {
  const loggedIn = !!state.employee;
  els.loginPage.classList.toggle("hidden", loggedIn);
  els.appPage.classList.toggle("hidden", !loggedIn);
  els.employeeDisplay.textContent = state.employee || "";
  els.employeeName.value = state.employee || "";
}

export function renderMode() {
  const meta = getModeMeta(state.mode);
  els.currentModeBadge.textContent = meta.label;
  els.currentModeBadge.className = `px-3 py-1 rounded-full text-sm border ${modeBadgeClasses(meta.color)}`;
  els.navPanel.classList.toggle("hidden", !state.mode);
}

export function renderDestinationPicker(onPick) {
  const shouldShow = needsDestination(state.mode, state.path);
  els.destinationWrap.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    els.destinationButtons.innerHTML = "";
    return;
  }
  els.destinationButtons.innerHTML = ISSUE_DESTINATIONS.map((x) => {
    const active = state.destination === x.key;
    return `<button data-dest="${escapeHtml(x.key)}" class="px-4 py-3 rounded-2xl border font-semibold transition ${active ? "bg-blue-800 text-white border-blue-950 shadow-md" : "bg-slate-200 text-slate-900 border-slate-400 hover:bg-slate-300"}">${escapeHtml(x.label)}</button>`;
  }).join("");
  els.destinationButtons.querySelectorAll("[data-dest]").forEach((btn) => btn.addEventListener("click", () => onPick(btn.dataset.dest)));
}


export function renderNavigation(node, handlers, stockSummary = {}) {
  els.breadcrumb.textContent = getPathLabels(state.path).join(" › ");
  renderDestinationPicker(handlers.onPickDestination);

  const children = getChildren(node);
  const items = getItems(node);

  const modeSurfaceClass = state.mode === "count"
    ? "mode-surface-green"
    : state.mode === "issue"
    ? "mode-surface-blue"
    : state.mode === "receive"
    ? "mode-surface-orange"
    : "mode-surface-default";

  const navRoot = els.nodeList.closest(".card");
  if (navRoot) {
    navRoot.classList.remove("mode-surface-green", "mode-surface-blue", "mode-surface-orange", "mode-surface-default");
    navRoot.classList.add(modeSurfaceClass);
  }

  if (children.length) {
    els.nodeList.classList.remove("hidden");
    els.itemPanel.classList.add("hidden");
    els.nodeList.innerHTML = children.map((child) => {
      const extraClass =
        child.key === "front" ? "node-front" :
        child.key === "kitchen" ? "node-kitchen" :
        child.key === "bar" ? "node-bar" :
        child.key === "stock" ? "node-stock" : "bg-white";

      return `
        <button data-node="${escapeHtml(child.key)}" class="text-left border border-slate-400 rounded-2xl p-4 hover:border-orange-700 hover:shadow-lg transition ${extraClass}">
          <div class="text-xl mb-1">${escapeHtml(child.icon || "📦")}</div>
          <div class="font-semibold">${escapeHtml(child.label || child.key)}</div>
        </button>
      `;
    }).join("");

    els.nodeList.querySelectorAll("[data-node]").forEach((btn) => {
      btn.addEventListener("click", () => handlers.onOpenChild(btn.dataset.node));
    });
    return;
  }

  els.nodeList.classList.add("hidden");
  els.itemPanel.classList.remove("hidden");

  if (!items.length) {
    els.itemPanel.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">ไม่พบรายการสินค้าในหมวดนี้</div>`;
    return;
  }

  const modeColor = state.mode === "count" ? "emerald" : state.mode === "issue" ? "blue" : "orange";
  const saveLabel = state.mode === "count" ? "💾 บันทึกยอดคงเหลือ" : state.mode === "issue" ? "💾 บันทึกการเบิก" : "💾 บันทึกรับของเข้า";
  const inputHint = state.mode === "count" ? "ยอดคงเหลือ" : state.mode === "issue" ? "จำนวนที่เบิก" : "จำนวนที่รับเข้า";

  els.itemPanel.innerHTML = `
    <div class="space-y-3">
      ${items.map((item, idx) => {
        const stock = stockSummary[item.name] ?? "";
        const stockLine = stock !== "" ? `คงเหลือ ${escapeHtml(stock)}` : `คงเหลือ -`;
        const minValue = state.mode === "issue" ? (item.minIssue || "-") : (item.minRemain || "-");
        const minText = `ขั้นต่ำ ${escapeHtml(minValue)}`;
        const lowBadge = (stock !== "" && Number(stock) <= Number(item.minRemain || item.minIssue || 0))
          ? '<span class="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">ใกล้หมด</span>'
          : '';
        return `
          <div class="rounded-2xl border border-slate-300 p-4 bg-white/95 shadow-sm">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-[220px] flex-1">
                <div class="font-semibold">${idx + 1}. ${escapeHtml(item.name)}</div>
                <div class="text-sm text-slate-600">แบรนด์: ${escapeHtml(item.brand || "-")}</div>
                <div class="text-sm text-slate-600">หน่วย: ${escapeHtml(item.unit || "-")} • ${minText}</div>
                <div class="text-sm text-slate-700 mt-1">${stockLine}</div>
                ${lowBadge}
              </div>
              <div class="w-full sm:w-48">
                <input
                  data-qty-index="${idx}"
                  type="number"
                  min="0"
                  step="any"
                  inputmode="decimal"
                  class="w-full border rounded-2xl px-4 py-3 bg-white"
                  placeholder="${inputHint}"
                />
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <div class="sticky-bottom mt-4 border border-slate-300 rounded-2xl p-3 flex gap-2 flex-wrap bg-white/95 shadow-md">
      <button id="saveBtn" class="px-6 py-3 rounded-2xl bg-${modeColor}-800 text-white font-semibold shadow-md hover:brightness-110">${saveLabel}</button>
      <button id="clearBtn" class="px-6 py-3 rounded-2xl bg-slate-300 text-slate-950 font-semibold hover:bg-slate-400">ล้างค่า</button>
      <button id="restoreDraftBtn" class="px-6 py-3 rounded-2xl bg-slate-300 text-slate-950 font-semibold hover:bg-slate-400">กู้ค่าค้าง</button>
    </div>
  `;

  qs("saveBtn").addEventListener("click", handlers.onSave);
  qs("clearBtn").addEventListener("click", handlers.onClear);
  qs("restoreDraftBtn").addEventListener("click", handlers.onRestoreDraft);
}

