# 从 @fontpkg/alibaba-pu-hui-ti-3-0 的全量 TTF 重新生成站点字体子集。
# 覆盖：src 全部文本字符 + ASCII + 中文标点（不再垫 GB2312 一级常用字）。
# 字符集不变时跳过重新生成；有新增用字时重生成并更新字体版本号。
# 用法：npm run fonts   （或直接 python scripts/subset-fonts.py；需要 pip install fonttools brotli）
import datetime, hashlib, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
TTF_DIR = os.path.join(ROOT, 'node_modules', '@fontpkg', 'alibaba-pu-hui-ti-3-0')
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')
MANIFEST = os.path.join(ROOT, 'scripts', 'font-charset.json')
CSS = os.path.join(ROOT, 'src', 'styles', 'global.css')
LAYOUT = os.path.join(ROOT, 'src', 'layouts', 'Base.astro')
FORCE = '--force' in sys.argv
FONTS = [
    ('AlibabaPuHuiTi-3-55-Regular.ttf', 'AlibabaPuHuiTi-3-55-Regular.woff2'),
    ('AlibabaPuHuiTi-3-65-Medium.ttf', 'AlibabaPuHuiTi-3-65-Medium.woff2'),
    ('AlibabaPuHuiTi-3-75-SemiBold.ttf', 'AlibabaPuHuiTi-3-75-SemiBold.woff2'),
]

# 1) 收集站点全部用字（含中英日韩与标点）
chars = set()
for root, dirs, files in os.walk(SRC):
    for name in files:
        if name.endswith(('.astro', '.js', '.json', '.ts', '.css', '.mjs')):
            t = open(os.path.join(root, name), encoding='utf-8').read()
            chars.update(t)

# 2) ASCII 可打印 + 常用中文标点（聊天回复等运行时文本不在源文件里，遇到生僻字回退系统字体）
chars.update(chr(c) for c in range(0x20, 0x7F))
chars.update('（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓')
chars.discard('\n'); chars.discard('\r'); chars.discard('\t')

text = ''.join(sorted(chars))

# 字符集没变且字体齐全 → 不必重跑 fontTools。
fonts_ok = all(os.path.exists(os.path.join(OUT_DIR, dst)) for _, dst in FONTS)
old = None
if os.path.exists(MANIFEST):
    try:
        old = json.load(open(MANIFEST, encoding='utf-8')).get('chars')
    except Exception:
        old = None
if old == text and fonts_ok and not FORCE:
    print(f'字符集未变（{len(chars)} 个），字体跳过')
    sys.exit(0)

txt_path = os.path.join(ROOT, '.font-charset.txt')
open(txt_path, 'w', encoding='utf-8').write(text)
print(f'字符集：{len(chars)} 个（有变化，重新生成）')

# 3) 逐个字重生成子集
ok = True
for src, dst in FONTS:
    src_path = os.path.join(TTF_DIR, src)
    dst_path = os.path.join(OUT_DIR, dst)
    cmd = [
        sys.executable, '-m', 'fontTools.subset', src_path,
        f'--text-file={txt_path}',
        '--flavor=woff2', '--output-file=' + dst_path,
        '--layout-features=*', '--no-hinting', '--desubroutinize',
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    size = os.path.getsize(dst_path) if os.path.exists(dst_path) else -1
    print(('[ok]' if r.returncode == 0 else '[fail]'), dst, f'{size/1024:.0f}KB')
    if r.returncode != 0:
        ok = False
        print(r.stderr[:500])
os.remove(txt_path)

if not ok:
    sys.exit(1)

# 4) 记下字符集，并更新缓存版本号（内容变了，旧缓存不能再用）
json.dump({'generated': datetime.date.today().isoformat(), 'chars': text},
          open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
new_v = hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]
import re
pat = re.compile(r'(AlibabaPuHuiTi-3-\d+-[A-Za-z]+\.woff2)\?v=\d+')
changed = False
for target in (CSS, LAYOUT):
    text_old = open(target, encoding='utf-8').read()
    text_new = pat.sub(rf'\1?v={new_v}', text_old)
    if text_new != text_old:
        open(target, 'w', encoding='utf-8').write(text_new)
        changed = True
if changed:
    print(f'字体版本号 → {new_v}')
