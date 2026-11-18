"""瀏覽器自動測試：用模擬的地圖與資料庫跑過主要功能。
執行：python3 tests/run.py（需要 Python 版 playwright）
"""
import asyncio, json, sys, pathlib, shutil
from playwright.async_api import async_playwright
import pathlib
REPO = pathlib.Path(__file__).resolve().parent.parent
MOCK = open(pathlib.Path(__file__).resolve().parent / 'mocks.js', encoding='utf-8').read()
ORIGIN = 'https://hua0716.github.io/my_tabelog/'
errors = []
def check(cond, msg):
    print(('✅ ' if cond else '❌ ') + msg)
    if not cond: errors.append(msg)

async def main():
    async with async_playwright() as p:
        chrome = shutil.which('google-chrome') or shutil.which('chromium')
        b = await p.chromium.launch(**({'executable_path':chrome} if chrome else {}), args=['--no-sandbox'])
        ctx = await b.new_context(geolocation={'latitude':25.0418,'longitude':121.5510}, permissions=['geolocation'], viewport={'width':1280,'height':800})
        page = await ctx.new_page()
        console = []
        page.on('console', lambda m: console.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        page.on('pageerror', lambda e: console.append(f'PAGEERROR: {e}'))
        async def route(r):
            u = r.request.url
            if u.startswith(ORIGIN):
                path = u[len(ORIGIN):].split('?')[0] or 'index.html'
                f = REPO / path
                if not f.exists(): return await r.fulfill(status=404, body='not found')
                ctype = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}.get(f.suffix,'text/plain')
                await r.fulfill(body=f.read_text(encoding='utf-8'), content_type=ctype)
            elif 'maplibre-gl' in u and u.endswith('.js'): await r.fulfill(body=MOCK, content_type='application/javascript')
            elif u.endswith('.css') or 'fonts.g' in u: await r.fulfill(body='', content_type='text/css')
            else: await r.abort()
        await page.route('**/*', route)
        await page.goto(ORIGIN)
        await page.wait_for_selector('.item', timeout=5000)

        t = await page.inner_text('#list'); check('舊店' in t and '4' in t, f'載入餐廳與評分：{t.strip()[:40]!r}')
        check(await page.evaluate('window.__subscribed === true'), '已訂閱即時同步')
        check('ratings(editor_name, rating, comment)' in await page.evaluate('window.__lastSelect'), '讀取時一併載入每人評分與備註')

        # 登入管理員
        await page.click('[data-act=unlock]'); await page.fill('#pinInput', '482917'); await page.click('#pinOk')
        await page.wait_for_selector('[data-act=admin]', timeout=3000)
        check(True, '管理員登入後顯示「管理使用者」')

        # 資訊視窗顯示每人評分
        await page.click('.item'); await page.wait_for_timeout(100)
        pop = await page.inner_text('.mock-popup') if await page.query_selector('.mock-popup') else ''
        check(__import__('re').search(r'小明\s*4★', pop) and '湯頭很香' in pop, f'資訊視窗列出每人評分與備註：{pop.splitlines()[2] if len(pop.splitlines())>2 else pop!r}')

        # 換小華登入，替舊店評 5 分
        await page.click('[data-act=lock]')
        check(await page.query_selector('[data-act=unlock]') is not None, '登出成功')
        await page.evaluate("setTimeout(() => openForm('r1'))"); await page.fill('#pinInput', '305566'); await page.click('#pinOk')
        await page.wait_for_selector('#overlay.show', timeout=3000)
        on = await page.eval_on_selector_all('#fRate button.on', 'els => els.length')
        hint = await page.inner_text('#fRateHint')
        check(on == 0, f'小華打開表單時「我的評分」是空的（亮 {on} 顆）')
        check('小明 4★' in hint, f'表單顯示其他人的評分：{hint!r}')
        check(await page.input_value('#fNote') == '', '小華的「我的備註」是空的，不會看到小明的備註')
        await page.click('#fRate button[data-n="5"]'); await page.fill('#fNote', '小籠包必點'); await page.click('#form [type=submit]')
        await page.wait_for_timeout(300)
        t = await page.inner_text('#list'); check('4.5' in t and '2 人' in t, f'儲存後顯示平均 4.5・2 人：{t.strip()!r}')
        await page.click('.item'); await page.wait_for_timeout(100)
        pop = await page.inner_text('.mock-popup')
        check('湯頭很香' in pop and '小籠包必點' in pop, f'資訊視窗同時列出兩人的備註：{" / ".join(pop.splitlines()[2:7])!r}')
        check(__import__('re').search(r'小明\s*4★', pop) and __import__('re').search(r'小華\s*5★', pop), '每則備註旁顯示寫的人與他的評分')
        await page.fill('#q', '小籠包'); await page.wait_for_timeout(50)
        check('舊店' in await page.inner_text('#list'), '搜尋可以找到備註內容')
        await page.fill('#q', ''); await page.wait_for_timeout(50)
        # 評分篩選用平均
        await page.select_option('#minRate', '-3'); await page.wait_for_timeout(50)
        check('舊店' not in await page.inner_text('#list'), '「3 以下」篩選以平均分數判斷（4.5 不顯示）')
        await page.select_option('#minRate', '4'); await page.wait_for_timeout(50)
        check('舊店' in await page.inner_text('#list'), '「4 以上」篩選顯示平均 4.5 的餐廳')
        await page.select_option('#minRate', '0')
        check(await page.query_selector('[data-act=admin]') is None, '一般使用者看不到「管理使用者」')

        # 清除自己的評分
        await page.evaluate("setTimeout(() => openForm('r1'))"); await page.wait_for_selector('#overlay.show')
        on = await page.eval_on_selector_all('#fRate button.on', 'els => els.length')
        check(on == 5, f'再次打開時顯示自己的 5 分（亮 {on} 顆）')
        check(await page.input_value('#fNote') == '小籠包必點', '再次打開時帶入自己的備註')
        await page.click('#fRateClear'); await page.click('#form [type=submit]'); await page.wait_for_timeout(300)
        rv = await page.evaluate("__db.ratings.filter(x => x.restaurant_id === 'r1').map(x => x.editor_name + ':' + x.rating + ':' + x.comment).join(',')")
        check('小華:null:小籠包必點' in rv, f'只清除評分時，備註仍保留：{rv}')
        t = await page.inner_text('#list'); check('2 人' not in t and '4' in t, f'清除自己的評分後回到只有小明的 4 分：{t.strip()!r}')

        # 管理員：新增、改名、重設 PIN、停用
        await page.click('[data-act=lock]')
        await page.click('[data-act=unlock]'); await page.fill('#pinInput', '482917'); await page.click('#pinOk')
        await page.wait_for_selector('[data-act=admin]'); await page.click('[data-act=admin]')
        await page.wait_for_selector('.admin-row', timeout=3000)
        rows = await page.inner_text('#adminList'); check('小明（你）' in rows and '管理員' in rows and '小華' in rows, '管理面板列出使用者')
        check(await page.query_selector('.admin-row[data-id="1"] [data-act=toggle]') is None, '不能停用自己（沒有停用按鈕）')
        await page.fill('#newName', '短碼'); await page.fill('#newPin', '12'); await page.click('#addEditorBtn'); await page.wait_for_timeout(200)
        check('短碼' in await page.inner_text('#adminList'), '短 PIN（2 碼）也可以新增使用者')
        await page.fill('#newName', '阿芳'); await page.fill('#newPin', '305566'); await page.click('#addEditorBtn'); await page.wait_for_timeout(100)
        check('已經有人用了' in await page.inner_text('#adminErr'), '重複的 PIN 會被拒絕')
        await page.fill('#newPin', '777888'); await page.click('#addEditorBtn'); await page.wait_for_timeout(200)
        check('阿芳' in await page.inner_text('#adminList'), '新增使用者成功')
        await page.click('.admin-row[data-id="2"] [data-act=rename]')
        await page.fill('.admin-row[data-id="2"] .admin-edit input', '華華'); await page.click('.admin-row[data-id="2"] [data-act=ok]'); await page.wait_for_timeout(300)
        check('華華' in await page.inner_text('#adminList'), '改名成功')
        await page.click('.admin-row[data-id="2"] [data-act=toggle]'); await page.wait_for_timeout(200)
        check('已停用' in await page.inner_text('.admin-row[data-id="2"]'), '停用使用者成功')
        await page.click('.admin-row[data-id="1"] [data-act=pin]')
        await page.fill('.admin-row[data-id="1"] .admin-edit input', '111222'); await page.press('.admin-row[data-id="1"] .admin-edit input', 'Enter'); await page.wait_for_timeout(200)
        stored = await page.evaluate("JSON.parse(localStorage.getItem('tfm-auth')).pin")
        check(stored == '111222', '重設自己的 PIN 後，這台裝置自動改用新 PIN')
        await page.click('#adminClose')

        # 定位
        await page.click('#locateBtn'); await page.wait_for_timeout(500)
        fly = await page.evaluate('window.__lastFly')
        check(await page.query_selector('.me-dot') is not None and abs(fly['center'][1]-25.0418) < 1e-6, f'定位：顯示藍點並移到目前位置 {fly["center"]}')

        # 即時同步：模擬別人新增一家店
        await page.evaluate("""__db.restaurants.push({id:'r9',name:'朋友新增的店',cat:'日式',visited:false,lat:25.05,lng:121.52,created_by:'阿芳',created_at:new Date().toISOString()}); __realtime[0]({})""")
        await page.wait_for_timeout(700)
        check('朋友新增的店' in await page.inner_text('#list'), '收到即時通知後自動顯示別人新增的餐廳')

        # 貼網址新增（回歸測試）
        await page.click('#fab'); await page.wait_for_timeout(300); await page.click('[data-mode=url]')
        await page.fill('#urlInput', 'https://www.google.com/maps/place/%E6%B8%AC%E8%A9%A6%E5%BA%97/@25.03,121.53,17z/data=!3d25.0335!4d121.5300')
        await page.click('#urlForm [type=submit]'); await page.wait_for_selector('#overlay.show')
        check(await page.input_value('#fName') == '測試店', '貼網址後自動帶入店名')
        await page.click('#form [type=submit]'); await page.wait_for_timeout(300)
        t = await page.inner_text('#list'); check('測試店' in t, '貼網址新增的餐廳已儲存，並帶著新增者評分')

        # 縮放、設定面板、Esc、在地圖上點選新增
        z0 = await page.evaluate('__map.zoom'); await page.click('#zoomIn'); z1 = await page.evaluate('__map.zoom')
        await page.click('#zoomOut'); z2 = await page.evaluate('__map.zoom')
        check(z1 == z0 + 1 and z2 == z0, f'放大／縮小按鈕正常（{z0}→{z1}→{z2}）')
        await page.click('#gear'); check(await page.is_visible('#settings'), '齒輪打開設定面板')
        n = await page.eval_on_selector_all('#poiOpts input', 'els => els.length'); check(n == 5, f'設定面板有 5 個地圖顯示勾選（{n}）')
        await page.click('#poiOpts input[data-poi="shops"]')
        check(await page.evaluate("JSON.parse(localStorage.getItem('tfm-prefs')).poi.shops") is False, '取消勾選「商店」會記在瀏覽器')
        await page.select_option('#baseSel', 'emap'); await page.wait_for_timeout(50)
        check(await page.evaluate("document.getElementById('poiOpts').classList.contains('disabled')"), '切到臺灣通用電子地圖時，顯示項目變灰')
        await page.select_option('#baseSel', 'liberty')
        await page.mouse.click(900, 500); await page.wait_for_timeout(50)
        check(not await page.is_visible('#settings'), '點旁邊會收起設定面板')
        await page.click('#fab'); await page.wait_for_timeout(300); await page.click('[data-mode=click]')
        check(await page.evaluate("document.getElementById('app').classList.contains('adding')"), '選「在地圖上點選位置」進入新增模式')
        await page.evaluate("__map.fire('click', { lngLat:{ lat:25.06, lng:121.54 }, originalEvent:{ target:document.getElementById('map') } })")
        await page.wait_for_selector('#overlay.show', timeout=2000)
        check(await page.query_selector('.temp-pin') is not None, '點地圖後打開表單，並標示即將存入的位置')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(50)
        check(not await page.is_visible('#overlay') and await page.query_selector('.temp-pin') is None, 'Esc 關閉表單並移除暫時標記')

        # 點空白處關閉資訊視窗時，取消選中（圓點恢復大小、列表取消標示）
        await page.click('.item'); await page.wait_for_timeout(100)
        check(await page.query_selector('.marker.active') is not None, '點列表後圓點呈現選中（放大）')
        await page.evaluate('__map.clickBlank()'); await page.wait_for_timeout(50)
        check(await page.query_selector('.marker.active') is None and await page.query_selector('.item.active') is None, '點空白處關閉資訊視窗後，圓點與列表都取消選中')
        # 即時更新重畫圓點時，正在看的那家不能被取消選中
        await page.click('.item'); await page.wait_for_timeout(100)
        await page.evaluate('__realtime[0]({})'); await page.wait_for_timeout(600)
        check(await page.query_selector('.marker.active') is not None and await page.query_selector('.mock-popup') is not None, '自動更新後仍保持選中與資訊視窗')

        # 圓點：外層不可有動畫（否則拖曳地圖時會延遲），外觀與放大效果在內層
        tr = await page.evaluate("getComputedStyle(document.querySelector('.marker')).transitionDuration")
        check(tr in ('0s', ''), f'圓點外層沒有動畫，拖曳時不會延遲（transition={tr}）')
        inner = await page.evaluate("!!document.querySelector('.marker > .marker-dot')")
        check(inner, '圓點外觀在內層 .marker-dot')

        # 電腦版：搜尋與篩選一律顯示，沒有展開按鈕
        check(await page.is_visible('#q') and not await page.is_visible('#filterToggle'), '電腦版直接顯示搜尋與篩選，不出現展開按鈕')

        # 手機版：搜尋與篩選預設收起，可展開；有篩選時顯示提示
        await page.set_viewport_size({'width':390, 'height':844}); await page.wait_for_timeout(100)
        await page.click('#toggleList'); await page.wait_for_timeout(350)
        check(await page.is_visible('#filterToggle') and not await page.is_visible('#q'), '手機版預設收起搜尋與篩選')
        await page.click('#filterToggle'); await page.wait_for_timeout(100)
        check(await page.is_visible('#q') and await page.is_visible('#catSel'), '手機版點「搜尋與篩選」可展開')
        await page.select_option('#catSel', '日式'); await page.click('#filterToggle'); await page.wait_for_timeout(100)
        badge = await page.inner_text('#filterBadge')
        check(not await page.is_visible('#q') and badge == '已套用 1 項', f'收起後顯示「{badge}」提醒有套用篩選')
        await page.click('#filterToggle'); await page.select_option('#catSel', '全部'); await page.wait_for_timeout(50)
        check(not await page.is_visible('#filterBadge'), '清除篩選後提示消失')
        await page.set_viewport_size({'width':1280, 'height':800})

        await page.screenshot(path=str(pathlib.Path(__file__).resolve().parent / 'after.png'))
        bad = [c for c in console if 'Failed to load resource' not in c and 'net::ERR' not in c]
        check(not bad, '沒有 JavaScript 錯誤' + ('' if not bad else '：' + ' | '.join(bad[:5])))
        await b.close()
    print('\n結果：', '全部通過' if not errors else f'{len(errors)} 項失敗')
asyncio.run(main())
