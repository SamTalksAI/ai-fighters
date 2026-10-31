// AI Fighters - screens, layout and main loop.
(function () {
  const A = window.AIF;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d', { willReadFrequently: true }), stage = $('stage');
  const isTouch = /[?&]touch=1/.test(location.search) || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');

  const app = (A.app = { screen: 'title', game: null, player: null, cpuCfg: null, cpu: null, cpuEnabled: true });

  function show(name) {
    app.screen = name;
    if (name !== 'fight') setPaused(false, true);
    if (name === 'title' || name === 'select') A.music.start('title'); // calmer menu loop (starts after the first gesture)
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === 'scr-' + name));
    document.body.classList.toggle('fighting', name === 'fight');
    layout();
  }

  function layout() {
    const portraitTouch = isTouch && innerHeight > innerWidth;
    const availH = portraitTouch ? innerHeight - 260 : innerHeight;
    const scale = Math.min(innerWidth / A.W, availH / A.H);
    stage.style.width = Math.floor(A.W * scale) + 'px';
    stage.style.height = Math.floor(A.H * scale) + 'px';
  }
  addEventListener('resize', layout);
  layout();
  A.music.start('title'); // pending until the first tap/key unlocks audio

  // character select cards are built from the roster config
  A.FIGHTERS.forEach((cfg) => {
    const b = document.createElement('button');
    b.className = 'card'; b.id = 'pick-' + cfg.id;
    b.innerHTML = `<canvas width="136" height="116"></canvas><b>${cfg.name}</b><small>${cfg.bio}</small>
      <small>Special: ${cfg.special.name}</small>${cfg.super ? `<small class="sup">Super: ${cfg.super.name}</small>` : ''}<small>SPD ${cfg.stats.speed} · PWR ${cfg.stats.power}</small>`;
    // low-res pixel preview, same renderer + palette as in the fight
    const c = b.querySelector('canvas').getContext('2d', { willReadFrequently: true });
    A.loadArt([cfg]).then(() => { // drawn once the image art is in (falls back to procedural if it failed)
      c.setTransform(1 / A.S, 0, 0, 1 / A.S, 0, 0); c.imageSmoothingEnabled = false;
      A.drawFighter(c, { cfg, x: 100 * A.S, y: 112 * A.S, facing: -1, state: 'idle', anim: 0 });
      A.quantize(c);
      A.drawPortrait(c, cfg, 2, 26, { size: 64, face: 1, bg: '#24188c', frame: '#f8b800' });
    });
    b.onclick = () => { A.sfx.play('select'); startMatch(cfg); };
    $('cards').appendChild(b);
  });

  function startMatch(cfg, opts = {}) {
    clearTimeout(app.overTimer);
    app.player = cfg;
    app.cpuCfg = A.FIGHTERS.find((f) => f !== cfg); // with more fighters: random pick from the others
    app.cpu = new A.CPU(0.5);
    app.game = new A.Game(cfg, app.cpuCfg, onOver);
    app.lastPhase = null; app.matchId = (app.matchId || 0) + 1;
    // intro cinematic (each fighter walks across, name in big title type), then the short VS card; a restart skips both
    app.introT = opts.restart ? 0 : INTRO_FRAMES;
    app.vsT = opts.restart ? 0 : VS_FRAMES; if (opts.restart) A.sfx.play('round');
    A.music.stop(); if (app.introT) A.music.jingle('intro');
    show('fight');
  }
  // ---- intro cinematic: black screen, letterbox bars, each fighter walks across in profile while the name comes in ----
  const SHOT = 140, INTRO_FRAMES = SHOT * 2;
  A.INTRO = { SHOT, FRAMES: INTRO_FRAMES };
  const TITLE_FONT = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
  if (document.fonts && document.fonts.load) document.fonts.load('48px "Bebas Neue"').catch(() => {});
  function drawIntro(ctx, g, t) {
    const LW = canvas.width, LH = canvas.height, i = t < SHOT ? 0 : 1, lt = t - i * SHOT, cfg = g.f[i].cfg;
    const dir = i ? -1 : 1, Z = 1.5, bar = Math.round(Math.min(1, t / 12) * 22), feet = LH - 24;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, LW, LH);
    // dim stage floor + spotlight so the walk reads as a shot, not a sprite on black
    ctx.fillStyle = '#100818'; ctx.fillRect(0, feet - 2, LW, LH - feet + 2);
    ctx.fillStyle = '#181028'; ctx.fillRect(0, feet - 2, LW, 1);
    // the fighter, scaled up, walking across (player left -> right, CPU right -> left)
    const x = i ? LW + 40 - lt * 1.75 : -40 + lt * 1.75, fake = { cfg, x: 0, y: A.GROUND, facing: dir, vx: dir, state: 'walk', anim: lt, hp: 1, maxHp: 1 };
    ctx.setTransform(Z / A.S, 0, 0, Z / A.S, Math.round(x), Math.round(feet - Z * A.GROUND / A.S));
    ctx.imageSmoothingEnabled = false;
    A.drawFighter(ctx, fake, null);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // name: tall condensed title type, letter-spaced, slides + fades in; on the opposite side of the walker
    const nameIn = Math.max(0, Math.min(1, (lt - 18) / 22)), out = Math.max(0, Math.min(1, (lt - (SHOT - 14)) / 14));
    const side = i ? 'left' : 'right', nx = i ? 22 - (1 - nameIn) * 30 : LW - 22 + (1 - nameIn) * 30;
    ctx.globalAlpha = nameIn * (1 - out);
    T(ctx, i ? 'CPU' : 'PLAYER 1', nx, 46, 8, '#bcbcbc', side);
    const nm = cfg.name.toUpperCase();
    ctx.letterSpacing = '3px'; ctx.font = '56px ' + TITLE_FONT;
    const fit = Math.min(56, Math.floor(56 * 210 / ctx.measureText(nm).width)); // long names shrink to fit the half-frame
    ctx.font = fit + 'px ' + TITLE_FONT; ctx.textAlign = side; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#a81000'; ctx.fillText(nm, nx + 2, 104 + 2);
    ctx.fillStyle = '#f8b800'; ctx.fillText(nm, nx, 104);
    const nw = ctx.measureText(nm).width; ctx.letterSpacing = '0px';
    const lw = nw * Math.max(0, Math.min(1, (lt - 30) / 20));
    if (lw > 0) { ctx.fillStyle = '#e40058'; ctx.fillRect(i ? nx : nx - lw, 110, lw, 2); }
    const tag = ((cfg.intro && cfg.intro.tagline) || cfg.special.name).toUpperCase();
    if (lt > 44) {
      ctx.globalAlpha = Math.min(1, (lt - 44) / 16) * (1 - out);
      const lines = []; tag.split(' ').forEach((w) => { const l = lines[lines.length - 1]; if (l != null && (l + ' ' + w).length <= 24) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); });
      lines.slice(0, 2).forEach((l, k) => T(ctx, l, nx, 118 + k * 11, 8, '#fcfcfc', side));
    }
    ctx.globalAlpha = 1;
    // fade from/to black between shots
    const fade = Math.max(0, 1 - lt / 10, (lt - (SHOT - 8)) / 8);
    if (fade > 0) { ctx.globalAlpha = Math.min(1, fade); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }
    A.quantize(ctx);
    // letterbox bars (after quantize: pure black) + skip hint
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, LW, bar); ctx.fillRect(0, LH - bar, LW, bar);
    if (bar > 1) { ctx.fillStyle = '#24188c'; ctx.fillRect(0, bar - 1, LW, 1); ctx.fillRect(0, LH - bar, LW, 1); }
    if ((t >> 4) % 2) T(ctx, 'TAP TO SKIP', LW / 2, 7, 8, '#7c7c7c', 'center');
  }
  const T = (...a) => A.pixelText(...a);
  // VS screen: both big portraits slide in before round 1 (any key / tap skips it)
  const VS_FRAMES = 80;
  function drawVs(ctx, g, t) {
    const LW = canvas.width, LH = canvas.height, T = A.pixelText, e = Math.min(1, t / 18), sl = Math.round((1 - e) * 140);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#100818'; ctx.fillRect(0, 0, LW, LH);
    for (let y = 0; y < LH; y += 2) { // two-colour diagonal split, scanlined
      const sx = LW / 2 + 26 - y * 0.25;
      ctx.fillStyle = y % 4 ? '#0000bc' : '#0058f8'; ctx.fillRect(0, y + 1, sx, 1);
      ctx.fillStyle = y % 4 ? '#a80020' : '#e40058'; ctx.fillRect(sx, y + 1, LW - sx, 1);
    }
    ctx.fillStyle = '#100818'; ctx.fillRect(0, 0, LW, 22); ctx.fillRect(0, LH - 30, LW, 30);
    const P = 128, py = 34;
    A.drawPortrait(ctx, g.f[0].cfg, 22 - sl, py, { face: 1, frame: '#fcfcfc' });
    A.drawPortrait(ctx, g.f[1].cfg, LW - 22 - P + sl, py, { face: -1, frame: '#fcfcfc' });
    T(ctx, g.f[0].cfg.name.toUpperCase(), 22 - sl, LH - 24, 8, '#f8b800', 'left');
    T(ctx, 'P1', 22 - sl, 8, 8, '#fcfcfc', 'left');
    T(ctx, g.f[1].cfg.name.toUpperCase(), LW - 22 + sl, LH - 24, 8, '#f8b800', 'right');
    T(ctx, 'CPU', LW - 22 + sl, 8, 8, '#fcfcfc', 'right');
    T(ctx, g.f[0].cfg.special.name.toUpperCase(), 22 - sl, LH - 12, 8, '#bcbcbc', 'left');
    T(ctx, g.f[1].cfg.special.name.toUpperCase(), LW - 22 + sl, LH - 12, 8, '#bcbcbc', 'right');
    if (t > 14) T(ctx, 'VS', LW / 2, 84 + (t < 24 ? (24 - t) * 3 : 0), 32, '#f8b800', 'center', '#e40058');
    if (t > 40 && (t >> 4) % 2) T(ctx, 'GET READY', LW / 2, 130, 8, '#fcfcfc', 'center');
  }
  // one tap / key skips the whole pre-fight sequence (intro cinematic + VS card)
  const skipVs = (e) => {
    if (app.screen !== 'fight' || app.paused || (e && e.target && e.target.closest && e.target.closest('#btn-mute,#btn-pause'))) return;
    if (app.introT > 0 && app.introT < INTRO_FRAMES - 10) { app.introT = 0; app.vsT = 0; A.music.stop(); }
    else if (!app.introT && app.vsT > 0 && app.vsT < VS_FRAMES - 10) app.vsT = 0;
  };
  addEventListener('keydown', (e) => { if (!['Escape', 'KeyP', 'KeyM'].includes(e.code)) skipVs(e); });
  addEventListener('pointerdown', skipVs);
  function onOver(champ) {
    const g = app.game;
    $('over-title').textContent = g.f[champ].cfg.name + ' wins!';
    $('over-sub').textContent = (champ === 0 ? 'You win! ' : 'CPU wins. ') + g.wins[0] + ' - ' + g.wins[1];
    app.overTimer = setTimeout(() => { show('over'); A.music.start('title'); }, 300);
  }

  // ---- pause menu (button, Esc / P, auto on hidden tab): freezes simulation, timers and AI, pauses the music ----
  const pauseEl = $('pause'), pauseBtns = [...pauseEl.querySelectorAll('[data-act]')];
  app.paused = false; app.pauseSel = 0;
  function canPause() { return app.screen === 'fight' && app.game && app.game.phase !== 'over'; }
  function setPaused(on, silent) {
    on = !!on && canPause();
    if (on === !!app.paused) return;
    app.paused = on; pauseEl.classList.toggle('on', on); document.body.classList.toggle('paused', on);
    if (A.clearInput) A.clearInput(); // no stuck keys / d-pad / latched taps across the menu
    if (on) { app.pauseSel = 0; markSel(); A.music.pause(); if (!silent) A.sfx.play('pause'); }
    else { A.music.resume(); last = performance.now(); acc = 0; }
  }
  app.setPaused = setPaused;
  function markSel() { pauseBtns.forEach((b, i) => b.classList.toggle('sel', i === app.pauseSel)); }
  function pauseAction(act) {
    A.sfx.play('select');
    if (act === 'resume') setPaused(false);
    else if (act === 'restart') { setPaused(false, true); startMatch(app.player, { restart: true }); }
    else if (act === 'menu') { setPaused(false, true); clearTimeout(app.overTimer); app.game = null; app.bgDrawn = false; app.introT = app.vsT = 0; show('title'); }
  }
  pauseBtns.forEach((b, i) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('pointermove', () => { if (app.pauseSel !== i) { app.pauseSel = i; markSel(); } });
    b.onclick = (e) => { e.stopPropagation(); pauseAction(b.dataset.act); };
  });
  const pauseBtn = $('btn-pause');
  pauseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  pauseBtn.onclick = () => { setPaused(!app.paused); pauseBtn.blur(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (canPause()) { setPaused(!app.paused); e.preventDefault(); } return; }
    if (!app.paused) return;
    if (e.code !== 'KeyM') e.stopImmediatePropagation(); // menu keys don't reach the fighter input
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { app.pauseSel = (app.pauseSel + pauseBtns.length - 1) % pauseBtns.length; markSel(); A.sfx.play('block'); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { app.pauseSel = (app.pauseSel + 1) % pauseBtns.length; markSel(); A.sfx.play('block'); }
    else if (e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'Space') { e.preventDefault(); pauseAction(pauseBtns[app.pauseSel].dataset.act); }
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden && canPause()) setPaused(true, true); });

  const click = (id, fn) => ($(id).onclick = () => { A.sfx.play('select'); fn(); });
  click('btn-start', () => show('select'));
  click('btn-replay', () => startMatch(app.player));
  click('btn-change', () => show('select'));
  const muteBtn = $('btn-mute');
  const muteLabel = () => (muteBtn.textContent = A.sfx.muted ? 'SOUND OFF' : 'SOUND ON');
  muteBtn.onclick = () => { A.sfx.toggle(); muteLabel(); muteBtn.blur(); };
  muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  muteLabel();
  // creator links open X in a new tab; never let the tap reach the game (skip/start handlers)
  document.querySelectorAll('.credit a').forEach((a) => ['pointerdown', 'click', 'keydown'].forEach((ev) => a.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'click') setTimeout(() => a.blur(), 0); })));
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && app.screen === 'title' && !app.paused && !(e.target && e.target.closest && e.target.closest('a'))) { A.sfx.play('select'); show('select'); }
    if (e.code === 'KeyM') { A.sfx.toggle(); muteLabel(); }
  });
  A.initTouch();
  ctx.imageSmoothingEnabled = false;

  // fixed 60 Hz simulation step, render every animation frame
  let last = performance.now(), acc = 0;
  // music follows the fight: loop starts on FIGHT!, stops with a KO jingle, victory jingle on the deciding KO
  function musicHooks(g) {
    if (g.phase !== app.lastPhase) {
      if (g.phase === 'intro') A.music.jingle('round');
      if (g.phase === 'fight') A.music.start('fight');
      if (g.phase === 'ko') { A.music.stop(); }
      app.lastPhase = g.phase;
    }
    if (g.phase === 'ko' && g.endT === 40) A.music.jingle(g.matchPoint ? 'victory' : 'ko');
    const frz = g.freeze > 0; // duck the music under the super activation sting
    if (frz !== !!app.superDuck) { app.superDuck = frz; A.music.duck(frz); }
  }
  // SP button / I key turn into an obvious glowing SUPER state while the player's meter is full
  const spBtn = document.getElementById('btn-special');
  function superButton() {
    const g = app.game, on = !!(g && app.screen === 'fight' && g.phase !== 'over' && g.f[0].superReady);
    if (on !== !!app.superOn) { app.superOn = on; spBtn.classList.toggle('super', on); spBtn.querySelector('.lbl').textContent = on ? 'SUPER' : 'SP'; }
    if (app.superDuck && !(g && app.screen === 'fight')) { app.superDuck = false; A.music.duck(false); }
    A.superKeyHint = document.body.classList.contains('touch') ? '' : 'PRESS I: SUPER!';
  }
  function loop(now) {
    acc = Math.min(acc + (now - last), 100); last = now;
    if (app.paused) acc = 0; // frozen: no simulation, no timers, no AI
    while (acc >= 1000 / 60) {
      acc -= 1000 / 60;
      const g = app.game;
      if (app.screen === 'fight' && app.introT > 0) { app.introT--; continue; }
      if (app.screen === 'fight' && app.vsT > 0) { app.vsT--; continue; }
      if (app.screen === 'fight' && g && g.phase !== 'over') {
        const cpuIn = app.cpuEnabled ? app.cpu.update(g.f[1], g.f[0], g) : A.blankInput();
        g.update([A.readInput(), cpuIn]);
        musicHooks(g);
      }
    }
    superButton();
    document.body.classList.toggle('cine', app.screen === 'fight' && (app.introT > 0 || app.vsT > 0));
    if (app.game && app.screen === 'fight' && app.introT > 0) drawIntro(ctx, app.game, INTRO_FRAMES - app.introT);
    else if (app.game && app.screen === 'fight' && app.vsT > 0) drawVs(ctx, app.game, VS_FRAMES - app.vsT);
    else if (app.game) app.game.draw(ctx);
    else if (!app.bgDrawn) { ctx.setTransform(1 / A.S, 0, 0, 1 / A.S, 0, 0); A.drawBackground(ctx, null); A.quantize(ctx); ctx.setTransform(1, 0, 0, 1, 0, 0); app.bgDrawn = true; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
