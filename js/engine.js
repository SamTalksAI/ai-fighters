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
  const BUSY = ['punch', 'kick', 'special', 'super', 'hit', 'blockstun', 'thrown', 'down', 'ko'];
  // SUPER meter (one super per fighter, fired with the normal special input when the meter is full).
  // Gains: per point of damage dealt / taken, flat per blocked hit. Persists across the rounds of a match, reset per match.
  // freeze = activation freeze (frames) with the darkened screen + portrait cut-in.
  // cpu = gain multiplier for the CPU side (g.f[1]) so its supers stay slightly rarer than the player's.
  const SUPER = (A.SUPER = { max: 100, deal: 0.36, take: 0.26, block: 9, blockAtk: 5, roundLoss: 20, attack: 0, special: 3, cpu: 0.85, freeze: 45 }); // tuned by tests/test_super_pacing.py: active player first full ~20-25 s of fight time
  const clampX = (x) => Math.max(40, Math.min(W - 40, x));
  // super move types; each fighter's cfg.super picks one and supplies its numbers (see js/fighters.js)
  const SUPER_TYPES = (A.SUPER_TYPES = {
    // a beam from orbit: a satellite tracks the target with a lagging reticle, locks, then a vertical beam slams down at the
    // locked x for `beamFrames`, hitting every `every` frames (multi-hit, chip when blocked). Fair: jumping does not help,
    // but running away during the whole telegraph (the reticle lags + a short gap after the lock) can dodge it.
    beam: {
      update(f, opp, g, s) {
        const B = f.beam || (f.beam = { tx: clampX(opp.x), locked: false, hits: 0, landed: 0, burn: -99 });
        const t = f.anim, bt = t - s.beamAt;
        if (t === s.chargeAt) sfx(s.chargeSfx);
        if (t < s.lockAt) B.tx += (clampX(opp.x) - B.tx) * s.track;
        else if (!B.locked) { B.locked = true; sfx('lock'); }
        if (bt === 0) sfx(s.beamSfx);
        if (bt >= 0 && bt < s.beamFrames) {
          g.shake = Math.max(g.shake, bt < 6 ? 12 : 5);
          if (bt % s.every === 0 && B.hits < s.hits) {
            B.hits++;
            const last = B.hits === s.hits;
            if (g.phase === 'fight' && Math.abs(opp.x - B.tx) <= s.halfWidth && !OUT.includes(opp.state)) {
              const blocked = opp.blocking && opp.facing === -(Math.sign(opp.x - f.x) || 1);
              g.hit(opp, f.x, { attacker: f, damage: (s.damage / s.hits) * f.cfg.stats.power, chip: s.chip / s.hits,
                hitstun: last ? 34 : s.every + 6, push: last ? 9 : 1.2, y: opp.y - 90 - (B.hits % 2) * 30, isSuper: true, sfx: last ? 'boom' : 'zap' });
              B.landed++; if (!blocked) B.burn = t;
              if (last) { g.shake = 16; g.fx.push({ x: B.tx, y: GROUND - 20, by: GROUND, t: 0, col: '#00bfff' }); }
            }
          }
        }
        if (f.timer <= 0) { f.beam = null; f.setState('idle'); }
      },
    },
    // a big multi-hit projectile: slows down while grinding through the target, chip damage when blocked
    projectile: {
      update(f, opp, g, s) {
        if (!f.fired && f.anim >= s.fireAt) {
          f.fired = true;
          g.spawnProjectile(f, Object.assign({}, s.projectile, { multi: true, hitsLeft: s.hits, every: s.every, hitCd: 0,
            damage: s.damage / s.hits, chip: s.chip / s.hits, isSuper: true, sfx: s.launchSfx }));
        }
        if (f.timer <= 0) f.setState('idle');
      },
    },
    // dash (glitchy teleport-rush) into a multi-hit combo that ends in a throw; blockable on contact, avoidable by jumping
    rush: {
      update(f, opp, g, s) {
        const R = f.rush || (f.rush = { ph: 'wind', t: 0, k: 0 });
        R.t++;
        if (g.phase !== 'fight') { f.rush = null; f.setState('idle'); return; }
        if (R.ph === 'wind') { if (R.t >= s.windup) { R.ph = 'dash'; R.t = 0; sfx(s.dashSfx || 'glitch'); } }
        else if (R.ph === 'dash') {
          f.x = clampX(f.x + f.facing * s.dashSpeed); f.vx = 0;
          const dx = (opp.x - f.x) * f.facing;
          if (dx > 0 && dx <= s.reach && opp.y > GROUND - 30 && !OUT.includes(opp.state)) {
            if (opp.blocking && opp.facing === -f.facing) { // blocked: chip + pushback, then a long, punishable recovery
              g.hit(opp, f.x, { attacker: f, damage: 0, chip: s.chip, hitstun: 0, push: 9, y: f.y - 110, isSuper: true });
              R.ph = 'recover'; R.t = 0;
            } else { R.ph = 'combo'; R.t = 0; R.k = 0; sfx('punch'); }
          } else if (R.t >= s.dashFrames) { R.ph = 'recover'; R.t = 0; }
        } else if (R.ph === 'combo') {
          // hold the victim in front of us (walls respected)
          opp.x = clampX(f.x + f.facing * 138); f.x = clampX(opp.x - f.facing * 138); opp.vx = 0;
          if (R.t % s.hitEvery === 1) {
            if (R.k < s.hits.length) {
              const kick = R.k % 2 === 1;
              g.hit(opp, f.x, { attacker: f, damage: s.hits[R.k] * f.cfg.stats.power, chip: 0, hitstun: s.hitEvery + 12, push: 0,
                y: f.y - (kick ? 72 : 118), unblockable: true, isSuper: true, sfx: kick ? 'kick' : 'punch' });
              R.k++; if (s.hitFx) s.hitFx(f, opp, g, R.k, kick); // visual only (light burst)
            } else {
              if (g.tryGrab(f, { range: 400, damage: s.throwDamage, text: s.finisher, isSuper: true }) && s.slamFx) s.slamFx(f, opp, g); // visual only
              R.ph = 'recover'; R.t = 0; R.thrown = true;
            }
          }
        } else if (R.ph === 'recover') { if (R.t >= (R.thrown ? s.recoverHit : s.recover)) { f.rush = null; f.setState('idle'); } }
      },
    },
  });
  const OUT = ['ko', 'thrown', 'down'];
  A.blankInput = () => ({ left: false, right: false, up: false, down: false, punch: false, kick: false, block: false, special: false });

  class Fighter {
    constructor(cfg, x, facing) { this.cfg = cfg; this.maxHp = cfg.stats.hp; this.meter = 0; this.supers = 0; this.reset(x, facing); }
    reset(x, facing) {
      Object.assign(this, { x, y: GROUND, vx: 0, vy: 0, facing, hp: this.maxHp, state: 'idle', anim: 0, timer: 0,
        hasHit: false, fired: false, specialCd: 60, rush: null, beam: null, prev: A.blankInput() }); // meter is kept (per match)
    }
    get grounded() { return this.y >= GROUND; }
    get busy() { return BUSY.includes(this.state); }
    // calling down the GAMMA RAY: can't be interrupted until the beam is over (punishable in the short recovery after)
    get invuln() { const s = this.cfg.super; return this.state === 'super' && s.type === 'beam' && this.anim < s.beamAt + s.beamFrames; }
    get superReady() { return !!this.cfg.super && this.meter >= SUPER.max; }
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
      } else if (st === 'super') {
        SUPER_TYPES[this.cfg.super.type].update(this, opp, g, this.cfg.super);
      } else if (st === 'hit' || st === 'blockstun' || st === 'down') {
        if (this.timer <= 0) this.setState('idle');
      } else if (st === 'thrown') {
        if (this.grounded && this.anim > 5) { this.setState(this.hp <= 0 ? 'ko' : 'down', 30); }
      }

      if (!this.busy) {
        if (this.grounded) this.facing = opp.x >= this.x ? 1 : -1;
        const s = this.cfg.stats;
        if (pr('special') && this.grounded && this.superReady) { // full meter: the special input fires the SUPER
          this.meter = 0; this.supers++; this.setState('super', this.cfg.super.frames || 999); this.fired = false; this.rush = null; this.beam = null; this.vx = 0;
          g.superFlash(this);
        } else if (pr('special') && this.specialCd <= 0 && this.grounded) {
          this.setState('special', this.cfg.special.frames); this.fired = false; this.specialCd = this.cfg.special.cooldown; this.vx = 0; g.gainMeter(this, SUPER.special);
        } else if (pr('punch') || pr('kick')) {
          const k = pr('punch') ? 'punch' : 'kick', a = ATK[k];
          this.setState(k, a.startup + a.active + a.recovery); this.hasHit = false; g.gainMeter(this, SUPER.attack);
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
        g.hit(opp, this.x, { attacker: this, damage: a.damage * this.cfg.stats.power, chip: a.chip, hitstun: a.hitstun, push: a.push, y: ay, sfx: a === ATK.kick ? 'kick' : 'punch' });
      }
    }
  }

  class Game {
    constructor(cfgA, cfgB, onOver) {
      this.f = [new Fighter(cfgA, 260, 1), new Fighter(cfgB, 700, -1)];
      this.wins = [0, 0]; this.round = 0; this.frame = 0; this.onOver = onOver; this.shake = 0; this.freeze = 0; this.freezeT = 0; this.superBy = null;
      this.startRound();
    }
    startRound() {
      this.round++;
      this.f[0].reset(260, 1); this.f[1].reset(700, -1);
      this.projectiles = []; this.fx = []; this.vfx = []; this.freeze = 0; this.superBy = null;
      this.time = ROUND_SECS * 60; this.phase = 'intro'; this.phaseT = 90;
      this.msg = 'ROUND ' + this.round; this.sub = ''; this.endT = 0; this.roundWinner = -1;
    }
    other(f) { return f === this.f[0] ? this.f[1] : this.f[0]; }

    // shared combat API used by attacks and by fighter specials
    // SUPER meter gain (fight phase only); plays a blip when it becomes full
    gainMeter(f, n) {
      if (!f || !f.cfg.super || this.phase !== 'fight' || !(n > 0)) return;
      if (f === this.f[1]) n *= SUPER.cpu * (this.cpuMeterMul == null ? 1 : this.cpuMeterMul); // + difficulty level (main.js)
      const was = f.meter; f.meter = Math.min(SUPER.max, f.meter + n);
      if (was < SUPER.max && f.meter >= SUPER.max) { f.fullAt = this.frame; sfx('meter'); }
    }
    // super activation: brief freeze, darkened screen + portrait cut-in with the super's name (drawn in draw())
    superFlash(f) {
      if (this.msg === 'FIGHT!') this.msg = ''; // a super right after the bell: drop the FIGHT! banner so it never covers the move
      this.freeze = SUPER.freeze; this.freezeT = 0; this.superBy = f; this.shake = 0;
      this.fx.push({ x: f.x, y: f.y - 120, by: f.y, t: 0, col: '#fcfcfc' });
      sfx(f.cfg.super.sting || 'super');
    }
    hit(def, fromX, o) {
      if (this.phase !== 'fight' || OUT.includes(def.state) || def.invuln) return;
      const dir = Math.sign(def.x - fromX) || 1;
      const facingAttacker = def.facing === -dir;
      const blocked = def.blocking && facingAttacker && !o.unblockable;
      const src = o.src || o.attacker;
      if (blocked) { this.gainMeter(def, SUPER.block); if (!o.isSuper) this.gainMeter(src, SUPER.blockAtk + o.chip * SUPER.deal); }
      else { this.gainMeter(def, o.damage * SUPER.take); if (!o.isSuper) this.gainMeter(src, o.damage * SUPER.deal); }
      this.pushback(def, o.attacker, dir, o.push * (blocked ? 0.85 : 1));
      if (blocked) {
        def.hp -= o.chip; def.setState('blockstun', 10); sfx('block');
        this.fx.push({ x: def.x - dir * 25, y: o.y || def.y - 110, by: def.y, t: 0, col: '#3cbcfc', block: true });
      } else {
        def.hp -= o.damage; def.setState('hit', o.hitstun); sfx(o.sfx || 'punch');
        if (!def.grounded) def.vy = -4;
        this.fx.push({ x: def.x - dir * 20, y: o.y || def.y - 110, by: def.y, t: 0, col: '#f8b800' }); this.shake = 6;
      }
      this.checkKO(def, dir);
    }
    // pushback on hit / block: the defender slides away; when the defender is against the wall the ATTACKER
    // takes the rest of the push (as in arcade fighters), so corner pressure cannot be held forever.
    pushback(def, att, dir, push) {
      def.vx = dir * push;
      if (!att) return;
      const slide = push / (1 - 0.82), room = dir > 0 ? W - 40 - def.x : def.x - 40; // friction 0.82 -> total slide
      const rest = Math.max(0, slide - room) * (1 - 0.82);
      if (rest > 0.2 && att.grounded) att.vx = -dir * Math.min(rest * 1.15, push * 1.15);
    }
    checkKO(def, dir) {
      if (def.hp <= 0) {
        def.hp = 0;
        if (def.state !== 'thrown') { def.setState('ko'); def.vy = -8; def.vx = dir * 5; def.y -= 1; }
        this.endRound('KO');
      }
    }
    spawnProjectile(f, o) {
      sfx(o.sfx || 'rocket');
      const x = f.x + f.facing * (o.xOff || 55);
      this.projectiles.push({ ...o, owner: f, x, x0: x, y: f.y + o.yOff, by: f.y, vx: f.facing * o.speed, dir: f.facing });
    }
    tryGrab(f, o) {
      const opp = this.other(f), dx = (opp.x - f.x) * f.facing;
      if (dx > 0 && dx < o.range && opp.grounded && !OUT.includes(opp.state) && !opp.invuln) {
        const dmg = o.damage * f.cfg.stats.power;
        this.gainMeter(opp, dmg * SUPER.take); if (!o.isSuper) this.gainMeter(f, dmg * SUPER.deal);
        opp.hp -= dmg; opp.setState('thrown'); opp.vy = -13; opp.vx = f.facing * 7; opp.y -= 1;
        this.fx.push({ x: opp.x, y: opp.y - 120, by: opp.y, t: 0, col: '#f878f8', text: o.text || 'THROW!' }); this.shake = o.isSuper ? 16 : 10; sfx('throw');
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
      this.matchPoint = w >= 0 && this.wins[w] >= 2;
      if (w >= 0 && !this.matchPoint) this.gainMeter(this.f[1 - w], SUPER.roundLoss); // comeback: the round loser carries a meter bonus into the next round
      this.phase = 'ko'; this.phaseT = this.matchPoint ? 270 : 150; this.roundWinner = w; this.endT = 0;
      this.msg = kind === 'KO' ? 'K.O.!' : 'TIME!';
      this.sub = w >= 0 ? this.f[w].cfg.name + ' wins the round' : 'Draw';
    }

    update(inputs) {
      this.frame++;
      if (this.freeze > 0) { // super activation freeze: nothing moves, the round clock stops
        this.freeze--; this.freezeT++; for (const e of this.fx) e.t++;
        if (!this.freeze) this.superBy = null;
        return;
      }
      if (this.shake > 0) this.shake--;
      if (this.vfx.length) { // visual-only super effects that outlive the move (e.g. the TAKEDOWN slam); never touch gameplay state
        for (const e of this.vfx) { e.t++; if (e.update) e.update(e, this); }
        this.vfx = this.vfx.filter((e) => e.t < e.life);
      }
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
          const t = this.other(p.owner), touch = () => Math.abs(p.x - t.x) < p.w / 2 + 22 && p.y >= t.bodyTop() && p.y <= t.y;
          if (p.multi) { // super projectile: several hits while it grinds through the target
            if (p.hitCd > 0) p.hitCd--;
            const on = touch() && !OUT.includes(t.state);
            p.x += on ? p.vx * (p.slow || 0.3) : p.vx;
            if (on && p.hitCd <= 0 && !p.dead) {
              const last = --p.hitsLeft <= 0;
              this.hit(t, p.x - p.dir * 10, { src: p.owner, damage: p.damage * p.owner.cfg.stats.power, chip: p.chip, hitstun: last ? 30 : p.every + 10,
                push: last ? 11 : 2.2, y: p.y, sfx: last ? 'boom' : 'kick', isSuper: true });
              p.hitCd = p.every; this.shake = last ? 14 : 5;
              if (last) { p.dead = true; for (let k = 0; k < 3; k++) this.fx.push({ x: p.x + p.dir * (k * 30 - 20), y: p.y + (k - 1) * 22, by: p.by, t: -k * 3, col: '#f83800' }); }
            }
          } else {
            p.x += p.vx;
            if (!p.dead && touch()) {
              p.dead = true; this.hit(t, p.x - p.dir * 10, { src: p.owner, damage: p.damage * p.owner.cfg.stats.power, chip: p.chip, hitstun: 20, push: 9, y: p.y, sfx: 'kick' });
            }
          }
          const m = (p.w || 0) / 2 + 40; if (p.x < -m || p.x > W + m) p.dead = true;
        }
        this.projectiles = this.projectiles.filter((p) => !p.dead);
        if (--this.time <= 0 && this.phase === 'fight') this.endRound('TIME');
      } else if (this.phase === 'ko') {
        this.endT++;
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
      for (const f of this.f) if (f.state === 'super' && f.cfg.super.drawBack) f.cfg.super.drawBack(ctx, f, this); // e.g. darkened stage, satellite
      for (const e of this.vfx) if (e.drawBack) e.drawBack(ctx, e, this);
      for (const f of order) {
        if (f.state === 'super' && A.drawSuperFx) A.drawSuperFx(ctx, f, this, 'under');
        A.drawFighter(ctx, f, this);
        if (f.state === 'super' && A.drawSuperFx) A.drawSuperFx(ctx, f, this, 'over');
      }
      for (const f of this.f) if (f.state === 'super' && f.cfg.super.drawTop) f.cfg.super.drawTop(ctx, f, this); // e.g. the beam itself
      for (const e of this.vfx) if (e.drawTop) e.drawTop(ctx, e, this);
      if (A.drawTears) for (const f of this.f) A.drawTears(ctx, f, this);
      for (const p of this.projectiles) p.draw(ctx, { ...p, y: vis(p.y, p.by) }, this.frame);
      for (const e of this.fx) {
        const y = vis(e.y, e.by);
        if (e.text) { A.pixelText(ctx, e.text, e.x, y - e.t * 2, 20, e.col, 'center'); continue; }
        if (e.t >= 0) A.drawSpark(ctx, e.x, y, e.t, e.col, e.block);
      }
      if (this.freeze > 0 && this.superBy) this.drawCutin(ctx, sh);
      ctx.restore();
      A.quantize(ctx);
      this.drawHud(ctx);
    }

    // SF-style super activation: screen darkens (flash first), the attacker stays lit, a coloured band sweeps across with the
    // fighter's portrait sliding through it and the super's name in big condensed title type. Low-res pixel coordinates.
    drawCutin(ctx, sh) {
      const f = this.superBy, s = f.cfg.super, t = this.freezeT, i = this.f.indexOf(f), dir = i ? -1 : 1, D = SUPER.freeze;
      const ease = (u) => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = t < 3 ? 'rgba(252,252,252,0.85)' : 'rgba(0,0,8,0.68)'; ctx.fillRect(0, 0, LW, LH);
      ctx.setTransform(1 / S, 0, 0, 1 / S, sh, sh); A.drawFighter(ctx, f, this); ctx.setTransform(1, 0, 0, 1, 0, 0); // the attacker stays lit
      const open = ease(t / 7) * (1 - ease((t - (D - 7)) / 7)), cy = 96, hh = Math.round(36 * open);
      if (hh < 2) return;
      const top = cy - hh, bot = cy + hh, col = s.color || '#e45c10', col2 = s.color2 || '#f8b800';
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, LW, bot - top); ctx.clip();
      ctx.fillStyle = col; ctx.fillRect(0, top, LW, bot - top);
      for (let k = 0; k < 14; k++) { // speed lines streaming against the slide
        const y = top + ((k * 37) % (bot - top)), len = 30 + (k * 23) % 50, x = (((k * 71 - dir * t * 14) % (LW + 80)) + LW + 80) % (LW + 80) - 40;
        ctx.fillStyle = k % 3 ? col2 : '#fcfcfc'; ctx.fillRect(x, y, len, 1);
      }
      // portrait slides in fast, drifts, then shoots out the far side
      const P = 92, inX = ease(t / 9), outX = ease((t - (D - 9)) / 9);
      const px0 = i ? LW + 10 : -P - 10, pxRest = i ? LW - P - 26 : 26, pxOut = i ? -P - 10 : LW + 10;
      const px = Math.round(px0 + (pxRest - px0) * inX + dir * t * 0.4 + (pxOut - pxRest) * outX);
      A.drawPortrait(ctx, f.cfg, px, cy - P / 2 + 6, { size: 128, scale: P / 128, face: dir, frame: '#fcfcfc' });
      ctx.restore();
      ctx.fillStyle = '#fcfcfc'; ctx.fillRect(0, top - 1, LW, 1); ctx.fillRect(0, bot, LW, 1);
      ctx.fillStyle = '#100818'; ctx.fillRect(0, top - 2, LW, 1); ctx.fillRect(0, bot + 1, LW, 1);
      // super name, slides in from the opposite side
      const nameIn = ease((t - 4) / 10), side = i ? 'right' : 'left', nx = i ? LW - P - 38 - (1 - nameIn) * 60 : P + 38 + (1 - nameIn) * 60;
      ctx.globalAlpha = nameIn * (1 - outX);
      A.pixelText(ctx, 'SUPER!', nx, cy - 30, 8, '#fcfcfc', side);
      const TF = '"Bebas Neue", Impact, "Arial Narrow", sans-serif', nm = s.name.toUpperCase();
      ctx.letterSpacing = '2px'; ctx.font = '44px ' + TF;
      const fit = Math.min(44, Math.floor(44 * (LW - P - 70) / ctx.measureText(nm).width));
      ctx.font = fit + 'px ' + TF; ctx.textAlign = side; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#100818'; ctx.fillText(nm, nx + 2, cy + 18 + 2);
      ctx.fillStyle = col2; ctx.fillText(nm, nx, cy + 18);
      ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
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
        if (f.cfg.super) { // SUPER meter under the name line; flashes when full
          const mw = 72, mx = i ? x + w - mw : x, my = 38, full = f.meter >= SUPER.max, mf = Math.round(mw * f.meter / SUPER.max);
          const fl = full && (this.frame >> 2) % 2;
          ctx.fillStyle = full ? (fl ? '#fcfcfc' : '#f8b800') : '#100818'; ctx.fillRect(mx - 2, my - 2, mw + 4, 10);
          ctx.fillStyle = '#100818'; ctx.fillRect(mx - 1, my - 1, mw + 2, 8);
          ctx.fillStyle = '#24188c'; ctx.fillRect(mx, my, mw, 6);
          const c1 = full ? ['#f8b800', '#f878f8', '#00e8d8'][(this.frame >> 3) % 3] : '#0078f8', c2 = full ? '#fcfcfc' : '#3cbcfc';
          ctx.fillStyle = c1; ctx.fillRect(i ? mx + mw - mf : mx, my, mf, 6);
          ctx.fillStyle = c2; ctx.fillRect(i ? mx + mw - mf : mx, my, mf, 2);
          for (let k = 1; k < 4; k++) { ctx.fillStyle = '#100818'; ctx.fillRect(mx + Math.round(mw * k / 4), my + 4, 1, 2); }
          const lx = i ? mx - 6 : mx + mw + 6, la = i ? 'right' : 'left';
          T(ctx, full ? 'SUPER!' : 'SUPER', lx, my - 1, 8, full ? (fl ? '#fcfcfc' : '#f8b800') : '#7c7c7c', la);
          if (full && !i && A.superKeyHint && this.phase === 'fight' && (this.frame >> 4) % 2) T(ctx, A.superKeyHint, mx, my + 10, 8, '#f8b800', 'left');
        }
        for (let k = 0; k < 2; k++) { // round-win pips
          const px = i ? x + k * 9 : x + w - 7 - k * 9;
          ctx.fillStyle = '#000000'; ctx.fillRect(px, 28, 7, 7);
          ctx.fillStyle = this.wins[i] > k ? '#f8b800' : '#545454'; ctx.fillRect(px + 1, 29, 5, 5);
        }
      });
      ctx.fillStyle = '#100818'; ctx.fillRect(cx - 17, 2, 34, 22);
      ctx.fillStyle = '#f8b800'; ctx.fillRect(cx - 17, 2, 34, 1); ctx.fillRect(cx - 17, 23, 34, 1);
      T(ctx, String(Math.ceil(this.time / 60)).padStart(2, '0'), cx, 5, 16, '#fcfcfc', 'center');
      if (this.msg && !(this.freeze > 0)) {
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
    'f8f0a0 d8c060 60e8f8 20a0c8 f86060 c02838 70f070 30b050 ' +
    '00bfff 1e5bff 0b2fa8 7fe8ff c8f4ff ff2bd6 ff7af0 2be8ff 2a0a4a')
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
