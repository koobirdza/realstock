import { CLIENT_CACHE_TTL_MS, GOOGLE_SCRIPT_URL } from "./config.v47.js";
import { createRequestId } from "./utils.v47.js";

const memoryCache = new Map();

function assertUrl() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PUT_YOUR_WEB_APP_EXEC_URL_HERE")) {
    throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL");
  }
}

function getCacheKey(action, params = {}) {
  return action + "::" + JSON.stringify(params || {});
}

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    memoryCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key, value, ttl = CLIENT_CACHE_TTL_MS) {
  memoryCache.set(key, {
    value,
    expireAt: Date.now() + ttl
  });
}

export function clearApiCache(prefix = "") {
  [...memoryCache.keys()].forEach((key) => {
    if (!prefix || key.startsWith(prefix)) memoryCache.delete(key);
  });
}

async function getJson(action, params = {}, { useCache = false, ttl = CLIENT_CACHE_TTL_MS, force = false } = {}) {
  assertUrl();

  const key = getCacheKey(action, params);
  if (useCache && !force) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("_", String(Date.now()));

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const json = await res.json();

  if (useCache && json?.ok) setCached(key, json, ttl);
  return json;
}

export function pingServer() {
  return getJson("ping");
}

export function getCatalog(mode, force = false) {
  return getJson("catalog", { mode }, { useCache: true, ttl: 10 * 60 * 1000, force });
}

export function getCurrentStockSummary(force = false) {
  return getJson("currentStock", {}, { useCache: true, ttl: CLIENT_CACHE_TTL_MS, force });
}

export function getOrderView(force = false) {
  return getJson("orderView", {}, { useCache: true, ttl: CLIENT_CACHE_TTL_MS, force });
}

export function getDailySnapshot() {
  return getJson("dailySnapshot");
}

export async function submitRecords(records, timeoutMs = 20000) {
  assertUrl();

  return await new Promise((resolve, reject) => {
    const requestId = createRequestId();
    const iframeName = "submit_iframe_" + requestId;

    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = GOOGLE_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = "none";

    const addHidden = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addHidden("request_id", requestId);
    addHidden("payload", JSON.stringify(records));
    document.body.appendChild(form);

    let done = false;

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      form.remove();
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "realstock_ack" || data.request_id !== requestId) return;
      done = true;
      cleanup();
      clearApiCache("currentStock::");
      clearApiCache("orderView::");
      resolve(data);
    };

    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      reject(new Error("Timed out waiting for Apps Script response"));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    form.submit();
  });
}
