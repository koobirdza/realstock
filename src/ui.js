import { APP_VERSION, ISSUE_DESTINATIONS } from "./config.js";
import { state } from "./state.js";
import { getChildren, getItems, getPathLabels, needsDestination } from "./catalog.js";
import { escapeHtml, qs } from "./utils.js";

const els = {};

export function bindDom() {
  [
    "versionLabel","healthBadge","fatalError","errorPanel","toast","draftBadge",
    "loginPage","appPage","employeeName","loginBtn","employeeDisplay","logoutBtn",
    "countModeBtn","issueModeBtn","currentModeBadge",
    "navPanel","breadcrumb","homeBtn","backBtn",
    "destinationWrap","destinationButtons","nodeList","itemPanel","healthCheckBtn","refreshWeeklyBtn","exportDebugBtn"
  ].forEach((id) => { els[id] = qs(id); });

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

export function clearInlineError() {
  showInlineError("");
}

export function setHealth(ok, text) {
  els.healthBadge.textContent = text;
  els.healthBadge.className = ok ? "text-emerald-600" : "text-amber-600";
}

export function setDraftBadge(text = "") {
  els.draftBadge.textContent = text;
  els.draftBadge.className = text ? "text-blue-600" : "text-slate-400";
}

export function toast(message, type = "info", timeout = 2600) {
  const map = {
    info: "bg-slate-800",
    success: "bg-emerald-600",
    error: "bg-red-600",
    warn: "bg-amber-600"
  };
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
  const modeText = state.mode === "count" ? "🟢 นับสต๊อก" : state.mode === "issue" ? "🔵 เบิกของ" : "ยังไม่ได้เลือกโหมด";
  els.currentModeBadge.textContent = modeText;
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
    return `<button data-dest="${escapeHtml(x.key)}" class="px-4 py-3 rounded-2xl border ${active ? "bg-blue-600 text-white border-blue-700" : "bg-white border-slate-200"}">${escapeHtml(x.label)}</button>`;
  }).join("");

  els.destinationButtons.querySelectorAll("[data-dest]").forEach((btn) => {
    btn.addEventListener("click", () => onPick(btn.dataset.dest));
  });
}

export function renderNavigation(node, handlers) {
  els.breadcrumb.textContent = getPathLabels(state.path).join(" › ");
  renderDestinationPicker(handlers.onPickDestination);

  const children = getChildren(node);
  const items = getItems(node);

  if (children.length) {
    els.nodeList.classList.remove("hidden");
    els.itemPanel.classList.add("hidden");
    els.nodeList.innerHTML = children.map((child) => `
      <button data-node="${escapeHtml(child.key)}" class="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-orange-400 hover:shadow transition">
        <div class="text-xl mb-1">${escapeHtml(child.icon || "📦")}</div>
        <div class="font-semibold">${escapeHtml(child.label || child.key)}</div>
      </button>
    `).join("");

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

  els.itemPanel.innerHTML = `
    <div class="space-y-3">
      ${items.map((item, idx) => {
        const minText = state.mode === "count"
          ? `ขั้นต่ำคงเหลือ ${escapeHtml(item.minRemain || "-")}`
          : `ขั้นต่ำเบิก ${escapeHtml(item.minIssue || "-")}`;
        const inputHint = state.mode === "count" ? "ยอดคงเหลือ" : "จำนวนที่เบิก";
        return `
          <div class="rounded-2xl border border-slate-200 p-4 bg-white">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-semibold">${idx + 1}. ${escapeHtml(item.name)}</div>
                <div class="text-sm text-slate-600">แบรนด์: ${escapeHtml(item.brand || "-")} • หน่วย: ${escapeHtml(item.unit || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">${minText}</div>
              </div>
              <div class="w-full sm:w-48">
                <input
                  data-qty-index="${idx}"
                  type="number"
                  min="0"
                  step="any"
                  inputmode="decimal"
                  class="w-full border rounded-2xl px-4 py-3"
                  placeholder="${inputHint}"
                />
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <div class="sticky-bottom mt-4 border border-slate-200 rounded-2xl p-3 flex gap-2 flex-wrap">
      <button id="saveBtn" class="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold">💾 บันทึก</button>
      <button id="clearBtn" class="px-6 py-3 rounded-2xl bg-slate-100">ล้างค่า</button>
      <button id="restoreDraftBtn" class="px-6 py-3 rounded-2xl bg-slate-100">กู้ค่าค้าง</button>
    </div>
  `;

  qs("saveBtn").addEventListener("click", handlers.onSave);
  qs("clearBtn").addEventListener("click", handlers.onClear);
  qs("restoreDraftBtn").addEventListener("click", handlers.onRestoreDraft);
}
