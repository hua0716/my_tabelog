# 資料庫（Supabase）

這個資料夾是資料庫設定的**紀錄**，依編號順序在 Supabase 的 SQL Editor 執行過。網站本身不會讀取這些檔案。

| 檔案 | 內容 |
|---|---|
| `00-setup.sql` | 建立餐廳表、編輯者表、PIN 嘗試紀錄、PIN 驗證與新增／編輯／刪除函式 |
| `01-visited.sql` | 新增「已探訪／未探訪」狀態 |
| `02-categories.sql` | 分類改由網站決定（資料庫只檢查長度） |
| `03-ratings-admin-realtime.sql` | 每人評分（`ratings` 表）、管理員與管理使用者函式、即時同步 |
| `04-personal-notes.sql` | 每人各自的備註（存在 `ratings.comment`） |
| `05-pin-length.sql` | 取消 PIN 最短長度限制（1～32 碼、不可重複） |

**要重建一個全新的資料庫**：依序執行 00 → 05。執行 00 前，先把最後的「你的名字／換成你的 PIN」改掉；第一個建立的使用者會在 03 自動成為管理員。

## 目前的結構

**資料表**（都開了 RLS，網頁只能讀取，不能直接寫入）

- `restaurants`：id、name、cat、visited、lat、lng、addr、created_by、created_at、updated_by、updated_at
  - `rating`、`note` 兩欄是舊版留下的，已不使用（評分與備註改存在 `ratings`）
- `ratings`：每人對每家餐廳一筆，主鍵 (restaurant_id, editor_id)；rating（1～5，可空）、comment（可空，兩者至少一個）、editor_name
- `editors`：name、pin_hash（bcrypt）、active、is_admin。網頁讀不到這張表
- `pin_attempts`：PIN 嘗試紀錄，10 分鐘內錯 20 次就暫停驗證

**網頁呼叫的函式**（都以 PIN 驗證，`security definer`）

- `verify_pin(p_pin)` → { ok, name, is_admin }
- `add_restaurant(p_pin, p_name, p_cat, p_rating, p_lat, p_lng, p_addr, p_note, p_visited)`：p_rating／p_note 是新增者自己的評分與備註
- `update_restaurant(p_pin, p_id, p_name, p_cat, p_rating, p_addr, p_note, p_visited)`：p_rating／p_note 是編輯者自己的；兩者都空時刪除自己那筆
- `delete_restaurant(p_pin, p_id)`
- 管理員專用：`admin_list_editors`、`admin_add_editor`、`admin_rename_editor`、`admin_reset_pin`、`admin_set_active`

**內部函式**（已撤銷網頁的執行權限）：`_auth`、`_check_pin`、`_pin_taken`、`_deny`

錯誤一律以 `{ ok:false, error:'代碼' }` 回傳，代碼包括 invalid_pin、locked、not_found、not_admin、bad_name、bad_pin、name_taken、pin_taken、self。

**即時同步**：`restaurants`、`ratings` 已加入 `supabase_realtime` publication。

## 新增資料庫更新時

建立新檔 `06-xxx.sql`，盡量寫成可重複執行（`if not exists`、`create or replace`、`drop ... if exists`），並更新上面的表格與結構說明。改函式參數時要先 `drop function` 舊的簽名，否則會多出一個同名函式。
