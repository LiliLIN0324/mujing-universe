/** 生成首页轮播/精选静帧：ring/i.jpg = 第 i 件精选作品的 R2 首图。
 *  排序与 src/lib.ts allWorks 一致；封面直接取 R2 库（第一张图，
 *  没有则试 R2 约定位 01.jpg），全部失败落 paper 占位。不用本地文件。 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const LINES = ['数字艺术', '产品', '游戏', '空间'];
const R2 = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig';
const TEX_MAX = 1920;
const COUNT = 10;

const root = path.resolve(import.meta.dirname, '..');
const worksDir = path.join(root, 'src', 'content', 'works');
const outDir = path.join(root, 'public', 'ring');

function isImg(src) {
  return typeof src === 'string' && /\.(jpe?g|png|webp)(?:$|\?)/i.test(src) && !src.includes('scroll-placeholder');
}

function coverCandidates(work) {
  const list = (work.images || []).filter(isImg);
  list.push(`${R2}/${work.slug}/01.jpg`);
  return [...new Set(list)];
}

async function writeCoverJpg(buf, dest) {
  let sharp;
  try { sharp = createRequire(import.meta.url)('sharp'); } catch { sharp = null; }
  if (sharp) {
    const meta = await sharp(buf).metadata();
    const w = meta.width || 1;
    const h = meta.height || 1;
    const m = Math.max(w, h);
    let img = sharp(buf).rotate();
    if (m > TEX_MAX) {
      img = img.resize({ width: w >= h ? TEX_MAX : undefined, height: h > w ? TEX_MAX : undefined, fit: 'inside', withoutEnlargement: true });
    }
    await img.jpeg({ quality: 86, mozjpeg: true }).toFile(dest);
    return;
  }
  await writeFile(dest, buf);
}

async function fetchRemote(url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      console.warn(`  miss ${res.status} ${url}`);
    } catch (e) {
      console.warn(`  err ${e.message} ${url}`);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

const files = (await readdir(worksDir)).filter((name) => name.endsWith('.json'));
const works = [];
for (const name of files) works.push(JSON.parse(await readFile(path.join(worksDir, name), 'utf8')));
works.sort((a, b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || (b.yearNum || 0) - (a.yearNum || 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
const ring = works.slice(0, COUNT);

await mkdir(outDir, { recursive: true });
const manifest = [];
for (let i = 0; i < ring.length; i++) {
  const work = ring[i];
  const dest = path.join(outDir, `${i}.jpg`);
  const candidates = coverCandidates(work);
  let done = false;
  for (const url of candidates) {
    const buf = await fetchRemote(url);
    if (!buf) continue;
    try { await writeCoverJpg(buf, dest); done = true; } catch (e) { console.warn(`  write fail ${e.message}`); }
    if (done) { manifest.push({ i, slug: work.slug, source: url }); console.log(`ok ${i} ${work.slug} ← ${url.split('/').slice(-2).join('/')}`); break; }
  }
  if (!done) {
    await copyFile(path.join(outDir, 'paper.jpg'), dest);
    manifest.push({ i, slug: work.slug, source: 'paper' });
    console.log(`paper ${i} ${work.slug}`);
  }
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`完成：${ring.length} 件`);
