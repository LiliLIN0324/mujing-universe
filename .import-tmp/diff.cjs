const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const curDir = path.join(root, 'src/content/works');
const freshDir = __dirname;
const cur = fs.readdirSync(curDir).filter((f) => f.endsWith('.json'));
const fresh = fs.readdirSync(freshDir).filter((f) => f.endsWith('.json'));
const load = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const FIELDS = ['title', 'category', 'year', 'yearNum', 'line', 'status', 'description', 'abstract', 'challenge', 'solution', 'tech', 'images', 'icon', 'hasDemo', 'link', 'note', 'source'];
const brief = (v) => {
  if (v === undefined) return '∅';
  const s = JSON.stringify(v) ?? '∅';
  return s.length > 150 ? s.slice(0, 150) + '…' : s;
};
const out = { add: [], gone: [], changed: [] };
for (const f of fresh) if (!cur.includes(f)) out.add.push(load(freshDir, f).slug);
for (const f of cur) if (!fresh.includes(f)) out.gone.push(load(curDir, f).slug);
for (const f of fresh) {
  if (!cur.includes(f)) continue;
  const a = load(curDir, f);
  const b = load(freshDir, f);
  const diffs = [];
  for (const k of FIELDS) {
    const av = JSON.stringify(a[k]);
    const bv = JSON.stringify(b[k]);
    if (av !== bv) diffs.push('· ' + k + '\n    现在: ' + brief(a[k]) + '\n    个人站: ' + brief(b[k]));
  }
  if (diffs.length) out.changed.push('【' + a.slug + '】\n' + diffs.join('\n'));
}
const report =
  '== 新增 ' + out.add.length + ' ==\n' + (out.add.join('\n') || '（无）') +
  '\n\n== 消失 ' + out.gone.length + ' ==\n' + (out.gone.join('\n') || '（无）') +
  '\n\n== 有差异 ' + out.changed.length + ' ==\n\n' + out.changed.join('\n\n');
fs.writeFileSync(path.join(freshDir, 'diff-report.txt'), report, 'utf8');
console.log('add=' + out.add.length, 'gone=' + out.gone.length, 'changed=' + out.changed.length);
