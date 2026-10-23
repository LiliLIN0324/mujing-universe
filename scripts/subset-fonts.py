# 从 @fontpkg/alibaba-pu-hui-ti-3-0 的全量 TTF 重新生成站点字体子集。
# 覆盖：src 全部文本字符 + GB2312 一级常用字 + ASCII + 中文标点。
# 用法：python scripts/subset-fonts.py   （需要 pip install fonttools brotli）
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
TTF_DIR = os.path.join(ROOT, 'node_modules', '@fontpkg', 'alibaba-pu-hui-ti-3-0')
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')
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
# public 下的 news 图片名等不影响；UI 文案都在 src 里。

# 2) ASCII 可打印 + 常用中文标点 + GB2312 一级常用字（防未来新增内容缺字）
chars.update(chr(c) for c in range(0x20, 0x7F))
chars.update('（）《》「」『』·—…！？：；、，。％℃①②③④⑤⑥⑦⑧⑨⑩×÷±→←↑↓')
gb = set()
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try:
            gb.add(bytes([hi, lo]).decode('gb2312'))
        except Exception:
            pass
chars |= gb
chars.discard('\n'); chars.discard('\r'); chars.discard('\t')

text = ''.join(sorted(chars))
txt_path = os.path.join(ROOT, '.font-charset.txt')
open(txt_path, 'w', encoding='utf-8').write(text)
print(f'字符集：{len(chars)} 个（含 GB2312 一级 {len(gb)}）')

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
    print(('✓' if r.returncode == 0 else '✗'), dst, f'{size/1024:.0f}KB')
    if r.returncode != 0:
        ok = False
        print(r.stderr[:500])
os.remove(txt_path)
sys.exit(0 if ok else 1)
