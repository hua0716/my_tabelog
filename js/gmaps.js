// 解析 Google 地圖網址或座標（純計算，不碰畫面，方便單獨測試）
// 回傳 { name, lat, lng, precise } 或 { error }

export function parseGoogleMaps(text){
  const t = (text || '').trim();
  if (!t) return { error:'請貼上網址或座標' };
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(t))
    return { error:'這是手機分享的短網址，網站讀不到裡面的位置。請在電腦瀏覽器打開這個連結，再複製網址列的完整網址。' };

  const inTaiwan = (lat, lng) => lat >= 21 && lat <= 27 && lng >= 118 && lng <= 123;
  let lat, lng, precise = false, name = '';

  // 純座標：25.0418, 121.5510
  let m = t.match(/^\s*(-?\d{1,2}\.\d+)\s*[,，\s]\s*(-?\d{1,3}\.\d+)\s*$/);
  if (m){ lat = +m[1]; lng = +m[2]; precise = true; }
  else {
    if (!/google\.[a-z.]+\/maps|maps\.google\./i.test(t)) return { error:'看起來不是 Google 地圖的網址，請再確認一次' };
    // 店家實際位置（最準）：…!3d25.0418!4d121.551…
    const pts = [...t.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
    if (pts.length){ const p = pts[pts.length - 1]; lat = +p[1]; lng = +p[2]; precise = true; }
    // 其他寫法：?q=25.04,121.55、query=、ll=
    if (lat == null && (m = t.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i))){ lat = +m[1]; lng = +m[2]; precise = true; }
    // 畫面中心（次準）：…/@25.04,121.55,17z
    if (lat == null && (m = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))){ lat = +m[1]; lng = +m[2]; }
    // 店名：…/maps/place/店名/…
    if ((m = t.match(/\/maps\/place\/([^/@?#]+)/))){
      try { name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch(e){ name = m[1]; }
      if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name)) name = '';   // place 後面放的是座標，不是店名
    }
  }
  if (lat == null) return { error:'網址裡找不到位置資訊。請在 Google 地圖點開那家店，再複製網址列的網址。' };
  if (!inTaiwan(lat, lng)) return { error:'這個位置不在台灣範圍內，請再確認一次' };
  return { name, lat, lng, precise };
}
