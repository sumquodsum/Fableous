// node test/rows.test.mjs
//
// Checks the claims the page makes. If a number appears in the prose of
// index.html, it should be asserted here.

import assert from 'node:assert/strict';
import {
  ROUNDS, LENGTH, CHANGES, ROWS, INDEX, NEXT, LINKS, FACES, METHODS,
  apply, rowsOf, enumerateExtents, Catalogue, period, mirror, isPalindromic,
  canonical, identify, position, kin,
} from '../js/rows.js';
import { families, familyOf, FLAT } from '../js/atlas.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    console.log('  FAIL ' + name);
    console.log(e.message.split('\n').map((l) => '       ' + l).join('\n'));
    process.exitCode = 1;
  }
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const parse = (s) => s.split('.').map((n) => CHANGES.findIndex((c) => c.name === n));

console.log('rows');
test('there are 24 rows and rounds is one of them', () => {
  assert.equal(ROWS.length, 24);
  assert.equal(new Set(ROWS).size, 24);
  assert.ok(INDEX.has(ROUNDS));
});
test('every change is its own undo', () => {
  for (const r of ROWS) for (const c of CHANGES) assert.equal(apply(apply(r, c.id), c.id), r);
});
test('plain hunt is eight rows and home', () => {
  const rows = rowsOf(parse('x.14.x.14.x.14.x.14'));
  assert.deepEqual(rows, ['1234', '2143', '2413', '4231', '4321', '3412', '3142', '1324', '1234']);
});

console.log('the solid');
test('all 24 corners are the same distance from the centre', () => {
  for (const r of ROWS) assert.ok(near(Math.hypot(...position(r)), Math.sqrt(5)));
});
test('36 edges of equal length, 12 cross diagonals exactly sqrt(2) longer', () => {
  const edges = LINKS.filter((l) => l.change !== 0);
  const diagonals = LINKS.filter((l) => l.change === 0);
  assert.equal(edges.length, 36);
  assert.equal(diagonals.length, 12);
  for (const l of edges) assert.ok(near(dist(position(ROWS[l.a]), position(ROWS[l.b])), Math.SQRT2));
  for (const l of diagonals) assert.ok(near(dist(position(ROWS[l.a]), position(ROWS[l.b])), 2));
});
test('no two rows share a corner', () => {
  for (let i = 0; i < 24; i++) {
    for (let j = i + 1; j < 24; j++) assert.ok(dist(position(ROWS[i]), position(ROWS[j])) > 1);
  }
});
test('six squares and eight hexagons, each flat, three faces to a corner', () => {
  assert.equal(FACES.filter((f) => f.kind === 'square').length, 6);
  assert.equal(FACES.filter((f) => f.kind === 'hexagon').length, 8);
  const perCorner = new Array(24).fill(0);
  for (const f of FACES) {
    assert.equal(f.verts.length, f.kind === 'square' ? 4 : 6);
    const pts = f.verts.map((v) => position(ROWS[v]));
    const c = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    const len = Math.hypot(...c);
    // Flat: every corner of the face has the same height along the face normal.
    for (const p of pts) assert.ok(near((p[0] * c[0] + p[1] * c[1] + p[2] * c[2]) / len, len));
    // In order: consecutive corners are one edge apart.
    for (let i = 0; i < pts.length; i++) {
      assert.ok(near(dist(pts[i], pts[(i + 1) % pts.length]), Math.SQRT2));
    }
    for (const v of f.verts) perCorner[v]++;
  }
  assert.ok(perCorner.every((n) => n === 3));
});
test('each cross lies inside a square face, and each square holds two', () => {
  const squares = FACES.filter((f) => f.kind === 'square');
  for (const sq of squares) {
    const inside = LINKS.filter((l) => l.change === 0 && sq.verts.includes(l.a) && sq.verts.includes(l.b));
    assert.equal(inside.length, 2);
  }
});

