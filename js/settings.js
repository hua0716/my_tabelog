// 設定面板（齒輪）：字體、底圖、地圖顯示項目

import { POI_GROUPS, VECTOR_BASES } from './config.js';
import { prefs, savePrefs } from './prefs.js';
import { $ } from './utils.js';
import { setFont, setBase, applyPoiVisibility } from './map.js';

// 圖片底圖（臺灣通用電子地圖、衛星影像）無法調整顯示項目
function syncPoiOpts(){
  const vec = VECTOR_BASES.includes(prefs.base);
  $('poiOpts').classList.toggle('disabled', !vec);
  $('poiNote').style.display = vec ? 'none' : 'block';
}

export function initSettings(){
  $('gear').onclick = e => { e.stopPropagation(); $('settings').classList.toggle('show'); $('gear').classList.toggle('on'); };
  $('settings').onclick = e => e.stopPropagation();
  document.addEventListener('click', () => { $('settings').classList.remove('show'); $('gear').classList.remove('on'); });

  $('fontSel').value = prefs.font;
  $('baseSel').value = prefs.base;
  $('fontSel').onchange = e => setFont(e.target.value);
  $('baseSel').onchange = e => { setBase(e.target.value); syncPoiOpts(); };

  $('poiOpts').innerHTML = Object.entries(POI_GROUPS).map(([k,g]) =>
    `<label><input type="checkbox" data-poi="${k}" ${prefs.poi[k] ? 'checked' : ''}>${g.label}</label>`).join('');
  $('poiOpts').onchange = e => {
    const k = e.target.dataset.poi; if (!k) return;
    prefs.poi[k] = e.target.checked; savePrefs(); applyPoiVisibility();
  };
  syncPoiOpts();
}
