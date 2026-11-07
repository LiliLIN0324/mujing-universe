# 从 @fontpkg/alibaba-pu-hui-ti-3-0 的全量 TTF 重新生成站点字体子集。
# 覆盖：src 里真正会渲染的字符（注释里的字不算）+ ASCII + 中文标点。
# 字符集不变时跳过重新生成；有新增用字时重生成并更新字体版本号。
# 用法：npm run fonts   （或直接 python scripts/subset-fonts.py；需要 pip install fonttools brotli）
import datetime, hashlib, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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

# 1) 收集站点全部用字：用 scripts/font-chars.mjs（剥掉注释里的字）
#    再和已有子集取并集 —— 只增不减，不会把历史上烘进去的字删掉。
#    2026-11-07 改：以前这里直接扫 src/ 的每个字符（连注释一起），于是
#    改一句中文注释就会让字体重生成一次；而且 CI（Cloudflare）里没有
#    fonttools，补字补不上就直接把部署打挂。
collected = subprocess.run(
    ['node', os.path.join(ROOT, 'scripts', 'font-chars.mjs'), '--json'],
    capture_output=True, encoding='utf-8', errors='replace')
if collected.returncode != 0:
    print('取字失败（node scripts/font-chars.mjs）：', (collected.stderr or '')[:400])
    sys.exit(1)
chars = set(json.loads(collected.stdout))

# 已烘进字体的字全部保留（只增不减）
if os.path.exists(MANIFEST):
    try:
        chars.update(json.load(open(MANIFEST, encoding='utf-8')).get('chars') or '')
    except Exception:
        pass

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
pat = re.compile(r'(AlibabaPuHuiTi-3-\d+-[A-Za-z]+\.woff2)\?v=[0-9a-f]+')
changed = False
for target in (CSS, LAYOUT):
    text_old = open(target, encoding='utf-8').read()
    text_new = pat.sub(rf'\1?v={new_v}', text_old)
    if text_new != text_old:
        open(target, 'w', encoding='utf-8').write(text_new)
        changed = True
if changed:
    print(f'字体版本号 → {new_v}')
