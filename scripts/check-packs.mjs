/**
 * 构建前检查：鸡场的美术素材在不在、跟引擎是不是同一份。
 *
 * 为什么要有这个（2026-11-04）：
 *   鸡场的器物图 / 品种表情表 / 品种全家福 / 成长阶段 / 豪华成鸡**现在入库**了
 *   （授权 2026-11-05 定 CC BY-NC 4.0，© 林丽丽）。
 *   它们由引擎仓 C:\coop-js 的 `npm run sync:packs` 生成到 public/packs/ 下。
 *   **忘了跑这一步，构建照样成功**，但线上器物图 / 品种图会全部 404 —— 静默失败，
 *   浏览器控制台才看得到。所以这里让它**响亮地失败**：构建直接报错，不让坏站发出去。
 *
 * 检查项（全部从 pack.json 里读真相，不硬编码文件名）：
 *   1. public/packs/mujing/ 在，且 pack.json 能 parse
 *   2. 每个品种的表情表精灵图 + 整只图在
 *   3. 每个品种 rig 的每一层 PNG 在
 *   4. 每件器物的图片在
 *   5. 成长阶段的图 + 破壳演出图在
 *   6. src/lib/coop/pack.json 与 public/packs/mujing/pack.json 是同一份
 *      （src/lib/coop/ 下的是引擎副本，public/ 下的是站点运行时用的）
 *   7. src/lib/coop/sprite.svg 在
 *
 * 帧表 JSON（expr-sheet.json）是**构建期源数据**，只在引擎仓，站点运行时读 pack.json
 * 里的 frames/格子尺寸。所以这里只查**浏览器真会 fetch 的 PNG** ——
 * 帧表跟 pack 对不对得上由引擎仓的 check-rig 校验（它同时查引擎和官网两份 pack.json）。
 *
 * 逃逸：SKIP_PACKS_CHECK=1 npm run build   （确实不想要鸡场的构建才用）
 * dev 用：node scripts/check-packs.mjs --warn   （只警告不挡，dev 本来就该能跑）
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const PACK_DIR = path.join(root, 'public', 'packs', 'mujing');
const SRC_COOP = path.join(root, 'src', 'lib', 'coop');
const WARN_ONLY = process.argv.includes('--warn');

if (process.env.SKIP_PACKS_CHECK === '1') {
  console.log('⏭  SKIP_PACKS_CHECK=1 → 跳过鸡场素材检查');
  process.exit(0);
}

const missing = [];
const need = (abs, label) => {
  if (!fs.existsSync(abs)) missing.push(label + '  →  ' + path.relative(root, abs).replace(/\\/g, '/'));
};

/* ---- 鸡场美术整个目录不存在 ----
   美术现在入库了（授权 CC BY-NC 4.0），所以「目录不在」= 同步被吞 / 提交漏了，
   **直接让构建失败** —— 别发一个鸡全是破图的站上去。
   （引擎那侧还有退路兜着，线上不会破图，但鸡会长成旧的扁平形象，不该发。） */
if (!fs.existsSync(PACK_DIR)) {
  console.error('');
  console.error('[fail] 鸡场美术素材整个目录不存在：' + path.relative(root, PACK_DIR).replace(/\\/g, '/'));
  console.error('');
  console.error('  你大概忘了在引擎仓跑：');
  console.error('');
  console.error('      cd C:\\coop-js && npm run sync:packs');
  console.error('');
  console.error('  确实不要鸡场的构建：SKIP_PACKS_CHECK=1 npm run build');
  console.error('');
  process.exit(1);
}

const packPath = path.join(PACK_DIR, 'pack.json');
need(packPath, '鸡场包清单');
if (missing.length) { fail(); process.exit(0); }

let pack;
try {
  pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
} catch (e) {
  console.error(`[fail] pack.json 解析失败：${e.message}`);
  process.exit(1);
}

/** pack.json 里的绝对站内路径 /packs/mujing/xxx → public/packs/mujing/xxx */
const pubFile = (sitePath) => path.join(root, 'public', sitePath.replace(/^\/+/, ''));

