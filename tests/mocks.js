// ---- 假的 MapLibre ----
(function(){
  const handlers = {};
  class Popup { constructor(){ this._open=false; } setHTML(h){ this._html=h; return this; } isOpen(){ return this._open; } }
  class Marker {
    constructor(o={}){ this._el = o.element || document.createElement('div'); }
    setLngLat(ll){ this._ll = ll; return this; } getLngLat(){ return { lng:this._ll[0], lat:this._ll[1] }; }
    setPopup(p){ this._popup = p; this._el.addEventListener('click', () => this.togglePopup()); return this; }
    getPopup(){ return this._popup || new Popup(); }
    togglePopup(){ if (this._popup){ this._popup._open = !this._popup._open; if (this._popup._open){ const d=document.createElement('div'); d.className='mock-popup'; d.innerHTML=this._popup._html; document.querySelectorAll('.mock-popup').forEach(x=>x.remove()); document.body.appendChild(d); } else document.querySelectorAll('.mock-popup').forEach(x=>x.remove()); } return this; }
    addTo(m){ this._map=m; document.getElementById('map').appendChild(this._el); window.__markers=(window.__markers||0)+1; return this; }
    remove(){ this._el.remove(); return this; }
    getElement(){ return this._el; }
  }
  class Map {
    constructor(o){ this.o=o; this.zoom=o.zoom; this.center=o.center; this.ev={}; window.__map=this; setTimeout(()=> (this.ev['style.load']||[]).forEach(f=>f()), 10); }
    on(e,f){ (this.ev[e] ||= []).push(f); return this; } once(e,f){ setTimeout(f, 5); return this; }
    addControl(){} remove(){} setStyle(){ setTimeout(()=> (this.ev['style.load']||[]).forEach(f=>f()), 10); }
    getStyle(){ return { layers:[], sources:{ openmaptiles:{ type:'vector' } } }; }
    getLayer(){ return null; } addLayer(){} setLayoutProperty(){} getLayoutProperty(){ return null; } getSource(){ return {}; }
    getZoom(){ return this.zoom; } getCenter(){ return this.center; } isStyleLoaded(){ return true; }
    flyTo(o){ window.__lastFly = o; } zoomIn(){ this.zoom++; } zoomOut(){ this.zoom--; }
    fire(e, data){ (this.ev[e]||[]).forEach(f=>f(data)); }
  }
  window.maplibregl = { Map, Marker, Popup };
})();

