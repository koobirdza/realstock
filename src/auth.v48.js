const KEY='realstock_session_v48';
export function saveSession(session){localStorage.setItem(KEY,JSON.stringify(session));}
export function readSession(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
export function clearSession(){localStorage.removeItem(KEY);}
