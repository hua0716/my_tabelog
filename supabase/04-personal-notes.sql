-- =====================================================================
-- 更新 4：每個人各自的備註
-- 用法：Supabase → SQL Editor → New query → 全部貼上 → Run（只需執行一次）
-- 原本每家餐廳的共用備註，會轉成「新增者的備註」。
-- =====================================================================

-- 評分表同時存放每個人的備註（只寫備註、不評分也可以）
alter table public.ratings alter column rating drop not null;
alter table public.ratings add column if not exists comment text;
alter table public.ratings drop constraint if exists ratings_comment_len;
alter table public.ratings add constraint ratings_comment_len check (char_length(comment) <= 500);
alter table public.ratings drop constraint if exists ratings_has_content;
alter table public.ratings add constraint ratings_has_content check (rating is not null or comment is not null);

-- 原本的共用備註 → 新增者的備註
insert into public.ratings(restaurant_id, editor_id, editor_name, comment)
select r.id, e.id, e.name, r.note
  from public.restaurants r join public.editors e on e.name = r.created_by
 where nullif(trim(r.note),'') is not null
on conflict (restaurant_id, editor_id) do update set comment = excluded.comment;

-- 新增餐廳：p_rating、p_note 都是「新增者自己的」
create or replace function public.add_restaurant(
  p_pin text, p_name text, p_cat text, p_rating int,
  p_lat double precision, p_lng double precision, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_row restaurants;
        v_rating int := case when coalesce(p_visited,true) then p_rating end;
        v_comment text := nullif(trim(coalesce(p_note,'')),'');
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  insert into restaurants(name,cat,rating,visited,lat,lng,addr,note,created_by)
  values (trim(p_name), p_cat, null, coalesce(p_visited,true),
          p_lat, p_lng, nullif(trim(p_addr),''), null, a->>'name')
  returning * into v_row;
  if v_rating is not null or v_comment is not null then
    insert into ratings(restaurant_id, editor_id, editor_name, rating, comment)
    values (v_row.id, (a->>'id')::int, a->>'name', v_rating, v_comment);
  end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

-- 編輯餐廳：p_rating、p_note 都是「編輯者自己的」
-- 標成「未探訪」時保留自己原本的評分（只是不顯示），備註照常更新
create or replace function public.update_restaurant(
  p_pin text, p_id uuid, p_name text, p_cat text, p_rating int, p_addr text, p_note text,
  p_visited boolean default true)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_row restaurants; v_old int; v_rating int;
        v_comment text := nullif(trim(coalesce(p_note,'')),'');
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  update restaurants set name=trim(p_name), cat=p_cat, visited=coalesce(p_visited,true),
         addr=nullif(trim(p_addr),''), updated_by=a->>'name', updated_at=now()
   where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok',false,'error','not_found'); end if;

  select rating into v_old from ratings where restaurant_id = p_id and editor_id = (a->>'id')::int;
  v_rating := case when coalesce(p_visited,true) then p_rating else v_old end;
  if v_rating is null and v_comment is null then
    delete from ratings where restaurant_id = p_id and editor_id = (a->>'id')::int;
  else
    insert into ratings(restaurant_id, editor_id, editor_name, rating, comment)
    values (p_id, (a->>'id')::int, a->>'name', v_rating, v_comment)
    on conflict (restaurant_id, editor_id)
    do update set rating = excluded.rating, comment = excluded.comment,
                  editor_name = excluded.editor_name, updated_at = now();
  end if;
  return jsonb_build_object('ok',true,'data',to_jsonb(v_row));
end $$;

notify pgrst, 'reload schema';
