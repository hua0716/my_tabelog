// 重新載入資料與即時同步：別人新增、修改、評分時自動更新畫面

import { store } from './store.js';
import { $, toast } from './utils.js';
import { render } from './list.js';
import { openPopupId, reopenPopup } from './markers.js';

// 重新載入所有餐廳；保留目前打開的資訊視窗
export async function refresh(){
  const openId = openPopupId();
  try { await store.load(); render(); reopenPopup(openId); }
  catch(err){ console.warn(err); toast('讀取資料失敗，請檢查網路後重新整理'); }
}

let timer;
const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(refresh, 400); };

export function initSync(){
  try { store.subscribe(scheduleRefresh); }
  catch(e){ console.warn('即時同步無法啟用', e); }
  // 切回這個分頁時也更新一次（以防即時連線中斷）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !$('overlay').classList.contains('show')) refresh();
  });
}
