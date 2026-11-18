// 側欄：搜尋、篩選、餐廳列表

import { CATEGORIES, catOf } from './config.js';
import { state } from './state.js';
import { store } from './store.js';
import { $, esc, statusHtml } from './utils.js';
import { renderMarkers, setActive } from './markers.js';

// 評分篩選：0＝不限，正數＝「N 以上」，負數＝「N 以下」（以平均分數判斷，只看已探訪的餐廳）
export function rateOk(r){
  const f = state.minRate;
  if (!f) return true;
  if (!r.visited || r.avg == null) return false;
  return f > 0 ? r.avg >= f : r.avg <= -f;
}

export function filtered(){
  const q = state.q.trim().toLowerCase();
  return store.all().filter(r =>
    (state.cat === '全部' || r.cat === state.cat) &&
    (state.visit === 'all' || (state.visit === 'yes') === r.visited) &&
    rateOk(r) &&
    (!q || (r.name + ' ' + (r.comments||'') + ' ' + (r.addr||'')).toLowerCase().includes(q)));
}

// 手機版收起篩選時，用小標籤提醒目前套用了幾項篩選
function updateFilterBadge(){
  const n = [state.q.trim(), state.cat !== '全部', state.visit !== 'all', state.minRate !== 0].filter(Boolean).length;
  $('filterBadge').textContent = n ? `已套用 ${n} 項` : '';
  $('filterBadge').classList.toggle('on', n > 0);
}

// 重畫列表與地圖圓點
export function render(){
  $('catSel').value = state.cat;
  updateFilterBadge();
  const items = filtered();
  $('list').innerHTML = items.length ? items.map(r => `
    <div class="item ${state.activeId===r.id?'active':''}" data-id="${r.id}">
      <span class="dot" style="background:${catOf(r.cat).color}"></span>
      <div><h3>${esc(r.name)}</h3>
        <div class="meta">${statusHtml(r)}　${esc(r.cat)}${r.addr ? '・'+esc(r.addr) : ''}</div>
      </div>
    </div>`).join('') : `<div class="empty">${store.all().length ? '沒有符合條件的餐廳<br>試試其他篩選條件' : '還沒有任何餐廳<br>輸入 PIN 後，點「＋ 新增餐廳」開始標記'}</div>`;
  renderMarkers();
}

// 儲存後若新餐廳被目前的篩選條件擋住，就放寬篩選讓它顯示
export function revealInFilters(r){
  if (state.cat !== '全部' && state.cat !== r.cat) state.cat = '全部';
  if (state.visit !== 'all' && (state.visit === 'yes') !== r.visited){ state.visit = 'all'; $('visitSel').value = 'all'; }
  if (!rateOk(r)){ state.minRate = 0; $('minRate').value = '0'; }
}

export function initList(){
  $('catSel').innerHTML = ['全部', ...CATEGORIES.map(c => c.id)].map(id => `<option value="${id}">${id === '全部' ? '全部分類' : id}</option>`).join('');
  $('legend').innerHTML = CATEGORIES.map(c => `<span><i class="dot" style="background:${c.color}"></i>${c.id}</span>`).join('');
  $('catSel').onchange = e => { state.cat = e.target.value; render(); };
  $('q').oninput = e => { state.q = e.target.value; render(); };
  $('visitSel').onchange = e => { state.visit = e.target.value; render(); };
  $('minRate').onchange = e => { state.minRate = +e.target.value; render(); };
  $('list').onclick = e => {
    const it = e.target.closest('.item'); if (!it) return;
    $('app').classList.remove('list-open');
    setActive(it.dataset.id);
  };
  $('toggleList').onclick = () => $('app').classList.add('list-open');
  // 手機版：搜尋與篩選可以展開／收合（電腦版一律顯示）
  $('filterToggle').onclick = () => {
    const open = $('filterToggle').closest('.head').classList.toggle('filters-open');
    $('filterToggle').setAttribute('aria-expanded', open);
    if (open) setTimeout(() => $('q').focus({ preventScroll:true }), 50);
  };
}
