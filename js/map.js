// 地圖：建立地圖、切換底圖與字體、捷運站／公園／景點等地點圖層、縮放按鈕
// 地圖固定平面顯示：不能傾斜，建築物也畫成平面（3D 建築在低解析度螢幕上看起來不舒服）

import { BASEMAPS, FONTS, VECTOR_BASES, POI_GROUPS } from './config.js';
import { prefs, savePrefs } from './prefs.js';
import { state } from './state.js';
import { $ } from './utils.js';
import { renderMarkers, resetMarkers } from './markers.js';
import { setAdding, openForm } from './form.js';

// 目前的地圖物件（其他模組只讀取，只有這裡會重新建立）
export let map = null;

export function createMap(){
  let view;
  if (map){ view = { center: map.getCenter(), zoom: map.getZoom() }; map.remove(); }
  map = new maplibregl.Map({
    container: 'map',
    style: BASEMAPS[prefs.base],
    center: view?.center || [121.535, 25.045],
    zoom: view?.zoom ?? 12.6,
    localIdeographFontFamily: FONTS[prefs.font].map,
    attributionControl: { compact: true },
    maxPitch: 0,          // 不能把地圖傾斜成立體視角
  });
  map.on('style.load', flattenBuildings);
  map.on('style.load', localizeLabels);
  map.on('click', e => {
    if (!state.adding) return;
    if (e.originalEvent?.target?.closest?.('.marker')) return;   // 新增模式下點到既有圓點不算
    state.pending = e.lngLat;
    setAdding(false);
    openForm(null);
  });
  map.on('error', e => console.warn('地圖錯誤：', e?.error?.message || e));
  resetMarkers();
  renderMarkers();
}

export function setFont(key){
  prefs.font = key; savePrefs();
  document.documentElement.style.setProperty('--font', FONTS[key].ui);
  // 地圖上的中文字型只能在建立地圖時設定，所以要重建地圖
  const ready = document.fonts?.load ? document.fonts.load(`16px ${FONTS[key].ui}`, '臺北市中山區大安信義士林萬華松山') : Promise.resolve();
  ready.catch(()=>{}).finally(() => { if (map) createMap(); });
}

export function setBase(key){
  prefs.base = key; savePrefs();
  map.setStyle(BASEMAPS[key]);
}

// 把 3D 建築換成平面的建築輪廓：隱藏立體圖層，在同一位置加一個平面圖層
function flattenBuildings(){
  const layers = map.getStyle().layers || [];
  // 沿用底圖原本平面建築的顏色（沒有的話用淺灰）
  const flat = layers.find(l => l.type === 'fill' && l['source-layer'] === 'building');
  const color = flat?.paint?.['fill-color'] || '#dedad6';
  for (const layer of layers){
    if (layer.type !== 'fill-extrusion') continue;
    const id = layer.id + '-flat';
    if (!map.getLayer(id)){
      map.addLayer({ id, type:'fill', source:layer.source, 'source-layer':layer['source-layer'],
        ...(layer.filter ? { filter:layer.filter } : {}),
        ...(layer.minzoom != null ? { minzoom:layer.minzoom } : {}),
        paint:{ 'fill-color':color, 'fill-outline-color':'#cfc9c3' } }, layer.id);
    }
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  }
}

// 讓向量地圖優先顯示中文地名；隱藏地圖原有的地點標示，改用下面可勾選的圖層
function localizeLabels(){
  if (!VECTOR_BASES.includes(prefs.base)) return;
  const NAME = ['coalesce', ['get','name:zh-Hant'], ['get','name:zh'], ['get','name'], ['get','name:latin']];
  let poiSource = null, textFont = null;
  for (const layer of map.getStyle().layers){
    if (layer.type !== 'symbol') continue;
    if (!textFont && layer.layout?.['text-font']) textFont = layer.layout['text-font'];
    if (layer['source-layer'] === 'poi'){ poiSource = layer.source; map.setLayoutProperty(layer.id, 'visibility', 'none'); continue; }
    const tf = map.getLayoutProperty(layer.id, 'text-field');
    if (tf && JSON.stringify(tf).includes('name')) map.setLayoutProperty(layer.id, 'text-field', NAME);
  }
  const vecSource = poiSource || Object.entries(map.getStyle().sources).find(([,v]) => v.type === 'vector')?.[0];
  if (vecSource) addPoiLayers(vecSource, textFont || ['Noto Sans Regular'], NAME);
  applyPoiVisibility();
}

