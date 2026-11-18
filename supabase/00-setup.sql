-- =====================================================================
-- 台北美食地圖：Supabase 設定
-- 用法：Supabase 專案 → 左側「SQL Editor」→ New query → 全部貼上 → Run
-- 只需要執行一次。
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 餐廳資料表 ----------
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  cat         text not null check (cat in ('台式','日式','東南亞','西式','甜點','咖啡廳','其他')),
  rating      int  not null check (rating between 1 and 5),
  lat         double precision not null check (lat between 21 and 27),
  lng         double precision not null check (lng between 118 and 123),
  addr        text check (char_length(addr) <= 120),
  note        text check (char_length(note) <= 500),
  created_by  text not null,
  created_at  timestamptz not null default now(),
  updated_by  text,
  updated_at  timestamptz
);
alter table public.restaurants enable row level security;

-- 任何人都可以看
drop policy if exists "public read" on public.restaurants;
create policy "public read" on public.restaurants for select to anon, authenticated using (true);
-- 沒有新增／修改／刪除的 policy：這些動作只能透過下面驗證 PIN 的函式進行
grant select on public.restaurants to anon, authenticated;

-- ---------- 編輯者（PIN 只存加密後的版本） ----------
create table if not exists public.editors (
  id        serial primary key,
  name      text unique not null,
  pin_hash  text not null,
  active    boolean not null default true
);
alter table public.editors enable row level security;   -- 沒有 policy：網頁讀不到

-- ---------- PIN 嘗試紀錄（防止猜 PIN） ----------
create table if not exists public.pin_attempts (
  id  bigserial primary key,
  at  timestamptz not null default now(),
  ok  boolean not null
);
alter table public.pin_attempts enable row level security;

-- ---------- 內部：驗證 PIN，回傳編輯者名稱（錯誤回傳 null） ----------
create or replace function public._check_pin(p_pin text)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text; v_fails int;
begin
  delete from pin_attempts where at < now() - interval '1 day';
  select count(*) into v_fails from pin_attempts where not ok and at > now() - interval '10 minutes';
  if v_fails >= 20 then return '__locked__'; end if;

  select name into v_name from editors
   where active and pin_hash = crypt(coalesce(p_pin,''), pin_hash) limit 1;
  insert into pin_attempts(ok) values (v_name is not null);
  return v_name;
end $$;
revoke all on function public._check_pin(text) from public, anon, authenticated;

-- ---------- 網頁呼叫的函式 ----------
create or replace function public.verify_pin(p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin);
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  return jsonb_build_object('ok',true,'name',v_name);
end $$;

create or replace function public.add_restaurant(
  p_pin text, p_name text, p_cat text, p_rating int,
  p_lat double precision, p_lng double precision, p_addr text, p_note text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin); v_row restaurants;
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  insert into restaurants(name,cat,rating,lat,lng,addr,note,created_by)
  values (trim(p_name),p_cat,p_rating,p_lat,p_lng,nullif(trim(p_addr),''),nullif(trim(p_note),''),v_name)
  returning * into v_row;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

create or replace function public.update_restaurant(
  p_pin text, p_id uuid, p_name text, p_cat text, p_rating int, p_addr text, p_note text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin); v_row restaurants;
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  update restaurants set name=trim(p_name), cat=p_cat, rating=p_rating,
         addr=nullif(trim(p_addr),''), note=nullif(trim(p_note),''),
         updated_by=v_name, updated_at=now()
   where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

create or replace function public.delete_restaurant(p_pin text, p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin);
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  delete from restaurants where id = p_id;
  return jsonb_build_object('ok',true);
end $$;

grant execute on function public.verify_pin(text) to anon, authenticated;
grant execute on function public.add_restaurant(text,text,text,int,double precision,double precision,text,text) to anon, authenticated;
grant execute on function public.update_restaurant(text,uuid,text,text,int,text,text) to anon, authenticated;
grant execute on function public.delete_restaurant(text,uuid) to anon, authenticated;

-- =====================================================================
-- 新增編輯者：把名字和 PIN 換成你要的（PIN 建議至少 6 位數），每人一行
-- 之後要加人，只要再單獨執行一行 insert 就好
-- =====================================================================
insert into public.editors(name, pin_hash) values
  ('你的名字', extensions.crypt('換成你的PIN', extensions.gen_salt('bf')));
-- ('朋友名字', extensions.crypt('朋友的PIN', extensions.gen_salt('bf'))),

-- 停用某人：update public.editors set active = false where name = '朋友名字';
-- 更換 PIN：update public.editors set pin_hash = extensions.crypt('新PIN', extensions.gen_salt('bf')) where name = '朋友名字';
