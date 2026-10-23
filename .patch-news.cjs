const fs = require('fs');
let t = fs.readFileSync('src/data/news.json', 'utf8');

const old1 = `      "id": "activity-ai4cities-2025",
      "section": "activity",
      "title": "同济 AI4CITIES 工作坊",
      "summary": "档案写的是「最佳跨界融合奖 · 同济 AI4CITIES 工作坊」。只记了年份。",
      "start": "2025-01-01",
      "end": "2025-12-31",
      "precision": "year",
      "event": "同济 AI4CITIES 工作坊",
      "format": "工作坊",
      "people": ["林丽丽"],
      "source": "archive"`;
const nw1 = `      "id": "activity-ai4cities-2025",
      "section": "activity",
      "title": "同济 AI4CITIES 工作坊",
      "summary": "林丽丽在上海同济大学参加了 AI4CITIES 工作坊，获最佳跨界融合奖。",
      "start": "2025-01-01",
      "end": "2025-12-31",
      "precision": "year",
      "event": "同济 AI4CITIES 工作坊",
      "place": "上海同济大学",
      "format": "工作坊",
      "people": ["林丽丽"],
      "source": "archive"`;
if (!t.includes(old1)) { console.log('ai4cities 没匹配上'); process.exit(1); }
t = t.replace(old1, nw1);

const old2 = `      "id": "activity-digital-futures-2023",
      "section": "activity",
      "title": "Digital Futures 工作坊",
      "summary": "档案里是 2023 年的参与证书。只记了年份。",
      "start": "2023-01-01",
      "end": "2023-12-31",
      "precision": "year",
      "event": "Digital Futures",
      "format": "工作坊",
      "people": ["林丽丽"],
      "source": "archive"`;
const nw2 = `      "id": "activity-digital-futures-2023",
      "section": "activity",
      "title": "Digital Futures 工作坊",
      "summary": "林丽丽在上海同济大学参加了 Digital Futures 工作坊。",
      "start": "2023-01-01",
      "end": "2023-12-31",
      "precision": "year",
      "event": "Digital Futures",
      "place": "上海同济大学",
      "format": "工作坊",
      "people": ["林丽丽"],
      "href": "/works/campus-public-space-vitality-modeling/",
      "hrefLabel": "相关作品",
      "image": "https://pub-3209bcb7fc36444a914deb0e70ceca92.r2.dev/fig/campus-public-space-vitality-modeling/01.jpg",
      "source": "archive"`;
if (!t.includes(old2)) { console.log('digital-futures 没匹配上'); process.exit(1); }
t = t.replace(old2, nw2);

fs.writeFileSync('src/data/news.json', t);
console.log('ok');
