import { GOOGLE_SCRIPT_URL } from "./config.js";
import { createRequestId } from "./utils.js";

export async function pingServer() {
  if (!GOOGLE_SCRIPT_URL) return { ok: false, message: "ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL" };
  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=ping&_=${Date.now()}`, { method: "GET", cache: "no-store" });
    return await res.json();
  } catch (err) {
    return { ok: false, message: err?.message || "Ping failed" };
  }
}

async function getJson(action) {
  const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}&_=${Date.now()}`, { method: "GET", cache: "no-store" });
  return await res.json();
}

export const refreshWeeklyUsage = () => getJson("refreshWeekly");
export const exportDebugLog = () => getJson("exportDebug");
export const getCurrentStockSummary = () => getJson("currentStock");
export const getDailyReport = () => getJson("dailyReport");

export async function testLineOA() {
  const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=testLineOA&_=${Date.now()}`, { method: "GET", cache: "no-store" });
  return await res.json();
}

export async function exportLineTargets() {
  const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=exportLineTargets&_=${Date.now()}`, { method: "GET", cache: "no-store" });
  return await res.json();
}

export async function submitRecords(records, timeoutMs = 12000) {
  if (!GOOGLE_SCRIPT_URL) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL");
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

    const makeHidden = (name, value) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      return input;
    };

    form.appendChild(makeHidden("request_id", requestId));
    form.appendChild(makeHidden("payload", JSON.stringify(records)));
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
