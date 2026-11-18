// 新增／編輯餐廳：新增按鈕選單、在地圖上點選、貼上 Google 地圖網址、表單

import { CATEGORIES } from './config.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, toast } from './utils.js';
import { auth, requirePin, handleError, myReview, myRating } from './auth.js';
import { map } from './map.js';
import { closeAllPopups, setActive } from './markers.js';
import { render, revealInFilters } from './list.js';
import { parseGoogleMaps } from './gmaps.js';

/* ---------- 新增按鈕與選單 ---------- */
export function setAdding(on){
  state.adding = on;
  $('app').classList.toggle('adding', on);
  $('fab').textContent = on ? '取消' : '＋ 新增餐廳';
  $('fab').classList.toggle('cancel', on);
}
export function toggleFabMenu(open){
  $('fabMenu').classList.toggle('open', open);
  if (!state.adding) $('fab').textContent = open ? '✕ 關閉' : '＋ 新增餐廳';
}

/* ---------- 貼上 Google 地圖網址 ---------- */
function openUrlDialog(){
  $('urlInput').value = ''; $('urlErr').style.display = 'none';
  $('urlOverlay').classList.add('show');
  setTimeout(() => $('urlInput').focus(), 50);
}
export function closeUrlDialog(){ $('urlOverlay').classList.remove('show'); }

function submitUrl(e){
  e.preventDefault();
  const r = parseGoogleMaps($('urlInput').value);
  if (r.error){ $('urlErr').textContent = r.error; $('urlErr').style.display = 'block'; return; }
  closeUrlDialog();
  state.pending = { lat:r.lat, lng:r.lng };
  map.flyTo({ center:[r.lng, r.lat], zoom:Math.max(map.getZoom(), 16), duration:700 });
  openForm(null, { name:r.name, note: r.precise ? '位置來自 Google 地圖網址' : '位置是 Google 地圖畫面的中心點，可能有些微偏差' });
}

/* ---------- 新增時在地圖上標示即將存入的位置 ---------- */
let tempMarker = null;
function showTempPin(p){
  hideTempPin();
  if (!p || !map) return;
  const el = document.createElement('div'); el.className = 'temp-pin';
  tempMarker = new maplibregl.Marker({ element:el }).setLngLat([p.lng, p.lat]).addTo(map);
}
function hideTempPin(){ if (tempMarker){ tempMarker.remove(); tempMarker = null; } }

