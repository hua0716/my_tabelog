// 管理使用者（只有管理員看得到）：新增、改名、重設 PIN、停用／啟用

import { store } from './store.js';
import { $, esc, toast } from './utils.js';
import { auth, saveAuth, renderEditbar, handleError } from './auth.js';
import { refresh } from './sync.js';

const ADMIN_ERR = {
  bad_name:'名字需為 1～20 個字', bad_pin:'PIN 不能空白，最長 32 碼', name_taken:'這個名字已經有人用了',
  pin_taken:'這組 PIN 已經有人用了，請換一組', self:'不能停用自己', not_admin:'只有管理員可以使用這個功能',
  not_found:'找不到這位使用者，請重新整理',
};
let editors = [];

function adminError(err){
  if (err.code === 'invalid_pin' || err.code === 'locked') return handleError(err);
  $('adminErr').textContent = ADMIN_ERR[err.code] || '操作失敗，請檢查網路後再試';
  $('adminErr').style.display = 'block';
}

export async function openAdmin(){
  $('adminErr').style.display = 'none'; $('newName').value = ''; $('newPin').value = '';
  $('adminList').innerHTML = '<div class="empty">載入中…</div>';
  $('adminOverlay').classList.add('show');
  await loadEditors();
}
export function closeAdmin(){ $('adminOverlay').classList.remove('show'); }

async function loadEditors(){
  try { editors = (await store.admin(auth.pin, 'admin_list_editors')).data; renderEditors(); }
  catch(err){ adminError(err); $('adminList').innerHTML = ''; }
}

function renderEditors(){
  $('adminList').innerHTML = editors.map(e => {
    const me = e.name === auth.name;
    return `<div class="admin-row ${e.active ? '' : 'inactive'}" data-id="${e.id}">
      <div class="admin-top">
        <div class="admin-name">${esc(e.name)}${me ? '（你）' : ''}${e.is_admin ? '<span class="badge">管理員</span>' : ''}${e.active ? '' : '<span class="badge off">已停用</span>'}</div>
        <div class="admin-actions">
          <button type="button" class="link" data-act="rename">改名</button>
          <button type="button" class="link" data-act="pin">重設 PIN</button>
          ${me ? '' : `<button type="button" class="link" data-act="toggle">${e.active ? '停用' : '啟用'}</button>`}
        </div>
      </div>
      <div class="admin-edit" hidden>
        <input autocomplete="off" maxlength="32">
        <button type="button" class="btn primary" data-act="ok">確定</button>
        <button type="button" class="btn" data-act="cancel">取消</button>
      </div>
    </div>`;
  }).join('');
}

async function onListClick(e){
  const b = e.target.closest('button'); if (!b) return;
  const row = b.closest('.admin-row'), id = +row.dataset.id, ed = editors.find(x => x.id === id);
  const box = row.querySelector('.admin-edit'), input = box.querySelector('input');
  $('adminErr').style.display = 'none';
  const act = b.dataset.act;

  if (act === 'rename' || act === 'pin'){
    document.querySelectorAll('.admin-edit').forEach(x => { if (x !== box) x.hidden = true; });
    box.hidden = false; box.dataset.mode = act;
    input.value = act === 'rename' ? ed.name : '';
    input.placeholder = act === 'rename' ? '新的名字' : '新的 PIN';
    input.inputMode = act === 'pin' ? 'numeric' : 'text';
    input.maxLength = act === 'rename' ? 20 : 32;
    input.focus(); input.select();
  }
  else if (act === 'cancel') box.hidden = true;
  else if (act === 'ok'){
    const v = input.value.trim(); if (!v) return input.focus();
    b.disabled = true;
    try {
      if (box.dataset.mode === 'rename'){
        await store.admin(auth.pin, 'admin_rename_editor', { p_id:id, p_name:v });
        if (ed.name === auth.name){ auth.name = v; saveAuth(); renderEditbar(); }
        toast('已改名'); refresh();
      } else {
        await store.admin(auth.pin, 'admin_reset_pin', { p_id:id, p_new_pin:v });
        if (ed.name === auth.name){ auth.pin = v; saveAuth(); }
        toast(`已重設 ${ed.name} 的 PIN`);
      }
      await loadEditors();
    } catch(err){ adminError(err); }
    finally { b.disabled = false; }
  }
  else if (act === 'toggle'){
    b.disabled = true;
    try {
      await store.admin(auth.pin, 'admin_set_active', { p_id:id, p_active:!ed.active });
      toast(ed.active ? `已停用 ${ed.name}` : `已啟用 ${ed.name}`);
      await loadEditors();
    }
    catch(err){ adminError(err); }
    finally { b.disabled = false; }
  }
}

async function addEditor(){
  const name = $('newName').value.trim(), pin = $('newPin').value.trim();
  $('adminErr').style.display = 'none';
  if (!name) return $('newName').focus();
  if (!pin) return $('newPin').focus();
  $('addEditorBtn').disabled = true;
  try {
    await store.admin(auth.pin, 'admin_add_editor', { p_name:name, p_new_pin:pin });
    toast(`已新增 ${name}`); $('newName').value = ''; $('newPin').value = '';
    await loadEditors();
  } catch(err){ adminError(err); }
  finally { $('addEditorBtn').disabled = false; }
}

export function initAdmin(){
  $('adminList').onclick = onListClick;
  $('adminList').onkeydown = e => {
    if (e.key === 'Enter' && e.target.matches('.admin-edit input')){ e.preventDefault(); e.target.parentElement.querySelector('[data-act=ok]').click(); }
  };
  $('addEditorBtn').onclick = addEditor;
  $('newPin').onkeydown = e => { if (e.key === 'Enter') addEditor(); };
  $('adminClose').onclick = closeAdmin;
  $('adminOverlay').onclick = e => { if (e.target === $('adminOverlay')) closeAdmin(); };
}
