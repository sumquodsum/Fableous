// One bell, struck once, as a row of samples.
//
// A bell does not sound a note the way a string does. It sounds a handful of
// partials that founders have names for, and what the ear takes for the note
// is mostly an agreement between them. In order, relative to the note heard:
//
//   hum         an octave below, quiet, and the last thing left ringing
//   prime       the note itself
//   tierce      a minor third above; this is what makes a bell sound like a bell
//   quint       a fifth above, weak
//   nominal     an octave above, and the brightest thing in the strike
//
// and above those a ladder of higher partials that are loud for an instant
// and gone almost at once. Low partials die slowly, high ones fast.
//
// This file has no audio API in it. It only does arithmetic, so the tests can
// check it under node.

export const SAMPLE_RATE = 44100;

// Four bells, treble to tenor, tuned to the top of a major scale coming down
// to its keynote: fa, mi, re, doh. Just intonation over a tenor in C.
const TENOR_HZ = 261.63;
export const STRIKE_HZ = [TENOR_HZ * (4 / 3), TENOR_HZ * (5 / 4), TENOR_HZ * (9 / 8), TENOR_HZ];

// [ratio to the strike note, loudness, how long it lasts relative to the hum]
const PARTIALS = [
  [0.5, 0.2, 1.0], // hum
  [1.0, 0.3, 0.6], // prime
  [1.2, 0.3, 0.46], // tierce
  [1.5, 0.07, 0.32], // quint
  [2.0, 0.4, 0.34], // nominal
  [3.0, 0.2, 0.19], // superquint
  [4.07, 0.14, 0.13], // octave nominal, a little sharp, as cast
  [5.34, 0.075, 0.085],
  [6.84, 0.04, 0.06],
  [8.5, 0.02, 0.04],
];

const HUM_SECONDS = 1.25; // time for the tenor's hum to fall to 1/e
const SECONDS = 4.2;

// Small deterministic random numbers, so each bell is always the same bell.
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// What goes into bell number `bell` (0 = treble): a list of
// { hz, gain, tau } components. Exposed so the tests can look for them.
export function recipe(bell) {
  const f = STRIKE_HZ[bell];
  const rand = rng(1668 + bell * 97);
  // Smaller bells ring shorter.
  const base = HUM_SECONDS * Math.pow(TENOR_HZ / f, 0.8);
  const out = [];
  for (const [ratio, gain, life] of PARTIALS) {
    // No two bells are cast quite alike: nudge each partial a few cents.
    const cents = ratio === 1 ? 0 : (rand() - 0.5) * 9;
    const hz = f * ratio * Math.pow(2, cents / 1200);
    const tau = base * life * (0.92 + rand() * 0.16);
    // A real bell is never perfectly round, so each partial is really two,
    // a hair apart, and they beat slowly against each other.
    const split = ratio <= 2 ? 0.25 + rand() * 0.5 : 0;
    if (split) {
      out.push({ hz: hz - split / 2, gain: gain * 0.68, tau });
      out.push({ hz: hz + split / 2, gain: gain * 0.32, tau: tau * 0.93 });
    } else {
      out.push({ hz, gain, tau });
    }
  }
  return out;
}

export function renderBell(bell, sampleRate = SAMPLE_RATE) {
  const n = Math.floor(SECONDS * sampleRate);
  const out = new Float32Array(n);
  const acc = new Float64Array(n);

  for (const { hz, gain, tau } of recipe(bell)) {
    if (hz >= sampleRate / 2) continue;
    // A sine by recurrence: each sample from the two before it. Seeded with
    // the two samples before time zero, so that the first one out is sin(0)
    // and the strike begins from silence instead of with a click.
    const w = (2 * Math.PI * hz) / sampleRate;
    const k = 2 * Math.cos(w);
    const decay = Math.exp(-1 / (tau * sampleRate));
    let y1 = -Math.sin(w);
    let y2 = -Math.sin(2 * w);
    let env = gain;
    for (let i = 0; i < n && env > 1e-5; i++) {
      const y = k * y1 - y2;
      y2 = y1;
      y1 = y;
      acc[i] += y * env;
      env *= decay;
    }
  }

  // The clapper: a few milliseconds of noise, with the top taken off.
  const rand = rng(40320 + bell);
  let lp = 0;
  const clack = Math.floor(0.03 * sampleRate);
  for (let i = 0; i < clack; i++) {
    lp += 0.35 * (rand() * 2 - 1 - lp);
    acc[i] += lp * 0.16 * Math.exp(-i / (0.0035 * sampleRate)) * Math.min(1, i / 12);
  }

  // Scale so the loudest instant is just under full, and let the last
  // quarter-second run out to nothing so the buffer ends in silence.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(acc[i]));
  const fade = Math.floor(0.25 * sampleRate);
  for (let i = 0; i < n; i++) {
    const tail = i > n - fade ? (n - i) / fade : 1;
    out[i] = (acc[i] / peak) * 0.92 * tail;
  }
  return out;
}

// The rhythm. Rows come in pairs, handstroke then backstroke, and after every
// backstroke the band leaves one beat of silence before the next handstroke:
// the handstroke gap. It is what gives ringing its gait.
//
// rowSpan: beats from the start of row k to the start of the row after it.
// rowStart: beats from the start of the ringing to the start of row k.
// Everything that schedules a strike goes through these two.
export function rowSpan(k, bells = 4) {
  return bells + (k % 2 ? 1 : 0);
}
export function rowStart(k, bells = 4) {
  let beats = 0;
  for (let i = 0; i < k; i++) beats += rowSpan(i, bells);
  return beats;
}