/* ---------- 表單 ---------- */
function renderFormCats(){
  $('fCat').innerHTML = CATEGORIES.map(c =>
    `<button type="button" data-cat="${c.id}" class="${state.formCat===c.id?'on':''}"><span class="dot" style="background:${c.color}"></span>${c.id}</button>`).join('');
}
function renderRate(){
  $('fRate').innerHTML = [1,2,3,4,5].map(n => `<button type="button" data-n="${n}" class="${state.rating && n<=state.rating?'on':''}">★</button>`).join('');
  $('fRateClear').style.visibility = state.rating ? 'visible' : 'hidden';
}
function renderVisit(){
  document.querySelectorAll('#fVisit button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === state.formVisited));
  $('fRateField').style.display = state.formVisited ? '' : 'none';
}

// 打開表單：id 為 null 時是新增（位置在 state.pending），preset 可預先帶入店名與位置說明
export async function openForm(id, preset = {}){
  closeAllPopups();
  if (!(await requirePin())) return;
  const r = id ? store.all().find(x => x.id === id) : null;
  state.editing = r;
  $('formTitle').textContent = r ? '編輯餐廳' : '新增餐廳';
  $('fName').value = r?.name || preset.name || '';
  $('fLocNote').textContent = r ? '' : (preset.note || '');
  $('fLocNote').style.display = (!r && preset.note) ? '' : 'none';
  if (!r) showTempPin(state.pending);
  $('fAddr').value = r?.addr || '';
  $('fNote').value = r ? (myReview(r)?.comment || '') : '';
  state.formCat = r?.cat || CATEGORIES[0].id; renderFormCats();
  state.rating = r ? myRating(r) : 4; renderRate();
  const others = r ? r.ratings.filter(x => x.editor_name !== auth.name) : [];
  $('fRateHint').textContent = others.length ? `其他人：${others.map(x => `${x.editor_name} ${x.rating}★`).join('・')}（不受你的評分影響）` : '';
  state.formVisited = r ? r.visited : true; renderVisit();
  $('fDel').style.visibility = r ? 'visible' : 'hidden';
  $('fDel').textContent = '刪除'; $('fDel').dataset.confirm = '';
  $('fErr').style.display = 'none';
  $('overlay').classList.add('show');
  setTimeout(() => $('fName').focus(), 50);
}
export function closeForm(){ $('overlay').classList.remove('show'); state.editing = null; state.pending = null; hideTempPin(); }

async function submitForm(e){
  e.preventDefault();
  const name = $('fName').value.trim();
  if (!name){ $('fErr').style.display = 'block'; $('fName').focus(); return; }
  const data = { name, cat:state.formCat, visited:state.formVisited, rating:state.formVisited ? state.rating : null,
                 addr:$('fAddr').value.trim(), note:$('fNote').value.trim() };
  const btn = $('form').querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = '儲存中…';
  try {
    const raw = state.editing
      ? await store.update(state.editing.id, data, auth.pin)
      : await store.add({ ...data, lat:state.pending.lat, lng:state.pending.lng }, auth.pin);
    closeForm();
    try { await store.load(); } catch(e){}   // 重新載入以取得最新的評分
    const saved = store.all().find(x => x.id === raw.id) || raw;
    revealInFilters(saved);
    render(); setActive(saved.id);
    toast('已儲存');
  } catch(err){ handleError(err); if (err.code === 'invalid_pin') closeForm(); }
  finally { btn.disabled = false; btn.textContent = '儲存'; }
}

async function deleteRestaurant(){
  const b = $('fDel');
  if (!b.dataset.confirm){ b.dataset.confirm = '1'; b.textContent = '確定刪除？'; return; }
  try { await store.remove(state.editing.id, auth.pin); closeForm(); state.activeId = null; render(); toast('已刪除'); }
  catch(err){ handleError(err); closeForm(); }
}

export function initForm(){
  window.openForm = openForm;                 // 資訊視窗裡的「編輯」按鈕會用到
  window.parseGoogleMaps = parseGoogleMaps;   // 方便測試

  // 新增按鈕：先確認 PIN，再往上展開兩個選項
  $('fab').onclick = async e => {
    e.stopPropagation();
    $('app').classList.remove('list-open');
    if (state.adding) return setAdding(false);
    if ($('fabMenu').classList.contains('open')) return toggleFabMenu(false);
    if (await requirePin()) toggleFabMenu(true);
  };
  $('fabMenu').onclick = e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    toggleFabMenu(false);
    if (b.dataset.mode === 'click') setAdding(true);
    else openUrlDialog();
  };
  document.addEventListener('click', () => { if ($('fabMenu').classList.contains('open')) toggleFabMenu(false); });

  // 貼網址視窗
  $('urlCancel').onclick = closeUrlDialog;
  $('urlOverlay').onclick = e => { if (e.target === $('urlOverlay')) closeUrlDialog(); };
  $('urlPaste').onclick = async () => {
    try { $('urlInput').value = await navigator.clipboard.readText(); $('urlInput').focus(); }
    catch(e){ toast('瀏覽器不允許讀取剪貼簿，請直接在框內貼上（Ctrl/Cmd + V）'); }
  };
  $('urlForm').onsubmit = submitUrl;

  // 表單
  $('fCat').onclick = e => { const b = e.target.closest('button'); if (b){ state.formCat = b.dataset.cat; renderFormCats(); } };
  $('fVisit').onclick = e => { const b = e.target.closest('button'); if (b){ state.formVisited = b.dataset.v === '1'; renderVisit(); } };
  $('fRate').onclick = e => { const n = +e.target.dataset.n; if (n){ state.rating = n; renderRate(); } };
  $('fRateClear').onclick = () => { state.rating = null; renderRate(); };
  $('form').onsubmit = submitForm;
  $('fCancel').onclick = closeForm;
  $('overlay').onclick = e => { if (e.target === $('overlay')) closeForm(); };
  $('fDel').onclick = deleteRestaurant;
}
