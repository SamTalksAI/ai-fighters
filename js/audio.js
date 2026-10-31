// AI Fighters - retro 8-bit audio with Web Audio (pulse/triangle/noise). No audio files.
//  * A.sfx   - sound effects (unchanged API: play / muted / context / toggle)
//  * A.music - an ORIGINAL chiptune score ("Neon Uplink", A minor, 150 BPM, 32-bar loop) played by a lookahead
//              scheduler, a calmer title loop, and short jingles (intro sting, round start, KO, victory).
// The AudioContext is only created after the first user gesture (browser autoplay rules).
// Routing: voices -> sfxBus (1.0) / musicBus (0.3, always below SFX) -> master (0 when muted) -> speakers.
(function () {
  const A = window.AIF;
  let ac = null, noiseBuf = null, muted = false, master = null, sfxBus = null, musicBus = null, waves = null;
  try { muted = localStorage.getItem('aif-muted') === '1'; } catch (e) {}
  const MUSIC_VOL = 0.3, DUCK_VOL = 0.09;

  function buses(ctx, dest) { // per-context routing graph (also used by the offline WAV renderer)
    const m = ctx.createGain(), s = ctx.createGain(), mu = ctx.createGain();
    s.connect(m); mu.connect(m); m.connect(dest); mu.gain.value = MUSIC_VOL;
    // NES-ish pulse waves (25% and 12.5% duty) for the lead and the arpeggio
    const pulse = (d) => { const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * d);
      return ctx.createPeriodicWave(re, im); };
    return { master: m, sfx: s, music: mu, waves: { p25: pulse(0.25), p12: pulse(0.125) } };
  }
  function unlock() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const b = buses(ac, ac.destination); master = b.master; sfxBus = b.sfx; musicBus = b.music; waves = b.waves;
      master.gain.value = muted ? 0 : 1;
    }
    if (ac.state === 'suspended') ac.resume();
    if (M.wanted && !M.running && !muted && !M.paused) M._begin(M.wanted);
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  // ---------------- sound effects ----------------
  function env(t, vol, dur) {
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(sfxBus); return g;
  }
  function tone(type, f0, f1, dur, vol = 0.12, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    o.connect(env(t, vol, dur)); o.start(t); o.stop(t + dur + 0.02);
  }
  function getNoise(ctx) {
    if (ctx === ac && noiseBuf) return noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    let r = 0x1234; for (let i = 0; i < d.length; i++) { r = (r * 1103515245 + 12345) & 0x7fffffff; d[i] = (r / 0x3fffffff) - 1; }
    if (ctx === ac) noiseBuf = b; return b;
  }
  function noise(dur, vol = 0.25, cutoff = 2000, delay = 0) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter();
    s.buffer = getNoise(ac); f.type = 'lowpass'; f.frequency.value = cutoff;
    s.connect(f).connect(env(t, vol, dur)); s.start(t); s.stop(t + dur);
  }
  const SFX = {
    punch: () => { noise(0.07, 0.3, 3500); tone('square', 320, 110, 0.08); },
    kick: () => { noise(0.12, 0.35, 1400); tone('square', 190, 55, 0.15, 0.14); },
    block: () => { tone('square', 1100, 900, 0.05, 0.07); tone('square', 1500, 1500, 0.04, 0.05, 0.05); },
    rocket: () => { noise(0.55, 0.2, 900); tone('sawtooth', 180, 900, 0.45, 0.05); },
    throw: () => { tone('square', 700, 90, 0.3, 0.12); noise(0.25, 0.35, 700, 0.28); },
    ko: () => { tone('square', 440, 50, 1.0, 0.13); tone('triangle', 220, 30, 1.1, 0.2); },
    round: () => { tone('square', 523, 523, 0.1, 0.09); tone('square', 659, 659, 0.1, 0.09, 0.11); tone('square', 784, 784, 0.22, 0.09, 0.22); },
    select: () => tone('square', 660, 1320, 0.09, 0.09),
    // SUPER: activation sting (impact + rising power chord), meter-full chime, VR glitch dash, final blast
    super: () => { noise(0.18, 0.4, 5000); tone('square', 98, 98, 0.5, 0.12, 0.04); tone('sawtooth', 196, 784, 0.55, 0.06, 0.05);
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.07, 0.12 + i * 0.07)); },
    meter: () => { tone('square', 784, 784, 0.06, 0.07); tone('square', 1175, 1175, 0.06, 0.07, 0.07); tone('square', 1568, 1568, 0.12, 0.06, 0.14); },
    // GAMMA RAY: rising charge hum (satellite powering up), target-lock beeps, the beam (sizzling roar + falling zap), per-hit zap
    gammaCharge: () => { tone('sawtooth', 55, 220, 0.6, 0.06); tone('square', 110, 440, 0.6, 0.04); for (let i = 0; i < 5; i++) tone('triangle', 660 + i * 120, 700 + i * 120, 0.05, 0.05, i * 0.11); },
    lock: () => { tone('square', 1760, 1760, 0.05, 0.07); tone('square', 1760, 1760, 0.05, 0.07, 0.08); },
    gammaBeam: () => { noise(0.25, 0.5, 6000); noise(1.1, 0.32, 2600, 0.05); tone('sawtooth', 1400, 90, 0.45, 0.09); tone('square', 62, 58, 1.0, 0.09, 0.03); tone('triangle', 90, 30, 1.1, 0.16, 0.05);
      for (let i = 0; i < 8; i++) tone('square', 900 - i * 70, 300 - i * 20, 0.06, 0.04, 0.1 + i * 0.12); },
    zap: () => { noise(0.08, 0.3, 7000); tone('square', 1200, 200, 0.09, 0.08); },
    glitch: () => { for (let i = 0; i < 6; i++) tone('square', 200 + ((i * 677) % 1500), 120 + ((i * 331) % 900), 0.035, 0.06, i * 0.035); noise(0.2, 0.15, 6000); },
    boom: () => { noise(0.6, 0.45, 500); tone('triangle', 120, 30, 0.6, 0.2); },
    pause: () => { tone('square', 988, 988, 0.05, 0.07); tone('square', 659, 659, 0.08, 0.07, 0.06); },
  };
  A.sfx = {
    log: [],
    play(name) {
      this.log.push(name); if (this.log.length > 30) this.log.shift();
      if (muted || !ac || !SFX[name]) return;
      try { SFX[name](); } catch (e) { /* never break the game over audio */ }
    },
    get muted() { return muted; },
    get context() { return ac; },
    toggle() {
      muted = !muted; try { localStorage.setItem('aif-muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.01);
      if (muted) M._halt(); else if (M.wanted && !M.paused && ac) M._begin(M.wanted);
      return muted;
    },
  };

  // ---------------- the score (original composition) ----------------
  // Notes: 'A4', 'C#5'; '-' holds the previous note; '.' is a rest. Lead/bass bars are 8 eighth notes.
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (n) => 12 * (+n.slice(-1) + 1) + NOTE[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CH = { Am: [57, 60, 64], F: [53, 57, 60], G: [55, 59, 62], Em: [52, 55, 59], E: [52, 56, 59], Dm: [50, 53, 57], C: [48, 52, 55] };
  const ROOT = { Am: 'A2', F: 'F2', G: 'G2', Em: 'E2', E: 'E2', Dm: 'D2', C: 'C2' };
  const HOOK = [ // section A: the hook (call ... answer)
    ['Am', 'A4 . A4 C5 E5 . D5 C5'], ['F', 'C5 . A4 . F4 G4 A4 .'], ['G', 'B4 . G4 B4 D5 . C5 B4'], ['Em', 'E5 - - . D5 C5 B4 G4'],
    ['Am', 'A4 . A4 C5 E5 . G5 E5'], ['F', 'F5 . E5 . C5 D5 E5 .'], ['G', 'D5 . B4 G4 D5 E5 F5 D5'], ['E', 'E5 - - - G#4 - B4 -'],
  ];
  const HOOK2 = HOOK.slice(0, 7).concat([['E', 'B4 C5 D5 E5 G#5 - B5 -']]); // second pass climbs into the bridge
  const BRIDGE = [ // section B: lifts to D minor, ends on a long E (dominant) before the hook returns
    ['Dm', 'F5 - E5 D5 A4 - D5 -'], ['Am', 'E5 - D5 C5 A4 - C5 -'], ['F', 'A5 - G5 F5 C5 - F5 -'], ['G', 'G5 - F5 E5 D5 - B4 -'],
    ['Dm', 'D5 F5 A5 - G5 F5 E5 D5'], ['Am', 'C5 E5 A5 - G5 E5 C5 E5'], ['E', 'B4 - E5 - G#5 - B5 -'], ['E', 'E6 - - - D6 C6 B5 G#5'],
  ];
  const FIGHT = { bpm: 150, bars: [...HOOK, ...HOOK2, ...BRIDGE, ...HOOK], drums: true, lead: 'p25', leadVol: 0.16 };
  // calmer title / select loop: slower, triangle lead, no snare
  const TITLE = { bpm: 104, drums: 'soft', lead: 'triangle', leadVol: 0.22, bars: [
    ['Am', 'E5 - - - D5 - C5 -'], ['F', 'A4 - - - - - . .'], ['C', 'G4 - C5 - E5 - G5 -'], ['G', 'D5 - - - - - . .'],
    ['Am', 'E5 - - - G5 - A5 -'], ['F', 'C6 - - - A5 - F5 -'], ['G', 'G5 - F5 - D5 - B4 -'], ['E', 'G#4 - - - B4 - - -'],
  ] };
  const TRACKS = { fight: FIGHT, title: TITLE };
  // flatten a track into per-16th-step events
  function compile(tr) {
    const ev = [];
    tr.bars.forEach(([chord, mel], bar) => {
      const b0 = bar * 16, toks = mel.split(' ');
      toks.forEach((tk, i) => {
        if (tk === '-' || tk === '.') return;
        let len = 1; while (toks[i + len] === '-') len++;
        ev.push({ s: b0 + i * 2, ch: 'lead', m: midi(tk), len: len * 2 - 0.4 });
      });
      const r = midi(ROOT[chord]);
      for (let i = 0; i < 8; i++) { // bass: octave pump, a walk-up on the last eighth
        const m = tr === TITLE ? (i % 4 === 0 ? r : i % 4 === 2 ? r + 7 : -1) : (i % 2 ? r + 12 : r) + (i === 7 ? 2 : 0);
        if (m > 0) ev.push({ s: b0 + i * 2, ch: 'bass', m, len: tr === TITLE ? 3.5 : 1.6 });
      }
      const tones = CH[chord];
      for (let i = 0; i < 16; i++) { // arpeggio, two octaves up, every 16th (8ths on the title loop)
        if (tr === TITLE && i % 2) continue;
        ev.push({ s: b0 + i, ch: 'arp', m: tones[[0, 1, 2, 1][i % 4]] + 12 + (i >= 8 && tr !== TITLE ? 12 : 0), len: 0.8 });
      }
      for (let i = 0; i < 16; i++) { // drums
        if (!tr.drums) break;
        if (tr.drums === 'soft') { if (i % 8 === 0) ev.push({ s: b0 + i, ch: 'kick' }); if (i % 4 === 2) ev.push({ s: b0 + i, ch: 'hat', v: 0.5 }); continue; }
        if (i === 0 || i === 6 || i === 8 || (i === 14 && bar % 2)) ev.push({ s: b0 + i, ch: 'kick' });
        if (i === 4 || i === 12) ev.push({ s: b0 + i, ch: 'snare' });
        if (i % 2 === 0) ev.push({ s: b0 + i, ch: 'hat', v: i % 4 ? 0.6 : 1 });
        if (bar % 8 === 7 && i >= 12) ev.push({ s: b0 + i, ch: 'snare', v: 0.6 }); // fill into the next phrase
      }
    });
    ev.sort((a, b) => a.s - b.s);
    return { ev, steps: tr.bars.length * 16, spb: 60 / tr.bpm / 4 };
  }
  const COMPILED = {}; for (const k in TRACKS) COMPILED[k] = compile(TRACKS[k]);

  // one voice; `R` = { ctx, out, waves, noise } so the same code renders live and offline
  function voice(R, e, t, spb, tr) {
    const c = R.ctx, g = c.createGain();
    g.connect(R.out);
    if (e.ch === 'kick') { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); o.start(t); o.stop(t + 0.18); return; }
    if (e.ch === 'snare' || e.ch === 'hat') {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), d = e.ch === 'snare' ? 0.13 : 0.035;
      s.buffer = R.noise; f.type = e.ch === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = e.ch === 'snare' ? 1800 : 7000;
      const v = (e.ch === 'snare' ? 0.42 : 0.16) * (e.v || 1);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.01); return;
    }
    const o = c.createOscillator(), dur = e.len * spb, f = hz(e.m);
    if (e.ch === 'lead') { if (tr.lead === 'triangle') o.type = 'triangle'; else o.setPeriodicWave(R.waves[tr.lead]); }
    else if (e.ch === 'arp') o.setPeriodicWave(R.waves.p12);
    else o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    if (e.ch === 'lead' && dur > 0.3) { // a little delayed vibrato on long lead notes
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.012, t + dur); lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    const v = e.ch === 'lead' ? tr.leadVol : e.ch === 'arp' ? 0.045 : 0.3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v * (e.ch === 'lead' ? 0.8 : 0.9), t + Math.max(0.01, dur - 0.03)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }

  // jingles: [step(16th), note, length] at their own tempo; played on the music bus, above the (stopped) loop
  const JINGLES = {
    intro: { bpm: 90, lead: 'p25', leadVol: 0.18, notes: [[0, 'A2', 8, 'bass'], [0, 'A3', 2], [2, 'E4', 2], [4, 'A4', 2], [6, 'C5', 2], [8, 'B4', 6], [8, 'E2', 8, 'bass'], [14, 'E5', 10], [14, 'A2', 10, 'bass']], drums: [0, 8, 14] },
    round: { bpm: 160, lead: 'p25', leadVol: 0.17, notes: [[0, 'E5', 1], [1, 'A5', 1], [2, 'C6', 1], [3, 'E6', 3], [0, 'A2', 4, 'bass']], drums: [0] },
    ko: { bpm: 150, lead: 'p25', leadVol: 0.16, notes: [[0, 'E5', 2], [2, 'C5', 2], [4, 'A4', 2], [6, 'E4', 6], [0, 'A2', 8, 'bass'], [6, 'A1', 6, 'bass']], drums: [] },
    victory: { bpm: 150, lead: 'p25', leadVol: 0.18, notes: [[0, 'A4', 1], [1, 'C5', 1], [2, 'E5', 1], [3, 'A5', 3], [6, 'G5', 2], [8, 'F5', 2], [10, 'G5', 2], [12, 'A5', 12],
      [0, 'A2', 6, 'bass'], [6, 'G2', 2, 'bass'], [8, 'F2', 2, 'bass'], [10, 'G2', 2, 'bass'], [12, 'A2', 12, 'bass']], drums: [0, 3, 12] },
  };
  function playJingle(R, name, t0) {
    const J = JINGLES[name]; if (!J) return 0;
    const spb = 60 / J.bpm / 4;
    for (const [s, n, len, ch] of J.notes) voice(R, { ch: ch || 'lead', m: midi(n), len: len - 0.2 }, t0 + s * spb, spb, J);
    for (const s of J.drums) { voice(R, { ch: 'kick' }, t0 + s * spb, spb, J); voice(R, { ch: 'snare', v: 0.7 }, t0 + s * spb, spb, J); }
    return Math.max(...J.notes.map((n) => n[0] + n[2])) * spb;
  }

  // ---------------- lookahead scheduler ----------------
  const LOOKAHEAD = 0.12, TICK = 25;
  const M = {
    wanted: null, track: null, running: false, paused: false, ducked: false, timer: null, step: 0, next: 0, idx: 0, out: null,
    scheduled: 0, starts: 0,
    // play `name` ('fight' | 'title'); safe to call repeatedly (no restart if already playing it)
    start(name) {
      if (this.wanted === name && (this.running || this.paused)) return;
      this.wanted = name; this.paused = false; this.step = 0; this.idx = 0;
      if (ac && !muted) this._begin(name); else this._halt();
    },
    stop() { this.wanted = null; this.paused = false; this._halt(); },
    pause() { if (!this.wanted || this.paused) return; this.paused = true; this._halt(true); },
    resume() { if (!this.paused) return; this.paused = false; if (ac && !muted && this.wanted) this._begin(this.wanted, true); },
    duck(on) { this.ducked = !!on; if (musicBus) musicBus.gain.setTargetAtTime(on ? DUCK_VOL : MUSIC_VOL, ac.currentTime, 0.05); },
    jingle(name) {
      if (!ac || muted) return 0;
      const g = ac.createGain(); g.connect(musicBus); g.gain.value = 1.4; // jingles a touch louder than the loop, still under SFX
      const d = playJingle({ ctx: ac, out: g, waves, noise: getNoise(ac) }, name, ac.currentTime + 0.03);
      setTimeout(() => g.disconnect(), (d + 1) * 1000);
      return d;
    },
    _begin(name, keepPos) {
      this._halt(true);
      const C = COMPILED[name]; if (!C || !ac) return;
      if (!keepPos) { this.step = 0; this.idx = 0; }
      this.track = name; this.running = true; this.starts++;
      this.out = ac.createGain(); this.out.connect(musicBus);
      this.next = ac.currentTime + 0.06;
      this.timer = setInterval(() => this._tick(), TICK);
      this._tick();
    },
    _halt() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null; this.running = false; this.track = null;
      if (this.out) { // fade what is already scheduled, then drop the node (no leaks across rounds/matches)
        const o = this.out; this.out = null;
        try { o.gain.setTargetAtTime(0, ac.currentTime, 0.02); } catch (e) {}
        setTimeout(() => o.disconnect(), 400);
      }
    },
    _tick() {
      const C = COMPILED[this.track]; if (!C || !this.out) return;
      const R = { ctx: ac, out: this.out, waves, noise: getNoise(ac) }, tr = TRACKS[this.track];
      while (this.next < ac.currentTime + LOOKAHEAD) {
        while (this.idx < C.ev.length && C.ev[this.idx].s === this.step) { voice(R, C.ev[this.idx], this.next, C.spb, tr); this.idx++; this.scheduled++; }
        this.next += C.spb; this.step++;
        if (this.step >= C.steps) { this.step = 0; this.idx = 0; }
      }
    },
    get state() {
      return { wanted: this.wanted, track: this.track, running: this.running, schedulerActive: !!this.timer, paused: this.paused,
        ducked: this.ducked, step: this.step, bar: this.step >> 4, scheduled: this.scheduled, starts: this.starts,
        contextState: ac && ac.state, musicGain: musicBus && musicBus.gain.value, masterGain: master && master.gain.value };
    },
    // render the same score offline (used for the WAV preview): sequence = [['jingle','intro'], ['track','fight', seconds], ...]
    async render(seq, rate = 44100) {
      const total = seq.reduce((s, x) => s + (x[0] === 'track' ? x[2] : x[0] === 'gap' ? x[1] : 0), 0) + 4;
      const oc = new OfflineAudioContext(1, Math.ceil(total * rate), rate), b = buses(oc, oc.destination);
      const R = { ctx: oc, out: b.music, waves: b.waves, noise: getNoise(oc) };
      b.music.gain.value = 0.9; let t = 0.05;
      for (const x of seq) {
        if (x[0] === 'jingle') { const g = oc.createGain(); g.gain.value = 1.4; g.connect(b.music); t += playJingle({ ...R, out: g }, x[1], t) + 0.25; }
        else if (x[0] === 'gap') t += x[1];
        else {
          const C = COMPILED[x[1]], tr = TRACKS[x[1]], end = t + x[2];
          for (let loop = 0; t + loop * C.steps * C.spb < end; loop++)
            for (const e of C.ev) { const et = t + (loop * C.steps + e.s) * C.spb; if (et < end) voice(R, e, et, C.spb, tr); }
          t = end;
        }
      }
      const buf = await oc.startRendering();
      return buf.getChannelData(0);
    },
    info: { fight: { bpm: FIGHT.bpm, bars: FIGHT.bars.length }, title: { bpm: TITLE.bpm, bars: TITLE.bars.length } },
  };
  A.music = M;
  // background tab: stop scheduling (setInterval is throttled there anyway); main.js also auto-pauses the fight
  document.addEventListener('visibilitychange', () => { if (document.hidden) M.pause(); else if (!(A.app && A.app.paused)) M.resume(); });
})();