function addPoiLayers(source, textFont, NAME){
  if (map.getLayer('stations-dot')) return;
  const cls = list => ['in', ['get','class'], ['literal', list]];
  const label = (id, filter, minzoom, color, size = [13,11,17,13], extra = {}) => map.addLayer({
    id, type:'symbol', source, 'source-layer':'poi', minzoom, filter,
    layout:{ 'text-field':NAME, 'text-font':textFont, 'text-size':['interpolate',['linear'],['zoom'],...size],
             'text-optional':true, 'text-max-width':8, ...extra },
    paint:{ 'text-color':color, 'text-halo-color':'#fff', 'text-halo-width':1.5 } });
  const dot = (id, filter, minzoom, color, r, stroke = 1.5) => map.addLayer({
    id, type:'circle', source, 'source-layer':'poi', minzoom, filter,
    paint:{ 'circle-radius':r, 'circle-color':color, 'circle-stroke-color':'#fff', 'circle-stroke-width':stroke } });

  // 捷運站／火車站（不含出入口）
  const station = ['all', ['==', ['get','class'], 'railway'],
    ['!', ['in', ['get','subclass'], ['literal', ['subway_entrance','train_station_entrance','platform']]]]];
  dot('stations-dot', station, 12, '#0b6fb8', ['interpolate',['linear'],['zoom'],12,2,16,3.5], 1);
  label('stations-label', station, 13, '#0b4f86', [13,11,17,13], { 'text-offset':[0,0.6], 'text-anchor':'top' });

  // 公園綠地：只顯示名稱
  label('parks-label', cls(['park','garden']), 13, '#2b7a3a', [13,11,17,13]);

  // 景點地標：博物館、古蹟等先顯示；寺廟教堂數量多，放大後才顯示
  label('sights-label', cls(['attraction','museum','art_gallery','castle','monument','zoo','theatre','stadium']), 13, '#6e4f99');
  label('worship-label', cls(['place_of_worship']), 15, '#6e4f99', [15,10.5,17,12]);

  // YouBike：放大到街道等級才顯示，名稱再放大一點才出現
  const bike = cls(['bicycle_rental']);
  dot('bike-dot', bike, 15, '#f2a900', ['interpolate',['linear'],['zoom'],15,3,18,5]);
  label('bike-label', bike, 17, '#9a6b00', [17,10,19,11], { 'text-offset':[0,0.8], 'text-anchor':'top' });

  // 商店（含便利商店、超市、藥妝、書店等）：數量多，放大到街道等級才顯示
  const shop = cls(['shop','grocery','convenience','supermarket','department_store','mall','clothing_store',
    'shoes','books','gift','jewelry','electronics','mobile_phone','furniture','hardware','florist',
    'pharmacy','optician','cosmetics','bakery','alcohol_shop','stationery','toys','sports','bicycle']);
  dot('shops-dot', shop, 16, '#9aa1a9', ['interpolate',['linear'],['zoom'],16,2.5,19,4]);
  label('shops-label', shop, 17, '#5f6670', [17,10,19,11], { 'text-offset':[0,0.8], 'text-anchor':'top' });
}

export function applyPoiVisibility(){
  if (!map) return;
  for (const [key, g] of Object.entries(POI_GROUPS))
    for (const id of g.layers){
      try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', prefs.poi[key] ? 'visible' : 'none'); }
      catch(e){ /* 地圖樣式尚未載入完成時略過，載入後會再套用一次 */ }
    }
}

export function initMapControls(){
  $('zoomIn').onclick = () => map && map.zoomIn({ duration:250 });
  $('zoomOut').onclick = () => map && map.zoomOut({ duration:250 });
}
