# 給 Claude 的工作說明

這是使用者（Hua）和朋友共用的台北美食地圖。主要由 Claude 修改並推送，但使用者有時也會自己調整部分程式或檔案；修改前先讀過目前的程式，保留使用者的調整，不要覆蓋。請用繁體中文、白話地和使用者溝通，避免技術術語。

- 網站：https://hua0716.github.io/my_tabelog/（GitHub Pages，`main` 分支根目錄）
- 前端：純 HTML／CSS／JavaScript 模組，沒有建置工具；檔案結構見 `README.md`
- 資料庫：Supabase，結構與歷次更新見 `supabase/README.md`
- 地圖：MapLibre GL 4.7.1＋OpenFreeMap（免 key），另可切換內政部國土測繪中心圖資

## 修改流程

1. 開始修改前與推送前都先 `git fetch` 檢查 `origin/main`：使用者可能直接在 GitHub 上改過檔案或程式，有新提交就以它為基礎（rebase），不要覆蓋；若使用者的調整和這次要做的修改衝突，先詢問
2. 修改 `css/` 或 `js/` 後執行 `python3 tools/bump_version.py` 更新版本號（避免瀏覽器快取舊檔）
3. 執行 `python3 tests/run.py`，需全部通過。新功能請在 `tests/run.py` 加對應檢查；資料庫行為的模擬在 `tests/mocks.js`
4. 需要改資料庫時：寫成 `supabase/NN-xxx.sql`，盡量先在本地 PostgreSQL 測試；**Claude 無法直接操作 Supabase**，要把 SQL 給使用者到 SQL Editor 執行，確認執行完成後才推送依賴它的前端
5. 推送後提醒使用者約 1～2 分鐘生效，並用 `Cmd/Ctrl + Shift + R` 強制重新整理

## 設計原則與注意事項

- 僅使用免費資源：服務、圖資、程式庫都以免費方案為主；若某個需求不得已需要付費（或需綁定付款方式），先向使用者說明原因與費用並詢問，不可自行採用
- 權限：所有寫入都透過資料庫函式驗證 PIN；PIN 不可出現在程式碼或儲存庫裡。publishable key 是公開的，放在 `js/config.js` 沒問題
- 餐廳圓點的外層 `.marker` 由 MapLibre 用 transform 定位，**不可加 CSS transition／transform**（會造成拖曳延遲），外觀與動畫放在內層 `.marker-dot`
- 手機版（寬度 ≤ 760px）的版面在 `css/style.css` 最後的 media query；搜尋與篩選在手機上可收合
- 介面風格：簡約、黑白灰為主，分類用顏色區分；文字一律繁體中文
- 使用者偏好：標題「派大星想吃美味蟹堡」；狀態用詞為「已拜訪／未探訪」
