const fs = require('fs');
let t = fs.readFileSync('scripts/fetch-ring-covers.mjs', 'utf8');
const old = `  } else {
    manifest.push({ slug: work.slug, file: null, local: remote });
    console.log('path', work.slug, remote);
  }`;
const nw = `  } else {
    // 站内本地路径（public/ 下）直接复制进槽位
    const src = path.join(root, 'public', remote);
    if (await exists(src)) {
      await writeCoverJpg(src, dest);
      manifest.push({ slug: work.slug, file, source: remote });
      console.log('local', work.slug, remote);
    } else {
      console.warn('missing local file', work.slug, src);
      if (await exists(dest)) {
        manifest.push({ slug: work.slug, file, kept: true });
      } else {
        await copyFile(path.join(outDir, 'paper.jpg'), dest);
        manifest.push({ slug: work.slug, file, fallback: true });
      }
    }
  }`;
if (!t.includes(old)) { console.log('没匹配上'); process.exit(1); }
t = t.replace(old, nw);
fs.writeFileSync('scripts/fetch-ring-covers.mjs', t);
console.log('fetch ok');
