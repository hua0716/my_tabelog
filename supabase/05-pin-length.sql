-- =====================================================================
-- 更新 5：取消 PIN 的最短長度限制（仍不可空白、不可與他人重複，最長 32 碼）
-- 用法：Supabase → SQL Editor → New query → 全部貼上 → Run（只需執行一次）
-- =====================================================================

create or replace function public.admin_add_editor(p_pin text, p_name text, p_new_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin); v_name text := trim(coalesce(p_name,''));
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if char_length(v_name) not between 1 and 20 then return jsonb_build_object('ok',false,'error','bad_name'); end if;
  if char_length(coalesce(p_new_pin,'')) not between 1 and 32 then return jsonb_build_object('ok',false,'error','bad_pin'); end if;
  if exists (select 1 from editors where name = v_name) then return jsonb_build_object('ok',false,'error','name_taken'); end if;
  if _pin_taken(p_new_pin, null) then return jsonb_build_object('ok',false,'error','pin_taken'); end if;
  insert into editors(name, pin_hash) values (v_name, crypt(p_new_pin, gen_salt('bf')));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.admin_reset_pin(p_pin text, p_id int, p_new_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare a jsonb := _auth(p_pin);
begin
  if a->>'status' <> 'ok' then return _deny(a); end if;
  if not (a->>'is_admin')::boolean then return jsonb_build_object('ok',false,'error','not_admin'); end if;
  if char_length(coalesce(p_new_pin,'')) not between 1 and 32 then return jsonb_build_object('ok',false,'error','bad_pin'); end if;
  if not exists (select 1 from editors where id = p_id) then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if _pin_taken(p_new_pin, p_id) then return jsonb_build_object('ok',false,'error','pin_taken'); end if;
  update editors set pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = p_id;
  return jsonb_build_object('ok',true);
end $$;
