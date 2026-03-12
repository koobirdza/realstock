export const qs=(s,root=document)=>root.querySelector(s);
export const qsa=(s,root=document)=>[...root.querySelectorAll(s)];
export function createRequestId(){return ['rs48',Date.now().toString(36),Math.random().toString(36).slice(2,9)].join('_');}
export function debounce(fn,wait=200){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}
export function formatNumber(n){const num=Number(n||0);return Number.isFinite(num)?num.toLocaleString('th-TH'):'0';}
export function getQueryFlag(name){const url=new URL(window.location.href);return url.searchParams.get(name)==='1';}
