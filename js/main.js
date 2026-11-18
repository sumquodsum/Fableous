// Extent: the conductor. Holds the touch being rung, decides what may happen
// next, and keeps the solid, the leaf, the bells and the margin in step.

import {
  ROUNDS, LENGTH, CHANGES, INDEX, METHODS,
  apply, rowsOf, Catalogue, period, isPalindromic, identify, kin,
} from './rows.js';
import { Solid } from './solid.js';
import { Leaf } from './leaf.js';
import { Tower } from './audio.js';
import { rowSpan } from './bell.js';
import { Atlas, familyOf } from './atlas.js';

const $ = (id) => document.getElementById(id);
const say = (n) => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// What is held.

const S = {
  changes: [], // the touch so far, as change ids
  blue: 2, // the bell the blue line follows
  beat: 0.235, // seconds between strikes
  given: null, // { no, name }: a name that arrived in the page's address
};

let cat = null; // the catalogue, once counted
let perf = null; // a performance in progress, or null
let flash = null; // a call that stands until the next thing happens
let queueEnd = 0; // audio time at which the last hand-rung row finishes

const NAMES_KEY = 'extent.names';
const names = (() => {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY)) || {};
  } catch {
    return {};
  }
})();

// The families (of the 162) that have been rung here by hand, kept by the
// catalogue number of each family's first member.
const FOUND_KEY = 'extent.found';
const found = (() => {
  try {
    return new Set((JSON.parse(localStorage.getItem(FOUND_KEY)) || []).filter(Number.isInteger));
  } catch {
    return new Set();
  }
})();
let atlas = null;
let atlasKey = '';

const tower = new Tower();
const solid = new Solid($('solid'), { onStep: (c) => step(c), onBack: () => back(), reducedMotion: reduced });
const leaf = new Leaf($('leaf'));

// ---------------------------------------------------------------------------
// Reading the touch.

function look() {
  const n = S.changes.length;
  const rows = rowsOf(S.changes);
  const here = rows[n];
  const round = n > 0 && here === ROUNDS;
  const extent = round && n === LENGTH;
  const rung = new Set(rows);

  // From here, each change leads somewhere: to a row not yet rung, to a row
  // already rung (which would make the ringing false, so it is shut), or home.
  const options = round
    ? []
    : CHANGES.map((c) => {
        const row = apply(here, c.id);
        const state = n > 0 && row === ROUNDS ? 'home' : rung.has(row) ? 'rung' : 'open';
        return { change: c.id, row, to: INDEX.get(row), state };
      });
  const stuck = !round && options.every((o) => o.state === 'rung');

  // Where this touch sits in the catalogue: the run of extents that begin
  // the way it has gone so far.
  let range = null;
  if (cat) range = round && !extent ? [0, 0] : cat.range(S.changes);
  const open = range ? range[1] - range[0] : null;
  const number = extent && range && open === 1 ? range[0] + 1 : 0;

  return { n, rows, here, round, extent, options, stuck, range, open, number, count: round ? n : n + 1 };
}

const isHunt = (changes) =>
  changes.length === 8 && (changes.every((c, i) => c === i % 2) || changes.every((c, i) => c === 1 - (i % 2)));

// The conductor's line: [what to say, how to say it]. 'warn' is for the
// moments that want a step back; 'loud' for arrivals.
function callFor(v) {
  if (flash) return [flash, ''];
  if (v.extent) return [v.number ? `That’s all. No. ${say(v.number)} of ${say(cat.size)}.` : 'That’s all.', 'loud'];
  if (v.round) {
    if (isHunt(S.changes)) {
      return ['Plain hunt: eight rows, and home, with sixteen never rung. Step back one, and where the hunt would close, make some other change.', 'loud'];
    }
    const left = LENGTH - v.n;
    return [`Came round after ${v.n}. True, but short: ${left} rows were never rung.`, 'loud'];
  }
  if (v.stuck) return ['Every way on leads to a row already rung. Step back.', 'warn'];
  if (v.open === 0) return ['No extent begins this way. Step back, or go on and see where it runs out.', 'warn'];
  if (v.n === 0) return ['Step to a joined row, or use a change. Drag to turn the solid.', ''];
  if (v.n === LENGTH - 1) return ['One change from home.', 'loud'];
  if (v.open === null) return [`${v.count} of 24 rows rung.`, ''];
  if (v.open === 1) return [`${v.count} of 24 rows rung. Only one extent still begins this way.`, ''];
  return [`${v.count} of 24 rows rung. ${say(v.open)} extents still begin this way.`, ''];
}

