"""从林丽丽个人站仓库（/tmp/lili）导入作品 → src/content/works/*.json
规则：排除 tutorials、games/06-07（教程性质）、Epstein；检测模板化重复文案。"""
import glob, re, json, os, collections
SRC = os.environ.get('LILI_REPO', '/tmp/lili') + '/src/data/projects'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'content', 'works')
LINE = {'product': 'AIGC 产品', 'platform': 'AIGC 产品', 'games': '游戏', 'AI': '空间与研究', 'planning': '空间与研究'}
SKIP = {'epstein-mystery-archive', 'how-to-use-unity-making-wechat-minigames', 'how-to-use-cocos-creator-making-games'}
def fm(text):
    m = re.match(r'^---\s*\n(.*?)\n---', text, re.S); body = m.group(1) if m else ''
    d = {}
    for k in ['id','slug','title','category','year','description','abstract','challenge','solution','icon']:
        mm = re.search(rf'^{k}:\s*(.*)$', body, re.M)
        v = (mm.group(1).strip() if mm else '')
        if v.startswith('|'):  # yaml block
            blk = re.search(rf'^{k}:\s*\|\s*\n((?:[ \t]+.*\n?)+)', body, re.M); v = blk.group(1) if blk else ''
            v = ' '.join(x.strip() for x in v.splitlines() if x.strip())
        d[k] = v.strip().strip('"').strip()
    t = re.search(r'^tech:\s*(\[.*\])', body, re.M)
    try: d['tech'] = json.loads(t.group(1)) if t else []
    except Exception: d['tech'] = re.findall(r'"([^"]+)"', t.group(1)) if t else []
    d['images'] = re.findall(r'https://[^"\s]+/fig/[^"\s]+/\d+\.(?:jpg|png)', body)[:8]
    d['hasDemo'] = 'hasDemo: true' in body
    return d
def year_num(y):
    m = re.search(r'(20\d\d)', y); return int(m.group(1)) if m else 0
items = []
for f in sorted(glob.glob(f'{SRC}/*/*.md')):
    folder = f.split('/')[-2]
    if folder == 'tutorials': continue
    d = fm(open(f, encoding='utf-8').read())
    if not d['slug'] or d['slug'] in SKIP: continue
    d.update(line=LINE[folder], source=f'https://lililin0324.github.io/#/{ {"games":"game","AI":"ai"}.get(folder,folder) }/{d["slug"]}',
             sourceFile=os.path.relpath(f, SRC), yearNum=year_num(d['year']), status='已完成', flags=[])
    items.append(d)
# 检测重复/模板文案
for key in ['description', 'challenge', 'solution', 'abstract']:
    c = collections.Counter(i[key] for i in items if len(i[key]) > 20)
    for i in items:
        if c.get(i[key], 0) > 1: i['flags'].append(f'{key} 与其他作品重复（疑似模板文案，待作者重写）')
for i in items:
    if 'modern web development stack' in i['solution']:
        i['flags'].append('solution 为通用模板句（多个平台项目雷同，含“paper upload”等错位描述），待作者重写')
    if i['slug'] == 'scendance':
        i['note'] = '幕景 Scendance 是 AI 活动布置工作台（非音画作品）'
    if i['solution'].startswith('http'): i['link'] = i['solution']; i['solution'] = ''
# 音画新线：手工条目
items.append(dict(slug='xihu-panorama', title='当代西湖繁胜全景图', category='AIGC 音画 · 长卷', year='2026 · 进行中', yearNum=2026,
  line='音画', status='进行中', description='以宋画长卷的形式重绘当代西湖，画面元素由声音转译生成。（占位简介，待艺术家确认）',
  abstract='', challenge='', solution='', tech=['AIGC', '声音转译（占位）'], images=[], icon='/scroll-placeholder.svg',
  hasDemo=False, flags=['占位：素材与文字待提供'], source='', sourceFile='manual'))
# 校验 R2 图片（HEAD），剔除 404；无图则用占位并标注
import urllib.request, concurrent.futures as cf
def ok(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'curl/8','Range':'bytes=0-0'}), timeout=10).status in (200, 206)
    except Exception: return False
urls = {u for i in items for u in i['images'] + ([i['icon']] if i['icon'].startswith('http') else [])}
with cf.ThreadPoolExecutor(16) as ex: alive = {u for u, r in zip(urls, ex.map(ok, urls)) if r}
for i in items:
    i['images'] = [u for u in i['images'] if u in alive]
    if i['icon'].startswith('http') and i['icon'] not in alive: i['icon'] = '/scroll-placeholder.svg'
    if not i['images'] and i['icon'] == '/scroll-placeholder.svg' and i['line'] != '音画': i['flags'].append('个人站图床无可用图片（R2 返回 404），暂用占位图')
os.makedirs(OUT, exist_ok=True)
for old in glob.glob(f'{OUT}/*.json'): os.remove(old)
for i in items:
    json.dump(i, open(f'{OUT}/{i["slug"]}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(items), 'works;', collections.Counter(i['line'] for i in items), '; flagged:', [i['slug'] for i in items if i['flags'] and i['line']!='音画'])
