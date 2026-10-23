import { copyFile, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const LINES = ['数字艺术', '产品', '游戏', '空间'];
const R2 = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig';
/** R2 stills 404 — keep paper unless a local override exists. */
const BROKEN = new Set([]);
const LOCAL_OVERRIDE = {
  scendance: '_sources/scendance-hero.jpg',
};
const TEX_MAX = 1920;
const root = path.resolve(import.meta.dirname, '..');
const worksDir = path.join(root, 'src/content/works');
const outDir = path.join(root, 'public/ring');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function coverOf(work) {
  if (work.slug === 'xihu-panorama') return `${R2}/xihu-panorama/01.jpg`;
  if (LOCAL_OVERRIDE[work.slug]) return { local: LOCAL_OVERRIDE[work.slug] };
  if (BROKEN.has(work.slug)) return null;
  const photos = (work.images || []).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
  if (photos.length) return photos[0];
  const icon = work.icon || '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon) && !icon.includes('scroll-placeholder')) return icon;
  return `${R2}/${work.slug}/01.jpg`;
}

async function writeCoverJpg(bufOrPath, dest) {
  // Prefer sharp if present; else sharp-less passthrough + note.
  let sharp;
  try {
    sharp = createRequire(import.meta.url)('sharp');
  } catch {
    sharp = null;
  }
  if (sharp) {
    const pipeline = typeof bufOrPath === 'string' ? sharp(bufOrPath) : sharp(bufOrPath);
    const meta = await pipeline.metadata();
    const w = meta.width || 1;
    const h = meta.height || 1;
    const m = Math.max(w, h);
    let img = pipeline.rotate();
    if (m > TEX_MAX) {
      img = img.resize({
        width: w >= h ? TEX_MAX : undefined,
        height: h > w ? TEX_MAX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    await img.jpeg({ quality: 86, mozjpeg: true }).toFile(dest);
    return;
  }
  if (typeof bufOrPath === 'string') {
    await copyFile(bufOrPath, dest);
  } else {
    await writeFile(dest, bufOrPath);
  }
}

const files = (await readdir(worksDir)).filter((name) => name.endsWith('.json'));
const works = [];
for (const name of files) {
  works.push(JSON.parse(await readFile(path.join(worksDir, name), 'utf8')));
}
works.sort((a, b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || (b.yearNum || 0) - (a.yearNum || 0) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
const ring = works.slice(0, 10);
await mkdir(outDir, { recursive: true });
const manifest = [];
for (let i = 0; i < ring.length; i++) {
  const work = ring[i];
  const remote = coverOf(work);
  const file = `${i}.jpg`;
  const dest = path.join(outDir, file);
  if (!remote) {
    await copyFile(path.join(outDir, 'paper.jpg'), dest);
    manifest.push({ slug: work.slug, file, fallback: true });
    console.log('paper', work.slug);
    continue;
  }
  if (typeof remote === 'object' && remote.local) {
    const src = path.join(outDir, remote.local);
    if (!(await exists(src))) {
      console.warn('missing local override', work.slug, src);
      await copyFile(path.join(outDir, 'paper.jpg'), dest);
      manifest.push({ slug: work.slug, file, fallback: true });
      continue;
    }
    await writeCoverJpg(src, dest);
    manifest.push({ slug: work.slug, file, source: remote.local });
    console.log('local', work.slug, remote.local);
    continue;
  }
  if (remote.startsWith('http')) {
    const res = await fetch(remote);
    if (!res.ok) {
      console.warn('miss', work.slug, res.status, remote);
      if (await exists(dest)) {
        manifest.push({ slug: work.slug, file, kept: true });
        console.log('keep', work.slug);
      } else {
        await copyFile(path.join(outDir, 'paper.jpg'), dest);
        manifest.push({ slug: work.slug, file, fallback: true });
      }
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeCoverJpg(buf, dest);
    manifest.push({ slug: work.slug, file });
    console.log('ok', work.slug, buf.length);
  } else {
    manifest.push({ slug: work.slug, file: null, local: remote });
    console.log('path', work.slug, remote);
  }
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