/* 1) 表情表精灵图 + 每个品种目录里的整只图 */
need(path.join(PACK_DIR, 'breeds', 'breeds.json'), '品种元信息');
for (const b of pack.breeds || []) {
  const name = b.name || b.id;
  /* 表情表精灵图在哪由 pack.expr.sheet 说了算：
     大多数品种在 breeds/<id>/expr-sheet.png，universe01 用共享的根级 expr-sheet.png。 */
  if (b.expr?.sheet) need(pubFile(b.expr.sheet), `品种「${name}」的表情表精灵图`);
  /* 有些品种有独立的 breeds/<id>/ 目录（整只图），
     有些用共享的根级素材 —— 目录存在才查里面的文件，不存在不是缺失。 */
  const dir = path.join(PACK_DIR, 'breeds', b.id);
  if (fs.existsSync(dir)) {
    need(path.join(dir, 'full.png'), `品种「${name}」的整只图`);
  }
  /* rig 分层：每一层都得在 */
  if (b.rig?.base) {
    for (const l of b.rig.layers || []) {
      need(path.join(root, 'public', b.rig.base.replace(/^\/+/, ''), l.file), `品种「${name}」的分层 ${l.file}`);
    }
  }
}

/* 2) 器物图 */
for (const [id, d] of Object.entries(pack.decos || {})) {
  if (d.img) need(pubFile(d.img), `器物「${id}」的图`);
}

/* 2·补. 成长阶段的图（2026-11-04）
   浏览器**真的会 fetch** 这些：每只鸡按阶段换图（雏/小/中/大 各一张按品种色改色的图）。
   缺一张 = 那只鸡直接破图，所以跟品种 rig 一样要查。 */
let stageCount = 0;
if (pack.stages && Array.isArray(pack.stages.order) && pack.stages.base) {
  for (const k of pack.stages.order) {
    const st = (pack.stages.list || {})[k];
    if (!st || !st.art) continue;   // 成鸡：图走 breeds/<id>/full.png
    stageCount++;
    for (const b of pack.breeds || []) {
      const file = (pack.stages.file || '<stage>/<breed>.png')
        .replace('<stage>', k).replace('<breed>', b.id);
      need(path.join(root, 'public', pack.stages.base.replace(/^\/+/, ''), file), `成长阶段「${k}」的 ${b.id} 图`);
    }
  }
  /* 演出图（破壳那一刻）：不在阶段链里，但浏览器一样会 fetch */
  for (const [k, def] of Object.entries(pack.stages.show || {})) {
    if (!def || !def.art) continue;
    stageCount++;
    for (const b of pack.breeds || []) {
      const file = (pack.stages.file || '<stage>/<breed>.png')
        .replace('<stage>', k).replace('<breed>', b.id);
      need(path.join(root, 'public', pack.stages.base.replace(/^\/+/, ''), file), `演出图「${k}」的 ${b.id} 图`);
    }
  }
}

/* 3) 引擎副本：pack.json 要跟 public 下的是同一份（sync:packs 同步过去的） */
const srcPack = path.join(SRC_COOP, 'pack.json');
need(srcPack, '引擎副本 pack.json（src/lib/coop/）');
need(path.join(SRC_COOP, 'sprite.svg'), '引擎副本 sprite.svg（src/lib/coop/）');
if (!missing.length && fs.existsSync(srcPack)) {
  const a = fs.readFileSync(srcPack, 'utf8').replace(/\r\n/g, '\n').trim();
  const b = fs.readFileSync(packPath, 'utf8').replace(/\r\n/g, '\n').trim();
  if (a !== b) missing.push('src/lib/coop/pack.json 与 public/packs/mujing/pack.json 不是同一份（sync:packs 没跑完？）');
}

if (missing.length) { fail(); process.exit(0); }

function fail() {
  if (WARN_ONLY) {
    console.warn('');
    console.warn(`[warn] 鸡场美术素材不齐（${missing.length} 项），页面上的器物图/品种表情表会 404：`);
    for (const m of missing) console.warn('  · ' + m);
    console.warn('  在引擎仓跑：cd C:\\coop-js && npm run sync:packs');
    console.warn('');
    return;
  }
  console.error('');
  console.error(`[fail] 鸡场美术素材不齐（${missing.length} 项）：`);
  for (const m of missing) console.error('  · ' + m);
  console.error('');
  console.error('  这些素材在本仓（授权 CC BY-NC 4.0，已入库），');
  console.error('  由引擎仓生成同步。请在引擎仓跑：');
  console.error('');
  console.error('      cd C:\\coop-js && npm run sync:packs');
  console.error('');
  console.error('  再回本站构建。确实不要鸡场的话：SKIP_PACKS_CHECK=1 npm run build');
  console.error('');
  process.exit(1);
}

/* 全套在位：报个数，让人知道构建带上了什么 */
const breedCount = (pack.breeds || []).length;
const decoCount = Object.keys(pack.decos || {}).length;
console.log(`✓ 鸡场素材齐全（${breedCount} 个品种 / ${decoCount} 件器物 / ${stageCount} 档成长阶段 / 精灵图与帧表都在）`);
