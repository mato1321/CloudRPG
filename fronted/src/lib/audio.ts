// @ts-nocheck
/* 遊戲音訊：音效與背景音樂全部用 Web Audio 即時合成，不需要任何音檔。
 *   audio.sfx("hit_heavy")          播放音效（名稱見 SFX）
 *   audio.playTheme("cave_battle")  切換背景音樂（名稱見 THEMES；同一首不會重頭播）
 *   audio.setMuted(true) / audio.setVolume("music", 0.5)  設定會記在 localStorage
 * 瀏覽器規定要有使用者操作才能發聲：第一次點擊 / 按鍵時自動解鎖，之前要求的音樂會接著播放 */

const LS_KEY = "crpg-audio";
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  pulse: PeriodicWave | null = null;
  settings = { muted: false, music: 0.6, sfx: 0.8 };
  listeners = new Set<(s: any) => void>();
  theme: string | null = null;
  private timer: any = null;
  private step = 0;
  private nextTime = 0;
  private lastSfx: Record<string, number> = {};

  constructor() {
    if (typeof window === "undefined") return;
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(LS_KEY) || "{}"));
    } catch {}
    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  private ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 25% 脈衝波：比方波更像紅白機的音色
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      this.pulse = ctx.createPeriodicWave(re, im);
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx && this.theme && !this.timer) this.startSequencer();
  }

  private applyVolumes() {
    if (!this.master) return;
    const s = this.settings;
    this.master.gain.value = s.muted ? 0 : 1;
    this.musicBus.gain.value = 0.16 * s.music;
    this.sfxBus.gain.value = 0.55 * s.sfx;
  }

  private save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.settings));
    } catch {}
    this.applyVolumes();
    this.listeners.forEach((fn) => fn({ ...this.settings }));
  }

  setMuted(muted: boolean) {
    this.settings.muted = muted;
    this.save();
  }

  setVolume(kind: "music" | "sfx", v: number) {
    this.settings[kind] = Math.max(0, Math.min(1, v));
    this.save();
  }

  subscribe(fn: (s: any) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /* ───────── 合成積木 ───────── */

  tone(o: { type?: OscillatorType | "pulse"; f0: number; f1?: number; t?: number; dur: number; vol?: number; attack?: number; bus?: GainNode; vib?: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const osc = ctx.createOscillator();
    if (o.type === "pulse") osc.setPeriodicWave(this.pulse);
    else osc.type = (o.type as OscillatorType) || "square";
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    if (o.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.vib;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur);
    }
    const g = ctx.createGain();
    const vol = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(o.bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  noise(o: { dur: number; vol?: number; t?: number; filter?: BiquadFilterType; f0?: number; f1?: number; q?: number; bus?: GainNode }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.t || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0 || 1200, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(o.bus || this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.dur + 0.02);
  }

  /** 播放音效。同一個音效 30ms 內只播一次，避免多段攻擊疊成爆音 */
  sfx(name: string, opts: any = {}) {
    if (this.settings.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - (this.lastSfx[name] || 0) < 30) return;
    this.lastSfx[name] = now;
    try {
      (SFX[name] || SFX.ui)(this, opts);
    } catch {}
  }

  /* ───────── 背景音樂：16 分音符步進的 chiptune 音序器 ───────── */

  playTheme(name: string | null) {
    if (name === this.theme) return;
    this.theme = name;
    this.step = 0;
    if (!name) return this.stopSequencer();
    if (this.ctx && this.ctx.state === "running") this.startSequencer();
    else if (this.ctx) this.unlock();
  }

  stopMusic() {
    this.playTheme(null);
  }

  private startSequencer() {
    this.stopSequencer();
    if (!this.ctx || !this.theme) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 30);
  }

  private stopSequencer() {
    clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const th = THEMES[this.theme];
    const ctx = this.ctx;
    if (!th || !ctx) return this.stopSequencer();
    const stepDur = 60 / th.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const t = this.nextTime - ctx.currentTime;
      this.playStep(th, this.step, Math.max(0, t), stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(th: any, step: number, t: number, sd: number) {
    const bus = this.musicBus;
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const deg = th.prog[bar % th.prog.length];
    const note = (d: number, oct = 0) => {
      const sc = th.scale;
      const i = ((d % sc.length) + sc.length) % sc.length;
      return th.root + sc[i] + 12 * (Math.floor(d / sc.length) + oct);
    };
    const chord = [note(deg), note(deg + 2), note(deg + 4)];
    const on = (pat: string) => pat && pat[s % pat.length] === "x";

    if (on(th.bass)) this.tone({ type: th.bassWave || "triangle", f0: midi(chord[0] - 24), t, dur: sd * 1.8, vol: 0.55, bus });
    if (on(th.arp)) {
      const n = chord[(s >> 1) % 3] + (s % 8 >= 4 ? 12 : 0);
      this.tone({ type: "pulse", f0: midi(n), t, dur: sd * 0.9, vol: 0.13, bus });
    }
    if (th.lead) {
      // 依小節與拍點決定的旋律：強拍用和弦音，其他拍在音階上小幅移動，偶爾休止
      const r = rand(th.seed + bar * 31 + s * 7);
      const strong = s % 4 === 0;
      if (strong || r < th.lead) {
        const d = strong ? deg + [0, 2, 4][Math.floor(r * 3)] : deg + Math.floor(r * 7) - 2;
        const len = strong && r > 0.5 ? 3 : 1;
        this.tone({ type: th.leadWave || "pulse", f0: midi(note(d, 1)), t, dur: sd * len * 0.95, vol: 0.12, bus, vib: th.vib || 0 });
      }
    }
    if (on(th.kick)) {
      this.tone({ type: "sine", f0: 150, f1: 42, t, dur: 0.14, vol: 0.8, bus });
    }
    if (on(th.snare)) {
      this.noise({ dur: 0.12, vol: 0.32, t, filter: "bandpass", f0: 1800, q: 0.7, bus });
      this.tone({ type: "triangle", f0: 220, f1: 140, t, dur: 0.08, vol: 0.25, bus });
    }
    if (on(th.hat)) this.noise({ dur: 0.035, vol: 0.12, t, filter: "highpass", f0: 7000, bus });
    if (th.glitch && rand(step * 13 + 5) < th.glitch) {
      this.tone({ type: "square", f0: midi(note(Math.floor(rand(step) * 14), 1)), t, dur: sd * 0.3, vol: 0.07, bus });
    }
  }
}

function rand(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ───────── 音效配方 ───────── */
const SFX: Record<string, (a: AudioEngine, o: any) => void> = {
  // 揮擊（出招當下）
  light: (a) => {
    a.noise({ dur: 0.07, vol: 0.25, filter: "highpass", f0: 2500, f1: 900 });
    a.tone({ type: "triangle", f0: 320, f1: 120, dur: 0.07, vol: 0.18 });
  },
  heavy: (a) => {
    a.noise({ dur: 0.16, vol: 0.32, filter: "bandpass", f0: 600, f1: 2200, q: 0.8 });
    a.tone({ type: "sawtooth", f0: 170, f1: 55, dur: 0.16, vol: 0.22 });
  },
  sweep: (a) => {
    a.noise({ dur: 0.18, vol: 0.3, filter: "bandpass", f0: 300, f1: 1800, q: 1.2 });
    a.tone({ type: "triangle", f0: 140, f1: 60, dur: 0.18, vol: 0.25 });
  },
  jump: (a) => a.tone({ type: "sine", f0: 220, f1: 560, dur: 0.11, vol: 0.18 }),
  dash: (a) => {
    a.noise({ dur: 0.22, vol: 0.3, filter: "highpass", f0: 3500, f1: 500 });
    a.tone({ type: "triangle", f0: 520, f1: 150, dur: 0.2, vol: 0.15 });
  },
  rising: (a) => {
    a.tone({ type: "sawtooth", f0: 180, f1: 820, dur: 0.26, vol: 0.22 });
    a.noise({ dur: 0.26, vol: 0.22, filter: "bandpass", f0: 500, f1: 3000 });
  },
  // 命中（打到對手）
  hit: (a) => {
    a.noise({ dur: 0.06, vol: 0.4, filter: "bandpass", f0: 1600, q: 0.9 });
    a.tone({ type: "square", f0: 190, f1: 70, dur: 0.07, vol: 0.2 });
  },
  hit_heavy: (a) => {
    a.noise({ dur: 0.16, vol: 0.55, filter: "lowpass", f0: 2400, f1: 300 });
    a.tone({ type: "sine", f0: 110, f1: 38, dur: 0.22, vol: 0.6 });
    a.tone({ type: "square", f0: 90, f1: 40, dur: 0.1, vol: 0.15 });
  },
  block: (a) => {
    a.tone({ type: "square", f0: 1250, f1: 900, dur: 0.06, vol: 0.14 });
    a.tone({ type: "triangle", f0: 2630, dur: 0.12, vol: 0.12 });
    a.noise({ dur: 0.04, vol: 0.2, filter: "highpass", f0: 4000 });
  },
  // 遠程技能：依職業不同
  proj_warrior: (a) => {
    a.noise({ dur: 0.28, vol: 0.32, filter: "bandpass", f0: 500, f1: 2600, q: 1.5 });
    a.tone({ type: "sawtooth", f0: 220, f1: 90, dur: 0.24, vol: 0.18 });
  },
  proj_mage: (a) => {
    for (let i = 0; i < 6; i++) a.tone({ type: "square", f0: 600 + Math.random() * 1200, t: i * 0.035, dur: 0.04, vol: 0.12 });
    a.noise({ dur: 0.25, vol: 0.2, filter: "highpass", f0: 3000 });
  },
  proj_priest: (a) => {
    [880, 1320, 1760].forEach((f, i) => a.tone({ type: "sine", f0: f, t: i * 0.05, dur: 0.3, vol: 0.14 }));
  },
  proj: (a) => {
    a.tone({ type: "sine", f0: 280, f1: 640, dur: 0.12, vol: 0.25 });
    a.tone({ type: "sine", f0: 640, f1: 190, t: 0.12, dur: 0.16, vol: 0.2 });
    a.noise({ dur: 0.25, vol: 0.15, filter: "bandpass", f0: 900 });
  },
  // 終極奧義：上升音 + 爆炸
  ult: (a) => {
    a.tone({ type: "sawtooth", f0: 110, f1: 1100, dur: 0.42, vol: 0.2 });
    a.noise({ dur: 0.42, vol: 0.15, filter: "bandpass", f0: 400, f1: 4000 });
    a.noise({ t: 0.42, dur: 0.6, vol: 0.6, filter: "lowpass", f0: 3000, f1: 200 });
    a.tone({ type: "sine", t: 0.42, f0: 80, f1: 30, dur: 0.6, vol: 0.7 });
  },
  heal: (a) => [523, 659, 784, 1046].forEach((f, i) => a.tone({ type: "sine", f0: f, t: i * 0.07, dur: 0.22, vol: 0.16 })),
  assist: (a) => [330, 440, 550, 880].forEach((f, i) => a.tone({ type: "pulse", f0: f, t: i * 0.05, dur: 0.12, vol: 0.14 })),
  ko: (a) => {
    a.noise({ dur: 0.7, vol: 0.55, filter: "lowpass", f0: 2000, f1: 120 });
    a.tone({ type: "sawtooth", f0: 300, f1: 40, dur: 0.8, vol: 0.25 });
    a.tone({ type: "sine", f0: 70, f1: 28, dur: 0.7, vol: 0.6 });
  },
  // Boss 機關：預警與發動
  warn: (a) => [0, 0.16].forEach((t) => a.tone({ type: "square", f0: 1046, t, dur: 0.1, vol: 0.1 })),
  hz_ice_spike: (a) => {
    [2093, 2637, 3136].forEach((f, i) => a.tone({ type: "sine", f0: f, t: i * 0.03, dur: 0.35, vol: 0.1 }));
    a.noise({ dur: 0.2, vol: 0.3, filter: "highpass", f0: 5000 });
    a.tone({ type: "square", f0: 160, f1: 60, dur: 0.12, vol: 0.2 });
  },
  hz_black_water: (a) => {
    for (let i = 0; i < 5; i++) a.tone({ type: "sine", f0: 180 + Math.random() * 120, f1: 500 + Math.random() * 300, t: i * 0.06, dur: 0.07, vol: 0.16 });
  },
  hz_sky_lightning: (a) => {
    a.noise({ dur: 0.45, vol: 0.7, filter: "highpass", f0: 1200, f1: 300 });
    a.tone({ type: "sawtooth", f0: 90, f1: 35, dur: 0.5, vol: 0.4 });
  },
  hz_format_beam: (a) => {
    a.tone({ type: "sawtooth", f0: 700, f1: 260, dur: 0.45, vol: 0.2 });
    a.tone({ type: "square", f0: 1400, f1: 520, dur: 0.45, vol: 0.08 });
  },
  hz_laser_sweep: (a) => SFX.hz_laser(a),
  hz_phantom: (a) => {
    a.noise({ dur: 0.3, vol: 0.3, filter: "bandpass", f0: 3000, f1: 400, q: 2 });
    a.tone({ type: "square", f0: 440, f1: 110, dur: 0.3, vol: 0.12 });
  },
  hz_laser: (a) => {
    a.tone({ type: "sawtooth", f0: 1600, f1: 400, dur: 0.5, vol: 0.18 });
    a.noise({ dur: 0.5, vol: 0.2, filter: "bandpass", f0: 2500, q: 4 });
  },
  hz_data_block: (a) => {
    for (let i = 0; i < 4; i++) a.tone({ type: "square", f0: [262, 330, 392, 523][i] * 2, t: i * 0.03, dur: 0.04, vol: 0.12 });
    a.tone({ type: "sine", f0: 120, f1: 50, t: 0.1, dur: 0.18, vol: 0.4 });
  },
  hazard: (a) => SFX.hz_format_beam(a),
  overclock: (a) => {
    for (let i = 0; i < 6; i++) a.tone({ type: "square", f0: i % 2 ? 660 : 880, t: i * 0.13, dur: 0.12, vol: 0.14 });
    a.noise({ dur: 0.8, vol: 0.12, filter: "bandpass", f0: 300, f1: 3000 });
  },
  // 結果 / 介面
  victory: (a) => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => a.tone({ type: "pulse", f0: f, t: i * 0.11, dur: i === 5 ? 0.5 : 0.12, vol: 0.18 })),
  defeat: (a) => [392, 370, 349, 262].forEach((f, i) => a.tone({ type: "triangle", f0: f, t: i * 0.22, dur: 0.3, vol: 0.22 })),
  loot: (a) => [988, 1319].forEach((f, i) => a.tone({ type: "pulse", f0: f, t: i * 0.08, dur: 0.14, vol: 0.14 })),
  levelup: (a) => [523, 659, 784, 1046, 1319].forEach((f, i) => a.tone({ type: "pulse", f0: f, t: i * 0.07, dur: 0.16, vol: 0.14 })),
  portal: (a) => {
    a.tone({ type: "sine", f0: 220, f1: 980, dur: 0.4, vol: 0.2, vib: 30 });
    a.noise({ dur: 0.4, vol: 0.12, filter: "bandpass", f0: 600, f1: 3000 });
  },
  talk: (a) => a.tone({ type: "square", f0: 520 + Math.random() * 160, dur: 0.035, vol: 0.05 }),
  ui: (a) => a.tone({ type: "square", f0: 1200, dur: 0.03, vol: 0.06 }),
};

/* ───────── 背景音樂 ─────────
 * root：主音（MIDI）、scale：音階、prog：每小節的和弦（音階級數，從 0 起算）
 * bass / arp / kick / snare / hat：16 步的節奏（x = 發聲）、lead：旋律密度（0 = 沒有旋律） */
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const CALM = { kick: "x.......x.......", snare: "", hat: "", bass: "x.......x...x...", arp: "x.x.x.x.x.x.x.x." };
const BATTLE = { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "x.xxx.x.x.xxx.x.", arp: "xxxxxxxxxxxxxxxx" };

export const THEMES: Record<string, any> = {
  lobby: { bpm: 100, root: 57, scale: MINOR, prog: [0, 5, 2, 6], ...CALM, kick: "x...x...x...x...", hat: "..x...x...x...x.", lead: 0.25, seed: 11 },
  school: { bpm: 96, root: 60, scale: MAJOR, prog: [0, 4, 5, 3], ...CALM, lead: 0.3, seed: 3 },
  glitch: { bpm: 120, root: 61, scale: PHRYGIAN, prog: [0, 1, 0, 6], ...CALM, arp: "x..x..x..x..x...", lead: 0.15, glitch: 0.18, seed: 404 },
  wasteland: { bpm: 88, root: 62, scale: DORIAN, prog: [0, 3, 0, 6], ...CALM, lead: 0.2, seed: 21 },
  village: { bpm: 92, root: 67, scale: MAJOR, prog: [0, 3, 4, 0], ...CALM, kick: "", lead: 0.35, leadWave: "triangle", seed: 8 },
  castle: { bpm: 84, root: 64, scale: HARMONIC, prog: [0, 3, 4, 0], ...CALM, arp: "x...x...x...x...", lead: 0.2, vib: 4, seed: 66 },
  // 戰鬥曲
  village_battle: { bpm: 150, root: 57, scale: MINOR, prog: [0, 5, 6, 4], ...BATTLE, lead: 0.45, seed: 101 },
  cave_battle: { bpm: 140, root: 62, scale: PHRYGIAN, prog: [0, 1, 0, 6], ...BATTLE, lead: 0.4, seed: 102 },
  mansion_battle: { bpm: 132, root: 64, scale: HARMONIC, prog: [0, 3, 4, 0], ...BATTLE, lead: 0.4, vib: 5, seed: 103 },
  abyss_battle: { bpm: 128, root: 54, scale: MINOR, prog: [0, 5, 3, 4], ...BATTLE, arp: "x.xxx.xxx.xxx.xx", lead: 0.3, seed: 104 },
  skyisle_battle: { bpm: 150, root: 62, scale: LYDIAN, prog: [0, 1, 4, 3], ...BATTLE, lead: 0.5, seed: 105 },
  demon_battle: { bpm: 156, root: 60, scale: HARMONIC, prog: [0, 5, 3, 4], ...BATTLE, bassWave: "sawtooth", lead: 0.45, seed: 106 },
  core_battle: { bpm: 168, root: 59, scale: PHRYGIAN, prog: [0, 1, 5, 4], ...BATTLE, bassWave: "sawtooth", lead: 0.4, glitch: 0.12, seed: 107 },
  dojo_battle: { bpm: 146, root: 64, scale: MINOR, prog: [0, 6, 5, 4], ...BATTLE, lead: 0.5, seed: 108 },
  raid_battle: { bpm: 160, root: 55, scale: HARMONIC, prog: [0, 5, 1, 4], ...BATTLE, bassWave: "sawtooth", lead: 0.45, seed: 109 },
  tower_battle: { bpm: 150, root: 61, scale: MINOR, prog: [0, 1, 5, 6], ...BATTLE, lead: 0.35, glitch: 0.06, seed: 110 },
};

/** 戰鬥場地 / 模式 → 戰鬥曲 */
export function battleTheme(stageKey: string, mode?: string) {
  if (mode === "raid" || mode === "worldboss" || mode === "guildboss") return "raid_battle";
  if (mode === "tower") return "tower_battle";
  if (mode === "pvp") return "dojo_battle";
  const t = `${stageKey}_battle`;
  return THEMES[t] ? t : "dojo_battle";
}

/** 故事場景 → 探索音樂 */
export function sceneTheme(sceneId: string) {
  if (!sceneId) return "village";
  if (sceneId.startsWith("classroom") || sceneId === "ending") return "school";
  if (sceneId.startsWith("portal") || sceneId.startsWith("glitch")) return "glitch";
  if (sceneId.startsWith("wasteland")) return "wasteland";
  if (sceneId.startsWith("demon") || sceneId.startsWith("after_demon")) return "castle";
  return "village";
}

export const audio = new AudioEngine();
