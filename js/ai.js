// AI Fighters - CPU opponent. A small state machine that plays like a (casual) human: it walks in and out of
// range (footsies), waits, pokes with a cooldown between attacks, blocks a share of attacks it SEES coming
// (perception is delayed by a reaction time), punishes whiffs, anti-airs jump-ins, uses its special at the
// range given by the fighter config (special.aiRange) and backs off so the fight moves around the screen
// instead of pinning the player in the corner. Difficulty ramps up with the round number.
// Fighter-agnostic: everything fighter-specific comes from cfg.stats / cfg.special in AIF.FIGHTERS.
(function () {
  const A = window.AIF;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ATTACK = ['punch', 'kick'];

  A.CPU = class {
    constructor(level = 0.5) {
      this.level = level; // 0..1 base skill; the round number adds on top (see tune)
      this.hist = []; this.mode = 'wait'; this.modeT = 30; this.atkCd = 50; this.cornerT = 0;
      this.seenAtk = -1; this.seenJump = -1; this.punished = -1; this.projSeen = new WeakSet(); this.pressed = 0;
      this.stats = { attacks: 0, blocks: 0, punishes: 0, antiAirs: 0, retreats: 0, specials: 0, supers: 0 };
    }
    // difficulty knobs: round 1 is gentle for a casual phone player, later rounds react faster and block more
    tune(g) {
      const r = (g && g.round) || 1, d = Math.max(0, Math.min(1, this.level * 0.4 + (r - 1) * 0.3));
      return {
        d, reaction: Math.round(lerp(26, 12, d)), block: lerp(0.15, 0.6, d), punish: lerp(0.15, 0.65, d),
        antiAir: lerp(0.25, 0.65, d), atkGap: lerp(120, 36, d), aggro: lerp(0.24, 0.6, d), jitter: lerp(10, 5, d),
        // SUPER: once the meter is full the CPU sits on it for a while (longer at low difficulty), then fires it
        // when it makes sense (in range, opponent grounded, the rush not into a guard), chance per decision
        superHold: lerp(210, 60, d), superP: lerp(0.3, 0.65, d),
      };
    }
    setMode(m, t) { this.mode = m; this.modeT = Math.round(t); if (m === 'retreat') this.stats.retreats++; }

    update(me, op, g) {
      const T = this.tune(g), W = A.W, ATK = A.ATTACKS;
      // ---- perception: what the opponent was doing `reaction` frames ago ----
      this.hist.push({ state: op.state, anim: op.anim, x: op.x, y: op.y, vx: op.vx, vy: op.vy, grounded: op.grounded });
      if (this.hist.length > 40) this.hist.shift();
      const delay = Math.min(this.hist.length - 1, T.reaction + Math.floor(Math.random() * T.jitter));
      const seen = this.hist[this.hist.length - 1 - delay];

      const inp = A.blankInput(), dx = op.x - me.x, dist = Math.abs(dx);
      const toward = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
      const sp = me.cfg.special, [smin, smax] = sp.aiRange || [0, 0];
      if (this.atkCd > 0) this.atkCd--;
      if (this.modeT > 0) this.modeT--;
      const meWall = me.x < 90 || me.x > W - 90, opWall = op.x < 100 || op.x > W - 100;
      this.cornerT = opWall && dist < 230 ? this.cornerT + 1 : Math.max(0, this.cornerT - 2);

      // SUPER bookkeeping: when the meter got full + a random hold before we are willing to use it
      if (me.superReady) { if (this.fullSince == null) { this.fullSince = g.frame; this.superWait = T.superHold * rnd(0.6, 1.5); } }
      else this.fullSince = null;

      if (me.busy) { // mid-attack / hitstun: keep holding block if we were blocking
        if (me.state === 'blockstun') inp.block = true;
        return inp;
      }

      // ---- reactions (interrupt the current plan) ----
      // 1) incoming projectile: decide once per projectile, after the reaction delay
      for (const pr of g.projectiles) {
        if (pr.owner === me || this.projSeen.has(pr)) continue;
        const gap = (me.x - pr.x) * pr.dir;
        if (gap > 0 && gap < 420 - delay * Math.abs(pr.vx) * 0.5) {
          this.projSeen.add(pr); // (a super projectile can't be ducked: block it)
          if (chance(T.block + 0.15)) this.setMode(!pr.multi && chance(0.5) ? 'duck' : 'block', gap / Math.abs(pr.vx) + (pr.multi ? 50 : 8));
        }
      }
      // 1b) the opponent fired a rushing SUPER: block it or jump over the dash (decided once, after the reaction delay)
      if (seen.state === 'super' && op.state === 'super' && op.cfg.super.type === 'rush' && this.seenSuper !== g.frame - op.anim) {
        this.seenSuper = g.frame - op.anim;
        const r = Math.random();
        if (r < T.block) this.setMode('block', 45); else if (r < T.block + 0.2 * T.d) this.setMode('jumpin', 60);
      }
      // 1c) the opponent called a GAMMA RAY: block it, or (skilled, with room) run from the lagging reticle during the telegraph
      if (seen.state === 'super' && op.state === 'super' && op.cfg.super.type === 'beam' && this.seenSuper !== g.frame - op.anim) {
        this.seenSuper = g.frame - op.anim;
        const s = op.cfg.super, left = s.beamAt + s.beamFrames - op.anim, room = Math.max(me.x - 60, W - 60 - me.x);
        if (op.anim < s.lockAt - 4 && room > 160 && chance(0.45 * T.d)) { this.beamDir = me.x - 60 > W - 60 - me.x ? 'left' : 'right'; this.setMode('beamdodge', left); }
        else if (chance(T.block + 0.1)) this.setMode('block', left);
      }
      // 2) the opponent started an attack (seen late, like a human) and we are in its range
      //    (blocking is a faster, more reflexive reaction than choosing a counter-attack)
      const atkId = g.frame - op.anim, bd = Math.min(this.hist.length - 1, Math.round(T.reaction * 0.45) + Math.floor(Math.random() * 4));
      const bseen = this.hist[this.hist.length - 1 - bd];
      if (ATTACK.includes(op.state) || op.state === 'special') this.lastOpAtk = g.frame;
      if ((ATTACK.includes(bseen.state) || bseen.state === 'special') && op.state === bseen.state && dist < 200 && this.seenAtk !== atkId &&
          op.anim <= (ATK[op.state] ? ATK[op.state].startup + ATK[op.state].active : 30) && this.mode !== 'block' && this.mode !== 'duck') {
        this.seenAtk = atkId;
        const r = Math.random();
        if (r < T.block) this.setMode('block', rnd(12, 22));
        else if (r < T.block + 0.12 && !meWall) this.setMode('retreat', rnd(12, 22));
      }
      // 3) whiff punish: opponent is recovering from an attack that missed
      if (ATTACK.includes(op.state) && !op.hasHit && op.anim > ATK[op.state].startup + ATK[op.state].active &&
          dist < 215 && this.punished !== atkId && this.mode !== 'punish') {
        this.punished = atkId;
        if (chance(T.punish)) { this.setMode('punish', 22); this.stats.punishes++; }
      }
      // 4) jump-in: anti-air with a punch when they come down in reach, or walk back under it
      if (seen.state === 'jump' && !seen.grounded && this.seenJump !== atkId && dist < 300 && Math.sign(seen.vx) === -Math.sign(dx)) {
        this.seenJump = atkId;
        if (chance(T.antiAir)) { this.setMode('antiair', 50); this.stats.antiAirs++; }
        else if (chance(0.4)) this.setMode('block', 30);
      }

      // ---- pick a new plan when the current one runs out ----
      if (this.modeT <= 0) this.decide(me, op, g, T, dist, meWall);
      if (this.mode === 'super' && !this.canSuper(me, op, g, dist)) this.mode = 'wait';

      // ---- execute the plan ----
      // spacing judgement: a low-skill CPU misjudges range (and whiffs) more often - it gives the player openings
      if (this.misT == null || --this.misT <= 0) { this.mis = chance(0.45 * (1 - T.d)) ? rnd(25, 60) : 0; this.misT = 40; }
      const reach = { punch: ATK.punch.range + 20 + this.mis, kick: ATK.kick.range + 22 + this.mis };
      const attack = (k) => { inp[k] = true; this.atkCd = T.atkGap + rnd(0, 30); this.stats.attacks++; };
      switch (this.mode) {
        case 'block': inp.block = true; break;
        case 'beamdodge': { // run until the beam has fired past us; if it caught us anyway, guard the rest
          const B = op.beam; if (!B || op.state !== 'super') { this.modeT = 0; break; }
          if (Math.abs(me.x - B.tx) < op.cfg.super.halfWidth + 60 || !B.locked) inp[this.beamDir] = true; else inp.block = op.anim >= op.cfg.super.beamAt;
          break;
        }
        case 'duck': inp.down = true; break;
        case 'wait': break;
        case 'retreat': if (!meWall) inp[away] = true; break;
        case 'approach': if (dist > this.target) inp[toward] = true; else this.modeT = 0; break;
        case 'space': // footsies: hover just outside kick range, small steps in and out
          if (dist > this.target + 25) inp[toward] = true;
          else if (dist < this.target - 25 && !meWall) inp[away] = true;
          else if (chance(0.06)) this.target = rnd(150 + 30 * T.d, 225 + 25 * T.d);
          break;
        case 'poke': // step in, then poke once
          if (dist > reach.kick - 6) inp[toward] = true;
          else { attack(dist < reach.punch - 6 && chance(0.5) ? 'punch' : 'kick'); this.setMode(chance(0.45) ? 'retreat' : 'wait', rnd(14, 34)); }
          break;
        case 'attack':
          if (dist < reach.kick) { attack(dist < reach.punch && chance(0.55) ? 'punch' : 'kick'); this.combo++; }
          this.setMode(this.combo < 2 && chance(0.35) ? 'attack2' : chance(0.4) ? 'retreat' : 'wait', rnd(16, 30));
          break;
        case 'attack2': // second hit of a little string, once the first one recovered
          if (this.modeT < 10 && dist < reach.kick) { attack(chance(0.5) ? 'punch' : 'kick'); this.setMode(chance(0.5) ? 'retreat' : 'wait', rnd(20, 40)); }
          break;
        case 'punish':
          if (dist < reach.kick - 4) { attack(dist < reach.punch ? 'punch' : 'kick'); this.setMode('wait', rnd(10, 20)); }
          else inp[toward] = true;
          break;
        case 'antiair':
          if (op.grounded && this.modeT < 40) this.modeT = 0;
          else if (!op.grounded && dist < 150 && op.vy > 0 && op.y > A.GROUND - 115) { attack('punch'); this.setMode('wait', 18); }
          break;
        case 'jumpin':
          if (me.grounded && this.modeT > 40) { inp.up = true; inp[toward] = true; }
          else if (!me.grounded && dist < 165 && me.vy > 0) { attack('kick'); this.setMode('wait', 30); }
          break;
        case 'super':
          inp.special = true; this.stats.supers++; this.fullSince = null; this.setMode('wait', 30);
          break;
        case 'special':
          if (!me.superReady && me.specialCd <= 0 && me.grounded && dist >= smin && dist <= smax) { inp.special = true; this.stats.specials++; this.atkCd = T.atkGap; }
          this.setMode(chance(0.5) ? 'wait' : 'space', rnd(20, 40));
          break;
      }
      return inp;
    }

    // SUPER is sensible now: full meter held long enough, in the super's range, opponent on the ground and hittable,
    // and (for a rush / beam) not into a guard
    canSuper(me, op, g, dist) {
      const s = me.cfg.super; if (!s || !me.superReady || this.fullSince == null || g.frame - this.fullSince < this.superWait) return false;
      const [a, b] = s.aiRange || [0, 2000];
      return me.grounded && dist >= a && dist <= b && op.grounded && !['ko', 'thrown', 'down'].includes(op.state) && !((s.type === 'rush' || s.type === 'beam') && op.blocking);
    }
    decide(me, op, g, T, dist, meWall) {
      const sp = me.cfg.special, [smin, smax] = sp.aiRange || [0, 0], W = A.W;
      if (this.canSuper(me, op, g, dist) && chance(T.superP)) return this.setMode('super', 1);
      const canSpecial = !me.superReady && me.specialCd <= 0 && dist >= smin && dist <= smax && op.grounded;
      const ready = this.atkCd <= 0;
      this.combo = 0;
      // corner fairness: after ~1.5 s of pressure on a cornered player, usually back off and let them out
      if (this.cornerT > 80 && chance(0.7)) { this.cornerT = 0; return this.setMode('retreat', rnd(50, 100)); }
      // we are the one in the corner: walk out, or jump over sometimes
      if (meWall && dist < 220) return chance(0.15 + 0.1 * T.d) ? this.setMode('jumpin', 60) : this.setMode(ready ? 'attack' : 'block', rnd(10, 20));
      const pick = (opts) => { // weighted random choice
        let s = 0; for (const o of opts) s += o[1];
        let r = Math.random() * s;
        for (const o of opts) if ((r -= o[1]) <= 0) return o;
        return opts[0];
      };
      // a passive opponent (no attacks for ~5 s) gets tested: pokes and pressure become more likely
      const bold = g.frame - (this.lastOpAtk || 0) > 300 ? 1.8 : 1;
      let o;
      if (dist > 300) o = pick([['approach', 0.55], ['special', canSpecial ? 0.3 : 0], ['wait', 0.15]]);
      else if (dist > 175) o = pick([['space', 0.35], ['poke', ready ? T.aggro * 0.7 * bold : 0], ['jumpin', ready ? 0.04 + 0.05 * T.d : 0],
        ['special', canSpecial ? 0.3 : 0], ['wait', 0.18], ['retreat', 0.12]]);
      else o = pick([['attack', ready ? T.aggro * bold : 0], ['special', canSpecial ? 0.35 : 0],
        ['block', g.frame - (this.lastOpAtk || -999) < 50 ? 0.04 + 0.5 * T.block : 0.06], ['retreat', 0.28],
        ['wait', 0.1], ['space', 0.15]]);
      const m = o[0];
      // footsie distance: a gentle round-1 CPU drifts inside the player's reach more often
      this.target = m === 'approach' ? rnd(170 + 30 * T.d, 240 + 20 * T.d) : rnd(150 + 30 * T.d, 225 + 25 * T.d);
      if (bold > 1) this.target -= 40; // creep closer on a passive opponent
      const len = { approach: 90, space: rnd(40, 90), poke: 45, jumpin: 60, special: 1, wait: rnd(12, 40) * (1.3 - T.d * 0.5),
        retreat: rnd(18, 45), attack: 1, block: rnd(12, 24) }[m];
      this.setMode(m, len);
    }
  };
})();
