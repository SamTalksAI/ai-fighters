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

  // character select cards are built from the roster config
  A.FIGHTERS.forEach((cfg) => {
    const b = document.createElement('button');
    b.className = 'card'; b.id = 'pick-' + cfg.id;
    b.innerHTML = `<canvas width="136" height="116"></canvas><b>${cfg.name}</b><small>${cfg.bio}</small>
      <small>Special: ${cfg.special.name}</small><small>SPD ${cfg.stats.speed} · PWR ${cfg.stats.power}</small>`;
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

  function startMatch(cfg) {
    app.player = cfg;
    app.cpuCfg = A.FIGHTERS.find((f) => f !== cfg); // with more fighters: random pick from the others
    app.cpu = new A.CPU(0.5);
    app.game = new A.Game(cfg, app.cpuCfg, onOver);
    app.vsT = VS_FRAMES; A.sfx.play('round');
    show('fight');
  }
  // VS screen: both big portraits slide in before round 1 (any key / tap skips it)
  const VS_FRAMES = 130;
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
  const skipVs = () => { if (app.screen === 'fight' && app.vsT > 0 && app.vsT < VS_FRAMES - 10) app.vsT = 0; };
  addEventListener('keydown', skipVs);
  addEventListener('pointerdown', skipVs);
  function onOver(champ) {
    const g = app.game;
    $('over-title').textContent = g.f[champ].cfg.name + ' wins!';
    $('over-sub').textContent = (champ === 0 ? 'You win! ' : 'CPU wins. ') + g.wins[0] + ' - ' + g.wins[1];
    setTimeout(() => show('over'), 300);
  }

  const click = (id, fn) => ($(id).onclick = () => { A.sfx.play('select'); fn(); });
  click('btn-start', () => show('select'));
  click('btn-replay', () => startMatch(app.player));
  click('btn-change', () => show('select'));
  const muteBtn = $('btn-mute');
  const muteLabel = () => (muteBtn.textContent = A.sfx.muted ? 'SOUND OFF' : 'SOUND ON');
  muteBtn.onclick = () => { A.sfx.toggle(); muteLabel(); muteBtn.blur(); };
  muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  muteLabel();
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && app.screen === 'title') { A.sfx.play('select'); show('select'); }
    if (e.code === 'KeyM') { A.sfx.toggle(); muteLabel(); }
  });
  A.initTouch();
  ctx.imageSmoothingEnabled = false;

  // fixed 60 Hz simulation step, render every animation frame
  let last = performance.now(), acc = 0;
  function loop(now) {
    acc = Math.min(acc + (now - last), 100); last = now;
    while (acc >= 1000 / 60) {
      acc -= 1000 / 60;
      const g = app.game;
      if (app.screen === 'fight' && app.vsT > 0) { app.vsT--; continue; }
      if (app.screen === 'fight' && g && g.phase !== 'over') {
        const cpuIn = app.cpuEnabled ? app.cpu.update(g.f[1], g.f[0], g) : A.blankInput();
        g.update([A.readInput(), cpuIn]);
      }
    }
    if (app.game && app.screen === 'fight' && app.vsT > 0) drawVs(ctx, app.game, VS_FRAMES - app.vsT);
    else if (app.game) app.game.draw(ctx);
    else if (!app.bgDrawn) { ctx.setTransform(1 / A.S, 0, 0, 1 / A.S, 0, 0); A.drawBackground(ctx, null); A.quantize(ctx); ctx.setTransform(1, 0, 0, 1, 0, 0); app.bgDrawn = true; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
