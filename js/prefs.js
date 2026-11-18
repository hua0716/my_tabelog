// 每個人自己的顯示偏好（字體、底圖、地圖顯示項目），記在瀏覽器裡

import { FONTS, BASEMAPS } from './config.js';

export const prefs = (() => { try { return JSON.parse(localStorage.getItem('tfm-prefs')) || {}; } catch(e){ return {}; } })();
prefs.font = FONTS[prefs.font] ? prefs.font : 'sans';
prefs.base = BASEMAPS[prefs.base] && prefs.v === 3 ? prefs.base : 'liberty';
prefs.v = 3;
prefs.poi = Object.assign({ stations:true, parks:true, sights:true, bike:true, shops:true }, prefs.poi);

export const savePrefs = () => { try { localStorage.setItem('tfm-prefs', JSON.stringify(prefs)); } catch(e){} };
