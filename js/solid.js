// The solid: the twenty-four rows as the corners of a truncated octahedron,
// drawn as a plate and used as the controller. You stand on a corner; the
// solid turns under you so that where you are is always facing you.

import { ROWS, LINKS, FACES, CHANGES, NEXT, position } from './rows.js';

const NS = 'http://www.w3.org/2000/svg';
const make = (name, attrs, parent) => {
  const node = document.createElementNS(NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
};

// --- quaternions, [w, x, y, z] ---------------------------------------------

const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = (q) => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};
const qrot = (q, v) => {
  const [w, x, y, z] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
};
const qaxis = (axis, angle) => {
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
};
const unit = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
// The shortest turn that carries unit vector a onto unit vector b.
const qarc = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.999999) return [1, 0, 0, 0];
  if (d < -0.999999) {
    const o = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ax = unit([a[1] * o[2] - a[2] * o[1], a[2] * o[0] - a[0] * o[2], a[0] * o[1] - a[1] * o[0]]);
    return [0, ax[0], ax[1], ax[2]];
  }
  return qnorm([1 + d, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
};
const qslerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) {
    b = [-b[0], -b[1], -b[2], -b[3]];
    d = -d;
  }
  if (d > 0.9995) return qnorm([0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * t));
  const th = Math.acos(d);
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = Math.sin(t * th) / Math.sin(th);
  return [0, 1, 2, 3].map((i) => a[i] * sa + b[i] * sb);
};
const qangle = (a, b) => {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
};

// --- geometry ----------------------------------------------------------------

const POS = ROWS.map(position);
const CAMERA = 11; // distance of the eye from the centre, in the solid's units
const SCALE = 74; // drawing units per unit of the solid
const FRONT = unit([0.1, -0.16, 1]); // where the corner you stand on is held

const FACE = FACES.map((f) => {
  const c = [0, 1, 2].map((k) => f.verts.reduce((s, v) => s + POS[v][k], 0) / f.verts.length);
  return { ...f, normal: unit(c), depth: Math.hypot(...c) };
});
// Which faces each link borders (two for an edge, one for a cross), and which
// faces meet at each corner. Something is in front if any of its faces is.
const LINK_FACES = LINKS.map((l) =>
  FACE.map((f, i) => (f.verts.includes(l.a) && f.verts.includes(l.b) ? i : -1)).filter((i) => i >= 0)
);
const CORNER_FACES = ROWS.map((_, v) =>
  FACE.map((f, i) => (f.verts.includes(v) ? i : -1)).filter((i) => i >= 0)
);
// The four rows one change away from each row.
const NEIGHBOURS = NEXT;
const linkKey = (a, b) => (a < b ? a * 24 + b : b * 24 + a);
const LINK_AT = new Map(LINKS.map((l, i) => [linkKey(l.a, l.b), i]));

// --- the plate ---------------------------------------------------------------

export class Solid {
  constructor(svg, { onStep, onBack, reducedMotion = false } = {}) {
    this.svg = svg;
    this.onStep = onStep || (() => {});
    this.onBack = onBack || (() => {});
    this.reducedMotion = reducedMotion;

    svg.setAttribute('viewBox', '-262 -262 524 524');

    // Start with rounds held at the front, and the square it sits on squared
    // up, so the first cross reads as a diagonal.
    const home = ROWS.indexOf('1234');
    this.q = qarc(unit(POS[home]), FRONT);
    this.target = this.q;
    this.spin = 0; // idle turning, radians per second about the vertical

    this.state = { path: [home], options: [], bead: null, done: false, canGoBack: false };
    this.hover = -1;

    this.#build();
    this.#listen();
    this.draw();
  }

  #build() {
    const svg = this.svg;
    this.gBack = make('g', { class: 'back' }, svg);
    this.gVeil = make('g', { class: 'veil' }, svg);
    this.gFront = make('g', { class: 'front' }, svg);

    this.faceEls = FACE.map((f) => make('polygon', { class: 'face ' + f.kind }, this.gVeil));

