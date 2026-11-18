-- =====================================================================
-- 更新 3：每個人各自評分、在網站上管理使用者、即時同步
-- 用法：Supabase → SQL Editor → New query → 全部貼上 → Run（只需執行一次）
-- 執行完最下方會列出所有使用者，請確認你自己的 is_admin 是 true。
-- =====================================================================

-- ---------- 1. 使用者：新增「管理員」欄位，最早建立的使用者設為管理員 ----------
alter table public.editors add column if not exists is_admin boolean not null default false;
update public.editors set is_admin = true
 where id = (select min(id) from public.editors)
   and not exists (select 1 from public.editors where is_admin);

-- ---------- 2. 每人評分 ----------
create table if not exists public.ratings (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  editor_id     int  not null references public.editors(id) on delete cascade,
  editor_name   text not null,
  rating        int  not null check (rating between 1 and 5),
  updated_at    timestamptz not null default now(),
  primary key (restaurant_id, editor_id)
);
alter table public.ratings enable row level security;
drop policy if exists "public read" on public.ratings;
create policy "public read" on public.ratings for select to anon, authenticated using (true);
grant select on public.ratings to anon, authenticated;

-- 把原本的評分轉成「新增者的評分」
insert into public.ratings(restaurant_id, editor_id, editor_name, rating)
select r.id, e.id, e.name, r.rating
  from public.restaurants r join public.editors e on e.name = r.created_by
 where r.rating is not null and r.visited
on conflict do nothing;

