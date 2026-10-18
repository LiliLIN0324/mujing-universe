import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LINES = ['音画', 'AIGC 产品', '游戏', '空间与研究'];
const R2 = 'https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig';
const BROKEN = new Set(['box-up-my-stuff-in-cyberspace', 'scendance']);
const root = path.resolve(import.meta.dirname, '..');
const worksDir = path.join(root, 'src/content/works');
const outDir = path.join(root, 'public/ring');

function coverOf(work) {
  if (work.slug === 'xihu-panorama') return `${R2}/xihu-panorama/01.jpg`;
  if (BROKEN.has(work.slug)) return null;
  const photos = (work.images || []).filter((src) => /\.(jpe?g|png|webp)(?:$|\?)/i.test(src));
  if (photos.length) return photos[0];
  const icon = work.icon || '';
  if (/\.(jpe?g|png|webp)(?:$|\?)/i.test(icon) && !icon.includes('scroll-placeholder')) return icon;
  return `${R2}/${work.slug}/01.jpg`;
}

const files = (await readdir(worksDir)).filter((name) => name.endsWith('.json'));
const works = [];
for (const name of files) {
  works.push(JSON.parse(await readFile(path.join(worksDir, name), 'utf8')));
}
works.sort((a, b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || (b.yearNum || 0) - (a.yearNum || 0));
const ring = works.slice(0, 10);
await mkdir(outDir, { recursive: true });
const manifest = [];
for (let i = 0; i < ring.length; i++) {
  const work = ring[i];
  const remote = coverOf(work);
  const file = `${i}.jpg`;
  if (!remote) {
    await copyFile(path.join(outDir, 'paper.jpg'), path.join(outDir, file));
    manifest.push({ slug: work.slug, file, fallback: true });
    console.log('paper', work.slug);
    continue;
  }
  const url = remote.startsWith('http') ? remote : new URL(remote, 'http://local').pathname;
  if (remote.startsWith('http')) {
    const res = await fetch(remote);
    if (!res.ok) {
      console.warn('miss', work.slug, res.status, remote);
      manifest.push({ slug: work.slug, file: null });
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(outDir, file), buf);
    manifest.push({ slug: work.slug, file });
    console.log('ok', work.slug, buf.length);
  } else {
    manifest.push({ slug: work.slug, file: null, local: url });
    console.log('local', work.slug, url);
  }
}
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
