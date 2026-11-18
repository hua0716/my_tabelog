-- =====================================================================
-- 更新 1：新增「是否已拜訪」狀態
-- 用法：Supabase → SQL Editor → New query → 全部貼上 → Run（只需執行一次）
-- 現有的餐廳都會被視為「已拜訪」，評分保留不變。
-- =====================================================================

alter table public.restaurants add column if not exists visited boolean not null default true;
alter table public.restaurants alter column rating drop not null;   -- 「想去」的餐廳沒有評分

drop function if exists public.add_restaurant(text,text,text,int,double precision,double precision,text,text);
drop function if exists public.update_restaurant(text,uuid,text,text,int,text,text);

create function public.add_restaurant(
  p_pin text, p_name text, p_cat text, p_rating int,
  p_lat double precision, p_lng double precision, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin); v_row restaurants;
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  insert into restaurants(name,cat,rating,visited,lat,lng,addr,note,created_by)
  values (trim(p_name), p_cat, case when p_visited then p_rating end, coalesce(p_visited,true),
          p_lat, p_lng, nullif(trim(p_addr),''), nullif(trim(p_note),''), v_name)
  returning * into v_row;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

create function public.update_restaurant(
  p_pin text, p_id uuid, p_name text, p_cat text, p_rating int, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare v_name text := _check_pin(p_pin); v_row restaurants;
begin
  if v_name = '__locked__' then return jsonb_build_object('ok',false,'error','locked'); end if;
  if v_name is null then return jsonb_build_object('ok',false,'error','invalid_pin'); end if;
  update restaurants set name=trim(p_name), cat=p_cat,
         visited=coalesce(p_visited,true), rating=case when p_visited then p_rating end,
         addr=nullif(trim(p_addr),''), note=nullif(trim(p_note),''),
         updated_by=v_name, updated_at=now()
   where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

grant execute on function public.add_restaurant(text,text,text,int,double precision,double precision,text,text,boolean) to anon, authenticated;
grant execute on function public.update_restaurant(text,uuid,text,text,int,text,text,boolean) to anon, authenticated;

-- 讓網站馬上認得新欄位
notify pgrst, 'reload schema';
