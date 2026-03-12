import { CACHE_TTL_MS, GOOGLE_SCRIPT_URL } from './config.v47.js';
import { createRequestId } from './utils.v47.js';

const mem = new Map();

function mustHaveUrl() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('PUT_YOUR_WEB_APP_EXEC_URL_HERE')) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL');
}
function keyOf(action, params = {}) { return `${action}::${JSON.stringify(params)}`; }
function getCache(key) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { mem.delete(key); return null; }
  return hit.value;
}
function setCache(key, value, ttl) {
  mem.set(key, { value, expiresAt: Date.now() + ttl });
}
export function clearClientCache(prefix = '') {
  [...mem.keys()].forEach((k) => { if (!prefix || k.startsWith(prefix)) mem.delete(k); });
}
async function getJson(action, params = {}, { useCache = false, ttl = 0 } = {}) {
  mustHaveUrl();
  const key = keyOf(action, params);
  if (useCache) {
    const cached = getCache(key);
    if (cached) return cached;
  }
  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('_', String(Date.now()));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  const json = await res.json();
  if (useCache && json?.ok) setCache(key, json, ttl);
  return json;
}

export const healthCheck = () => getJson('health');
export const getCatalog = (mode) => getJson('catalog', { mode }, { useCache: true, ttl: CACHE_TTL_MS.catalog });
export const getCurrentStock = () => getJson('currentStock', {}, { useCache: true, ttl: CACHE_TTL_MS.stock });
export const getOrderView = () => getJson('orderView', {}, { useCache: true, ttl: CACHE_TTL_MS.orderView });
export const reloadViews = () => getJson('reloadViews');

export async function submitRecords(action, records, timeoutMs = 30000) {
  mustHaveUrl();
  const requestId = createRequestId();
  return await new Promise((resolve, reject) => {
    const iframeName = `realstock_submit_${requestId}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = 'none';

    const appendHidden = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    appendHidden('action', action);
    appendHidden('requestId', requestId);
    appendHidden('payload', JSON.stringify(records));
    document.body.appendChild(form);

    let done = false;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      form.remove();
    };
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== 'realstock_ack' || data.requestId !== requestId) return;
      done = true;
      cleanup();
      clearClientCache('currentStock::');
      clearClientCache('orderView::');
      resolve(data);
    };
    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error('Timed out waiting for Apps Script response'));
    }, timeoutMs);

    window.addEventListener('message', onMessage);
    form.submit();
  });
}