console.log('the catalogue');
const packed = enumerateExtents();
const cat = new Catalogue(packed);
test('there are 10,792 extents', () => assert.equal(cat.size, 10792));
test('every one is true, complete, and comes round', () => {
  for (let n = 0; n < cat.size; n++) {
    const rows = rowsOf(cat.get(n));
    assert.equal(rows.length, LENGTH + 1);
    assert.equal(rows[LENGTH], ROUNDS);
    assert.equal(new Set(rows.slice(0, LENGTH)).size, LENGTH);
  }
});
test('they are in dictionary order with no duplicates', () => {
  let prev = '';
  for (let n = 0; n < cat.size; n++) {
    const s = cat.get(n).join('');
    assert.ok(s > prev);
    prev = s;
  }
});
test('prefix ranges agree with brute force', () => {
  const all = [];
  for (let n = 0; n < cat.size; n++) all.push(cat.get(n).join(''));
  for (const prefix of [[], [0], [1], [2], [3], [0, 1, 0], [3, 2, 3, 1], [0, 0], [0, 1, 0, 1, 0, 1, 0, 1], [2, 2]]) {
    const want = all.filter((s) => s.startsWith(prefix.join(''))).length;
    assert.equal(cat.count(prefix), want, 'prefix ' + prefix.join(''));
  }
  assert.equal(cat.count([]), 10792);
  assert.equal(cat.count([0, 0]), 0);
});
test('indexOf finds each extent where it sits', () => {
  for (const n of [0, 1, 500, 5395, 10791]) assert.equal(cat.indexOf(cat.get(n)), n);
  assert.equal(cat.indexOf(new Array(24).fill(0)), -1);
});
test('162 essentially different, up to start point, direction and mirror', () => {
  const classes = new Set();
  for (let n = 0; n < cat.size; n++) classes.add(canonical(cat.get(n)));
  assert.equal(classes.size, 162);
});

test('kin: every relative is itself an extent, and the families tile the catalogue', () => {
  const sizes = new Map();
  let total = 0;
  const done = new Uint8Array(cat.size);
  for (let n = 0; n < cat.size; n++) {
    if (done[n]) continue;
    const family = kin(cat.get(n));
    for (const k of family) {
      const at = cat.indexOf(k);
      assert.ok(at >= 0, 'a relative of ' + n + ' is not an extent');
      assert.equal(done[at], 0);
      done[at] = 1;
    }
    total += family.length;
    sizes.set(family.length, (sizes.get(family.length) || 0) + 1);
  }
  assert.equal(total, cat.size);
  assert.equal([...sizes.values()].reduce((a, b) => a + b, 0), 162);
  console.log('         family sizes: ' + [...sizes].sort((a, b) => a[0] - b[0]).map(([s, c]) => c + ' of ' + s).join(', '));
});

console.log('the eleven');
test('each named method is an extent', () => {
  for (const m of METHODS) assert.ok(cat.indexOf(m.changes) >= 0, m.name);
});
test('Plain Bob is No. 1', () => assert.equal(cat.indexOf(METHODS[0].changes), 0));
test('in each, the treble plain-hunts', () => {
  const hunt = [0, 1, 2, 3, 3, 2, 1, 0];
  for (const m of METHODS) {
    const rows = rowsOf(m.changes);
    for (let i = 0; i < 24; i++) assert.equal(rows[i].indexOf('1'), hunt[i % 8], m.name);
  }
});
test('Reverse X is X mirrored and begun at the half-lead; Doubles are their own', () => {
  const byName = new Map(METHODS.map((m) => [m.name, m]));
  const reverseOf = (m) => {
    const mm = mirror(m.lead);
    return mm.slice(4).concat(mm.slice(0, 4)).join('');
  };
  const pairs = [
    ['Plain Bob', 'Reverse Bob'],
    ['Canterbury Place', 'Reverse Canterbury Place'],
    ['Single Court Place', 'Reverse Court Place'],
    ['St Nicholas Bob', 'Reverse St Nicholas Bob'],
  ];
  for (const [a, b] of pairs) assert.equal(reverseOf(byName.get(a)), byName.get(b).lead.join(''), a);
  for (const d of ['Double Bob', 'Double Canterbury Place', 'Double Court Place']) {
    assert.equal(reverseOf(byName.get(d)), byName.get(d).lead.join(''), d);
  }
});
test('the 88 extents of period 8 are exactly the eleven, begun at each point of the lead', () => {
  const byPeriod = {};
  let named = 0;
  for (let n = 0; n < cat.size; n++) {
    const ch = cat.get(n);
    const p = period(ch);
    byPeriod[p] = (byPeriod[p] || 0) + 1;
    const id = identify(ch);
    if (p === 8) assert.ok(id, 'period-8 extent with no name at ' + n);
    if (id) named++;
  }
  assert.deepEqual(byPeriod, { 6: 24, 8: 88, 12: 192, 24: 10488 });
  assert.equal(named, 88);
});
test('identify reports the offset', () => {
  assert.deepEqual(identify(METHODS[0].changes).offset, 0);
  const lead = METHODS[0].lead;
  const shifted = lead.slice(3).concat(lead.slice(0, 3));
  const id = identify([...shifted, ...shifted, ...shifted]);
  assert.equal(id.method.name, 'Plain Bob');
  assert.equal(id.offset, 3);
});
test('all eleven are palindromic', () => {
  for (const m of METHODS) assert.ok(isPalindromic(m.changes), m.name);
});