function setCall(text, tone = '') {
  const el = $('call');
  setText(el, text);
  el.classList.toggle('loud', tone === 'loud');
  el.classList.toggle('warn', tone === 'warn');
}

// ---------------------------------------------------------------------------
// The four changes, as buttons. Each shows which pairs cross and where it
// would take you.

const X = [8, 22, 36, 50];
function diagram(change) {
  const to = [0, 1, 2, 3];
  for (const [i, j] of change.swaps) [to[i], to[j]] = [to[j], to[i]];
  const paths = to.map((q, p) => `M${X[p]},5 L${X[q]},29`).join(' ');
  const dots = X.map((x) => `<circle cx="${x}" cy="5" r="2"/><circle cx="${x}" cy="29" r="2"/>`).join('');
  return `<svg viewBox="0 0 58 34" aria-hidden="true"><path d="${paths}"/>${dots}</svg>`;
}

const changeButtons = CHANGES.map((c) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'change';
  b.innerHTML = `${diagram(c)}<span class="glyph">${c.glyph}</span><span class="to"></span><kbd>${c.key}</kbd>`;
  b.addEventListener('click', () => step(c.id));
  b.addEventListener('animationend', () => b.classList.remove('refuse'));
  // Pointing at a change points at the way it leads on the solid.
  const point = (on) => () => {
    const o = on && !perf ? look().options.find((x) => x.change === c.id) : null;
    solid.setHover(o && o.state !== 'rung' ? o.to : -1);
  };
  b.addEventListener('pointerenter', point(true));
  b.addEventListener('pointerleave', point(false));
  b.addEventListener('focus', point(true));
  b.addEventListener('blur', point(false));
  $('changes').append(b);
  return b;
});

// The shelf: the eleven that have names.
const shelfButtons = METHODS.map((m) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = m.name;
  b.addEventListener('click', () => load(m.changes, { thenRing: true }));
  $('shelf').append(b);
  return b;
});

