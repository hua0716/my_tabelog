// PIN 登入／登出、管理員身分、錯誤處理

import { store } from './store.js';
import { $, esc, toast } from './utils.js';
import { render } from './list.js';
import { openAdmin, closeAdmin } from './admin.js';

// 目前登入的人（PIN 記在這台裝置的瀏覽器裡）
export const auth = { pin:null, name:null, isAdmin:false };
try { const saved = JSON.parse(localStorage.getItem('tfm-auth')); if (saved?.pin) Object.assign(auth, saved); } catch(e){}

export function saveAuth(){ try { auth.pin ? localStorage.setItem('tfm-auth', JSON.stringify(auth)) : localStorage.removeItem('tfm-auth'); } catch(e){} }

export function lock(){ auth.pin = null; auth.name = null; auth.isAdmin = false; saveAuth(); renderEditbar(); closeAdmin(); }

// 目前登入者對某家餐廳的評分／備註
export const myReview = r => r?.reviews?.find(x => x.editor_name === auth.name) || null;
export const myRating = r => myReview(r)?.rating ?? null;

export function renderEditbar(){
  $('editbar').innerHTML = auth.pin
    ? `已解鎖編輯：<b>${esc(auth.name)}</b>　${auth.isAdmin ? '<button class="link" data-act="admin">管理使用者</button>　' : ''}<button class="link" data-act="lock">登出</button>`
    : `<button class="link" data-act="unlock">輸入 PIN 以編輯</button>`;
}

// 需要編輯權限時呼叫：已登入直接回傳 true，否則跳出 PIN 視窗，等使用者輸入或取消
let pinResolve = null;
export function requirePin(){
  if (auth.pin) return Promise.resolve(true);
  $('pinInput').value = ''; $('pinErr').style.display = 'none';
  $('pinOverlay').classList.add('show');
  setTimeout(() => $('pinInput').focus(), 50);
  return new Promise(res => { pinResolve = res; });
}
export function closePin(ok){ $('pinOverlay').classList.remove('show'); if (pinResolve){ pinResolve(ok); pinResolve = null; } }

// 儲存、刪除等動作失敗時的統一處理
export function handleError(err){
  console.warn(err);
  if (err.code === 'invalid_pin'){ lock(); toast('PIN 已失效，請重新輸入'); }
  else if (err.code === 'locked') toast('嘗試次數過多，請 10 分鐘後再試');
  else if (err.code === 'not_found') toast('這家餐廳已經被別人刪除了');
  else toast('儲存失敗，請檢查網路後再試');
}

export function initAuth(){
  renderEditbar();
  $('editbar').onclick = e => {
    const act = e.target.dataset?.act;
    if (act === 'lock'){ lock(); toast('已登出'); }
    if (act === 'unlock') requirePin();
    if (act === 'admin') openAdmin();
  };
  $('pinForm').onsubmit = async e => {
    e.preventDefault();
    const pin = $('pinInput').value.trim();
    if (!pin) return;
    $('pinOk').disabled = true;
    try {
      const me = await store.verify(pin);
      auth.pin = pin; auth.name = me.name; auth.isAdmin = me.isAdmin; saveAuth(); renderEditbar(); render();
      toast(`歡迎，${me.name}！`);
      closePin(true);
    } catch(err){
      $('pinErr').textContent = err.code === 'locked' ? '嘗試次數過多，請 10 分鐘後再試' :
                                err.code === 'invalid_pin' ? 'PIN 不正確' : '連線失敗，請稍後再試';
      $('pinErr').style.display = 'block';
      $('pinInput').select();
    } finally { $('pinOk').disabled = false; }
  };
  $('pinCancel').onclick = () => closePin(false);
  $('pinOverlay').onclick = e => { if (e.target === $('pinOverlay')) closePin(false); };

  // 開啟網站時重新確認記住的 PIN，取得最新的名字與管理員身分
  if (auth.pin){
    store.verify(auth.pin).then(me => {
      auth.name = me.name; auth.isAdmin = me.isAdmin; saveAuth(); renderEditbar(); render();
    }).catch(err => { if (err.code === 'invalid_pin'){ lock(); toast('你的 PIN 已變更或停用，請重新輸入'); } });
  }
}
