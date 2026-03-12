/* RealStock v49 Catalog Fast Icons Patch
 * Drop-in replacement for src/catalog.v49.js
 */

const CatalogV49 = (() => {
  const CATALOG_STORAGE_KEY = 'realstock_catalog_cache_v49_fast';
  const CATALOG_TTL_MS = 10 * 60 * 1000;
  const TARGET_ICONS = {
    'ห้องสต๊อก': '📦','ครัว': '🍳','บาร์น้ำ': '🥤','หน้าร้าน': '🏪','ห้องเย็น': '🧊','แช่เย็น': '🧊','แช่แข็ง': '❄️','ทั่วไป': '📁',
  };
  const SUB_ICONS = {
    'เครื่องปรุง': '🧂','เส้น / ข้าว': '🍜','เส้น/ข้าว': '🍜','ข้าว': '🍚','เส้น': '🍜','ผัก': '🥬','เนื้อสัตว์': '🥩','หมู': '🐷','ไก่': '🍗','ทะเล': '🦐','ลูกชิ้น': '🍢','ของแห้ง': '🥫','ของสด': '🛒','เครื่องดื่ม': '🥤','น้ำจิ้ม': '🥣','ของหวาน': '🍮','ขนม': '🍪','ผลไม้': '🍎','ทั่วไป': '📄',
  };
  const state = {rawRows:[],treesByMode:{count:{},issue:{},receive:{},order:{}},htmlByMode:{count:{targets:'',subs:{}},issue:{targets:'',subs:{}},receive:{targets:'',subs:{}},order:{targets:'',subs:{}}},mode:'count',path:[],lastLoadedAt:0};
  const normalizeString=(v,f='')=>String(v==null?'':v).trim()||f;
  const escapeHtml=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const iconForTarget=(label)=>TARGET_ICONS[label]||TARGET_ICONS['ทั่วไป'];
  const iconForSub=(label)=>SUB_ICONS[label]||SUB_ICONS['ทั่วไป'];
  const sortThai=(a,b)=>String(a).localeCompare(String(b),'th');
  const labelTarget=(row)=>normalizeString(row.target_category_label||row.target_category,'ไม่ระบุโซน');
  const labelSub=(row)=>normalizeString(row.sub_category_label||row.sub_category||row.main_category_label||row.main_category,'ทั่วไป');
  const labelItem=(row)=>normalizeString(row.item_name,'ไม่มีชื่อ');
  const scheduleLabel=(row)=>normalizeString(row.schedule_group||row.main_category_label||'','');
  function rowAllowedForMode(row,mode){ const yes=(v)=>['Y','YES','TRUE','1'].includes(String(v||'').trim().toUpperCase()); if(mode==='count') return yes(row.can_count); if(mode==='issue') return yes(row.can_issue); if(mode==='receive') return yes(row.can_receive); return true; }
  function dedupeCatalogRows(rows){ const seen=new Set(), out=[]; for(const row of (rows||[])){ const target=labelTarget(row), sub=labelSub(row), item=labelItem(row); const key=`${target}|${sub}|${item}|${normalizeString(row.item_key)}`; if(seen.has(key)) continue; seen.add(key); out.push({...row,__targetLabel:target,__subLabel:sub,__itemLabel:item,__scheduleLabel:scheduleLabel(row)});} return out; }
  function sortItems(rows){ return rows.sort((a,b)=>{ const ao=Number(a.sort_order||999999), bo=Number(b.sort_order||999999); if(ao!==bo) return ao-bo; return sortThai(a.__itemLabel,b.__itemLabel);}); }
  function buildTree(rows,mode){ const tree={}; for(const row of rows){ if(!rowAllowedForMode(row,mode)) continue; const target=row.__targetLabel, sub=row.__subLabel; if(!tree[target]) tree[target]={}; if(!tree[target][sub]) tree[target][sub]=[]; tree[target][sub].push(row);} Object.keys(tree).forEach(target=>Object.keys(tree[target]).forEach(sub=>sortItems(tree[target][sub]))); return tree; }
  function renderTargetCard(label){ return `<button class="cat-card target-card" data-action="open-target" data-target="${escapeHtml(label)}"><span class="cat-icon">${iconForTarget(label)}</span><span class="cat-label">${escapeHtml(label)}</span></button>`; }
  function renderSubCard(label,tag=''){ const badge=tag?`<span class="cat-badge">${escapeHtml(tag)}</span>`:''; return `<button class="cat-card sub-card" data-action="open-sub" data-sub="${escapeHtml(label)}"><span class="cat-icon">${iconForSub(label)}</span><span class="cat-label">${escapeHtml(label)}</span>${badge}</button>`; }
  function renderItemCard(row){ const unit=normalizeString(row.unit,''), meta=[row.brand,row.item_type,unit].filter(Boolean).join(' • '); return `<button class="item-card" data-action="open-item" data-item-key="${escapeHtml(normalizeString(row.item_key))}"><div class="item-name">${escapeHtml(row.__itemLabel)}</div>${meta?`<div class="item-meta">${escapeHtml(meta)}</div>`:''}</button>`; }
  function warmHtmlCache(){ for(const mode of ['count','issue','receive','order']){ const tree=state.treesByMode[mode]||{}; const targets=Object.keys(tree).sort(sortThai); state.htmlByMode[mode]={targets:'',subs:{}}; state.htmlByMode[mode].targets=targets.map(renderTargetCard).join(''); for(const target of targets){ const subNames=Object.keys(tree[target]||{}).sort(sortThai); state.htmlByMode[mode].subs[target]=subNames.map(sub=>{ const firstRow=(tree[target]&&tree[target][sub]&&tree[target][sub][0])||null; return renderSubCard(sub, firstRow?firstRow.__scheduleLabel:''); }).join(''); } } }
  function saveLocalCache(rows){ try{ localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ts:Date.now(), rows})); }catch(_){} }
  function loadLocalCache(){ try{ const raw=localStorage.getItem(CATALOG_STORAGE_KEY); if(!raw) return null; const parsed=JSON.parse(raw); if(!parsed || !Array.isArray(parsed.rows) || !parsed.ts) return null; if(Date.now()-Number(parsed.ts)>CATALOG_TTL_MS) return null; return parsed.rows; }catch(_){ return null; } }
  function warmCatalog(rows){ const deduped=dedupeCatalogRows(rows); state.rawRows=deduped; state.treesByMode.count=buildTree(deduped,'count'); state.treesByMode.issue=buildTree(deduped,'issue'); state.treesByMode.receive=buildTree(deduped,'receive'); state.treesByMode.order=buildTree(deduped,'order'); state.lastLoadedAt=Date.now(); warmHtmlCache(); saveLocalCache(deduped); }
  async function fetchCatalogRows(){ if(typeof window.apiGetCatalog==='function') return await window.apiGetCatalog(); if(window.API && typeof window.API.getCatalog==='function') return await window.API.getCatalog(); throw new Error('Catalog API not found'); }
  async function refreshCatalogInBackground(){ try{ const rows=await fetchCatalogRows(); warmCatalog(rows||[]); if(!state.path.length) renderCurrent(); }catch(_){} }
  async function ensureCatalogLoaded({force=false}={}){ if(!force && state.rawRows.length) return state.rawRows; if(!force){ const cached=loadLocalCache(); if(cached && cached.length){ warmCatalog(cached); refreshCatalogInBackground(); return state.rawRows; } } const rows=await fetchCatalogRows(); warmCatalog(rows||[]); return state.rawRows; }
  const getCatalogRootEl=()=>document.querySelector('#catalogView')||document.querySelector('#catalog-view')||document.querySelector('[data-role="catalog-view"]');
  const getBreadcrumbEl=()=>document.querySelector('#catalogBreadcrumb')||document.querySelector('#catalog-breadcrumb')||document.querySelector('[data-role="catalog-breadcrumb"]');
  const getTitleEl=()=>document.querySelector('#catalogTitle')||document.querySelector('#catalog-title')||document.querySelector('[data-role="catalog-title"]');
  const treeForMode=(mode)=>state.treesByMode[mode]||{};
  function updateHeader(){ const titleEl=getTitleEl(), crumbEl=getBreadcrumbEl(); const [target,sub]=state.path; if(titleEl) titleEl.textContent=sub||target||'เลือกหมวด'; if(crumbEl){ const parts=['หมวด']; if(target) parts.push(target); if(sub) parts.push(sub); crumbEl.textContent=parts.join(' / ');} }
  function renderTargets(mode=state.mode){ const root=getCatalogRootEl(); if(!root) return; root.innerHTML=state.htmlByMode[mode]?.targets || '<div class="empty-state">ไม่พบหมวด</div>'; state.path=[]; updateHeader(); }
  function renderSubs(target, mode=state.mode){ const root=getCatalogRootEl(); if(!root) return; root.innerHTML=state.htmlByMode[mode]?.subs?.[target] || '<div class="empty-state">ไม่พบหมวดย่อย</div>'; state.path=[target]; updateHeader(); }
  function renderItems(target,sub,mode=state.mode){ const root=getCatalogRootEl(); if(!root) return; const rows=(treeForMode(mode)[target]&&treeForMode(mode)[target][sub])||[]; root.innerHTML=rows.length?rows.map(renderItemCard).join(''):'<div class="empty-state">ไม่พบรายการสินค้า</div>'; state.path=[target,sub]; updateHeader(); }
  function renderCurrent(){ const [target,sub]=state.path; if(!target) return renderTargets(state.mode); if(!sub) return renderSubs(target,state.mode); return renderItems(target,sub,state.mode); }
  function back(){ if(state.path.length>=2){ state.path=[state.path[0]]; return renderCurrent(); } if(state.path.length===1){ state.path=[]; return renderCurrent(); } }
  function setMode(mode){ state.mode=mode||'count'; state.path=[]; renderCurrent(); }
  function findRowByItemKey(itemKey){ return (state.rawRows||[]).find(r=>normalizeString(r.item_key)===normalizeString(itemKey))||null; }
  function handleClick(ev){ const btn=ev.target.closest('[data-action]'); if(!btn) return; const action=btn.getAttribute('data-action'); if(action==='open-target'){ const target=btn.getAttribute('data-target'); if(target) renderSubs(target,state.mode); return; } if(action==='open-sub'){ const sub=btn.getAttribute('data-sub'); const target=state.path[0]; if(target&&sub) renderItems(target,sub,state.mode); return; } if(action==='open-item'){ const itemKey=btn.getAttribute('data-item-key'); const row=findRowByItemKey(itemKey); if(typeof window.onCatalogItemSelected==='function') window.onCatalogItemSelected(row,{mode:state.mode,path:[...state.path]}); } }
  function attach(root=document){ const catalogRoot=getCatalogRootEl() || root.querySelector('#catalogView, #catalog-view, [data-role="catalog-view"]'); if(catalogRoot && !catalogRoot.__catalogV49Bound){ catalogRoot.addEventListener('click', handleClick); catalogRoot.__catalogV49Bound=true; } }
  function injectStyles(){ if(document.getElementById('catalog-v49-fast-icons-style')) return; const style=document.createElement('style'); style.id='catalog-v49-fast-icons-style'; style.textContent=`.cat-card,.item-card{width:100%;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:1px solid rgba(0,0,0,.08);background:#fff;cursor:pointer;margin-bottom:10px;box-sizing:border-box}.cat-icon{font-size:22px;line-height:1;flex:0 0 auto}.cat-label,.item-name{flex:1 1 auto;text-align:left;font-size:16px;font-weight:600}.cat-badge{flex:0 0 auto;font-size:12px;padding:4px 8px;border-radius:999px;background:#f3f4f6;color:#374151}.item-card{display:block;text-align:left}.item-meta{margin-top:4px;font-size:12px;color:#6b7280}.empty-state{padding:18px;text-align:center;color:#6b7280}`; document.head.appendChild(style); }
  return {state,attach,back,setMode,ensureCatalogLoaded,refreshCatalogInBackground,renderCurrent,renderTargets,renderSubs,renderItems,warmCatalog,injectStyles};
})();
window.CatalogV49 = CatalogV49;
window.initCatalogV49FastIcons = async function initCatalogV49FastIcons(mode='count'){ CatalogV49.injectStyles(); CatalogV49.attach(document); await CatalogV49.ensureCatalogLoaded(); CatalogV49.setMode(mode); return CatalogV49; };
