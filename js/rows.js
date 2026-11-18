// The arithmetic of four bells.
//
// A row is the bells in the order they strike, written as a string: '1234' is
// rounds, treble first, tenor last. A change is a set of neighbouring pairs
// that swap between one row and the next. On four bells there are four.
//
// Nothing in this file touches the DOM, so it runs under node for the tests.

export const ROUNDS = '1234';
export const LENGTH = 24; // rows in an extent: 4!

// Ringers name a change by the places that stay put ("place notation").
// '14' means the bells in 1st and 4th place hold, so the middle pair swap.
// 'x' means nobody holds.
export const CHANGES = [
  { id: 0, name: 'x', glyph: '×', word: 'both pairs cross', swaps: [[0, 1], [2, 3]], key: 'x' },
  { id: 1, name: '14', glyph: '14', word: 'the middle pair cross', swaps: [[1, 2]], key: 'm' },
  { id: 2, name: '12', glyph: '12', word: 'the back pair cross', swaps: [[2, 3]], key: 'b' },
  { id: 3, name: '34', glyph: '34', word: 'the front pair cross', swaps: [[0, 1]], key: 'f' },
];

export function apply(row, change) {
  const a = row.split('');
  for (const [i, j] of CHANGES[change].swaps) [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

// All twenty-four rows, in dictionary order, and a lookup back from row to index.
export const ROWS = (() => {
  const out = [];
  const go = (head, rest) => {
    if (!rest.length) return out.push(head);
    for (let i = 0; i < rest.length; i++) go(head + rest[i], rest.slice(0, i) + rest.slice(i + 1));
  };
  go('', ROUNDS);
  return out;
})();
export const INDEX = new Map(ROWS.map((r, i) => [r, i]));
const HOME = INDEX.get(ROUNDS);

// NEXT[row][change] -> row, as indices.
export const NEXT = ROWS.map((r) => CHANGES.map((c) => INDEX.get(apply(r, c.id))));

// The rows a sequence of changes passes through, starting from rounds.
export function rowsOf(changes) {
  const rows = [ROUNDS];
  for (const c of changes) rows.push(apply(rows[rows.length - 1], c));
  return rows;
}

// ---------------------------------------------------------------------------
// The catalogue.
//
// Every extent: every sequence of 24 changes that leaves rounds, visits each
// of the other 23 rows exactly once, and comes home. They come out of the
// search in dictionary order (x < 14 < 12 < 34), which is what lets a walk in
// progress be located in the catalogue by binary search.
//
// Returned packed, 24 bytes to an extent.

export function enumerateExtents() {
  const out = [];
  const path = new Uint8Array(LENGTH);
  const walk = (at, depth, seen) => {
    if (depth === LENGTH - 1) {
      for (let c = 0; c < 4; c++) {
        if (NEXT[at][c] === HOME) {
          path[depth] = c;
          for (let i = 0; i < LENGTH; i++) out.push(path[i]);
        }
      }
      return;
    }
    for (let c = 0; c < 4; c++) {
      const to = NEXT[at][c];
      if (seen & (1 << to)) continue;
      path[depth] = c;
      walk(to, depth + 1, seen | (1 << to));
    }
  };
  walk(HOME, 0, 1 << HOME);
  return Uint8Array.from(out);
}

export class Catalogue {
  constructor(packed = enumerateExtents()) {
    this.packed = packed;
    this.size = packed.length / LENGTH;
  }

  // The changes of extent number n (0-based internally; shown 1-based).
  get(n) {
    return Array.from(this.packed.subarray(n * LENGTH, (n + 1) * LENGTH));
  }

  // Compare the opening of extent i against a prefix.
  #cmp(i, prefix) {
    const o = i * LENGTH;
    for (let j = 0; j < prefix.length; j++) {
      const d = this.packed[o + j] - prefix[j];
      if (d) return d;
    }
    return 0;
  }

  // [lo, hi): the run of extents that begin with these changes.
  range(prefix) {
    const bound = (strict) => {
      let lo = 0;
      let hi = this.size;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const d = this.#cmp(mid, prefix);
        if (d < 0 || (strict && d === 0)) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    return [bound(false), bound(true)];
  }

  count(prefix) {
    const [lo, hi] = this.range(prefix);
    return hi - lo;
  }

  // Catalogue number of a complete extent, or -1.
  indexOf(changes) {
    if (changes.length !== LENGTH) return -1;
    const [lo, hi] = this.range(changes);
    return hi > lo ? lo : -1;
  }
}

// ---------------------------------------------------------------------------
// Structure.

// The shortest block of changes that, repeated, makes the whole sequence.
export function period(changes) {
  const n = changes.length;
  for (let p = 1; p < n; p++) {
    if (n % p) continue;
    let ok = true;
    for (let i = p; i < n && ok; i++) ok = changes[i] === changes[i - p];
    if (ok) return p;
  }
  return n;
}

// Front-to-back mirror: what the ringing would look like read from the far
// side of the rope circle. 12 and 34 trade places; x and 14 are their own
// reflections.
const MIRROR = [0, 1, 3, 2];
export const mirror = (changes) => changes.map((c) => MIRROR[c]);

const rotate = (a, k) => a.slice(k).concat(a.slice(0, k));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Does the loop read the same backwards, from some starting point?
export function isPalindromic(changes) {
  const back = changes.slice().reverse();
  for (let k = 0; k < changes.length; k++) if (same(rotate(back, k), changes)) return true;
  return false;
}

// A single representative for all the extents that are "the same loop":
// started elsewhere, rung backwards, or mirrored.
export function canonical(changes) {
  let best = null;
  for (const m of [changes, mirror(changes)]) {
    for (const d of [m, m.slice().reverse()]) {
      for (let k = 0; k < d.length; k++) {
        const s = rotate(d, k).join('');
        if (best === null || s < best) best = s;
      }
    }
  }
  return best;
}

// Every extent that is this same loop: begun at any of its 24 rows, rung in
// either direction, mirrored or not. Up to 96 of them; fewer when the loop
// has symmetry and some of those come out identical. Returned as change
// sequences, this one included, without duplicates.
export function kin(changes) {
  const seen = new Map();
  for (const m of [changes, mirror(changes)]) {
    for (const d of [m, m.slice().reverse()]) {
      for (let k = 0; k < d.length; k++) {
        const r = rotate(d, k);
        seen.set(r.join(''), r);
      }
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// The eleven.
//
// The plain Minimus methods, as named in the Composition Library
// (complib.org, methods 10460-10470). In each the treble hunts plainly from
// front to back and home again while the other three bells weave round it;
// three leads of eight changes make the extent.

const parse = (s) => s.split('.').map((n) => CHANGES.findIndex((c) => c.name === n));

export const METHODS = [
  { name: 'Plain Bob', lead: 'x.14.x.14.x.14.x.12' },
  { name: 'Reverse Bob', lead: 'x.14.x.34.x.14.x.14' },
  { name: 'Double Bob', lead: 'x.14.x.34.x.14.x.12' },
  { name: 'Canterbury Place', lead: 'x.14.12.34.12.14.x.14' },
  { name: 'Reverse Canterbury Place', lead: '34.14.x.14.x.14.34.12' },
  { name: 'Double Canterbury Place', lead: '34.14.12.34.12.14.34.12' },
  { name: 'Single Court Place', lead: '34.14.x.14.x.14.34.14' },
  { name: 'Reverse Court Place', lead: 'x.14.12.14.12.14.x.14' },
  { name: 'Double Court Place', lead: '34.14.12.14.12.14.34.14' },
  { name: 'St Nicholas Bob', lead: '34.14.x.34.x.14.34.12' },
  { name: 'Reverse St Nicholas Bob', lead: 'x.14.12.34.12.14.x.12' },
].map((m) => {
  const lead = parse(m.lead);
  return { ...m, lead, changes: [...lead, ...lead, ...lead] };
});

// If these changes are one of the eleven, say which, and how far into its
// lead it was begun (0 = from the start, as ringers ring it).
export function identify(changes) {
  if (changes.length !== LENGTH || period(changes) !== 8) return null;
  const head = changes.slice(0, 8);
  for (const method of METHODS) {
    for (let k = 0; k < 8; k++) {
      if (same(rotate(method.lead, k), head)) return { method, offset: k };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The solid.
//
// Give each row a point in space: for each bell, the place it is ringing in.
// That is four numbers that always sum to the same total, so the points lie
// in a three-dimensional slice of four-space, and there they are the corners
// of a truncated octahedron. Two rows one single swap apart are joined by an
// edge. The cross, which swaps both pairs, runs corner to corner across a
// square face.

const S = Math.SQRT1_2;
export function position(row) {
  const p = [0, 0, 0, 0];
  for (let place = 0; place < 4; place++) p[row.charCodeAt(place) - 49] = place - 1.5;
  return [(p[0] - p[1]) * S, (p[2] - p[3]) * S, (p[0] + p[1] - p[2] - p[3]) / 2];
}

// Every connection on the solid, once each: { a, b, change } with a < b.
export const LINKS = (() => {
  const out = [];
  for (let a = 0; a < ROWS.length; a++) {
    for (let c = 0; c < 4; c++) {
      const b = NEXT[a][c];
      if (a < b) out.push({ a, b, change: c });
    }
  }
  return out;
})();

// The fourteen faces, each a ring of row indices in order round the face.
// Six squares (the front pair and the back pair swapping independently) and
// eight hexagons (three neighbouring places shuffling while the fourth bell
// holds: four with a bell fixed at the back, four with one fixed in front).
export const FACES = (() => {
  const seen = new Set();
  const out = [];
  const ring = (start, c1, c2, kind) => {
    const verts = [];
    let at = start;
    let turn = 0;
    do {
      verts.push(at);
      at = NEXT[at][turn++ % 2 ? c2 : c1];
    } while (at !== start);
    const key = verts.slice().sort((p, q) => p - q).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ verts, kind });
  };
  for (let r = 0; r < ROWS.length; r++) {
    ring(r, 3, 2, 'square');
    ring(r, 1, 3, 'hexagon');
    ring(r, 1, 2, 'hexagon');
  }
  return out;
})();
