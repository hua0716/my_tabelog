// 我的位置：只在瀏覽器裡使用，不會上傳到任何地方

import { $, toast } from './utils.js';
import { map } from './map.js';

let meMarker = null;

function locateMe(){
  if (!navigator.geolocation || !window.isSecureContext){ toast('這個瀏覽器或網址無法使用定位'); return; }
  const btn = $('locateBtn'); btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(pos => {
    btn.classList.remove('busy'); btn.classList.add('on');
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (!meMarker){
      const el = document.createElement('div'); el.className = 'me-dot'; el.title = '你的位置';
      meMarker = new maplibregl.Marker({ element:el });
    }
    meMarker.setLngLat([p.lng, p.lat]).addTo(map);
    map.flyTo({ center:[p.lng, p.lat], zoom:Math.max(map.getZoom(), 15), duration:800 });
  }, err => {
    btn.classList.remove('busy');
    toast(err.code === 1 ? '定位權限被拒絕，請在瀏覽器的網站設定中允許「位置」' :
          err.code === 3 ? '定位逾時，請到訊號較好的地方再試一次' : '目前無法取得你的位置');
  }, { enableHighAccuracy:true, timeout:12000, maximumAge:30000 });
}

export function initLocate(){
  $('locateBtn').onclick = locateMe;
}
