import { CACHE_TTL, GOOGLE_SCRIPT_URL, SAVE_TIMEOUT_MS } from "./config.v49.js";
import { getCache, setCache, clearCache } from "./store.v49.js";
import { withTimeout } from "./utils.v49.js";

function mustHaveUrl() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PUT_YOUR_WEB_APP_EXEC_URL_HERE")) {
    throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL");
  }
}
function buildUrl(action, params = {}) {
  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}
export async function getJson(action, params = {}, cacheName = "", ttlMs = 0) {
  mustHaveUrl();
  if (cacheName && ttlMs > 0) {
    const hit = getCache(cacheName);
    if (hit?.value) return hit.value;
  }
  const res = await fetch(buildUrl(action, { ...params, _: Date.now() }), { method: "GET", cache: "no-store" });
  const json = await res.json();
  if (cacheName && ttlMs > 0 && json?.ok) setCache(cacheName, json, ttlMs);
  return json;
}
export function clearDataCaches() {
  clearCache("catalog.");
  clearCache("stock.");
  clearCache("order.");
}
export function setCurrentStockCache(payload) {
  if (payload?.ok) setCache("stock.current", payload, CACHE_TTL.stock);
}
export function setOrderViewCache(payload) {
  if (payload?.ok) setCache("order.view", payload, CACHE_TTL.orderView);
}
export const health = () => getJson("health");
export const getCatalog = (mode) => getJson("catalog", { mode }, `catalog.${mode}`, CACHE_TTL.catalog);
export const getCurrentStock = () => getJson("currentStock", {}, "stock.current", CACHE_TTL.stock);
export const getOrderView = () => getJson("orderView", {}, "order.view", CACHE_TTL.orderView);
export const adminWarm = () => getJson("adminWarm", { admin: 1 });
export const adminRebuild = () => getJson("adminRebuild", { admin: 1 });

export async function submitAction(action, requestId, rows) {
  mustHaveUrl();
  const res = await withTimeout(fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, requestId, rows })
  }), SAVE_TIMEOUT_MS, "save timeout");
  return await res.json();
}
