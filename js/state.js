// 畫面目前的狀態（篩選條件、選中的餐廳、表單內容），各模組共用同一份

import { CATEGORIES } from './config.js';

export const state = {
  // 篩選
  cat:'全部', visit:'all', q:'', minRate:0,
  // 地圖與列表
  activeId:null, adding:false,
  // 表單
  editing:null, pending:null, rating:4, formVisited:true, formCat:CATEGORIES[0].id,
};
