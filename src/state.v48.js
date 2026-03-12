export const state={employee:'',mode:'',path:[],destination:'',catalogs:{},stockMap:{},orderMap:{},saveLock:false,pendingValues:{}};
export function resetPath(){state.path=[];state.destination='';}
export function softBackAfterSave(){if(state.path.length>=2)state.path=state.path.slice(0,2);else if(state.path.length>=1)state.path=state.path.slice(0,1);}