// ---- 假的 Supabase（照 SQL 的邏輯在記憶體裡模擬） ----
(function(){
  const db = {
    editors:[ { id:1, name:'小明', pin:'482917', active:true, is_admin:true }, { id:2, name:'小華', pin:'305566', active:true, is_admin:false } ],
    restaurants:[ { id:'r1', name:'舊店', cat:'台式', visited:true, lat:25.04, lng:121.53, addr:'大安區', note:'', created_by:'小明', created_at:'2026-11-18T00:00:00Z' } ],
    ratings:[ { restaurant_id:'r1', editor_id:1, editor_name:'小明', rating:4, comment:'湯頭很香' } ],
  };
  window.__db = db; window.__realtime = [];
  const auth = pin => db.editors.find(e => e.active && e.pin === pin);
  const deny = { ok:false, error:'invalid_pin' };
  const rpcs = {
    verify_pin:({p_pin}) => { const a = auth(p_pin); return a ? { ok:true, name:a.name, is_admin:a.is_admin } : deny; },
    add_restaurant:(p) => { const a = auth(p.p_pin); if (!a) return deny;
      const r = { id:'r'+(db.restaurants.length+1), name:p.p_name, cat:p.p_cat, visited:p.p_visited, lat:p.p_lat, lng:p.p_lng, addr:p.p_addr||null, note:p.p_note||null, created_by:a.name, created_at:new Date().toISOString() };
      db.restaurants.push(r); const rt = p.p_visited ? p.p_rating : null, cm = (p.p_note||'').trim() || null; if (rt || cm) db.ratings.push({ restaurant_id:r.id, editor_id:a.id, editor_name:a.name, rating:rt, comment:cm });
      return { ok:true, data:r }; },
    update_restaurant:(p) => { const a = auth(p.p_pin); if (!a) return deny;
      const r = db.restaurants.find(x => x.id === p.p_id); Object.assign(r, { name:p.p_name, cat:p.p_cat, visited:p.p_visited, addr:p.p_addr, note:p.p_note, updated_by:a.name });
      const old = db.ratings.find(x => x.restaurant_id === r.id && x.editor_id === a.id); const rt = p.p_visited ? p.p_rating : (old?.rating ?? null), cm = (p.p_note||'').trim() || null; db.ratings = db.ratings.filter(x => x !== old); if (rt || cm) db.ratings.push({ restaurant_id:r.id, editor_id:a.id, editor_name:a.name, rating:rt, comment:cm });
      return { ok:true, data:r }; },
    delete_restaurant:(p) => { if (!auth(p.p_pin)) return deny; db.restaurants = db.restaurants.filter(x => x.id !== p.p_id); return { ok:true }; },
    admin_list_editors:({p_pin}) => { const a = auth(p_pin); if (!a) return deny; if (!a.is_admin) return { ok:false, error:'not_admin' };
      return { ok:true, data: db.editors.map(({id,name,active,is_admin}) => ({id,name,active,is_admin})) }; },
    admin_add_editor:(p) => { const a = auth(p.p_pin); if (!a?.is_admin) return deny;
      if (!p.p_new_pin || p.p_new_pin.length > 32) return { ok:false, error:'bad_pin' };
      if (db.editors.some(e => e.name === p.p_name)) return { ok:false, error:'name_taken' };
      if (db.editors.some(e => e.pin === p.p_new_pin)) return { ok:false, error:'pin_taken' };
      db.editors.push({ id:db.editors.length+1, name:p.p_name, pin:p.p_new_pin, active:true, is_admin:false }); return { ok:true }; },
    admin_rename_editor:(p) => { const a = auth(p.p_pin); if (!a?.is_admin) return deny; const e = db.editors.find(x => x.id === p.p_id);
      const old = e.name; e.name = p.p_name; db.restaurants.forEach(r => { if (r.created_by === old) r.created_by = p.p_name; }); db.ratings.forEach(r => { if (r.editor_id === e.id) r.editor_name = p.p_name; }); return { ok:true }; },
    admin_reset_pin:(p) => { const a = auth(p.p_pin); if (!a?.is_admin) return deny; if (db.editors.some(e => e.pin === p.p_new_pin && e.id !== p.p_id)) return { ok:false, error:'pin_taken' };
      db.editors.find(x => x.id === p.p_id).pin = p.p_new_pin; return { ok:true }; },
    admin_set_active:(p) => { const a = auth(p.p_pin); if (!a?.is_admin) return deny; if (p.p_id === a.id && !p.p_active) return { ok:false, error:'self' };
      db.editors.find(x => x.id === p.p_id).active = p.p_active; return { ok:true }; },
  };
  const client = {
    from(){ return { select(sel){ window.__lastSelect = sel; return { order(){ return Promise.resolve({ data: db.restaurants.map(r => ({ ...r, ratings: db.ratings.filter(g => g.restaurant_id === r.id).map(({editor_name,rating,comment}) => ({editor_name,rating,comment})) })), error:null }); } }; } }; },
    rpc(fn, args){ window.__calls = (window.__calls||[]).concat([[fn, args]]); return Promise.resolve({ data: rpcs[fn](args), error:null }); },
    channel(){ const ch = { on(_, f, cb){ window.__realtime.push(cb); return ch; }, subscribe(){ window.__subscribed = true; return ch; } }; return ch; },
  };
  window.supabase = { createClient: () => client };
})();
