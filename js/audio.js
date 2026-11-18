// The tower: four cast bells, a room for them to sound in, and a clock.
//
// Each bell is rendered once (see bell.js) and after that a strike is just
// that recording played again from the top. Everything is scheduled against
// the audio clock, never against timers, so the rhythm holds even when the
// page is busy drawing.

import { SAMPLE_RATE, renderBell, rowStart } from './bell.js';

// Where each bell stands, left to right, as if you were in the ringing room
// with the treble on your left and the tenor on your right.
const PAN = [-0.5, -0.17, 0.17, 0.5];
// The heavier the bell, the more it says.
const WEIGHT = [0.8, 0.86, 0.93, 1.0];

// The sound of a stone room: noise, dying away, with the top rolled off.
function room(ctx) {
  const seconds = 1.7;
  const n = Math.floor(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let seed = 1715;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const start = Math.floor(0.012 * ctx.sampleRate);
    let lp = 0;
    let energy = 0;
    for (let i = start; i < n; i++) {
      const t = (i - start) / ctx.sampleRate;
      lp += 0.22 * (rand() * 2 - 1 - lp);
      data[i] = lp * Math.exp(-t / 0.42);
      energy += data[i] * data[i];
    }
    const scale = 1 / Math.sqrt(energy);
    for (let i = start; i < n; i++) data[i] *= scale;
  }
  return buf;
}

// Wire up a context: returns the node each bell should be played into.
function build(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const press = ctx.createDynamicsCompressor();
  press.threshold.value = -12;
  press.knee.value = 12;
  press.ratio.value = 3;
  press.attack.value = 0.004;
  press.release.value = 0.25;
  master.connect(press).connect(ctx.destination);

  const dry = ctx.createGain();
  dry.gain.value = 0.42;
  dry.connect(master);

  const reverb = ctx.createConvolver();
  reverb.normalize = false;
  reverb.buffer = room(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  dry.connect(reverb).connect(wet).connect(master);

  const inputs = PAN.map((p) => {
    const pan = ctx.createStereoPanner();
    pan.pan.value = p;
    pan.connect(dry);
    return pan;
  });
  return { master, inputs };
}

export class Tower {
  constructor() {
    this.ctx = null;
    this.samples = null; // Float32Array per bell
    this.buffers = null; // AudioBuffer per bell
    this.live = new Set(); // strikes scheduled and not yet finished
    this.muted = false;
    this.log = []; // every strike scheduled: { bell, when }. For checking.
  }

  // Cast the bells. Cheap enough to do at load, before anyone has asked.
  cast() {
    if (!this.samples) this.samples = [0, 1, 2, 3].map((b) => renderBell(b, SAMPLE_RATE));
    return this.samples;
  }

  // Must be called from inside a click or key press: browsers will not let a
  // page make a sound until the visitor has done something. Returns the
  // current time on the audio clock.
  wake() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      const graph = build(this.ctx);
      this.master = graph.master;
      this.inputs = graph.inputs;
      this.buffers = this.cast().map((data) => {
        const buf = this.ctx.createBuffer(1, data.length, SAMPLE_RATE);
        buf.getChannelData(0).set(data);
        return buf;
      });
      this.master.gain.value = this.muted ? 0 : 0.85;
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx.currentTime;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  strike(bell, when, loud = 1) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[bell];
    const gain = this.ctx.createGain();
    gain.gain.value = WEIGHT[bell] * loud;
    src.connect(gain).connect(this.inputs[bell]);
    src.start(when);
    const entry = { src, gain, when };
    this.live.add(entry);
    src.onended = () => {
      this.live.delete(entry);
      gain.disconnect();
    };
    this.log.push({ bell, when });
    if (this.log.length > 400) this.log.splice(0, 200);
  }

  // Ring one row: four strikes, a beat apart. No band strikes like a
  // machine, so each blow lands a few milliseconds early or late and a
  // little harder or softer than the last.
  ringRow(row, when, beat, { steady = false } = {}) {
    for (let place = 0; place < row.length; place++) {
      const slip = steady ? 0 : (Math.random() + Math.random() - 1) * 0.007;
      const loud = steady ? 1 : 0.93 + Math.random() * 0.14;
      this.strike(row.charCodeAt(place) - 49, Math.max(0, when + place * beat + slip), loud);
    }
  }

  // Stand: stop whatever has not yet struck. Bells already sounding ring on.
  cancel() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const entry of this.live) {
      if (entry.when > now) {
        try {
          entry.src.stop();
        } catch {
          // already stopped
        }
      }
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  // For checking, not for listening: render some rows through the same wiring
  // offline and report how loud it got. Resolves to { peak, rms, seconds }.
  async measure(rows, beat) {
    const seconds = rows.length * 5 * beat + 4;
    const off = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const { inputs } = build(off);
    const buffers = this.cast().map((data) => {
      const buf = off.createBuffer(1, data.length, SAMPLE_RATE);
      buf.getChannelData(0).set(data);
      return buf;
    });
    rows.forEach((row, k) => {
      const t0 = 0.05 + rowStart(k) * beat;
      for (let place = 0; place < 4; place++) {
        const bell = row.charCodeAt(place) - 49;
        const src = off.createBufferSource();
        src.buffer = buffers[bell];
        const gain = off.createGain();
        gain.gain.value = WEIGHT[bell];
        src.connect(gain).connect(inputs[bell]);
        src.start(t0 + place * beat);
      }
    });
    const out = await off.startRendering();
    let peak = 0;
    let sum = 0;
    for (let ch = 0; ch < 2; ch++) {
      const d = out.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        sum += v * v;
      }
    }
    return { peak, rms: Math.sqrt(sum / (2 * out.length)), seconds };
  }
}
