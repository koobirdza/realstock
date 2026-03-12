import { ISSUE_DESTINATIONS, QUICK_QTY_PRESETS } from './config.v47.js';
import { state } from './state.v47.js';
import { getChildren, getItems, getModeMeta, getPathLabels, needsDestination } from './catalog.v47.js';
import { escapeHtml, qs } from './utils.v47.js';

const els = {};

export function bindDom() {
  [
    'versionLabel', 'healthLabel', 'loginPage', 'appPage', 'employeeName', 'loginBtn', 'employeeDisplay', 'logoutBtn',
    'countModeBtn', 'issueModeBtn', 'receiveModeBtn', 'orderModeBtn', 'currentModeBadge', 'workspaceCard', 'breadcrumb',
    'viewStatus', 'homeBtn', 'backBtn', 'destinationWrap', 'destinationButtons', 'nodeList', 'itemPanel', 'draftBadge',
    'errorPanel', 'adminPanel', 'healthCheckBtn', 'clearClientCacheBtn', 'reloadViewsBtn', 'toastWrap'
  ].forEach((id) => { const el = qs(id); if (el) els[id] = el; });
}
export function dom() { return els; }
export function setVersion(text) { if (els.versionLabel) els.versionLabel.textContent = text; }
export function setHealth(ok, text) { els.healthLabel.textContent = text; els.healthLabel.style.color = ok ? '#047857' : '#b45309'; }
export function showInlineError(message) { els.errorPanel.textContent = message; els.errorPanel.classList.remove('hidden'); }
export function clearInlineError() { els.errorPanel.textContent = ''; els.errorPanel.classList.add('hidden'); }
export function setDraftBadge(text) { els.draftBadge.textContent = text || ''; }
export function setViewStatus(text) { els.viewStatus.textContent = text || ''; }

export function pushToast(message, type = 'info', ttl = 2200) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastWrap.appendChild(toast);
  setTimeout(() => toast.remove(), ttl);
}

export function renderSession() {
  const loggedIn = !!state.employee;
  els.loginPage.classList.toggle('hidden', loggedIn);
  els.appPage.classList.toggle('hidden', !loggedIn);
  els.workspaceCard.classList.toggle('hidden', !loggedIn || !state.mode);
  els.logoutBtn.classList.toggle('hidden', !loggedIn);
  els.employeeDisplay.textContent = state.employee || '-';
  els.employeeName.value = state.employee || '';
}

export function renderMode() {
  const meta = getModeMeta(state.mode);
  els.currentModeBadge.textContent = meta.label;
  els.currentModeBadge.className = `badge ${meta.badge}`;
  els.workspaceCard.className = `card p16 stack ${meta.panel || ''}`;
}

function renderDestinationPicker(onPick) {
  const show = needsDestination(state.mode, state.path);
  els.destinationWrap.classList.toggle('hidden', !show);
  if (!show) {
    els.destinationButtons.innerHTML = '';
    return;
  }
  els.destinationButtons.innerHTML = ISSUE_DESTINATIONS.map((x) => {
    const active = state.destination === x.key;
    return `<button class="btn ${active ? 'btn-issue' : 'btn-ghost'}" data-dest="${escapeHtml(x.key)}">${escapeHtml(x.label)}</button>`;
  }).join('');
  els.destinationButtons.querySelectorAll('[data-dest]').forEach((btn) => btn.addEventListener('click', () => onPick(btn.dataset.dest)));
}

function renderSkeletons(count = 5) {
  return Array.from({ length: count }).map(() => '<div class="skeleton"></div>').join('');
}

function quickButtons(index, suggested = 0) {
  const suggestedBtn = suggested > 0 ? `<button type="button" class="chip chip-fill" data-quick-set="${index}" data-quick-mode="replace" data-quick-value="${escapeHtml(suggested)}">แนะนำ ${escapeHtml(suggested)}</button>` : '';
  return `
    <div class="chip-row">
      ${QUICK_QTY_PRESETS.map((n) => `<button type="button" class="chip" data-quick-set="${index}" data-quick-mode="add" data-quick-value="${n}">+${n}</button>`).join('')}
      ${suggestedBtn}
      <button type="button" class="chip" data-quick-set="${index}" data-quick-mode="replace" data-quick-value="0">ล้าง</button>
    </div>`;
}

function bindQuickButtons(onQuickSet) {
  document.querySelectorAll('[data-quick-set]').forEach((btn) => {
    btn.addEventListener('click', () => onQuickSet(Number(btn.dataset.quickSet), Number(btn.dataset.quickValue), btn.dataset.quickMode));
  });
}

