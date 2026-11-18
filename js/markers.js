// 地圖上的餐廳圓點與資訊視窗

import { catOf } from './config.js';
import { state } from './state.js';
import { esc, statusHtml } from './utils.js';
import { map } from './map.js';
import { filtered } from './list.js';

// 目前地圖上的圓點：{ 餐廳 id: Marker }
export let markers = {};
export function resetMarkers(){ markers = {}; }

function popupHtml(r){
  const c = catOf(r.cat);
  const gmap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' ' + (r.addr||''))}`;
  return `<div class="pop">
    <h3><span class="dot" style="background:${c.color}"></span>${esc(r.name)}</h3>
    <div class="meta">${statusHtml(r)}　${esc(r.cat)}${r.addr ? '・'+esc(r.addr) : ''}</div>
    ${r.reviews.length ? `<div class="reviews">${r.reviews.map(x => `
      <div class="rv"><span class="rv-name">${esc(x.editor_name)}</span>${r.visited && x.rating ? `<span class="rv-stars">${x.rating}★</span>` : ''}
        ${x.comment ? `<div class="rv-note">${esc(x.comment)}</div>` : ''}</div>`).join('')}</div>` : ''}
    <div class="meta">由 ${esc(r.by)} 新增${r.updated_by && r.updated_by !== r.by ? `・${esc(r.updated_by)} 編輯過` : ''}</div>
    <div class="actions">
      <button class="btn primary" onclick="openForm('${r.id}')">編輯</button>
      <a class="btn" href="${gmap}" target="_blank" rel="noopener">Google 地圖</a>
    </div></div>`;
}

export function renderMarkers(){
  if (!map) return;
  Object.values(markers).forEach(m => m.remove());
  markers = {};
  filtered().forEach(r => {
    const el = document.createElement('div');
    el.className = 'marker' + (r.visited ? '' : ' want') + (state.activeId === r.id ? ' active' : '');
    el.style.borderColor = r.visited ? '' : catOf(r.cat).color;
    el.style.background = catOf(r.cat).color;
    el.title = r.name;
    el.addEventListener('click', () => { if (!state.adding) setActive(r.id, false); });
    const popup = new maplibregl.Popup({ offset:12, maxWidth:'280px' }).setHTML(popupHtml(r));
    markers[r.id] = new maplibregl.Marker({ element:el }).setLngLat([r.lng, r.lat]).setPopup(popup).addTo(map);
  });
}

export function closeAllPopups(){
  Object.values(markers).forEach(x => x.getPopup().isOpen() && x.togglePopup());
}
export function openPopupId(){
  return Object.entries(markers).find(([,m]) => m.getPopup().isOpen())?.[0];
}
export function reopenPopup(id){
  if (id && markers[id] && !markers[id].getPopup().isOpen()) markers[id].togglePopup();
}

// 選中一家餐廳：列表與圓點同時標示；fly=true 時地圖飛過去並打開資訊視窗
export function setActive(id, fly = true){
  state.activeId = id;
  document.querySelectorAll('.item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  Object.entries(markers).forEach(([k,m]) => m.getElement().classList.toggle('active', k === id));
  const m = markers[id];
  if (m && fly){
    closeAllPopups();
    map.flyTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 15.5), duration: 700 });
    map.once('moveend', () => { if (!m.getPopup().isOpen()) m.togglePopup(); });
  }
  const el = document.querySelector(`.item[data-id="${id}"]`);
  if (el) el.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