console.log('the plate of 162');
const fams = families(cat);
test('162 families that between them hold every extent once', () => {
  assert.equal(fams.length, 162);
  assert.equal(fams.reduce((s, f) => s + f.size, 0), cat.size);
  for (let i = 1; i < fams.length; i++) assert.ok(fams[i].first > fams[i - 1].first);
  assert.equal(fams[0].first, 1);
});
test('the eleven fall into seven families: four pairs and three alone', () => {
  const named = fams.filter((f) => f.names.length);
  assert.equal(named.length, 7);
  assert.equal(named.filter((f) => f.names.length === 2).length, 4);
  assert.equal(named.filter((f) => f.names.length === 1).length, 3);
  for (const f of named.filter((x) => x.names.length === 1)) assert.ok(f.names[0].startsWith('Double'), f.names[0]);
  const pairs = named.filter((x) => x.names.length === 2).map((f) => f.names.join(' + ')).sort();
  assert.deepEqual(pairs, [
    'Canterbury Place + Reverse Canterbury Place',
    'Plain Bob + Reverse Bob',
    'Single Court Place + Reverse Court Place',
    'St Nicholas Bob + Reverse St Nicholas Bob',
  ]);
  assert.deepEqual(named.map((f) => f.size).sort((a, b) => a - b), [8, 8, 8, 16, 16, 16, 16]);
});
test('familyOf agrees with the list, from any member', () => {
  for (const n of [0, 87, 4126, 10791]) {
    const first = familyOf(cat, cat.get(n));
    assert.ok(fams.some((f) => f.first === first));
    assert.ok(first <= n + 1);
  }
});
test('from the plate’s point of view no corner hides another', () => {
  let least = Infinity;
  for (let i = 0; i < 24; i++) {
    for (let j = i + 1; j < 24; j++) least = Math.min(least, Math.hypot(FLAT[i].x - FLAT[j].x, FLAT[i].y - FLAT[j].y));
  }
  assert.ok(least > 0.6, 'closest pair of corners is ' + least.toFixed(3) + ' apart');
});

// Plain hunt on the solid. Not quoted on the page, but in the journal.
test('plain hunt is a belt: it crosses four squares corner to corner, and the three hunts are at right angles', () => {
  const squares = FACES.filter((f) => f.kind === 'square');
  const centre = (f) => [0, 1, 2].map((k) => f.verts.reduce((s, v) => s + position(ROWS[v])[k], 0) / 4);
  const axes = [];
  const used = new Set();
  for (let start = 0; start < 24; start++) {
    if (used.has(start)) continue;
    const course = [start];
    for (let i = 0; i < 7; i++) course.push(NEXT[course[i]][i % 2]);
    assert.equal(NEXT[course[7]][1], start); // eight rows and home
    course.forEach((r) => used.add(r));
    const touched = squares.filter((sq) => sq.verts.filter((v) => course.includes(v)).length > 0);
    assert.equal(touched.length, 4);
    for (const sq of touched) {
      const mine = sq.verts.filter((v) => course.includes(v));
      assert.equal(mine.length, 2);
      assert.ok(near(dist(position(ROWS[mine[0]]), position(ROWS[mine[1]])), 2)); // opposite corners
    }
    const rest = squares.filter((sq) => !touched.includes(sq));
    assert.equal(rest.length, 2);
    const [a, b] = rest.map(centre);
    assert.ok(near(a[0] + b[0], 0) && near(a[1] + b[1], 0) && near(a[2] + b[2], 0)); // opposite faces
    axes.push(a);
  }
  assert.equal(axes.length, 3);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) assert.ok(near(axes[i][0] * axes[j][0] + axes[i][1] * axes[j][1] + axes[i][2] * axes[j][2], 0));
  }
});

// Figures quoted in the journal and the essay.
let pal = 0;
const first = [0, 0, 0, 0];
for (let n = 0; n < cat.size; n++) {
  const ch = cat.get(n);
  if (isPalindromic(ch)) pal++;
  first[ch[0]]++;
}
console.log('\nfigures');
console.log('  palindromic extents: ' + pal);
console.log('  by first change (x, 14, 12, 34): ' + first.join(', '));
const t0 = performance.now();
enumerateExtents();
console.log('  enumeration takes ' + (performance.now() - t0).toFixed(1) + ' ms');
console.log('\n' + passed + ' passed' + (process.exitCode ? ', SOME FAILED' : ''));
