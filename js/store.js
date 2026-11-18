// 資料存取：所有和 Supabase 溝通的地方都在這裡

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let sb;

// 把資料庫的一筆餐廳整理成畫面要用的格式
// reviews：每個人的評分＋備註；ratings：其中有評分的部分（用來算平均）
function norm(r){
  const reviews = (r.ratings || []).filter(x => x && (x.rating || x.comment))
    .sort((a,b) => a.editor_name.localeCompare(b.editor_name, 'zh-Hant'));
  const ratings = reviews.filter(x => x.rating);
  const avg = ratings.length ? ratings.reduce((s,x) => s + x.rating, 0) / ratings.length : null;
  return { ...r, addr: r.addr || '', by: r.created_by, visited: r.visited !== false, reviews, ratings, avg,
           comments: reviews.map(x => x.comment || '').join(' ') };
}

export const store = {
  _items: [],
  init(){ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false } }); },

  async load(){
    const { data, error } = await sb.from('restaurants').select('*, ratings(editor_name, rating, comment)').order('created_at', { ascending:false });
    if (error) throw error;
    this._items = data.map(norm);
  },
  all(){ return this._items; },

  // 呼叫資料庫函式；回傳 ok:false 時丟出帶有 code 的錯誤
  async _rpc(fn, args){
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    if (!data?.ok){ const e = new Error(data?.error || 'unknown'); e.code = data?.error; throw e; }
    return data;
  },

  async verify(pin){ const d = await this._rpc('verify_pin', { p_pin:pin }); return { name:d.name, isAdmin:!!d.is_admin }; },
  admin(pin, fn, args = {}){ return this._rpc(fn, { p_pin: pin, ...args }); },

  async add(r, pin){
    const d = await this._rpc('add_restaurant', { p_pin:pin, p_name:r.name, p_cat:r.cat, p_rating:r.rating,
      p_lat:r.lat, p_lng:r.lng, p_addr:r.addr, p_note:r.note, p_visited:r.visited });
    const it = norm(d.data); this._items.unshift(it); return it;
  },
  async update(id, r, pin){
    const d = await this._rpc('update_restaurant', { p_pin:pin, p_id:id, p_name:r.name, p_cat:r.cat,
      p_rating:r.rating, p_addr:r.addr, p_note:r.note, p_visited:r.visited });
    const it = norm(d.data); this._items = this._items.map(x => x.id === id ? it : x); return it;
  },
  async remove(id, pin){
    await this._rpc('delete_restaurant', { p_pin:pin, p_id:id });
    this._items = this._items.filter(x => x.id !== id);
  },

  // 即時同步：餐廳或評分有變動時呼叫 onChange
  subscribe(onChange){
    sb.channel('food-map')
      .on('postgres_changes', { event:'*', schema:'public', table:'restaurants' }, onChange)
      .on('postgres_changes', { event:'*', schema:'public', table:'ratings' }, onChange)
      .subscribe();
  },
};
