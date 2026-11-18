// 設定：連線資訊、分類、字體、底圖、地圖可勾選的地點。想調整這些內容，改這個檔案就好。

// Supabase 連線資訊（publishable key 本來就是公開的，權限由資料庫規則保護）
export const SUPABASE_URL = 'https://qzferamjocllevbryrqi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_NU-KikhtYb-ZsfdIEQR9xg_xiiPk4ag';

// 外部程式庫（依序嘗試多個來源）
export const LIBS = [
  { ok:() => window.maplibregl, name:'地圖程式庫', srcs:[
    'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js',
    'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'] },
  { ok:() => window.supabase?.createClient, name:'資料庫程式庫', srcs:[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'] },
];

// 餐廳分類：順序就是選單與圖例的順序
export const CATEGORIES = [
  { id:'台式',     color:'#e8590c' },
  { id:'炸物小吃', color:'#e0a800' },
  { id:'日式',     color:'#1c7ed6' },
  { id:'東南亞',   color:'#2b8a3e' },
  { id:'西式',     color:'#6741d9' },
  { id:'甜點',     color:'#d6336c' },
  { id:'咖啡廳',   color:'#8d5a3b' },
  { id:'其他',     color:'#868e96' },
];
export const catOf = id => CATEGORIES.find(c => c.id === id) || { id, color:'#868e96' };

// 字體：介面用網路字型；地圖上的中文用電腦已安裝的字型優先（比較穩定），網路字型備用
export const FONTS = {
  sans:  { ui:'"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
           map:'"PingFang TC","Microsoft JhengHei","Noto Sans TC","Noto Sans CJK TC",sans-serif' },
  serif: { ui:'"Noto Serif TC","Songti TC","PMingLiU",serif',
           map:'"Noto Serif TC","Songti TC","PMingLiU","MingLiU","Noto Serif CJK TC",serif' },
  kai:   { ui:'"LXGW WenKai TC","Kaiti TC","DFKai-SB",serif',
           map:'"LXGW WenKai TC","Kaiti TC","BiauKai","DFKai-SB","KaiTi",serif' },
};

// 底圖：liberty、positron 是向量地圖（可改字體、可勾選地點）；其餘是圖片
export const VECTOR_BASES = ['liberty', 'positron'];
function rasterStyle(url, attribution){
  return { version:8, sources:{ base:{ type:'raster', tiles:[url], tileSize:256, maxzoom:19, attribution } },
           layers:[{ id:'base', type:'raster', source:'base' }] };
}
export const BASEMAPS = {
  liberty:  'https://tiles.openfreemap.org/styles/liberty',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  emap:  rasterStyle('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', '© 內政部國土測繪中心'),
  photo: rasterStyle('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', '© 內政部國土測繪中心'),
};

// 地圖上可勾選顯示的地點（資料來自 OpenStreetMap；圖層內容在 map.js 的 addPoiLayers）
export const POI_GROUPS = {
  stations: { label:'捷運站／火車站', layers:['stations-dot','stations-label'] },
  parks:    { label:'公園綠地',       layers:['parks-label'] },
  sights:   { label:'景點地標',       layers:['sights-label','worship-label'] },
  bike:     { label:'YouBike 站',     layers:['bike-dot','bike-label'] },
  shops:    { label:'商店',           layers:['shops-dot','shops-label'] },
};
