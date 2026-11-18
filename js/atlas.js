// The plate of 162: every essentially different extent, drawn small.
//
// Each of the 10,792 extents is one of these loops, begun at one row or
// another, rung one way round or the other, mirrored or not. Each drawing is
// the loop on the solid, seen from one fixed side; the near half is dark and
// the far half pale.

import { ROWS, LINKS, INDEX, METHODS, rowsOf, kin, identify, position } from './rows.js';

const NS = 'http://www.w3.org/2000/svg';

// One fixed point of view for every drawing. It was found by trying every
// direction, a degree at a time, and keeping the one from which the closest
// two corners appear furthest apart, so that no corner hides behind another.
const EYE = (() => {
  const v = [-0.1391, -0.7431, -0.6545];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();
const RIGHT = (() => {
  // up × eye, with up taken as the y axis
  const r = [EYE[2], 0, -EYE[0]];
  const n = Math.hypot(...r);
  return r.map((v) => v / n);
})();
const UP = [
  EYE[1] * RIGHT[2] - EYE[2] * RIGHT[1],
  EYE[2] * RIGHT[0] - EYE[0] * RIGHT[2],
  EYE[0] * RIGHT[1] - EYE[1] * RIGHT[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const FLAT = ROWS.map((r) => {
  const p = position(r);
  return { x: dot(p, RIGHT), y: -dot(p, UP), z: dot(p, EYE) };
});
const seg = (a, b) => `M${FLAT[a].x.toFixed(2)},${FLAT[a].y.toFixed(2)}L${FLAT[b].x.toFixed(2)},${FLAT[b].y.toFixed(2)}`;
const isNear = (a, b) => FLAT[a].z + FLAT[b].z > 0;
// The solid itself, once, for every drawing to sit on.
const FRAME = LINKS.filter((l) => l.change !== 0).map((l) => seg(l.a, l.b)).join('');

// The families, in catalogue order of their first member.
// -> [{ first, size, names }] with first as a 1-based catalogue number.
export function families(cat) {
  const done = new Uint8Array(cat.size);
  const out = [];
  for (let n = 0; n < cat.size; n++) {
    if (done[n]) continue;
    const members = kin(cat.get(n));
    const names = new Set();
    for (const m of members) {
      done[cat.indexOf(m)] = 1;
      const id = identify(m);
      if (id && id.offset === 0) names.add(id.method.name);
    }
    // Keep the names in the order ringers list them.
    const ordered = METHODS.map((m) => m.name).filter((name) => names.has(name));
    out.push({ first: n + 1, size: members.length, names: ordered });
  }
  return out;
}

// Which family an extent belongs to: the catalogue number of its first member.
export function familyOf(cat, changes) {
  let first = Infinity;
  for (const m of kin(changes)) first = Math.min(first, cat.indexOf(m) + 1);
  return first;
}

export class Atlas {
  constructor(grid, readout, { cat, onPick }) {
    this.grid = grid;
    this.readout = readout;
    this.cat = cat;
    this.list = families(cat);
    this.cells = new Map();
    this.found = new Set();
    this.current = 0;
    this.resting = '';

    const frag = document.createDocumentFragment();
    for (const fam of this.list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'loop';
      b.setAttribute('aria-label', this.describe(fam));

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '-2.5 -2.5 5 5');
      svg.setAttribute('aria-hidden', 'true');
      const idx = rowsOf(cat.get(fam.first - 1)).map((r) => INDEX.get(r));
      let near = '';
      let far = '';
      for (let i = 1; i < idx.length; i++) {
        if (isNear(idx[i - 1], idx[i])) near += seg(idx[i - 1], idx[i]);
        else far += seg(idx[i - 1], idx[i]);
      }
      for (const [cls, d] of [['frame', FRAME], ['far', far], ['near', near]]) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('class', cls);
        p.setAttribute('d', d);
        svg.appendChild(p);
      }
      b.appendChild(svg);

      b.addEventListener('click', () => onPick(fam));
      const tell = () => this.say(this.describe(fam));
      const rest = () => this.say(this.resting);
      b.addEventListener('pointerenter', tell);
      b.addEventListener('pointerleave', rest);
      b.addEventListener('focus', tell);
      b.addEventListener('blur', rest);

      // One tab stop for the whole plate, not 162. The arrow keys move within it.
      b.tabIndex = -1;
      this.cells.set(fam.first, b);
      frag.appendChild(b);
    }
    grid.replaceChildren(frag);
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'The 162 loops. Arrow keys move between them; Enter has the band ring one.');
    this.order = [...this.cells.values()];
    this.order[0].tabIndex = 0;

    grid.addEventListener('keydown', (e) => {
      const at = this.order.indexOf(document.activeElement);
      if (at < 0) return;
      const across = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + across, ArrowUp: at - across, Home: 0, End: this.order.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      if (to < 0 || to >= this.order.length) return;
      this.rove(this.order[to]);
      this.order[to].focus();
    });
  }

  // Make this cell the plate's one tab stop.
  rove(cell) {
    for (const c of this.order) c.tabIndex = c === cell ? 0 : -1;
  }

  describe(fam) {
    const no = 'No. ' + fam.first.toLocaleString('en-GB');
    const alike = fam.size === 1 ? 'alone' : `one of ${fam.size} alike`;
    const names = fam.names.length ? ', ' + fam.names.join(' and ') : '';
    const found = this.found.has(fam.first) ? '. Rung by you.' : '';
    return `${no}${names}, ${alike}${found}`;
  }

  say(text) {
    if (this.readout.textContent !== text) this.readout.textContent = text;
  }

  // found: the families rung by hand. current: the family on the solid now, or 0.
  update(found, current) {
    this.found = found;
    for (const [first, cell] of this.cells) {
      cell.classList.toggle('found', found.has(first));
      cell.classList.toggle('current', first === current);
    }
    for (const fam of this.list) this.cells.get(fam.first).setAttribute('aria-label', this.describe(fam));
    this.current = current;
    // Tabbing into the plate lands on the loop that is on the solid, if one is.
    if (current && !this.grid.contains(document.activeElement)) this.rove(this.cells.get(current));
    const n = found.size;
    this.resting =
      n === 0
        ? 'None of these has been rung by you yet.'
        : n === this.list.length
          ? 'You have rung all 162.'
          : `You have rung ${n} of the ${this.list.length} by hand.`;
    this.say(this.resting);
  }
}
