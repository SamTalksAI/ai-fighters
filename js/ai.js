// AI Fighters - simple CPU: approach, attack, sometimes block/dodge/special, with randomness.
(function () {
  const A = window.AIF;
  A.CPU = class {
    constructor(level = 0.5) { this.level = level; this.plan = A.blankInput(); this.think = 30; }
    update(me, op, g) {
      if (--this.think > 0) return this.plan;
      const p = (this.plan = A.blankInput()), r = Math.random(), dist = Math.abs(op.x - me.x);
      const toward = op.x > me.x ? 'right' : 'left', away = toward === 'right' ? 'left' : 'right';
      const [smin, smax] = me.cfg.special.aiRange;
      const incoming = g.projectiles.some((pr) => pr.owner === op && Math.sign(me.x - pr.x) === pr.dir && Math.abs(me.x - pr.x) < 330);
      this.think = 6 + Math.floor(Math.random() * 14);
      if (incoming && r < 0.6) { r < 0.3 ? (p.down = true) : (p.block = true); this.think = 20; }
      else if (['punch', 'kick', 'special'].includes(op.state) && dist < 220 && r < this.level * 0.7) { p.block = true; this.think = 16; }
      else if (me.specialCd <= 0 && dist >= smin && dist <= smax && r < 0.35) p.special = true;
      else if (dist > 140) { p[toward] = true; if (r < 0.06) p.up = true; }
      else if (r < 0.75) { p[Math.random() < 0.55 ? 'punch' : 'kick'] = true; this.think = 10; }
      else if (r < 0.88) { p[away] = true; }
      return p;
    }
  };
})();
