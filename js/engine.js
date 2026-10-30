// AI Fighters - core engine: fighter physics/combat, rounds, rendering. Fighter-agnostic.
(function () {
  const A = window.AIF;
  const W = 960, H = 540, GROUND = 470, GRAV = 0.8, ROUND_SECS = 60;
  A.W = W; A.H = H; A.GROUND = GROUND;
  // Retro pixel look: the world is simulated in 960x540 units but rendered to a 384x216 canvas (1/2.5 scale),
  // snapped to a limited palette, then upscaled with pixelated CSS.
  const S = 2.5, LW = W / S, LH = H / S;
  // purely visual: sprites are drawn taller than the (unchanged) hurtboxes, so hit sparks / projectiles are
  // drawn at sprite height: visual y = base + (y - base) * VY
  const VY = 1.6;
  A.S = S; A.LW = LW; A.LH = LH;
  const sfx = (n) => A.sfx && A.sfx.play(n);

  const ATK = {
    punch: { startup: 4, active: 4, recovery: 9, damage: 6, chip: 1, range: 112, y: -118, hitstun: 14, push: 5 },
    kick: { startup: 7, active: 5, recovery: 13, damage: 10, chip: 2, range: 136, y: -72, hitstun: 18, push: 8 },
  };
  const BUSY = ['punch', 'kick', 'special', 'hit', 'blockstun', 'thrown', 'down', 'ko'];
  const OUT = ['ko', 'thrown', 'down'];
  A.blankInput = () => ({ left: false, right: false, up: false, down: false, punch: false, kick: false, block: false, special: false });

  class Fighter {
    constructor(cfg, x, facing) { this.cfg = cfg; this.maxHp = cfg.stats.hp; this.reset(x, facing); }
    reset(x, facing) {
      Object.assign(this, { x, y: GROUND, vx: 0, vy: 0, facing, hp: this.maxHp, state: 'idle', anim: 0, timer: 0,
        hasHit: false, fired: false, specialCd: 60, prev: A.blankInput() });
    }
    get grounded() { return this.y >= GROUND; }
    get busy() { return BUSY.includes(this.state); }
    get blocking() { return this.state === 'block' || this.state === 'blockstun'; }
    bodyTop() { return this.y - (this.state === 'crouch' ? 110 : 180); }
    setState(s, timer = 0) { if (this.state !== s) this.anim = 0; this.state = s; this.timer = timer; }

    update(inp, opp, g) {
      const pr = (k) => inp[k] && !this.prev[k];
      this.anim++;
      if (this.specialCd > 0) this.specialCd--;
      if (this.timer > 0) this.timer--;
      const st = this.state;
      if (st === 'punch' || st === 'kick') {
        const a = ATK[st];
        if (this.anim > a.startup && this.anim <= a.startup + a.active && !this.hasHit) this.checkHit(a, opp, g);
        if (this.timer <= 0) this.setState(this.grounded ? 'idle' : 'jump');
      } else if (st === 'special') {
        if (!this.fired && this.anim >= this.cfg.special.fireAt) { this.fired = true; this.cfg.special.run(this, g); }
        if (this.timer <= 0) this.setState('idle');
      } else if (st === 'hit' || st === 'blockstun' || st === 'down') {
        if (this.timer <= 0) this.setState('idle');
      } else if (st === 'thrown') {
        if (this.grounded && this.anim > 5) { this.setState(this.hp <= 0 ? 'ko' : 'down', 30); }
      }

      if (!this.busy) {
        if (this.grounded) this.facing = opp.x >= this.x ? 1 : -1;
        const s = this.cfg.stats;
        if (pr('special') && this.specialCd <= 0 && this.grounded) {
          this.setState('special', this.cfg.special.frames); this.fired = false; this.specialCd = this.cfg.special.cooldown; this.vx = 0;
        } else if (pr('punch') || pr('kick')) {
          const k = pr('punch') ? 'punch' : 'kick', a = ATK[k];
          this.setState(k, a.startup + a.active + a.recovery); this.hasHit = false;
          if (this.grounded) this.vx = 0;
        } else if (this.grounded) {
          if (inp.block) { this.setState('block'); this.vx = 0; }
          else if (inp.down) { this.setState('crouch'); this.vx = 0; }
          else if (inp.up) { this.vy = -s.jump; this.vx = (inp.right - inp.left) * s.speed; this.y -= 1; this.setState('jump'); }
          else if (inp.left || inp.right) { this.vx = (inp.right ? 1 : -1) * s.speed; this.setState('walk'); }
          else { this.vx = 0; this.setState('idle'); }
        }
      }
      this.prev = { ...inp };
      this.physics();
    }
    physics() {
      if (!this.grounded || this.vy < 0) { this.vy += GRAV; this.y += this.vy; }
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
      if (this.grounded && this.state !== 'walk') this.vx *= 0.82;
      this.x = Math.max(40, Math.min(W - 40, this.x + this.vx));
    }
    checkHit(a, opp, g) {
      const dx = (opp.x - this.x) * this.facing, ay = this.y + a.y;
      if (dx > 0 && dx < a.range + 28 && ay >= opp.bodyTop() && ay <= opp.y && !OUT.includes(opp.state)) {
        this.hasHit = true;
        g.hit(opp, this.x, { damage: a.damage * this.cfg.stats.power, chip: a.chip, hitstun: a.hitstun, push: a.push, y: ay, sfx: a === ATK.kick ? 'kick' : 'punch' });
      }
    }
  }

  class Game {
    constructor(cfgA, cfgB, onOver) {
      this.f = [new Fighter(cfgA, 260, 1), new Fighter(cfgB, 700, -1)];
      this.wins = [0, 0]; this.round = 0; this.frame = 0; this.onOver = onOver; this.shake = 0;
      this.startRound();
    }
    startRound() {
      this.round++;
      this.f[0].reset(260, 1); this.f[1].reset(700, -1);
      this.projectiles = []; this.fx = [];
      this.time = ROUND_SECS * 60; this.phase = 'intro'; this.phaseT = 90;
      this.msg = 'ROUND ' + this.round; this.sub = '';
    }
    other(f) { return f === this.f[0] ? this.f[1] : this.f[0]; }

    // shared combat API used by attacks and by fighter specials
    hit(def, fromX, o) {
      if (this.phase !== 'fight' || OUT.includes(def.state)) return;
      const dir = Math.sign(def.x - fromX) || 1;
      const facingAttacker = def.facing === -dir;
      if (def.blocking && facingAttacker && !o.unblockable) {
        def.hp -= o.chip; def.setState('blockstun', 10); sfx('block'); def.vx = dir * o.push * 0.6;
        this.fx.push({ x: def.x - dir * 25, y: o.y || def.y - 110, by: def.y, t: 0, col: '#3cbcfc', block: true });
      } else {
        def.hp -= o.damage; def.setState('hit', o.hitstun); sfx(o.sfx || 'punch'); def.vx = dir * o.push;
        if (!def.grounded) def.vy = -4;
        this.fx.push({ x: def.x - dir * 20, y: o.y || def.y - 110, by: def.y, t: 0, col: '#f8b800' }); this.shake = 6;
      }
      this.checkKO(def, dir);
    }
    checkKO(def, dir) {
      if (def.hp <= 0) {
        def.hp = 0;
        if (def.state !== 'thrown') { def.setState('ko'); def.vy = -8; def.vx = dir * 5; def.y -= 1; }
        this.endRound('KO');
      }
    }
    spawnProjectile(f, o) {
      sfx('rocket');
      const x = f.x + f.facing * (o.xOff || 55);
      this.projectiles.push({ ...o, owner: f, x, x0: x, y: f.y + o.yOff, by: f.y, vx: f.facing * o.speed, dir: f.facing });
    }
    tryGrab(f, o) {
      const opp = this.other(f), dx = (opp.x - f.x) * f.facing;
      if (dx > 0 && dx < o.range && opp.grounded && !OUT.includes(opp.state)) {
        opp.hp -= o.damage * f.cfg.stats.power; opp.setState('thrown'); opp.vy = -13; opp.vx = f.facing * 7; opp.y -= 1;
        this.fx.push({ x: opp.x, y: opp.y - 120, by: opp.y, t: 0, col: '#f878f8', text: 'THROW!' }); this.shake = 10; sfx('throw');
        this.checkKO(opp, f.facing);
        return true;
      }
      return false;
    }

    endRound(kind) {
      if (this.phase !== 'fight') return;
      const [a, b] = this.f, w = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1;
      if (w >= 0) this.wins[w]++;
      sfx('ko');
      this.phase = 'ko'; this.phaseT = 150; this.roundWinner = w;
      this.msg = kind === 'KO' ? 'K.O.!' : 'TIME!';
      this.sub = w >= 0 ? this.f[w].cfg.name + ' wins the round' : 'Draw';
    }

    update(inputs) {
      this.frame++;
      if (this.shake > 0) this.shake--;
      const [a, b] = this.f, blank = A.blankInput();
      if (this.phase === 'intro') {
        if (--this.phaseT <= 0) { this.phase = 'fight'; this.msg = 'FIGHT!'; this.msgT = 40; sfx('round'); }
        return;
      }
      if (this.phase === 'fight') {
        if (this.msgT > 0 && --this.msgT === 0) this.msg = '';
        a.update(inputs[0], b, this); b.update(inputs[1], a, this);
        // keep fighters from overlapping
        if (!OUT.includes(a.state) && !OUT.includes(b.state) && Math.abs(a.y - b.y) < 120) {
          const d = b.x - a.x, min = 134; // pushbox: sprites may touch but never interpenetrate
          if (Math.abs(d) < min) {
            const s = Math.sign(d) || (a.facing > 0 ? 1 : -1), push = (min - Math.abs(d)) / 2;
            a.x -= s * push; b.x += s * push;
            const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x); // at a wall, the free fighter takes the whole push
            if (lo < 40) { a.x += 40 - lo; b.x += 40 - lo; } else if (hi > W - 40) { a.x -= hi - W + 40; b.x -= hi - W + 40; }
          }
        }
        for (const p of this.projectiles) {
          p.x += p.vx;
          const t = this.other(p.owner);
          if (!p.dead && Math.abs(p.x - t.x) < p.w / 2 + 22 && p.y >= t.bodyTop() && p.y <= t.y) {
            p.dead = true; this.hit(t, p.x - p.dir * 10, { damage: p.damage * p.owner.cfg.stats.power, chip: p.chip, hitstun: 20, push: 9, y: p.y, sfx: 'kick' });
          }
          if (p.x < -80 || p.x > W + 80) p.dead = true;
        }
        this.projectiles = this.projectiles.filter((p) => !p.dead);
        if (--this.time <= 0 && this.phase === 'fight') this.endRound('TIME');
      } else if (this.phase === 'ko') {
        a.update(blank, b, this); b.update(blank, a, this);
        if (--this.phaseT <= 0) {
          const champ = this.wins[0] >= 2 ? 0 : this.wins[1] >= 2 ? 1 : -1;
          if (champ >= 0) { this.phase = 'over'; this.onOver && this.onOver(champ); }
          else this.startRound();
        }
      }
      for (const e of this.fx) e.t++;
      this.fx = this.fx.filter((e) => e.t < (e.text ? 40 : 14));
    }

    // ctx = the low-res (LW x LH) canvas context
    draw(ctx) {
      ctx.save();
      const sh = this.shake ? Math.round((Math.random() - 0.5) * this.shake / 2) : 0, vis = (y, by) => by + (y - by) * VY;
      ctx.setTransform(1 / S, 0, 0, 1 / S, sh, sh);
      ctx.imageSmoothingEnabled = false;
      A.drawBackground(ctx, this);
      // the fighter being hit / thrown is drawn first so the attacker's fist overlaps it
      const order = [...this.f].sort((p, q) => (p.state === 'punch' || p.state === 'kick' || p.state === 'special') - (q.state === 'punch' || q.state === 'kick' || q.state === 'special'));
      for (const f of order) A.drawFighter(ctx, f, this);
      for (const p of this.projectiles) p.draw(ctx, { ...p, y: vis(p.y, p.by) }, this.frame);
      for (const e of this.fx) {
        const y = vis(e.y, e.by);
        if (e.text) { A.pixelText(ctx, e.text, e.x, y - e.t * 2, 20, e.col, 'center'); continue; }
        A.drawSpark(ctx, e.x, y, e.t, e.col, e.block);
      }
      ctx.restore();
      A.quantize(ctx);
      this.drawHud(ctx);
    }

    drawHud(ctx) { // drawn after quantize, in low-res pixel coordinates
      const T = A.pixelText, w = 132, cx = LW / 2;
      this.f.forEach((f, i) => {
        // small portrait next to the bar (bruised face when low on health / KO'd)
        A.drawPortrait(ctx, f.cfg, i ? LW - 34 : 2, 3, { size: 32, face: i ? -1 : 1, hurt: f.hp / f.maxHp < 0.3 || f.state === 'ko', bg: '#100818', frame: '#fcfcfc' });
        const x = i ? LW - 40 - w : 40, pct = f.hp / f.maxHp, fw = Math.round(w * pct), al = i ? 'right' : 'left', tx = i ? x + w : x;
        ctx.fillStyle = '#100818'; ctx.fillRect(x - 2, 4, w + 4, 11);
        ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - 1, 5, w + 2, 9);
        ctx.fillStyle = '#a81000'; ctx.fillRect(x, 6, w, 7);
        ctx.fillStyle = pct > 0.3 ? '#f8b800' : '#f83800'; ctx.fillRect(i ? x + w - fw : x, 6, fw, 7);
        ctx.fillStyle = pct > 0.3 ? '#f8d878' : '#f87858'; ctx.fillRect(i ? x + w - fw : x, 6, fw, 2);
        T(ctx, f.cfg.name.toUpperCase(), tx, 18, 8, '#fcfcfc', al);
        const ready = f.specialCd <= 0;
        T(ctx, (i ? 'CPU' : 'P1') + (ready ? ' SP OK' : ''), tx, 28, 8, ready ? '#f878f8' : '#bcbcbc', al);
        for (let k = 0; k < 2; k++) { // round-win pips
          const px = i ? x + k * 9 : x + w - 7 - k * 9;
          ctx.fillStyle = '#000000'; ctx.fillRect(px, 28, 7, 7);
          ctx.fillStyle = this.wins[i] > k ? '#f8b800' : '#545454'; ctx.fillRect(px + 1, 29, 5, 5);
        }
      });
      ctx.fillStyle = '#100818'; ctx.fillRect(cx - 17, 2, 34, 22);
      ctx.fillStyle = '#f8b800'; ctx.fillRect(cx - 17, 2, 34, 1); ctx.fillRect(cx - 17, 23, 34, 1);
      T(ctx, String(Math.ceil(this.time / 60)).padStart(2, '0'), cx, 5, 16, '#fcfcfc', 'center');
      if (this.msg) {
        T(ctx, this.msg, cx, 72, this.msg.length > 6 ? 16 : 32, '#f8b800', 'center', '#e40058');
        if (this.sub) T(ctx, this.sub.toUpperCase(), cx, 116, 8, '#fcfcfc', 'center');
      }
    }
  }
  A.Fighter = Fighter; A.Game = Game; A.ATTACKS = ATK;

  // ---------- 8-bit rendering helpers ----------
  // NES-style palette: every rendered pixel gets snapped to one of these.
  const PAL = ('000000 7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 ' +
    'bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888 545454 ' +
    'f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878 ' +
    'fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc')
    .split(' ').map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)]);
  // a few 16-bit style ramps for the stage (fighters register their own sprite ramps via A.addColors)
  ('100818 181028 241838 302050 402870 583088 1c2c48 283c5c 38506c 50687c 6c8098 3c2c1c 5c4430 141c24 202c38 2c3c4c ' +
    'f8f0a0 d8c060 60e8f8 20a0c8 f86060 c02838 70f070 30b050')
    .split(' ').forEach((h) => PAL.push([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)]));
  A.PALETTE = PAL;
  const qcache = new Map();
  A.addColors = function (list) {
    for (const h of list) {
      const c = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      if (!PAL.some((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2])) PAL.push(c);
    }
    qcache.clear();
  };
  function nearest(key) {
    const r = key >> 16, g = (key >> 8) & 255, b = key & 255; let best = 0, bd = 1e9;
    for (let i = 0; i < PAL.length; i++) {
      const p = PAL[i], d = 3 * (r - p[0]) ** 2 + 4 * (g - p[1]) ** 2 + 2 * (b - p[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return PAL[best];
  }
  A.quantize = function (ctx) {
    const { width: w, height: h } = ctx.canvas, img = ctx.getImageData(0, 0, w, h), d = img.data;
    if (qcache.size > 60000) qcache.clear();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let c = qcache.get(key); if (!c) { c = nearest(key); qcache.set(key, c); }
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  // chunky pixel text (bundled Press Start 2P font, 8px grid), with a hard drop shadow
  A.pixelText = function (ctx, text, x, y, size, color, align = 'left', shadow = '#000000') {
    ctx.font = size + 'px "Press Start 2P", monospace'; ctx.textAlign = align; ctx.textBaseline = 'top';
    const o = Math.max(1, size / 8);
    ctx.fillStyle = shadow; ctx.fillText(text, Math.round(x) + o, Math.round(y) + o);
    ctx.fillStyle = color; ctx.fillText(text, Math.round(x), Math.round(y));
  };

  // SF2-style pixel hit spark (yellow star burst on hit, blue on block)
  A.drawSpark = function (ctx, x, y, t, col, block) {
    const K = S, cx = Math.round(x / K), cy = Math.round(y / K), r = block ? 4 + t : 6 + t * 1.6, c2 = t % 4 < 2 ? '#fcfcfc' : col;
    const pt = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect((cx + dx) * K, (cy + dy) * K, K, K); };
    if (t > 11) return;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + (block ? 0 : 0.2), l = r * (i % 2 ? 0.6 : 1);
      for (let k = t < 6 ? 0 : Math.floor(l * 0.4); k < l; k++) pt(Math.round(Math.cos(a) * k), Math.round(Math.sin(a) * k), k > l - 2 ? col : c2);
    }
    if (t < 4) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) < 3) pt(dx, dy, '#fcfcfc');
  };
})();
