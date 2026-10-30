// AI Fighters - retro 8-bit sound effects with Web Audio (square/triangle/noise). No audio files.
// The AudioContext is only created after the first user gesture (browser autoplay rules).
(function () {
  const A = window.AIF;
  let ac = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('aif-muted') === '1'; } catch (e) {}

  function unlock() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (ac.state === 'suspended') ac.resume();
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  function env(t, vol, dur) {
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(ac.destination); return g;
  }
  function tone(type, f0, f1, dur, vol = 0.12, delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    o.connect(env(t, vol, dur)); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, cutoff = 2000, delay = 0) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = cutoff;
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
      return muted;
    },
  };
})();
