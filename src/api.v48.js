import { CACHE_TTL, GOOGLE_SCRIPT_URL, SAVE_TIMEOUT_MS } from './config.v48.js';
import { createRequestId } from './utils.v48.js';
import { clearMem, getMem, setMem } from './store.v48.js';
function mustUrl(){if(!GOOGLE_SCRIPT_URL||GOOGLE_SCRIPT_URL.includes('PUT_YOUR_WEB_APP_EXEC_URL_HERE'))throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL');}
function key(action,params={}){return `${action}::${JSON.stringify(params)}`;}
async function getJson(action,params={},ttlMs=0){mustUrl();const cacheKey=key(action,params);if(ttlMs){const hit=getMem(cacheKey);if(hit)return hit;}const url=new URL(GOOGLE_SCRIPT_URL);url.searchParams.set('action',action);url.searchParams.set('_',Date.now());Object.entries(params).forEach(([k,v])=>{if(v!==''&&v!==null&&v!==undefined)url.searchParams.set(k,v);});const res=await fetch(url.toString(),{cache:'no-store'});const json=await res.json();if(ttlMs&&json?.ok)setMem(cacheKey,json,ttlMs);return json;}
export const health=()=>getJson('health');
export const getCatalog=(mode)=>getJson('catalog',{mode},CACHE_TTL.catalog);
export const getCurrentStock=()=>getJson('currentStock',{},CACHE_TTL.currentStock);
export const getOrderView=()=>getJson('orderView',{},CACHE_TTL.orderView);
export const adminRebuild=()=>getJson('adminRebuild');
export const adminWarm=()=>getJson('adminWarm');
export function clearRuntimeCache(){clearMem('currentStock::');clearMem('orderView::');}
export function submitRecords(action,records){mustUrl();const requestId=createRequestId();return new Promise((resolve,reject)=>{const iframeName=`submit_${requestId}`;const iframe=document.createElement('iframe');iframe.name=iframeName;iframe.style.display='none';document.body.appendChild(iframe);const form=document.createElement('form');form.method='POST';form.action=GOOGLE_SCRIPT_URL;form.target=iframeName;form.style.display='none';const addHidden=(name,value)=>{const i=document.createElement('input');i.type='hidden';i.name=name;i.value=value;form.appendChild(i);};addHidden('action',action);addHidden('requestId',requestId);addHidden('payload',JSON.stringify(records));document.body.appendChild(form);const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);iframe.remove();form.remove();};const onMessage=(event)=>{const data=event.data;if(!data||data.type!=='realstock_ack'||data.requestId!==requestId)return;cleanup();clearRuntimeCache();resolve(data);};const timer=setTimeout(()=>{cleanup();reject(new Error('Timed out waiting for save response'));},SAVE_TIMEOUT_MS);window.addEventListener('message',onMessage);form.submit();});}