    // Each link and corner is drawn twice, once under the veil of the near
    // faces and once over it; only one of the two is shown at a time.
    this.linkEls = LINKS.map((l) => {
      const cls = 'link ' + (l.change === 0 ? 'cross' : 'edge');
      return [make('line', { class: cls }, this.gBack), make('line', { class: cls }, this.gFront)];
    });
    this.dotEls = ROWS.map(() => [
      make('circle', { class: 'corner' }, this.gBack),
      make('circle', { class: 'corner' }, this.gFront),
    ]);

    this.homeRing = make('circle', { class: 'home-ring' }, this.gFront);
    this.hereRing = make('circle', { class: 'here-ring' }, this.gFront);
    this.bead = make('circle', { class: 'bead', r: 6 }, this.gFront);

    this.labelEls = ROWS.map((r) => {
      const t = make('text', { class: 'row-label' }, this.gFront);
      t.textContent = r;
      return t;
    });
    this.glyphEls = CHANGES.map((c) => {
      const t = make('text', { class: 'change-glyph' }, this.gFront);
      t.textContent = c.glyph;
      return t;
    });
    this.hitEls = ROWS.map((r, i) => {
      const c = make('circle', { class: 'hit', r: 22 }, this.gFront);
      c.dataset.row = i;
      return c;
    });
  }

  #listen() {
    const svg = this.svg;
    let drag = null;

    svg.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, target: e.target };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) {
        const row = e.target.dataset && e.target.dataset.row;
        const h = row === undefined ? -1 : Number(row);
        if (h !== this.hover) {
          this.hover = h;
          this.draw();
        }
        return;
      }
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      const size = svg.getBoundingClientRect().width || 500;
      const d = Math.hypot(dx, dy);
      // Turn about the axis in the plane of the page at right angles to the drag.
      const turn = qaxis(unit([dy, dx, 0]), (d / size) * 4.2);
      this.q = qnorm(qmul(turn, this.q));
      this.target = this.q;
      this.spin = 0;
      svg.classList.add('dragging');
      this.draw();
    });
    const end = (e) => {
      if (!drag) return;
      const was = drag;
      drag = null;
      svg.classList.remove('dragging');
      if (was.moved) return;
      const row = was.target.dataset && was.target.dataset.row;
      if (row === undefined) return;
      const opt = this.state.options.find((o) => o.to === Number(row));
      if (opt && opt.state !== 'rung') return this.onStep(opt.change);
      // The row you just came from: going back the way you came is a step back.
      const { path, canGoBack } = this.state;
      if (canGoBack && path.length > 1 && Number(row) === path[path.length - 2]) this.onBack();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', () => {
      drag = null;
      svg.classList.remove('dragging');
    });
    svg.addEventListener('pointerleave', () => {
      if (this.hover !== -1) {
        this.hover = -1;
        this.draw();
      }
    });
  }

  // path: row indices walked, in order, from rounds.
  // options: [{ change, to, state: 'open' | 'home' | 'rung' }] from the last row.
  // bead: null, or { from, to, t } for a point travelling between two rows.
  set(state, { follow = true } = {}) {
    this.state = { ...this.state, ...state };
    if (follow) {
      const bead = this.state.bead;
      if (!bead) this.face(this.state.path[this.state.path.length - 1]);
      else if (this.reducedMotion) this.face(bead.t < 0.5 ? bead.from : bead.to); // cut, don't roll
      else this.#faceBead(bead);
    }
    this.#wake();
  }

  // Turn so that this row is held at the front.
  face(row) {
    const now = unit(qrot(this.target, POS[row]));
    this.target = qnorm(qmul(qarc(now, FRONT), this.target));
    if (this.reducedMotion) this.q = this.target;
    this.#wake();
  }

  #faceBead({ from, to, t }) {
    const a = POS[from];
    const b = POS[to];
    const p = unit([0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t));
    const now = unit(qrot(this.target, p));
    this.target = qnorm(qmul(qarc(now, FRONT), this.target));
  }

  // Point at one of the ways on, from outside: the change buttons do this,
  // so a button and the way it leads light up together.
  setHover(row) {
    if (row === this.hover) return;
    this.hover = row;
    this.draw();
  }

  setSpin(radPerSec) {
    this.spin = this.reducedMotion ? 0 : radPerSec;
    this.#wake();
  }

  #wake() {
    if (this.raf) return;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      let moving = false;
      if (this.spin) {
        const turn = qaxis([0, 1, 0], this.spin * dt);
        this.q = qnorm(qmul(turn, this.q));
        this.target = this.q;
        moving = true;
      } else if (qangle(this.q, this.target) > 0.0008) {
        this.q = qslerp(this.q, this.target, 1 - Math.exp(-dt / 0.13));
        moving = true;
      } else {
        this.q = this.target;
      }
      this.draw();
      this.raf = moving || this.state.bead ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  #project(p) {
    const r = qrot(this.q, p);
    const k = (CAMERA / (CAMERA - r[2])) * SCALE;
    return { x: r[0] * k, y: -r[1] * k, z: r[2], k };
  }

  draw() {
    const { path, options, bead, done, canGoBack } = this.state;
    const here = path[path.length - 1];
    const home = path[0];
    const behind = canGoBack && path.length > 1 ? path[path.length - 2] : -1;
    const P = POS.map((p) => this.#project(p));

    // Which faces are turned toward the eye.
    const front = FACE.map((f) => qrot(this.q, f.normal)[2] > f.depth / CAMERA);
    this.faceEls.forEach((el, i) => {
      if (!front[i]) return el.setAttribute('display', 'none');
      el.removeAttribute('display');
      el.setAttribute('points', FACE[i].verts.map((v) => P[v].x.toFixed(1) + ',' + P[v].y.toFixed(1)).join(' '));
    });

    // What has been walked, and what could be walked next.
    const walked = new Set();
    for (let i = 1; i < path.length; i++) walked.add(LINK_AT.get(linkKey(path[i - 1], path[i])));
    const visited = new Set(path);
    const optionAt = new Map();
    const optionLink = new Map();
    for (const o of options) {
      optionAt.set(o.to, o);
      optionLink.set(LINK_AT.get(linkKey(here, o.to)), o);
    }

    LINKS.forEach((l, i) => {
      const isFront = LINK_FACES[i].some((f) => front[f]);
      const [under, over] = this.linkEls[i];
      const show = isFront ? over : under;
      const hide = isFront ? under : over;
      hide.setAttribute('display', 'none');
      show.removeAttribute('display');
      const a = P[l.a];
      const b = P[l.b];
      show.setAttribute('x1', a.x.toFixed(1));
      show.setAttribute('y1', a.y.toFixed(1));
      show.setAttribute('x2', b.x.toFixed(1));
      show.setAttribute('y2', b.y.toFixed(1));
      const o = optionLink.get(i);
      let cls = 'link ' + (l.change === 0 ? 'cross' : 'edge');
      if (walked.has(i)) cls += ' walked';
      else if (o && o.state !== 'rung') cls += ' open' + (this.hover === o.to ? ' hover' : '');
      show.setAttribute('class', cls);
    });

    ROWS.forEach((_, v) => {
      const isFront = CORNER_FACES[v].some((f) => front[f]);
      const [under, over] = this.dotEls[v];
      const show = isFront ? over : under;
      (isFront ? under : over).setAttribute('display', 'none');
      show.removeAttribute('display');
      const p = P[v];
      const o = optionAt.get(v);
      let cls = 'corner';
      let r = 3.1;
      if (visited.has(v)) cls += ' rung';
      if (v === here && !bead) {
        cls += ' here';
        r = 6.2;
      } else if (o && o.state !== 'rung') {
        cls += ' open';
        r = this.hover === v ? 6.4 : 5;
      }
      show.setAttribute('class', cls);
      show.setAttribute('cx', p.x.toFixed(1));
      show.setAttribute('cy', p.y.toFixed(1));
      show.setAttribute('r', ((r * p.k) / SCALE).toFixed(2));

      // The row's name, set beside its corner on the side away from the
      // middle of the plate. Rows seen nearly edge-on are left unnamed.
      const label = this.labelEls[v];
      const facing = p.z / Math.sqrt(5);
      if (!isFront || facing < 0.08) {
        label.setAttribute('display', 'none');
      } else {
        label.removeAttribute('display');
        let dx = p.x;
        let dy = p.y;
        let reach = 15;
        if (v === here && !bead) {
          // Where you stand, four ways lead out. Find the widest gap between
          // them and set the name in the middle of it.
          const angles = NEIGHBOURS[v]
            .map((n) => Math.atan2(P[n].y - p.y, P[n].x - p.x))
            .sort((a, b) => a - b);
          let widest = -1;
          let mid = Math.PI / 2;
          for (let i = 0; i < angles.length; i++) {
            const from = angles[i];
            const to = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * Math.PI;
            if (to - from > widest) {
              widest = to - from;
              mid = (from + to) / 2;
            }
          }
          dx = Math.cos(mid);
          dy = Math.sin(mid);
          reach = v === home ? 31 : 26;
        }
        const len = Math.hypot(dx, dy);
        if (len < 0.35) {
          dx = 0;
          dy = 1;
        } else {
          dx /= len;
          dy /= len;
        }
        // Names are wider than they are tall, so stand further off sideways.
        const off = reach + 9 * Math.abs(dx);
        label.setAttribute('x', (p.x + dx * off).toFixed(1));
        label.setAttribute('y', (p.y + dy * off + 5).toFixed(1));
        let lc = 'row-label';
        if (v === here && !bead) lc += ' here';
        else if (o && o.state !== 'rung') lc += ' open';
        else if (visited.has(v)) lc += ' rung';
        label.setAttribute('class', lc);
        label.style.opacity = Math.min(1, 0.3 + (facing - 0.08) * 2.2).toFixed(2);
      }

      const hit = this.hitEls[v];
      hit.setAttribute('cx', p.x.toFixed(1));
      hit.setAttribute('cy', p.y.toFixed(1));
      hit.setAttribute('class', 'hit' + ((o && o.state !== 'rung') || v === behind ? ' live' : ''));
    });

    // Rounds wears a ring, always.
    const hp = P[home];
    const homeFront = CORNER_FACES[home].some((f) => front[f]);
    this.homeRing.setAttribute('cx', hp.x.toFixed(1));
    this.homeRing.setAttribute('cy', hp.y.toFixed(1));
    this.homeRing.setAttribute('r', ((10.5 * hp.k) / SCALE).toFixed(2));
    this.homeRing.setAttribute('class', 'home-ring' + (homeFront ? '' : ' behind') + (done ? ' done' : ''));

    // Where you are.
    const cp = P[here];
    if (bead) this.hereRing.setAttribute('display', 'none');
    else {
      this.hereRing.removeAttribute('display');
      this.hereRing.setAttribute('cx', cp.x.toFixed(1));
      this.hereRing.setAttribute('cy', cp.y.toFixed(1));
      this.hereRing.setAttribute('r', ((here === home ? 15.5 : 11) * cp.k / SCALE).toFixed(2));
    }

    // The name of each change, written beside the way it leads.
    this.glyphEls.forEach((g, c) => {
      const o = options.find((x) => x.change === c);
      if (!o || bead) return g.setAttribute('display', 'none');
      g.removeAttribute('display');
      const a = P[here];
      const b = P[o.to];
      const t = c === 0 ? 0.36 : 0.5;
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      // Set the glyph off to one side of the line, consistently.
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      g.setAttribute('x', (mx + nx * 13).toFixed(1));
      g.setAttribute('y', (my + ny * 13 + 4.5).toFixed(1));
      g.setAttribute('class', 'change-glyph' + (o.state === 'rung' ? ' shut' : ''));
    });

    if (bead) {
      const a = P[bead.from];
      const b = P[bead.to];
      const s = bead.t;
      this.bead.removeAttribute('display');
      this.bead.setAttribute('cx', (a.x + (b.x - a.x) * s).toFixed(1));
      this.bead.setAttribute('cy', (a.y + (b.y - a.y) * s).toFixed(1));
    } else {
      this.bead.setAttribute('display', 'none');
    }
  }
}