// ---------------------------------------------------------------------------
// Drawing everything from what is held.

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function render({ delay = 0, stagger = 0.2 } = {}) {
  const v = look();
  const playing = !!perf;

  if (!playing) {
    solid.setSpin(v.extent ? 0.07 : 0);
    solid.set({ path: v.rows.map((r) => INDEX.get(r)), options: v.options, bead: null, done: v.extent, canGoBack: v.n > 0 });
  }

  // Rule the leaf off wherever the changes start over.
  const rules = [];
  if (v.extent) {
    const p = period(S.changes);
    for (let r = p; r < LENGTH; r += p) rules.push(r);
  }
  leaf.render({ rows: v.rows, changes: S.changes, blue: S.blue, rules, stagger, delay });

  changeButtons.forEach((b, c) => {
    const o = v.options.find((x) => x.change === c);
    b.classList.toggle('rung', !!o && o.state === 'rung');
    b.classList.toggle('home', !!o && o.state === 'home');
    b.disabled = playing || !o || o.state === 'rung';
    setText(b.querySelector('.to'), !o ? '—' : o.state === 'home' ? 'home' : o.row);
    const where = !o ? '' : o.state === 'home' ? ', home to rounds' : o.state === 'rung' ? `, to ${o.row}, already rung` : `, to ${o.row}`;
    b.setAttribute('aria-label', `${CHANGES[c].glyph === '×' ? 'Cross' : CHANGES[c].name}: ${CHANGES[c].word}${where}`);
  });

  if (!playing) setCall(...callFor(v));
  setText($('t-rows'), String(Math.min(v.count, LENGTH)));
  setText($('t-open'), v.open === null ? '…' : say(v.open));
  const span = $('span');
  if (v.range && cat) {
    span.style.left = ((v.range[0] / cat.size) * 100).toFixed(3) + '%';
    span.style.width = ((v.open / cat.size) * 100).toFixed(3) + '%';
  }
  span.parentElement.classList.toggle('none', v.open === 0);
  span.parentElement.classList.toggle('one', v.open === 1);

  $('back').disabled = playing || v.n === 0;
  $('again').disabled = playing || v.n === 0;
  setText($('ring'), playing ? 'Stand' : 'Ring it');
  $('ring').classList.toggle('ready', !playing && v.round);

  colophon(v);
  address(v);

  if (atlas) {
    const family = v.extent && v.number ? familyOf(cat, S.changes) : 0;
    const key = family + ':' + found.size;
    if (key !== atlasKey) {
      atlasKey = key;
      atlas.update(found, family);
    }
  }

  const id = v.extent ? identify(S.changes) : null;
  shelfButtons.forEach((b, i) => {
    const on = !!id && id.offset === 0 && id.method === METHODS[i];
    if (on) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
}

const COUNT = ['', 'one change', 'two changes', 'three changes', 'four changes', 'five changes', 'six changes', 'seven changes'];

function nameOf(number) {
  if (names[number]) return { name: names[number], whose: 'you' };
  if (S.given && S.given.no === number) return { name: S.given.name, whose: 'other' };
  return null;
}

function colophon(v) {
  const box = $('colophon');
  if (!v.extent || !v.number) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('c-number').innerHTML = `No. ${say(v.number)} <small>of ${say(cat.size)}</small>`;

  const what = $('c-what');
  what.replaceChildren();
  const strong = (text) => {
    const s = document.createElement('strong');
    s.textContent = text;
    what.append(s);
  };
  const id = identify(S.changes);
  const mine = nameOf(v.number);
  let nameable = false;

  if (id) {
    strong(`${id.method.name} Minimus`);
    what.append(
      id.offset === 0
        ? '. The same eight changes three times over; ringers call each a lead.'
        : `, begun ${COUNT[id.offset]} into its lead.`
    );
  } else {
    const p = period(S.changes);
    let shape = p === 12 ? 'The same twelve changes, twice over.' : p === 6 ? 'The same six changes, four times over.' : 'No part of it repeats.';
    if (isPalindromic(S.changes)) shape += ' It reads the same backwards as forwards.';
    if (mine) {
      strong(`${mine.name} Minimus`);
      what.append(`. ${shape} ${mine.whose === 'you' ? 'So named by you.' : 'So named by whoever sent you here.'}`);
      if (mine.whose === 'you') {
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'quiet';
        again.textContent = 'Rename it';
        again.addEventListener('click', () => {
          delete names[v.number];
          keepNames();
          render();
          $('name').focus();
        });
        what.append(' ', again);
      }
    } else {
      what.append(`${shape} This page knows no name for it.`);
      nameable = true;
    }
  }
  $('naming').hidden = !nameable;

  // Its family: the extents that are this same loop, differently begun.
  const family = kin(S.changes).map((k) => cat.indexOf(k) + 1);
  const first = Math.min(...family);
  const others = family.length - 1;
  const kinEl = $('c-kin');
  kinEl.replaceChildren(
    `${others} others are this same loop, begun at another row, rung backwards, or mirrored front to back. `
  );
  if (first === v.number) {
    kinEl.append('This is the first of them.');
  } else {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'quiet';
    go.textContent = `No. ${say(first)}`;
    go.addEventListener('click', () => {
      S.given = null;
      load(cat.get(first - 1), { thenRing: false });
    });
    kinEl.append('The first of them is ', go, '.');
  }
}

function keepNames() {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // private windows may refuse; the name still holds for this visit and in the address
  }
}

// A finished extent has an address: its number, and its name if it has one
// of yours. Anything else has none.
function address(v) {
  // Until the catalogue is counted, an address someone arrived with has not
  // been read yet. Leave it alone.
  if (!cat) return;
  let hash = '';
  let title = 'Extent · all the changes on four bells';
  if (v.extent && v.number) {
    const id = identify(S.changes);
    const mine = id ? null : nameOf(v.number);
    hash = '#' + v.number + (mine ? ':' + encodeURIComponent(mine.name) : '');
    const label = id && id.offset === 0 ? `${id.method.name} Minimus` : mine ? `${mine.name} Minimus` : `No. ${say(v.number)}`;
    title = `${label} · Extent`;
  }
  if (document.title !== title) document.title = title;
  if (location.hash !== hash) {
    try {
      history.replaceState(null, '', hash || location.pathname + location.search);
    } catch {
      // some embeddings forbid it; the address is a nicety
    }
  }
}

function fromAddress() {
  const m = /^#(\d{1,5})(?::(.*))?$/.exec(location.hash);
  if (!m || !cat) return false;
  const no = Number(m[1]);
  if (no < 1 || no > cat.size) return false;
  let name = '';
  try {
    name = decodeURIComponent(m[2] || '').trim().slice(0, 40);
  } catch {
    name = '';
  }
  S.given = name ? { no, name } : null;
  load(cat.get(no - 1), { thenRing: false });
  return true;
}

// ---------------------------------------------------------------------------
// Doing things.

function step(c) {
  if (perf) return;
  const v = look();
  const o = v.options.find((x) => x.change === c);
  if (!o) return;
  if (o.state === 'rung') {
    const b = changeButtons[c];
    b.classList.remove('refuse');
    void b.offsetWidth;
    b.classList.add('refuse');
    return;
  }
  flash = null;
  S.changes.push(c);

  // An extent finished by hand is inked in on the plate of 162.
  if (cat && S.changes.length === LENGTH && o.state === 'home') {
    found.add(familyOf(cat, S.changes));
    try {
      localStorage.setItem(FOUND_KEY, JSON.stringify([...found]));
    } catch {
      // kept for this visit only
    }
  }

  // Ring the row stepped onto. If steps come faster than rows can be rung,
  // let them queue a little, then give up and overlap.
  const beat = Math.min(S.beat, 0.2);
  const now = tower.wake();
  let delay = 0;
  if (now !== null) {
    const start = Math.max(now + 0.03, Math.min(queueEnd, now + 0.9));
    tower.ringRow(o.row, start, beat);
    queueEnd = start + 4 * beat;
    delay = start - now;
  }
  render({ delay, stagger: beat });
}

function back() {
  if (perf || !S.changes.length) return;
  flash = null;
  S.changes.pop();
  render();
}

function again() {
  if (perf || !S.changes.length) return;
  flash = null;
  S.changes = [];
  S.given = null;
  render();
}

function load(changes, { thenRing }) {
  if (perf) stand();
  flash = null;
  S.changes = changes.slice();
  leaf.reset(LENGTH + 2); // set down whole; the performance will ink it in
  render();
  if (thenRing) ring();
}

// ---------------------------------------------------------------------------
// The band rings it.
//
// Rows are scheduled on the audio clock a little ahead of time, and the
// drawing follows that same clock, so what you see strike is what you hear.

const clock = () => (tower.ctx ? tower.now : performance.now() / 1000);

function ring() {
  if (perf) return stand();
  const woke = tower.wake();
  const now = woke === null ? clock() : woke;
  const v = look();
  flash = null;

  // Two rows of rounds to set the rhythm, then the touch. If it comes round,
  // finish as a band would: on a backstroke, with one more whole pull of rounds.
  const seq = [{ row: ROUNDS, leaf: 0 }, { row: ROUNDS, leaf: 0 }];
  for (let i = 1; i <= v.n; i++) seq.push({ row: v.rows[i], leaf: i });
  if (v.round || v.n === 0) {
    if (seq.length % 2) seq.push({ row: ROUNDS, leaf: v.n });
    seq.push({ row: ROUNDS, leaf: v.n }, { row: ROUNDS, leaf: v.n });
  }

  // What is being rung, to say while it is rung.
  let title = '';
  if (v.extent && v.number) {
    const id = identify(S.changes);
    const mine = id ? null : nameOf(v.number);
    title = id && id.offset === 0 ? `${id.method.name} Minimus.` : mine ? `${mine.name} Minimus.` : `No. ${say(v.number)}.`;
  }

  perf = {
    seq,
    title,
    index: v.rows.map((r) => INDEX.get(r)),
    round: v.round,
    n: v.n,
    times: [],
    beats: [],
    next: 0,
    nextStart: now + 0.15,
    shown: '',
  };
  solid.setSpin(0);
  schedule();
  perf.timer = setInterval(schedule, 40);
  perf.raf = requestAnimationFrame(follow);
  render();
  leaf.setPlayhead({ row: 0, strike: -1 });
  setCall('Look to. Treble’s going. She’s gone.', 'loud');
}

function schedule() {
  if (!perf) return;
  const now = clock();
  const ahead = document.hidden ? 1.6 : 0.4;
  if (perf.nextStart < now) perf.nextStart = now + 0.05;
  while (perf.next < perf.seq.length && perf.nextStart < now + ahead) {
    const k = perf.next++;
    const beat = S.beat;
    tower.ringRow(perf.seq[k].row, perf.nextStart, beat);
    perf.times[k] = perf.nextStart;
    perf.beats[k] = beat;
    perf.nextStart += rowSpan(k) * beat;
  }
}

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function follow() {
  if (!perf) return;
  const now = clock();
  const { seq, times, beats } = perf;
  let k = -1;
  while (k + 1 < times.length && times[k + 1] <= now) k++;
  if (k >= 0) {
    const item = seq[k];
    const beat = beats[k];
    const into = now - times[k];
    if (k === seq.length - 1 && into > 4 * beat + 0.2) return finish();

    const strike = Math.min(3, Math.floor(into / beat));
    const key = item.leaf + ':' + strike + ':' + k;
    if (key !== perf.shown) {
      perf.shown = key;
      leaf.setPlayhead({ row: item.leaf, strike });
      const closing = perf.round && item.leaf === perf.n;
      setCall(k < 2 ? 'Look to. Treble’s going. She’s gone.' : closing ? 'That’s all.' : perf.title, 'loud');
    }

    // Between this row and the next, a bead runs along the way taken. It
    // waits on the corner while the row is struck, then goes.
    const nxt = seq[k + 1];
    let bead = null;
    if (nxt && nxt.row !== item.row) {
      const whole = rowSpan(k) * beat;
      bead = { from: INDEX.get(item.row), to: INDEX.get(nxt.row), t: smooth((into / whole - 0.3) / 0.7) };
    }
    solid.set({ path: perf.index.slice(0, item.leaf + 1), options: [], bead, done: false, canGoBack: false });
  }
  perf.raf = requestAnimationFrame(follow);
}

function endPerformance() {
  clearInterval(perf.timer);
  cancelAnimationFrame(perf.raf);
  perf = null;
  leaf.setPlayhead(null);
}

function finish() {
  const round = perf.round;
  endPerformance();
  flash = round ? null : 'Stand.';
  render();
}

function stand() {
  if (!perf) return;
  tower.cancel();
  endPerformance();
  flash = 'Stand.';
  render();
}

// ---------------------------------------------------------------------------
// Hands on.

$('back').addEventListener('click', back);
$('again').addEventListener('click', again);
$('ring').addEventListener('click', ring);

$('lot').addEventListener('click', () => {
  if (!cat) return;
  S.given = null;
  load(cat.get(Math.floor(Math.random() * cat.size)), { thenRing: true });
});

$('lines').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-bell]');
  if (!b) return;
  S.blue = Number(b.dataset.bell);
  for (const x of $('lines').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  leaf.render({ rows: look().rows, changes: S.changes, blue: S.blue, rules: leafRules() });
});
function leafRules() {
  const v = look();
  const rules = [];
  if (v.extent) for (let p = period(S.changes), r = p; r < LENGTH; r += p) rules.push(r);
  return rules;
}

