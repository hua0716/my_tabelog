// 共用小工具：取得元素、跳脫文字、評分顯示、提示訊息

export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const ratingText = n => '★'.repeat(n) + '<span style="color:#ddd">' + '★'.repeat(5-n) + '</span>';
export const fmtAvg = v => Number.isInteger(v) ? String(v) : v.toFixed(1);

// 列表與資訊視窗裡的狀態：未探訪／尚未評分／平均星等
export const statusHtml = r => !r.visited ? '<span class="tag-want">未探訪</span>'
  : r.avg == null ? '<span class="tag-want">尚未評分</span>'
  : `<span class="rating">${ratingText(Math.round(r.avg))}</span> <span class="avg">${fmtAvg(r.avg)}${r.ratings.length > 1 ? `・${r.ratings.length} 人` : ''}</span>`;

let toastTimer;
export function toast(msg){
  $('toast').textContent = msg; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}
