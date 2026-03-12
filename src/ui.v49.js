import { MODE_META, ISSUE_DESTINATIONS, APP_VERSION } from "./config.v49.js";
import { state } from "./state.v49.js";
import { $, $$, escapeHtml } from "./utils.v49.js";
import { getChildren, getItems, pathLabels, needsDestination, getScheduleBadge } from "./catalog.v49.js";

const dom = {};
export function bindDom() {
  ["loginPage","appPage","employeeName","loginBtn","logoutBtn","employeeDisplay","modeBadge","healthBadge","versionLabel","homeBtn","backBtn","breadcrumb","nodePanel","itemPanel","destinationPanel","destinationButtons","toast","errorBox","cacheStamp","adminPanel","warmBtn","rebuildBtn"]
    .forEach((id) => dom[id] = $(id));
  dom.versionLabel.textContent = APP_VERSION;
  return dom;
}
export function showError(message = "") {
  dom.errorBox.textContent = message;
  dom.errorBox.classList.toggle("hidden", !message);
}
export function toast(message, type = "info", ms = 1800) {
  dom.toast.className = `toast ${type}`;
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  clearTimeout(dom.toast._t);
  dom.toast._t = setTimeout(() => dom.toast.classList.add("hidden"), ms);
}
export function renderSession() {
  dom.loginPage.classList.toggle("hidden", !!state.employee);
  dom.appPage.classList.toggle("hidden", !state.employee);
  dom.employeeDisplay.textContent = state.employee || "-";
  dom.homeBtn.classList.toggle("hidden", !state.mode);
  dom.backBtn.classList.toggle("hidden", !state.mode || !state.path.length);
  const meta = MODE_META[state.mode];
  dom.modeBadge.textContent = meta?.label || "ยังไม่ได้เลือกโหมด";
  dom.modeBadge.dataset.modeColor = meta?.color || "";
}
export function setHealth(ok, text) {
  dom.healthBadge.textContent = text;
  dom.healthBadge.style.background = ok ? "#dcfce7" : "#fee2e2";
  dom.healthBadge.style.color = ok ? "#166534" : "#991b1b";
}
export function renderAdmin() {
  dom.adminPanel.classList.toggle("hidden", !state.admin);
}
export function renderBreadcrumb(tree) {
  const crumbs = pathLabels(tree, state.path);
  dom.breadcrumb.innerHTML = crumbs.map((c, idx) => {
    const sep = idx === 0 ? "" : '<span class="crumb-sep">›</span>';
    return `${sep}<span class="crumb"><span class="crumb-icon">${c.icon || "📁"}</span><span>${escapeHtml(c.label)}</span></span>`;
  }).join("");
  const node = state.path.length ? state.path[state.path.length - 1] : "";
  const badgeKey = state.path.length === 2 ? `${state.path[0]}__${state.path[1]}` : node;
  const badge = state.scheduleBadgeByPath[badgeKey] || "";
  dom.cacheStamp.innerHTML = `${escapeHtml(state.lastCacheStamp || "")}${badge ? ` <span class="mini-badge">${escapeHtml(badge)}</span>` : ""}`;
}
export function renderDestinationPicker() {
  const visible = needsDestination(state.mode);
  dom.destinationPanel.classList.toggle("hidden", !visible);
  if (!visible) return;
  dom.destinationButtons.innerHTML = ISSUE_DESTINATIONS.map((d) => {
    const selected = state.destination === d.key ? 'data-selected="1"' : "";
    return `<button class="btn" data-dest="${escapeHtml(d.key)}" ${selected}>${escapeHtml(d.label)}</button>`;
  }).join("");
}
export function renderNodesFromHtml(html, onOpen) {
  dom.itemPanel.classList.add("hidden");
  dom.nodePanel.classList.remove("hidden");
  dom.nodePanel.innerHTML = html || '<div class="card pad">ไม่พบหมวด</div>';
  $$('[data-node]', dom.nodePanel).forEach((el) => el.addEventListener('click', () => onOpen(el.dataset.node)));
  return true;
}
export function renderNodes(node, onOpen) {
  const children = getChildren(node);
  dom.itemPanel.classList.add("hidden");
  dom.nodePanel.classList.toggle("hidden", !children.length);
  if (!children.length) return false;
  dom.nodePanel.innerHTML = children.map((child) => {
    const badgeHtml = getScheduleBadge(child) ? `<span class="mini-badge">${escapeHtml(getScheduleBadge(child))}</span>` : "";
    return `
      <button class="nav-btn nav-card ${child.type || ''}" data-node="${escapeHtml(child.key)}">
        <div class="nav-top"><span class="nav-icon">${child.icon || '📁'}</span>${badgeHtml}</div>
        <div class="nav-title">${escapeHtml(child.label)}</div>
        <div class="hint">เปิดหมวด</div>
      </button>
    `;
  }).join("");
  $$('[data-node]', dom.nodePanel).forEach((el) => el.addEventListener('click', () => onOpen(el.dataset.node)));
  return true;
}
export function setSaveLocked(locked, label = "") {
  const saveBtn = $("saveBtn");
  if (!saveBtn) return;
  saveBtn.disabled = !!locked;
  saveBtn.dataset.originalLabel ||= saveBtn.textContent;
  saveBtn.textContent = locked ? (label || "Saving...") : saveBtn.dataset.originalLabel;
  $$('[data-step], [data-suggest], [data-qty-index], #clearBtn, #restoreBtn', dom.itemPanel).forEach((el) => {
    el.disabled = !!locked;
  });
}
export function renderItems(node, stockMap = {}, orderRows = [], onSave) {
  const items = getItems(node);
  dom.nodePanel.classList.add("hidden");
  dom.itemPanel.classList.remove("hidden");
  const meta = MODE_META[state.mode];
  if (!items.length) {
    dom.itemPanel.innerHTML = '<div class="card pad">ไม่พบรายการในหมวดนี้</div>';
    return;
  }
  const orderMap = Object.fromEntries(orderRows.map((x) => [x.item_key, x]));
  dom.itemPanel.innerHTML = `
    <div class="card pad">
      <div class="between" style="margin-bottom:12px">
        <div>
          <strong>${escapeHtml(meta.label)}</strong>
          <div class="hint">${state.mode === "count" ? "กรอกยอดคงเหลือจริง" : state.mode === "order" ? "กรอกจำนวนที่จะสั่ง หรือกดแนะนำ" : "กรอกจำนวนที่เปลี่ยนแปลง"}</div>
        </div>
        <div class="pill">${items.length} รายการ</div>
      </div>
      <div class="grid">
        ${items.map((item, idx) => {
          const stock = stockMap[item.item_key] || {};
          const order = orderMap[item.item_key] || {};
          const suggestion = Number(order.suggested_order_qty || 0);
          const badge = item.__scheduleBadge ? `<span class="mini-badge">${escapeHtml(item.__scheduleBadge)}</span>` : "";
          return `<div class="item">
            <div class="between" style="margin-bottom:6px;align-items:flex-start">
              <h4>${idx + 1}. ${escapeHtml(item.item_name)}</h4>
              ${badge}
            </div>
            <div class="meta">คงเหลือ ${escapeHtml(stock.current_stock ?? "-")} ${escapeHtml(item.unit || stock.unit || "")} • ${escapeHtml(item.brand || "-")}</div>
            ${state.mode === "order" ? `<div class="meta">Suggested: ${escapeHtml(suggestion || 0)} ${escapeHtml(item.unit || "")}</div>` : ""}
            <div class="qty-row">
              <input class="input qty" data-qty-index="${idx}" inputmode="decimal" type="number" min="0" step="any" placeholder="จำนวน" />
              <button class="btn step" data-step="${idx}:1">+1</button>
              <button class="btn step" data-step="${idx}:5">+5</button>
              <button class="btn step" data-step="${idx}:10">+10</button>
              ${state.mode === "order" ? `<button class="btn" data-suggest="${idx}:${suggestion || 0}">แนะนำ</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="footer-bar">
        <div class="row">
          <button id="saveBtn" class="btn primary">${escapeHtml(meta.saveLabel)}</button>
          <button id="clearBtn" class="btn">ล้างค่า</button>
          <button id="restoreBtn" class="btn">กู้ข้อมูลค้าง</button>
        </div>
      </div>
    </div>
  `;
  $$('[data-step]', dom.itemPanel).forEach((el) => el.addEventListener('click', () => {
    const [idx, step] = el.dataset.step.split(':').map(Number);
    const input = dom.itemPanel.querySelector(`[data-qty-index="${idx}"]`);
    const current = Number(input.value || 0);
    input.value = String(current + step);
    input.dispatchEvent(new Event('input'));
  }));
  $$('[data-suggest]', dom.itemPanel).forEach((el) => el.addEventListener('click', () => {
    const [idx, qty] = el.dataset.suggest.split(':');
    const input = dom.itemPanel.querySelector(`[data-qty-index="${idx}"]`);
    input.value = qty;
    input.dispatchEvent(new Event('input'));
  }));
  $("saveBtn").addEventListener("click", onSave);
}
export function renderSkeleton() {
  dom.nodePanel.classList.remove("hidden");
  dom.itemPanel.classList.add("hidden");
  dom.nodePanel.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
}
