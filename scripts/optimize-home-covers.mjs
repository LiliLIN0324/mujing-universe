/**
 * 首页封面出图：R2 原图 → 960/1920（西湖再加 2560）WebP + 48px 模糊底图。
 * 只处理 src/pages/index.astro 的 HOME_PICKS，产物传到 R2 opt/home/，不回写原图。
 * 用法：
 *   node scripts/optimize-home-covers.mjs          出图 + 上传 + 写 src/data/home-covers.json
 *   node scripts/optimize-home-covers.mjs --dry    只出图看体积，不上传
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const run = promisify(exec);
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const root = path.resolve(import.meta.dirname, '..');
const dry = process.argv.includes('--dry');
const sharp = createRequire(import.meta.url)('sharp');
const TMP = path.join(process.env.TEMP, 'mj-home-covers');
const R2 = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev';
const BUCKET = 'lili-assets';
const WRANGLER = process.platform === 'win32' ? 'D:/dsh-tools/node/wrangler.cmd' : 'wrangler';
const CACHE = 'public, max-age=31536000, immutable';
const WIDTHS = [960, 1920];
const HERO_WIDTHS = [960, 1920, 2560];
const LQIP_W = 48;

const sunc = (url) => url.replace(/^https?:\/\//, '');

const page = await fs.readFile(path.join(root, 'src/pages/index.astro'), 'utf8');
const picksMatch = page.match(/const HOME_PICKS = \[([\s\S]*?)\];/);
if (!picksMatch) throw new Error('index.astro 里找不到 HOME_PICKS');
const slugs = [...picksMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!slugs.length) throw new Error('HOME_PICKS 是空的');

const isImg = (src) => typeof src === 'string' && /\.(jpe?g|png|webp)(?:$|\?)/i.test(src);

/** 与 src/lib.ts workCovers 同一个取值：images 里第一张图，没有才用 icon / 01.jpg。
 *  JSON 里写裸文件名时，和 allWorks() 一样展开成 fig/<slug>/<文件>。 */
async function coverOf(slug) {
  const work = JSON.parse(await fs.readFile(path.join(root, 'src/content/works', `${slug}.json`), 'utf8'));
  const abs = (src) => (/^https?:\/\//.test(src) ? src : `${R2}/fig/${slug}/${src}`);
  const photo = (work.images || []).find(isImg);
  if (photo) return abs(photo);
  if (isImg(work.icon)) return abs(work.icon);
  return `${R2}/fig/${slug}/01.jpg`;
}

async function download(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) { if (res.status === 404) return null; throw new Error(`HTTP ${res.status}`); }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}

await fs.rm(TMP, { recursive: true, force: true });
await fs.mkdir(TMP, { recursive: true });

const manifest = {};
console.log('slug                          原图      960     1920    2560    LQIP');
for (const slug of slugs) {
  let buf = null, src = null;
  src = await coverOf(slug);
  buf = await download(src);
  if (!buf) { console.error(`✗ ${slug}：下载失败 ${sunc(src)}`); continue; }
  const widths = slug === 'xihu-panorama' ? HERO_WIDTHS : WIDTHS;
  const out = {};
  for (const w of widths) {
    const name = `${slug}-${w}.webp`;
    const file = path.join(TMP, name);
    await sharp(buf)
      .rotate()
      .resize({ width: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: w >= 1920 ? 80 : 76, effort: 5 })
      .toFile(file);
    out[w] = { file, bytes: (await fs.stat(file)).size };
  }
  const lqipFile = path.join(TMP, `${slug}-lqip.webp`);
  await sharp(buf).rotate().resize({ width: LQIP_W }).webp({ quality: 42, effort: 6 }).toFile(lqipFile);
  const lqip = `data:image/webp;base64,${(await fs.readFile(lqipFile)).toString('base64')}`;

  const cols = widths.map((w) => `${(out[w].bytes / 1024).toFixed(0)}K`.padStart(6)).join(' ');
  const blanks = widths.length < 3 ? ' '.repeat(7) : '';
  console.log(
    `${slug.padEnd(28)} ${(buf.length / 1024 / 1024).toFixed(2)}M ${cols} ${blanks} ${(lqip.length / 1024).toFixed(1)}K`
  );

  if (!dry) {
    for (const w of widths) {
      const key = `${BUCKET}/opt/home/${slug}-${w}.webp`;
      await run([
        q(WRANGLER), 'r2', 'object', 'put', q(key),
        '--file', q(out[w].file),
        '--content-type', 'image/webp',
        '--cache-control', q(CACHE),
        '--remote',
      ].join(' '), { cwd: root, maxBuffer: 4 * 1024 * 1024 });
      process.stdout.write(`  ↑ ${sunc(`${R2}/opt/home/${slug}-${w}.webp`)}\n`);
    }
  }
  manifest[slug] = {
    lqip,
    widths,
    source: sunc(src),
    srcBytes: buf.length,
    sizes: widths.map((w) => ({ w, bytes: out[w].bytes })),
  };
}

if (!dry) {
  const dest = path.join(root, 'src/data/home-covers.json');
  await fs.writeFile(dest, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n写入 ${path.relative(root, dest)}（${Object.keys(manifest).length} 件）`);
}
if (dry) console.log('\n（--dry：未上传，未写 manifest）');
