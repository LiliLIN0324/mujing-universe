/**
 * Isometric approximation of the Chair44 carrier (arXiv:2609.19214):
 * a 2×2×2 cube minus one corner, eight rotated copies making the 2× supertile.
 * Faces are grouped back-to-front so the SVG stays a flat list of paths.
 */

const CHILDREN = [
  [[0, 1, 2], [1, 1, 1], [0, 0, 0]],
  [[1, 0, 2], [1, 1, -1], [0, 0, 4]],
  [[0, 2, 1], [1, -1, 1], [0, 4, 0]],
  [[2, 0, 1], [1, -1, -1], [0, 4, 4]],
  [[2, 1, 0], [-1, 1, 1], [4, 0, 0]],
  [[1, 2, 0], [-1, 1, -1], [4, 0, 4]],
  [[0, 1, 2], [-1, -1, 1], [4, 4, 0]],
  [[0, 1, 2], [1, 1, 1], [1, 1, 1]],
];

const BASE = [];
for (let x = 0; x < 2; x++) {
  for (let y = 0; y < 2; y++) {
    for (let z = 0; z < 2; z++) {
      if (x === 1 && y === 1 && z === 1) continue;
      BASE.push([x, y, z]);
    }
  }
}

const IDENT = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function frameMatrix(p, s) {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) m[i][p[i]] = s[i];
  return m;
}

function mul(a, b) {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return m;
}

function apply(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function imageCell(M, t, a) {
  const p0 = apply(M, a);
  const p1 = apply(M, [a[0] + 1, a[1] + 1, a[2] + 1]);
  return [0, 1, 2].map((i) => Math.round(Math.min(p0[i], p1[i]) + t[i]));
}

function chairsAt(level) {
  let poses = [{ M: IDENT, t: [0, 0, 0] }];
  for (let n = 0; n < level; n++) {
    const next = [];
    for (const pose of poses) {
      for (const [p, s, u] of CHILDREN) {
        const H = frameMatrix(p, s);
        next.push({ M: mul(pose.M, H), t: add(apply(pose.M, u), pose.t.map((v) => v * 2)) });
      }
    }
    poses = next;
  }
  return poses.map((pose) => BASE.map((a) => imageCell(pose.M, pose.t, a)));
}

const AX = Math.cos(Math.PI / 6);
const AY = 0.5;

function project(x, y, z, scale) {
  x /= scale;
  y /= scale;
  z /= scale;
  return [(x - y) * AX, (x + y) * AY - z];
}

function centroid(cells) {
  const c = [0, 0, 0];
  for (const a of cells) {
    c[0] += a[0] + 0.5;
    c[1] += a[1] + 0.5;
    c[2] += a[2] + 0.5;
  }
  return c.map((v) => v / cells.length);
}

function shrink(pt, cen, f) {
  return [
    cen[0] + (pt[0] - cen[0]) * f,
    cen[1] + (pt[1] - cen[1]) * f,
    cen[2] + (pt[2] - cen[2]) * f,
  ];
}

const QUADS = {
  z: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  x: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  y: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
};

function exposedFaces(cells, inset) {
  const key = (a) => `${a[0]},${a[1]},${a[2]}`;
  const set = new Set(cells.map(key));
  const cen = centroid(cells);
  const faces = [];
  for (const a of cells) {
    const neighbors = {
      z: [a[0], a[1], a[2] + 1],
      x: [a[0] + 1, a[1], a[2]],
      y: [a[0], a[1] + 1, a[2]],
    };
    for (const kind of ['y', 'x', 'z']) {
      if (set.has(key(neighbors[kind]))) continue;
      const pts = QUADS[kind].map(([dx, dy, dz]) => shrink([a[0] + dx, a[1] + dy, a[2] + dz], cen, inset));
      const depth = pts.reduce((s, p) => s + p[0] + p[1] + p[2], 0);
      faces.push({ kind, pts, depth });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  return faces;
}

function pathFrom(pts, scale) {
  return pts.map((p, i) => {
    const [x, y] = project(p[0], p[1], p[2], scale);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`;
  }).join('') + 'Z';
}

function round2([x, y]) {
  return `${x.toFixed(3)},${y.toFixed(3)}`;
}

/** Outer projected loop of one chair. Level 3 uses this so the page stays light. */
function silhouettePath(cells, inset, scale) {
  const faces = exposedFaces(cells, inset);
  const count = new Map();
  const ends = new Map();
  for (const f of faces) {
    const proj = f.pts.map((p) => project(p[0], p[1], p[2], scale));
    for (let i = 0; i < proj.length; i++) {
      const a = proj[i];
      const b = proj[(i + 1) % proj.length];
      const ka = round2(a);
      const kb = round2(b);
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      count.set(key, (count.get(key) || 0) + 1);
      ends.set(key, [a, b]);
    }
  }
  const adj = new Map();
  for (const [key, n] of count) {
    if (n !== 1) continue;
    const [a, b] = ends.get(key);
    const ka = round2(a);
    const kb = round2(b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push(b);
    adj.get(kb).push(a);
  }
  const startKey = adj.keys().next().value;
  if (!startKey) return '';
  const [sx, sy] = startKey.split(',').map(Number);
  const loop = [[sx, sy]];
  let prev = null;
  let cur = [sx, sy];
  for (let guard = 0; guard < 64; guard++) {
    const nexts = adj.get(round2(cur)) || [];
    const nxt = nexts.find((p) => !prev || round2(p) !== round2(prev));
    if (!nxt || round2(nxt) === startKey) break;
    loop.push(nxt);
    prev = cur;
    cur = nxt;
  }
  return loop.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join('') + 'Z';
}

function assertPartition(level, groups) {
  const scale = 2 ** (level + 1);
  const seen = new Set();
  for (const cells of groups) {
    for (const a of cells) {
      const k = a.join(',');
      if (seen.has(k) || a.some((v) => v < 0 || v >= scale)) {
        throw new Error(`chair partition failed at level ${level}: ${k}`);
      }
      seen.add(k);
    }
  }
  const expect = scale ** 3 - (scale / 2) ** 3;
  if (seen.size !== expect) throw new Error(`chair count ${level}: ${seen.size} != ${expect}`);
}

/** @returns {{viewBox: string, layers: {id: string, faces: {kind: string, d: string}[]}[]}} */
export function chairLayers() {
  const layers = [0, 1, 2, 3].map((level) => {
    const scale = 2 ** (level + 1);
    const inset = level === 0 ? 1 : level === 3 ? 0.82 : 0.9;
    const groups = chairsAt(level);
    assertPartition(level, groups);
    const ordered = groups.map((cells) => ({
      depth: centroid(cells).reduce((s, v) => s + v, 0),
      cells,
    }));
    ordered.sort((a, b) => a.depth - b.depth);
    const faces = [];
    if (level < 3) {
      for (const g of ordered) {
        for (const f of exposedFaces(g.cells, inset)) faces.push({ kind: f.kind, d: pathFrom(f.pts, scale) });
      }
    } else {
      for (const g of ordered) {
        const d = silhouettePath(g.cells, inset, scale);
        if (d) faces.push({ kind: 's', d });
      }
    }
    return { id: `d${level}`, faces };
  });
  return {
    viewBox: '-1.02 -1.16 2.04 2.28',
    layers,
  };
}
