// node test/bell.test.mjs
//
// I cannot listen to these bells, so this is the next best thing: measure
// them. Each check is something a wrong synthesiser would fail.

import assert from 'node:assert/strict';
import { SAMPLE_RATE, STRIKE_HZ, recipe, renderBell, rowSpan, rowStart } from '../js/bell.js';

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

// Strength of one frequency in a stretch of samples (Goertzel).
const strength = (x, hz, from, to) => {
  const w = (2 * Math.PI * hz) / SAMPLE_RATE;
  const k = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = from; i < to; i++) {
    const s = x[i] + k * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - k * s1 * s2)) / (to - from);
};
const rms = (x, from, to) => {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return Math.sqrt(s / (to - from));
};
const at = (seconds) => Math.floor(seconds * SAMPLE_RATE);

const bells = [0, 1, 2, 3].map((b) => renderBell(b));

console.log('each bell');
test('is finite, within range, and close to full scale at its loudest', () => {
  for (const x of bells) {
    let peak = 0;
    for (const v of x) {
      assert.ok(Number.isFinite(v));
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak <= 0.921 && peak > 0.9, 'peak ' + peak);
  }
});
test('starts and ends in silence, so it cannot click', () => {
  for (const x of bells) {
    assert.ok(Math.abs(x[0]) < 0.02, 'first sample ' + x[0]);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-4);
  }
});
test('speaks at once: loudest within the first 30 ms', () => {
  for (const x of bells) {
    let peakAt = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i]) > Math.abs(x[peakAt])) peakAt = i;
    assert.ok(peakAt < at(0.03), 'peak at ' + (peakAt / SAMPLE_RATE).toFixed(3) + ' s');
  }
});
test('dies away steadily', () => {
  for (const x of bells) {
    const a = rms(x, at(0.0), at(0.2));
    const b = rms(x, at(0.8), at(1.0));
    const c = rms(x, at(2.4), at(2.6));
    assert.ok(a > b * 2 && b > c * 2, [a, b, c].map((v) => v.toFixed(4)).join(' > '));
  }
});
test('contains its partials and not their neighbours', () => {
  bells.forEach((x, b) => {
    const f = STRIKE_HZ[b];
    for (const ratio of [0.5, 1, 1.2, 2, 3]) {
      const on = strength(x, f * ratio, 0, at(0.5));
      const off = strength(x, f * ratio * 1.09, 0, at(0.5));
      assert.ok(on > off * 4, `bell ${b + 1} partial ${ratio}: ${on.toExponential(2)} vs ${off.toExponential(2)}`);
    }
  });
});
test('the tierce is a minor third, not a major one', () => {
  bells.forEach((x, b) => {
    const f = STRIKE_HZ[b];
    assert.ok(strength(x, f * 1.2, 0, at(0.5)) > strength(x, f * 1.25, 0, at(0.5)) * 3);
  });
});
test('late in the note, the hum has outlasted the nominal', () => {
  bells.forEach((x, b) => {
    const f = STRIKE_HZ[b];
    const early = strength(x, f * 2, 0, at(0.15)) / strength(x, f * 0.5, 0, at(0.15));
    const late = strength(x, f * 2, at(2), at(2.5)) / strength(x, f * 0.5, at(2), at(2.5));
    assert.ok(early > 1, 'nominal should lead at the strike: ' + early.toFixed(2));
    assert.ok(late < 0.2, 'hum should lead later: ' + late.toFixed(3));
  });
});

console.log('the ring');
test('rounds runs down the scale: each bell lower than the last', () => {
  for (let b = 1; b < 4; b++) assert.ok(STRIKE_HZ[b] < STRIKE_HZ[b - 1]);
  assert.ok(Math.abs(STRIKE_HZ[0] / STRIKE_HZ[3] - 4 / 3) < 1e-9);
});
test('smaller bells ring shorter', () => {
  const hum = (b) => recipe(b)[0].tau;
  assert.ok(hum(0) < hum(1) && hum(1) < hum(2) && hum(2) < hum(3));
});
test('every bell is the same bell each time it is cast', () => {
  const again = renderBell(2);
  assert.deepEqual(Array.from(again.subarray(0, 2000)), Array.from(bells[2].subarray(0, 2000)));
});

console.log('the rhythm');
test('rows are four beats long with one beat of gap after each backstroke', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => rowSpan(k)), [4, 5, 4, 5, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => rowStart(k)), [0, 4, 9, 13, 18, 22]);
});
test('an extent with its rounds before and after is 28 rows and 125 beats', () => {
  // Two rows of rounds, 24 changes, two more of rounds; the last row is four beats.
  assert.equal(rowStart(27) + 4, 125);
});

const t0 = performance.now();
for (let b = 0; b < 4; b++) renderBell(b);
console.log('\n  casting four bells takes ' + (performance.now() - t0).toFixed(0) + ' ms');
console.log('\n' + passed + ' passed' + (process.exitCode ? ', SOME FAILED' : ''));
