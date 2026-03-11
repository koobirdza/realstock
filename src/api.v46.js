import { CLIENT_CACHE_TTL_MS, GOOGLE_SCRIPT_URL } from "./config.v46.js";
import { createRequestId } from "./utils.v46.js";

const memoryCache = new Map();

function mustHaveUrl() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PUT_YOUR_WEB_APP_EXEC_URL_HERE")) {
    throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL");
  }
}

function cacheKey(action, params = {}) {
  return action + "::" + JSON.stringify(params || {});
}

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;

  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return hit.value;
}

function setCached(key, value, ttlMs = CLIENT_CACHE_TTL_MS) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

export function clearApiCache(prefix = "") {
  [...memoryCache.keys()].forEach((key) => {
    if (!prefix || key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  });
}

async function getJson(
  action,
  params = {},
  { useCache = false, ttlMs = CLIENT_CACHE_TTL_MS, force = false } = {}
) {
  mustHaveUrl();

  const key = cacheKey(action, params);

  if (useCache && !force) {
    const cached = getCached(key);
    if (cached) return cached;
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("_", Date.now());

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store"
  });

  const json = await res.json();

  if (useCache && json?.ok) {
    setCached(key, json, ttlMs);
  }

  return json;
}

export const pingServer = () => getJson("ping");

export const getCatalog = (mode, force = false) =>
  getJson("catalog", { mode }, { useCache: true, ttlMs: 10 * 60 * 1000, force });

export const getCurrentStockSummary = (force = false) =>
  getJson("currentStock", {}, { useCache: true, ttlMs: CLIENT_CACHE_TTL_MS, force });

export const getOrderView = (force = false) =>
  getJson("orderView", {}, { useCache: true, ttlMs: CLIENT_CACHE_TTL_MS, force });

export const getDailySnapshot = () => getJson("dailySnapshot");
export const exportDebugLog = () => getJson("exportDebug");
export const exportLineTargets = () => getJson("exportLineTargets");
export const testLineOA = () => getJson("testLineOA");
export const refreshLineSummary = () => getJson("refreshLineSummary");
export const previewLineSummary = () => getJson("previewLineSummary");
export const sendLineSummary = () => getJson("sendLineSummary");

export async function submitRecords(records, timeoutMs = 20000) {
  mustHaveUrl();

  const requestId = createRequestId();

  return await new Promise((resolve, reject) => {
    const iframeName = `submit_iframe_${requestId}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = GOOGLE_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = "none";

    const hidden = (name, val) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = val;
      return input;
    };

    form.appendChild(hidden("request_id", requestId));
    form.appendChild(hidden("payload", JSON.stringify(records)));
    document.body.appendChild(form);

    let finished = false;

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      form.remove();
    };

    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "realstock_ack" || data.request_id !== requestId) return;

      finished = true;
      cleanup();

      clearApiCache("catalog::");
      clearApiCache("currentStock::");
      clearApiCache("orderView::");

      resolve(data);
    };

    const timer = setTimeout(() => {
      if (finished) return;
      cleanup();
      reject(new Error("Timed out waiting for Apps Script response"));
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    form.submit();
  });
}
