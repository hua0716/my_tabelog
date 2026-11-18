// 進入點：載入外部程式庫，再依序啟動各個部分

import { LIBS, FONTS } from './config.js';
import { prefs } from './prefs.js';
import { state } from './state.js';
import { store } from './store.js';
import { $ } from './utils.js';
import { initAuth, closePin } from './auth.js';
import { initAdmin, closeAdmin } from './admin.js';
import { initList, render } from './list.js';
import { initForm, closeForm, closeUrlDialog, toggleFabMenu, setAdding } from './form.js';
import { initSettings } from './settings.js';
import { initLocate } from './locate.js';
import { initMapControls, createMap } from './map.js';
import { initSync, refresh } from './sync.js';

// 依序載入地圖與資料庫程式庫；每個都有備用來源
function loadLibs(){
  return new Promise((resolve, reject) => {
    let li = 0, si = 0;
    (function next(){
      if (li >= LIBS.length) return resolve();
      const lib = LIBS[li];
      if (lib.ok()){ li++; si = 0; return next(); }
      if (si >= lib.srcs.length) return reject(new Error(lib.name + '載入失敗'));
      const s = document.createElement('script');
      s.src = lib.srcs[si++];
      s.onload = next; s.onerror = next;
      document.head.appendChild(s);
    })();
  });
}

function showLoadError(title){
  $('map').innerHTML = `<div class="load-error"><div><b style="color:#1f1f1f">${title}</b><br>
    請確認有連上網路後重新整理頁面。</div></div>`;
  $('fab').style.display = 'none';
}

// Esc：由最上層的視窗開始關閉
function onEscape(e){
  if (e.key !== 'Escape') return;
  if ($('pinOverlay').classList.contains('show')) closePin(false);
  else if ($('adminOverlay').classList.contains('show')) closeAdmin();
  else if ($('urlOverlay').classList.contains('show')) closeUrlDialog();
  else if ($('fabMenu').classList.contains('open')) toggleFabMenu(false);
  else if ($('overlay').classList.contains('show')) closeForm();
  else if (state.adding) setAdding(false);
}

function start(){
  document.documentElement.style.setProperty('--font', FONTS[prefs.font].ui);
  store.init();
  initAuth();
  initAdmin();
  initList();
  initForm();
  initSettings();
  initMapControls();
  initLocate();
  initSync();
  document.addEventListener('keydown', onEscape);

  const fontReady = document.fonts?.load ? document.fonts.load(`16px ${FONTS[prefs.font].ui}`, '臺北市中山區') : Promise.resolve();
  fontReady.catch(()=>{}).finally(() => { createMap(); render(); refresh(); });
}

loadLibs().then(start).catch(err => showLoadError(err.message));