// Pace: the slider runs from stately to brisk.
const paceOf = (value) => 0.32 - (value / 100) * 0.17;
$('pace').addEventListener('input', (e) => {
  S.beat = paceOf(Number(e.target.value));
});
S.beat = paceOf(Number($('pace').value));

$('mute').addEventListener('click', () => {
  const muted = !tower.muted;
  tower.setMuted(muted);
  $('mute').setAttribute('aria-pressed', String(muted));
  setText($('mute'), muted ? 'Sound off' : 'Sound on');
});

$('naming').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = look();
  const name = $('name').value.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!v.number || !name) return;
  names[v.number] = name;
  keepNames();
  $('name').value = '';
  render();
});

$('copy').addEventListener('click', async () => {
  const b = $('copy');
  try {
    await navigator.clipboard.writeText(location.href);
    setText(b, 'Copied');
  } catch {
    setText(b, 'It is in the address bar');
  }
  setTimeout(() => setText(b, 'Copy the address of this extent'), 1800);
});

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches('input, textarea, select')) return;
  const key = e.key.toLowerCase();
  const c = CHANGES.find((x) => x.key === key);
  if (c) {
    step(c.id);
    e.preventDefault();
  } else if (key === 'backspace' || key === 'z') {
    back();
    e.preventDefault();
  } else if (key === ' ' && !e.target.matches('button, a')) {
    ring();
    e.preventDefault();
  } else if (key === 'escape') {
    stand();
  }
});

addEventListener('hashchange', () => {
  const v = look();
  const mine = v.number ? '#' + v.number : '';
  if (location.hash.split(':')[0] === mine) return;
  // An address that names no extent is put back to what is on the page.
  if (!fromAddress()) render();
});

// ---------------------------------------------------------------------------
// Begin. Draw at once; count the catalogue and cast the bells just after, so
// the page is on screen before the arithmetic starts.

render();
setTimeout(() => {
  cat = new Catalogue();
  atlas = new Atlas($('atlas'), $('atlas-say'), {
    cat,
    onPick: (family) => {
      S.given = null;
      load(cat.get(family.first - 1), { thenRing: true });
      $('solid').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    },
  });
  if (!fromAddress()) render();
  tower.cast();
}, 40);

// A handle for checking things from the console.
window.extent = { S, tower, solid, leaf, look, step, back, again, ring, stand, load, catalogue: () => cat };