function renderOrderInputs(items, handlers, orderRows) {
  const orderMap = Object.fromEntries((orderRows || []).map((r) => [r.item_key, r]));
  const filtered = items.map((item, index) => ({ item, index, order: orderMap[item.item_key] || {} }));
  const actionable = filtered.filter(({ order }) => Number(order.suggested_order_qty || 0) > 0 || Number(order.target_par || 0) > 0);
  if (!actionable.length) {
    els.itemPanel.innerHTML = '<div class="card p16">หมวดย่อยนี้ยังไม่มีรายการที่ต้องสั่งของ</div>';
    return;
  }
  els.itemPanel.innerHTML = `
    <div class="card p16" style="background:#faf5ff;border-color:#ddd6fe">โหมดสั่งของจะบันทึกเข้า Order_Log โดยไม่ตัด stock ทันที</div>
    <div class="list">
      ${actionable.map(({ item, index, order }) => `
        <div class="item-row card">
          <div>
            <div class="item-name">${index + 1}. ${escapeHtml(item.item_name)}</div>
            <div class="item-sub">คงเหลือ ${escapeHtml(order.current_stock ?? 0)} ${escapeHtml(item.unit || '')} • par ${escapeHtml(order.target_par ?? 0)} • แนะนำ ${escapeHtml(order.suggested_order_qty ?? 0)}</div>
            ${quickButtons(index, Number(order.suggested_order_qty || 0))}
          </div>
          <div><input data-qty-index="${index}" type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(order.suggested_order_qty ?? 0)}" placeholder="จำนวนที่สั่ง" /></div>
        </div>`).join('')}
    </div>
    <div class="sticky-action">
      <div class="card p16 toolbar">
        <button id="saveBtn" class="btn btn-order">ยืนยันสั่งของ</button>
        <button id="clearBtn" class="btn btn-ghost">ล้างค่า</button>
        <button id="restoreDraftBtn" class="btn btn-ghost">กู้ค่าค้าง</button>
      </div>
    </div>`;
  qs('saveBtn').addEventListener('click', handlers.onSave);
  qs('clearBtn').addEventListener('click', handlers.onClear);
  qs('restoreDraftBtn').addEventListener('click', handlers.onRestoreDraft);
  bindQuickButtons(handlers.onQuickSet);
}

function renderInputs(items, handlers, stockSummary) {
  const meta = getModeMeta(state.mode);
  els.itemPanel.innerHTML = `
    <div class="list">
      ${items.map((item, index) => {
        const stock = stockSummary[item.item_key] || {};
        const low = stock.status === 'LOW' ? '<span class="badge" style="background:#fee2e2;color:#991b1b">ต่ำกว่าขั้นต่ำ</span>' : '';
        return `
          <div class="item-row card">
            <div>
              <div class="item-name">${index + 1}. ${escapeHtml(item.item_name)}</div>
              <div class="item-sub">${escapeHtml(item.brand || '-')} • หน่วย ${escapeHtml(item.unit || '-')} • คงเหลือ ${escapeHtml(stock.current_stock ?? '-')}</div>
              ${low}
              ${quickButtons(index)}
            </div>
            <div><input data-qty-index="${index}" type="number" min="0" step="any" inputmode="decimal" placeholder="จำนวน" /></div>
          </div>`;
      }).join('')}
    </div>
    <div class="sticky-action">
      <div class="card p16 toolbar">
        <button id="saveBtn" class="btn ${meta.button}">บันทึก</button>
        <button id="clearBtn" class="btn btn-ghost">ล้างค่า</button>
        <button id="restoreDraftBtn" class="btn btn-ghost">กู้ค่าค้าง</button>
      </div>
    </div>`;
  qs('saveBtn').addEventListener('click', handlers.onSave);
  qs('clearBtn').addEventListener('click', handlers.onClear);
  qs('restoreDraftBtn').addEventListener('click', handlers.onRestoreDraft);
  bindQuickButtons(handlers.onQuickSet);
}

export function setSaveDisabled(disabled, label = 'บันทึก') {
  const btn = qs('saveBtn');
  if (!btn) return;
  btn.disabled = disabled;
  btn.textContent = label;
}

export function renderNavigation(node, handlers, stockSummary = {}, orderRows = []) {
  els.breadcrumb.textContent = getPathLabels(handlers.catalogTree, state.path).join(' › ');
  renderDestinationPicker(handlers.onPickDestination);
  const children = getChildren(node);
  const items = getItems(node);

  if (state.loadingView) {
    els.nodeList.classList.remove('hidden');
    els.itemPanel.classList.add('hidden');
    els.nodeList.innerHTML = renderSkeletons();
    return;
  }

  if (children.length) {
    els.nodeList.classList.remove('hidden');
    els.itemPanel.classList.add('hidden');
    els.nodeList.innerHTML = children.map((child) => `
      <button class="nav-btn" data-node="${escapeHtml(child.key)}">
        <div>${escapeHtml(child.icon || '📁')} ${escapeHtml(child.label || child.key)}</div>
        <small>${child.items?.length ? `${child.items.length} รายการ` : 'เปิดดูรายละเอียด'}</small>
      </button>`).join('');
    els.nodeList.querySelectorAll('[data-node]').forEach((btn) => btn.addEventListener('click', () => handlers.onOpenChild(btn.dataset.node)));
    return;
  }

  els.nodeList.classList.add('hidden');
  els.itemPanel.classList.remove('hidden');

  if (!items.length) {
    els.itemPanel.innerHTML = '<div class="card p16">ไม่พบรายการสินค้าในหมวดนี้</div>';
    return;
  }

  if (state.mode === 'order') {
    renderOrderInputs(items, handlers, orderRows);
    return;
  }

  renderInputs(items, handlers, stockSummary);
}
