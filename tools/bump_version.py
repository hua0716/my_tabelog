#!/usr/bin/env python3
"""更新 index.html 裡各個 CSS／JS 檔案的版本號，避免瀏覽器讀到舊的快取。

每次修改 css/ 或 js/ 裡的檔案後執行一次：
    python3 tools/bump_version.py
"""
import datetime, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
version = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
modules = sorted(p.name for p in (root / 'js').glob('*.js'))

importmap = {'imports': {f'./js/{m}': f'./js/{m}?v={version}' for m in modules}}
block = (
    '<!-- 版本號由 tools/bump_version.py 產生，請勿手動修改 -->\n'
    f'<link rel="stylesheet" href="css/style.css?v={version}">\n'
    '<script type="importmap">\n' + json.dumps(importmap, ensure_ascii=False, indent=2) + '\n</script>\n'
    f'<script type="module" src="./js/main.js?v={version}"></script>\n'
)

html_path = root / 'index.html'
html = html_path.read_text(encoding='utf-8')
html, n = re.subn(r'<!-- VERSION:START -->.*?<!-- VERSION:END -->',
                  '<!-- VERSION:START -->\n' + block + '<!-- VERSION:END -->', html, flags=re.S)
assert n == 1, '找不到 VERSION 區塊'
html_path.write_text(html, encoding='utf-8')
print('版本號：', version, '｜模組：', ', '.join(modules))
