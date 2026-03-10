import { GOOGLE_SCRIPT_URL } from "./config.js";
import { createRequestId } from "./utils.js";
function mustHaveUrl(){ if(!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PUT_YOUR_WEB_APP_EXEC_URL_HERE")) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL"); }
async function getJson(action, params={}){ mustHaveUrl(); const url=new URL(GOOGLE_SCRIPT_URL); url.searchParams.set("action",action); url.searchParams.set("_",Date.now()); Object.entries(params).forEach(([k,v])=>{ if(v!==undefined && v!==null && v!=="") url.searchParams.set(k,v); }); const res=await fetch(url.toString(),{method:"GET",cache:"no-store"}); return await res.json(); }
export const pingServer=()=>getJson("ping");
export const getCatalog=(mode)=>getJson("catalog",{mode});
export const getCurrentStockSummary=()=>getJson("currentStock");
export const getOrderView=()=>getJson("orderView");
export const getDailySnapshot=()=>getJson("dailySnapshot");
export const exportDebugLog=()=>getJson("exportDebug");
export const exportLineTargets=()=>getJson("exportLineTargets");
export const testLineOA=()=>getJson("testLineOA");
export const refreshLineSummary=()=>getJson("refreshLineSummary");
export const previewLineSummary=()=>getJson("previewLineSummary");
export const sendLineSummary=()=>getJson("sendLineSummary");
export async function submitRecords(records,timeoutMs=20000){ mustHaveUrl(); const requestId=createRequestId(); return await new Promise((resolve,reject)=>{ const iframeName=`submit_iframe_${requestId}`; const iframe=document.createElement("iframe"); iframe.name=iframeName; iframe.style.display="none"; document.body.appendChild(iframe); const form=document.createElement("form"); form.method="POST"; form.action=GOOGLE_SCRIPT_URL; form.target=iframeName; form.style.display="none"; const hidden=(name,val)=>{ const i=document.createElement("input"); i.type="hidden"; i.name=name; i.value=val; return i; }; form.appendChild(hidden("request_id",requestId)); form.appendChild(hidden("payload",JSON.stringify(records))); document.body.appendChild(form); let finished=false; const cleanup=()=>{ clearTimeout(timer); window.removeEventListener("message",onMessage); iframe.remove(); form.remove(); }; const onMessage=(event)=>{ const data=event.data; if(!data || data.type!=="realstock_ack" || data.request_id!==requestId) return; finished=true; cleanup(); resolve(data); }; const timer=setTimeout(()=>{ if(finished) return; cleanup(); reject(new Error("Timed out waiting for Apps Script response")); },timeoutMs); window.addEventListener("message",onMessage); form.submit(); }); }