-- ---------- 3. 內部：驗證 PIN，回傳使用者資訊 ----------
create or replace function public._auth(p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v editors; v_fails int;
begin
  delete from pin_attempts where at < now() - interval '1 day';
  select count(*) into v_fails from pin_attempts where not ok and at > now() - interval '10 minutes';
  if v_fails >= 20 then return jsonb_build_object('status','locked'); end if;
  select * into v from editors
   where active and pin_hash = crypt(coalesce(p_pin,''), pin_hash) limit 1;
  insert into pin_attempts(ok) values (v.id is not null);
  if v.id is null then return jsonb_build_object('status','invalid'); end if;
  return jsonb_build_object('status','ok','id',v.id,'name',v.name,'is_admin',v.is_admin);
end $$;

-- 舊函式改為呼叫 _auth（delete_restaurant 仍在使用）
create or replace function public._check_pin(p_pin text)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' = 'locked' then return '__locked__'; end if;
  if a->>'status' <> 'ok' then return null; end if;
  return a->>'name';
end $$;

-- PIN 是否已被別人使用（避免兩人同 PIN）
create or replace function public._pin_taken(p_pin text, p_except int)
returns boolean language sql security definer
set search_path = public, extensions as $$
  select exists (select 1 from editors where id <> coalesce(p_except,-1) and pin_hash = crypt(p_pin, pin_hash));
$$;

-- 驗證失敗時的統一回應
create or replace function public._deny(a jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object('ok',false,'error', case when a->>'status' = 'locked' then 'locked' else 'invalid_pin' end);
$$;

revoke all on function public._auth(text) from public, anon, authenticated;
revoke all on function public._check_pin(text) from public, anon, authenticated;
revoke all on function public._pin_taken(text,int) from public, anon, authenticated;
revoke all on function public._deny(jsonb) from public, anon, authenticated;

-- ---------- 4. 網頁呼叫的函式 ----------
create or replace function public.verify_pin(p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  return jsonb_build_object('ok',true,'name',a->>'name','is_admin',(a->>'is_admin')::boolean);
end $$;

-- 新增餐廳：p_rating 是「新增者自己的評分」
create or replace function public.add_restaurant(
  p_pin text, p_name text, p_cat text, p_rating int,
  p_lat double precision, p_lng double precision, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_row restaurants;
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  insert into restaurants(name,cat,rating,visited,lat,lng,addr,note,created_by)
  values (trim(p_name), p_cat, null, coalesce(p_visited,true),
          p_lat, p_lng, nullif(trim(p_addr),''), nullif(trim(p_note),''), a->>'name')
  returning * into v_row;
  if coalesce(p_visited,true) and p_rating is not null then
    insert into ratings(restaurant_id, editor_id, editor_name, rating)
    values (v_row.id, (a->>'id')::int, a->>'name', p_rating);
  end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

-- 編輯餐廳：p_rating 是「編輯者自己的評分」（null＝清除自己的評分）
create or replace function public.update_restaurant(
  p_pin text, p_id uuid, p_name text, p_cat text, p_rating int, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_row restaurants;
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  update restaurants set name=trim(p_name), cat=p_cat, visited=coalesce(p_visited,true),
         addr=nullif(trim(p_addr),''), note=nullif(trim(p_note),''),
         updated_by=a->>'name', updated_at=now()
   where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if coalesce(p_visited,true) then
    if p_rating is null then
      delete from ratings where restaurant_id = p_id and editor_id = (a->>'id')::int;
    else
      insert into ratings(restaurant_id, editor_id, editor_name, rating)
      values (p_id, (a->>'id')::int, a->>'name', p_rating)
      on conflict (restaurant_id, editor_id)
      do update set rating = excluded.rating, editor_name = excluded.editor_name, updated_at = now();
    end if;
  end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

-- ---------- 5. 管理使用者（只有管理員能用） ----------
create or replace function public.admin_list_editors(p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  return jsonb_build_object('ok',true,'data',
    coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active,'is_admin',is_admin) order by id)
                from editors), '[]'::jsonb));
end $$;

create or replace function public.admin_add_editor(p_pin text, p_name text, p_new_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_name text := trim(coalesce(p_name,''));
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if char_length(v_name) not between 1 and 20 then return jsonb_build_object('ok',false,'error','bad_name'); end if;
  if char_length(coalesce(p_new_pin,'')) not between 6 and 32 then return jsonb_build_object('ok',false,'error','bad_pin'); end if;
  if exists (select 1 from editors where name = v_name) then return jsonb_build_object('ok',false,'error','name_taken'); end if;
  if _pin_taken(p_new_pin, null) then return jsonb_build_object('ok',false,'error','pin_taken'); end if;
  insert into editors(name, pin_hash) values (v_name, crypt(p_new_pin, gen_salt('bf')));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_rename_editor(p_pin text, p_id int, p_name text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_old text; v_name text := trim(coalesce(p_name,''));
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if char_length(v_name) not between 1 and 20 then return jsonb_build_object('ok',false,'error','bad_name'); end if;
  select name into v_old from editors where id = p_id;
  if v_old is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if v_old = v_name then return jsonb_build_object('ok',true); end if;
  if exists (select 1 from editors where name = v_name) then return jsonb_build_object('ok',false,'error','name_taken'); end if;
  update editors set name = v_name where id = p_id;
  update restaurants set created_by = v_name where created_by = v_old;
  update restaurants set updated_by = v_name where updated_by = v_old;
  update ratings set editor_name = v_name where editor_id = p_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_reset_pin(p_pin text, p_id int, p_new_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if char_length(coalesce(p_new_pin,'')) not between 6 and 32 then return jsonb_build_object('ok',false,'error','bad_pin'); end if;
  if not exists (select 1 from editors where id = p_id) then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if _pin_taken(p_new_pin, p_id) then return jsonb_build_object('ok',false,'error','pin_taken'); end if;
  update editors set pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = p_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_set_active(p_pin text, p_id int, p_active boolean)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if p_id = (a->>'id')::int and not p_active then return jsonb_build_object('ok',false,'error','self'); end if;
  update editors set active = p_active where id = p_id;
  return jsonb_build_object('ok',true);
end $$;

grant execute on function public.verify_pin(text) to anon, authenticated;
grant execute on function public.admin_list_editors(text) to anon, authenticated;
grant execute on function public.admin_add_editor(text,text,text) to anon, authenticated;
grant execute on function public.admin_rename_editor(text,int,text) to anon, authenticated;
grant execute on function public.admin_reset_pin(text,int,text) to anon, authenticated;
grant execute on function public.admin_set_active(text,int,boolean) to anon, authenticated;

-- ---------- 6. 即時同步：資料變動時通知網頁 ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='restaurants') then
      alter publication supabase_realtime add table public.restaurants;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ratings') then
      alter publication supabase_realtime add table public.ratings;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ---------- 確認：你自己的 is_admin 應該是 true ----------
select id, name, active, is_admin from public.editors order by id;
-- 若管理員不是你：update public.editors set is_admin = (name = '你的名字');
