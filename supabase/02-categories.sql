-- =====================================================================
-- 更新 2：分類改由網站決定（新增「炸物小吃」，之後增減分類不必再改資料庫）
-- 用法：Supabase → SQL Editor → New query → 全部貼上 → Run（只需執行一次）
-- =====================================================================

alter table public.restaurants drop constraint if exists restaurants_cat_check;
alter table public.restaurants add constraint restaurants_cat_check
  check (char_length(cat) between 1 and 20);
