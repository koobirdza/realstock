const mem=new Map();
export function setMem(key,value,ttlMs){mem.set(key,{value,expiresAt:Date.now()+ttlMs});return value;}
export function getMem(key){const hit=mem.get(key);if(!hit)return null;if(Date.now()>hit.expiresAt){mem.delete(key);return null;}return hit.value;}
export function clearMem(prefix=''){[...mem.keys()].forEach(k=>{if(!prefix||k.startsWith(prefix))mem.delete(k);});}
