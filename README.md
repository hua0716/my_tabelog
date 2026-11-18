# 美食地圖

和朋友一起在台北地圖上標記喜歡的餐廳。網站：https://hua0716.github.io/my_tabelog/

- 任何人都能看地圖；輸入自己的 PIN 後才能新增、編輯、評分、寫備註
- 資料存在 Supabase，網頁放在 GitHub Pages
- 地圖使用 MapLibre＋OpenFreeMap（免費、不需 API key），也可切換臺灣通用電子地圖、衛星影像

## 檔案結構

```
index.html          畫面骨架（側欄、按鈕、各個對話框）
css/style.css       所有樣式
js/
├── main.js         進入點：載入外部程式庫，依序啟動各部分；Esc 關閉視窗
├── config.js       設定：Supabase 連線、分類與顏色、字體、底圖、可勾選的地點
├── prefs.js        每個人的顯示偏好（字體、底圖、顯示項目），記在瀏覽器
├── state.js        畫面目前的狀態（篩選條件、選中的餐廳、表單內容）
├── utils.js        共用小工具：取得元素、跳脫文字、評分顯示、提示訊息
├── store.js        資料存取：所有和 Supabase 溝通的地方
├── auth.js         PIN 登入／登出、管理員身分、錯誤處理
├── admin.js        管理使用者（新增、改名、重設 PIN、停用）
├── map.js          地圖、底圖與字體切換、捷運站／公園等地點圖層、縮放
├── markers.js      餐廳圓點與資訊視窗
├── list.js         側欄搜尋、篩選、餐廳列表
├── form.js         新增／編輯餐廳、新增按鈕選單、貼上 Google 地圖網址
├── gmaps.js        解析 Google 地圖網址（純計算）
├── locate.js       我的位置
├── settings.js     設定面板（齒輪）
└── sync.js         重新載入與即時同步
tools/bump_version.py   更新版本號（每次改 css/js 後執行）
tests/              瀏覽器自動測試（模擬地圖與資料庫）
```

## 常見修改

| 想做的事 | 改哪裡 |
|---|---|
| 新增、改名、調整分類或顏色 | `js/config.js` 的 `CATEGORIES` |
| 改地圖上捷運站、公園等的樣式或出現時機 | `js/map.js` 的 `addPoiLayers` |
| 改資訊視窗內容 | `js/markers.js` 的 `popupHtml` |
| 改列表或篩選 | `js/list.js` |
| 改新增／編輯表單 | `index.html` 的表單區塊＋`js/form.js` |
| 改顏色、大小、版面 | `css/style.css` |

## 修改後的步驟

1. 改完 `css/` 或 `js/` 後執行 `python3 tools/bump_version.py`，更新 `index.html` 裡的版本號，避免瀏覽器讀到舊檔案
2. 執行 `python3 tests/run.py` 確認測試全部通過
3. 推送到 `main`，GitHub Pages 約 1～2 分鐘後更新

注意：網站使用 JavaScript 模組，直接雙擊 `index.html` 打開會無法載入；請看 GitHub Pages 上的網站，或在資料夾內執行 `python3 -m http.server` 後打開 http://localhost:8000 。

## 資料庫

資料表與函式定義在 Supabase。PIN 只存加密後的版本；新增、修改、刪除都要透過驗證 PIN 的資料庫函式，網頁無法直接改資料。
