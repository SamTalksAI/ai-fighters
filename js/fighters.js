// AI Fighters - roster. Adding a fighter = add ONE config object below: gameplay config + `sprite` data.
// Art: `sprite.images` (img/sprites/<id>/sprite.js: one pixel-art PNG per pose) and `sprite.portrait`
// (img/portraits/portraits.js). If a pose image is missing, js/sprites.js falls back to the procedural SF2-style
// body built from the ramps / build / head grid / pose data below. Parody caricatures only: no photos, logos or trademarks.
(function () {
  const A = (window.AIF = window.AIF || {});

  // generic toy rocket (no logos): nose cone, porthole, red band, swept fins, nozzle. Flame + smoke are drawn procedurally.
  const ROCKET = [
    '...........oRRRRooo...............................',
    '...........oRRRRRRRoooo...........................',
    '...........oRRRRRRRRRRRooo........................',
    '...........oRRRRRRRRRRRRRRooooooooooooooo.........',
    '..........oooWWWWWWRRWWWWWWWWWWWWWWWWWrrrooo......',
    '.........ogggwwwwwwRRwwwwwwwwwwbwwwwwwrrrrrroo....',
    '.........ogggwwwwwwRRwwwwwwwwwccbwwwwwRRRRRRRRoo..',
    '.........ogggddddddRRdwwwwwwwwbbbwwwwwRRRRRRRRRRo.',
    '.........oGGGwwwwwwRRwwwwwwwwwwbwwwwwwRRRRRRRRoo..',
    '.........oGGGggggggddgggggggggggggggggddddddoo....',
    '..........oodggggggddgggggggggggggggggdddooo......',
    '...........odddddddddddoooooooooooooooooo.........',
    '...........odddddddddoo...........................',
    '...........oddddddooo.............................',
    '...........oddddoo................................',
  ];
  const ROCKET_COLS = { o: '#100818', R: '#d82800', r: '#f86858', d: '#8c1800', W: '#fcfcfc', w: '#d8d8e8', g: '#9898b0', G: '#606078',
    b: '#3c5c9c', c: '#78c8f8', F: '#f8d878', f: '#f87818', y: '#fcfcfc', s: '#c0c0c8', S: '#888898', T: '#585868' };
  const P = A.HEADS; // procedural fallback heads only

  // small hand-held rocket prop for the wind-up pose (the projectile itself is bigger)
  const ROCKET_PROP = [
    '.....oo................',
    '....oRRo.......oooo....',
    '....oRRRoooooooowwwoo..',
    '.ooooooowwwwwwwwbbwwRRo.',
    'oFFfoggwwwwwwwwbccbwwRRo',
    '.ooooooowwwwwwwwbbwwRRo.',
    '....oRRRoooooooooooooo..',
    '....oRRo................',
    '.....oo.................',
  ];



  A.FIGHTERS = [
    {
      id: 'musk', name: 'Elon Musk', bio: 'Rocket guy. Posts at 3am.',
      intro: { tagline: 'Next stop: Mars. First stop: your face.' }, // intro cinematic subtitle (optional)
      stats: { hp: 100, speed: 4.4, jump: 15.5, power: 1.0 },
      special: {
        name: 'Mars Rocket', frames: 40, fireAt: 14, cooldown: 150, aiRange: [180, 2000],
        run: (f, g) => g.spawnProjectile(f, { speed: 9, damage: 14, chip: 3, w: 110, h: 40, yOff: -125, xOff: 90, draw: drawRocket }),
      },
      // SUPER (special input with a full meter): GAMMA RAY from orbit. Musk points at the sky, a satellite tracks the
      // opponent (lagging reticle), locks at `lockAt`, then a vertical beam slams down at `beamAt` for `beamFrames`,
      // `hits` hits (one every `every` frames). Total damage = damage * power (~32%); blocked = `chip` total.
      // Jumping does not help; running away during the whole telegraph can dodge it (reticle lag + gap after the lock).
      super: {
        name: 'Gamma Ray', type: 'beam', frames: 114, chargeAt: 4, lockAt: 26, beamAt: 38, beamFrames: 60, every: 12, hits: 5,
        track: 0.1, halfWidth: 76, damage: 32, chip: 8, aiRange: [0, 2000], color: '#00a800', color2: '#b8f818',
        chargeSfx: 'gammaCharge', beamSfx: 'gammaBeam', drawBack: drawGammaBack, drawTop: drawGammaTop,
      },
      sprite: {
        ramps: {
          skin: ['#f0c098', '#d89c70', '#b07450'], hair: ['#523a26', '#34241a', '#1c140c'],
          shirt: ['#585868', '#2c2c38', '#141418'], pants: ['#5878b8', '#344c88', '#1c2850'],
          boots: ['#80603c', '#4c3424', '#24180c'], eye: ['#f8f8f8', '#4c6c5c', '#100818'], mouth: ['#d89070', '#904838', '#501c10'],
        },
        legend: Object.assign({ r: '#d82800', x: '#c8c8d0', R: '#d82800', g: '#a0a0b0', b: '#3c5c9c', c: '#78c8f8', F: '#f8b800', f: '#f83800' }, P.musk.headLegend),
        // image-generator art (img/): one PNG per pose + per-fighter pose remaps; procedural body below is the fallback
        images: A.SPRITES.musk, imageMap: { spWind: 'special', spLaunch: 'punch' },
        anchors: { kneelEye: [13, -50] }, // eye in kneel.png (low-res px from the feet): where the defeat tears spurt from
        portrait: A.PORTRAIT_ART.musk,
        build: { thigh: 24, shin: 23, upper: 15, fore: 14, rThigh: [7, 5], rShin: [5, 3.6], calf: 1, rUpper: [4.6, 3.4], bicep: 1.5,
          rFore: [4, 3], forearm: 1, fist: 3.8, delt: 6.2, sleeve: 5.2, sleeveLen: 0.5, shoulder: 14, chest: 10.5, waist: 7, seat: 7.4,
          neck: 4, neckLen: 5, shFront: 5, shBack: 7, rBoot: 4.2, bootTop: 0.7, foot: 6 },
        head: P.musk.head, // facing right, 3/4 view: swept-back receding dark hair, broad jaw, hooded eyes, smirk
        grids: { rocket: ROCKET_PROP },
        // tiny abstract pixel rocket on the T-shirt (not a logo)
        decals(d) {
          const { J, S } = d, c = add(add(J.sh, J.u, -15), J.p, 4), x = S.legend.x, r = S.legend.r;
          [[0, -2], [0, -1], [-1, 0], [0, 0], [1, 0], [0, 1], [-1, 2], [1, 2]].forEach(([a, b]) => d.px(c[0] + a, c[1] + b, x));
          d.px(c[0], c[1] + 3, r);
        },
        specialPose: (t, sp) => (t < sp.fireAt ? 'spWind' : t < sp.fireAt + 14 ? 'spLaunch' : 'punch0'),
        superPose: (f, s) => (f.anim < 2 || f.anim >= s.beamAt + s.beamFrames + 6 ? 'punch0' : 'win'), // fist to the sky: calling the satellite
        poses: {
          spWind: { hip: [-5, -46], sh: [-7, -78], ff: [16, -4], fb: [-15, -4], hf: [20, -74], hb: [-18, -103], prop: { grid: 'rocket', anchor: [12, 4], hand: 'hb' } },
          spLaunch: { hip: [2, -46], sh: [9, -78], ff: [21, -4], fb: [-12, -4], hf: [42, -82], hb: [4, -66] },
          win: { hip: [0, -50], sh: [0, -82], ff: [9, -4], fb: [-9, -4], hf: [17, -114], hb: [-7, -55] }, // fist pump
        },
      },
    },
    {
      id: 'zuck', name: 'Mark Zuckerberg', bio: 'Jiu-jitsu enjoyer. Loves a metaverse.',
      intro: { tagline: 'Blue belt in the metaverse.' },
      stats: { hp: 100, speed: 4.0, jump: 14.5, power: 1.1 },
      special: {
        name: 'Jiu-Jitsu Throw', frames: 40, fireAt: 8, cooldown: 150, aiRange: [0, 150],
        run: (f, g) => g.tryGrab(f, { range: 150, damage: 20 }),
      },
      // SUPER: glitchy VR dash (afterimages) into a 3-hit jiu-jitsu combo (unblockable once it connects) ending in a throw.
      // Blocked on contact = chip + long recovery; a jump goes over the dash. Total ~ (4+4+5+14) * power 1.1 = ~30%.
      super: {
        name: 'Metaverse Takedown', type: 'rush', windup: 6, dashFrames: 24, dashSpeed: 15, reach: 150, hits: [4, 4, 5], hitEvery: 9,
        throwDamage: 14, chip: 6, recover: 34, recoverHit: 22, finisher: 'TAKEDOWN!', aiRange: [140, 420], glitch: true,
        color: '#0058f8', color2: '#3cbcfc', dashSfx: 'glitch',
      },
      sprite: {
        ramps: {
          skin: ['#fce0cc', '#f0c4a4', '#d8a080'], hair: ['#8a6440', '#644428', '#3c2818'],
          shirt: ['#d8d8e0', '#a4a4b0', '#68687c'], pants: ['#6888c8', '#3c5c9c', '#20305c'],
          boots: ['#f8f8f8', '#c0c0c8', '#707080'], eye: ['#f8f8f8', '#58a8f8', '#100818'], mouth: ['#e8a090', '#b06858', '#683830'],
          belt: ['#585858', '#242424', '#0c0c0c'],
        },
        legend: P.zuck.headLegend,
        images: A.SPRITES.zuck, imageMap: { spGrab: 'grab', spHeave: 'heave' },
        anchors: { kneelEye: [17, -49] },
        portrait: A.PORTRAIT_ART.zuck,
        build: { thigh: 24, shin: 23, upper: 15, fore: 14, rThigh: [6.6, 4.8], rShin: [4.8, 3.5], calf: 0.9, rUpper: [4.3, 3.2], bicep: 1.3,
          rFore: [3.8, 2.9], forearm: 0.9, fist: 3.6, delt: 5.8, sleeve: 5, sleeveLen: 0.48, shoulder: 13, chest: 10, waist: 6.8, seat: 7.2,
          neck: 3.8, neckLen: 5, shFront: 5, shBack: 6.5, rBoot: 4, bootTop: 0.88, foot: 6 },
        head: P.zuck.head, // facing right, 3/4 view: short curly Caesar crop, round face, big light-blue eyes
        grids: {},
        // jiu-jitsu nod: black belt tied around the waist, knot + two hanging ends
        decals(d) {
          const { J, R } = d, a = add(add(J.hip, J.u, 4), J.p, -9), b = add(add(J.hip, J.u, 4), J.p, 9);
          d.group([d.cap(a, b, 1.8, 1.8, R.belt)]);
          const k = add(add(J.hip, J.u, 4), J.p, 6);
          d.group([d.cap(k, add(k, J.u, -1), 2, 2, R.belt), d.cap(add(k, J.p, -1), add(add(k, J.u, -8), J.p, -2), 1.1, 1, R.belt),
            d.cap(add(k, J.p, 1), add(add(k, J.u, -7), J.p, 2.5), 1.1, 1, R.belt)]);
        },
        specialPose: (t, sp) => (t < sp.fireAt ? 'spGrab' : t < sp.fireAt + 18 ? 'spHeave' : 'punch0'),
        superPose: (f, s) => {
          const R = f.rush;
          if (!R || R.ph === 'wind' || R.ph === 'dash') return 'spGrab';
          if (R.ph === 'combo') return R.t % s.hitEvery < 6 && R.t > 0 ? (R.k % 2 ? 'punch1' : 'kick1') : 'punch0';
          return R.thrown && R.t < 18 ? 'spHeave' : 'punch0';
        },
        poses: {
          spGrab: { hip: [2, -44], sh: [11, -73], ff: [21, -4], fb: [-12, -4], hf: [36, -66], hb: [30, -62], armsFront: true },
          spHeave: { hip: [-2, -42], sh: [-9, -73], ff: [18, -4], fb: [-17, -4], hf: [-8, -100], hb: [1, -98], armsFront: true, head: [1, 1] },
          win: { hip: [0, -50], sh: [1, -82], ff: [10, -4], fb: [-10, -4], hf: [-3, -66], hb: [10, -68], armsFront: true }, // arms crossed
        },
      },
    },
  ];

  // ---- SUPER: GAMMA RAY from orbit (drawn in low-res px; ctx transform = world -> low-res) ----
  // satellite: generic flat-panel comms sat (no logos), two solar wings, gamma emitter underneath. 46 x 12 low-res px.
  const SAT = (() => {
    const rows = [];
    for (let r = 0; r < 12; r++) {
      let row = '';
      for (let c = 0; c < 46; c++) {
        const wing = (c <= 15 || c >= 30) && r >= 1 && r <= 7, body = c >= 18 && c <= 27 && r <= 8;
        if (wing) row += r === 1 || r === 7 || c === 0 || c === 15 || c === 30 || c === 45 ? 'k' : c % 4 === 3 || r === 4 ? 'G' : (c % 4 === 0 && (r === 2 || r === 5)) ? 'B' : 'b';
        else if ((c === 16 || c === 17 || c === 28 || c === 29) && (r === 3 || r === 4)) row += 'g';
        else if (body) row += r === 0 || r === 8 || c === 18 || c === 27 ? 'k' : r <= 2 ? 'w' : r === 5 ? 'y' : 'g';
        else if (r === 9 && c >= 20 && c <= 25) row += 'G';
        else if (r === 10 && c >= 21 && c <= 24) row += 'e';
        else if (r === 11 && c >= 22 && c <= 23) row += 'E';
        else row += '.';
      }
      rows.push(row);
    }
    return rows;
  })();
  const SAT_COLS = { k: '#100818', b: '#24188c', B: '#3cbcfc', G: '#545464', g: '#a4a4b4', w: '#fcfcfc', y: '#f8b800' };
  const GR = { dark: '#005800', mid: '#00a800', hi: '#58d854', lime: '#b8f818', pale: '#d8f878', white: '#fcfcfc', red: '#f83800' };
  const SAT_Y = 44, EMIT_Y = SAT_Y + 24, FLOOR_Y = () => Math.round(A.GROUND / A.S); // satellite (drawn 2x: 92 x 24 low-res px) sits just under the HUD
  const gammaBox = (ctx) => { const K = A.S; return (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) * K, Math.round(y) * K, Math.max(1, Math.round(w)) * K, Math.max(1, Math.round(h)) * K); }; };
  function gammaDark(f, s) { // stage dim level 0..1
    const t = f.anim, end = s.beamAt + s.beamFrames;
    return t < 10 ? t / 10 : t < end ? 1 : Math.max(0, 1 - (t - end) / 12);
  }
  // under the fighters: darkened stage, satellite, uplink waves from Musk's fist, targeting laser
  function drawGammaBack(ctx, f, g) {
    const s = f.cfg.super, B = f.beam, t = f.anim, K = A.S, box = gammaBox(ctx); if (!B) return;
    const dark = gammaDark(f, s), bt = t - s.beamAt, firing = bt >= 0 && bt < s.beamFrames;
    ctx.fillStyle = `rgba(0,0,16,${0.74 * dark})`; ctx.fillRect(-40, -40, A.W + 80, A.H + 80);
    if (firing) { ctx.fillStyle = 'rgba(0,120,0,0.12)'; ctx.fillRect(-40, -40, A.W + 80, A.H + 80); }
    const sx = Math.round(B.tx / K), drop = Math.max(0, 1 - t / 10), sy = Math.round(SAT_Y - 34 * drop * drop);
    // uplink chevrons rising from Musk's raised fist
    if (t >= 2 && t < s.lockAt + 4) for (let k = 0; k < 3; k++) {
      const a = (t * 2 + k * 9) % 27, ux = Math.round(f.x / K) + f.facing * 5, uy = Math.round(f.y / K) - 108 - a; // just above the raised fist
      const w = 3 + (a >> 3), c = a < 14 ? GR.lime : GR.mid;
      for (let i = 0; i <= w; i++) { box(ux - i, uy + i, 1, 1, c); box(ux + i, uy + i, 1, 1, c); }
    }
    // satellite (emitter glows hotter as it charges)
    const heat = t < s.beamAt ? (t >> 2) % 2 ? GR.lime : GR.hi : GR.white;
    const cols = Object.assign({ e: heat, E: t < s.beamAt ? GR.mid : GR.pale }, SAT_COLS);
    for (let r = 0; r < SAT.length; r++) for (let c = 0; c < SAT[r].length; c++) { const col = cols[SAT[r][c]]; if (col) box(sx - 46 + c * 2, sy + r * 2, 2, 2, col); }
    box(sx - 1, sy - 5, 1, 5, SAT_COLS.G); // antenna + blinking beacon
    if (t < s.beamAt && (t >> 3) % 2) box(sx - 2, sy - 7, 3, 3, GR.red);
    // targeting laser (dashed) from the emitter to the reticle
    if (t >= s.chargeAt && t < s.beamAt) {
      const ry = Math.round((A.GROUND - 95) / K), col = B.locked ? (t % 4 < 2 ? GR.red : GR.white) : GR.hi;
      for (let y = sy + 24 + ((t * 2) % 6); y < ry - 16; y += 6) box(sx, y, 1, 3, col);
    }
  }
  // over the fighters: reticle, the beam (core / glow / scanlines / particles), ground impact, flash, burning victim
  let burnCv = null;
  function drawGammaTop(ctx, f, g) {
    const s = f.cfg.super, B = f.beam, t = f.anim, K = A.S, box = gammaBox(ctx); if (!B) return;
    const sx = Math.round(B.tx / K), gy = FLOOR_Y(), bt = t - s.beamAt;
    // reticle: green brackets closing in while tracking, red/white + LOCK once locked
    if (t >= s.chargeAt && bt < 4) {
      const ry = Math.round((A.GROUND - 95) / K), r = B.locked ? 15 : Math.round(15 + (s.lockAt - t) * 0.7);
      const col = B.locked ? (t % 4 < 2 ? GR.red : GR.white) : GR.lime, L = 6;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = sx + dx * r, cy = ry + dy * r;
        box(dx < 0 ? cx : cx - L + 1, cy, L, 1, col); box(cx, dy < 0 ? cy : cy - L + 1, 1, L, col);
      }
      box(sx - 7, ry, 4, 1, col); box(sx + 4, ry, 4, 1, col); box(sx, ry - 7, 1, 4, col); box(sx, ry + 4, 1, 4, col);
      if (B.locked) A.pixelText(ctx, 'LOCK', sx * K, (ry - r - 9) * K, 14, col, 'center');
    }
    if (bt < 0) return;
    const fadeLen = 10, fade = bt < s.beamFrames ? 1 : 1 - (bt - s.beamFrames) / fadeLen; if (fade <= 0) return;
    const slam = bt < 5 ? 1.35 : 1, p = Math.sin(bt * 0.7), yb = Math.round(EMIT_Y + (gy + 2 - EMIT_Y) * Math.min(1, (bt + 1) / 4));
    const ow = (30 + 3 * p) * slam * fade, mw = (17 + 2 * p) * slam * fade, cw = (7 + (bt % 4 < 2 ? 1 : 0)) * slam * fade;
    ctx.save();
    ctx.globalAlpha = 0.55; // outer glow: dithered scanlines with wobbling edges
    for (let y = EMIT_Y; y < yb; y++) if ((y + bt) % 2 === 0) { const w = ow + Math.sin(y * 0.31 + bt * 0.5) * 2.5; box(sx - w, y, w * 2, 1, (y >> 1) % 3 ? GR.mid : GR.dark); }
    ctx.globalAlpha = 0.85;
    for (let y = EMIT_Y; y < yb; y++) { const w = mw + Math.sin(y * 0.5 - bt * 0.9) * 1.2; box(sx - w, y, w * 2, 1, GR.hi); }
    ctx.globalAlpha = 1;
    box(sx - cw - 1, EMIT_Y, (cw + 1) * 2, yb - EMIT_Y, GR.pale); box(sx - cw + 2, EMIT_Y, Math.max(1, cw * 2 - 4), yb - EMIT_Y, GR.white);
    for (let k = 0; k < 6; k++) { const y = EMIT_Y + ((bt * 7 + k * 23) % Math.max(1, yb - EMIT_Y)); box(sx - mw, y, mw * 2, 1, GR.white); } // racing bands
    for (let k = 0; k < 22; k++) { // particles fizzing up and down the beam
      const span = Math.max(1, ow * 2), x = sx - ow + ((k * 53 + bt * (k % 3 + 1)) % span), y = yb - ((bt * (3 + (k % 4)) + k * 37) % Math.max(1, yb - EMIT_Y));
      box(x, y, 1, k % 3 ? 1 : 2, k % 2 ? GR.lime : GR.white);
    }
    // emitter flare
    for (let r = 6; r >= 0; r -= 2) { const w = (r + 4 + (bt % 3)) * fade; box(sx - w, EMIT_Y - 2 + (6 - r) / 2, w * 2, r ? 2 : 1, r > 3 ? GR.hi : GR.white); }
    // ground impact: glowing pool + debris arcs
    if (yb >= gy) {
      for (let dy = -7; dy <= 3; dy++) { const w = (ow + 16 + p * 3) * Math.sqrt(Math.max(0, 1 - (dy / 8) ** 2)) * fade; box(sx - w, gy + dy, w * 2, 1, dy < -4 ? GR.mid : dy < 0 ? GR.hi : GR.lime); }
      box(sx - ow * 0.8, gy - 2, ow * 1.6, 3, GR.white);
      for (let k = 0; k < 14; k++) {
        const life = (bt * 2 + k * 7) % 22, side = k % 2 ? 1 : -1, x = sx + side * (ow * 0.6 + life * (2 + (k % 3))), y = gy - life * (2 + (k % 4)) * 0.8 + life * life * 0.12;
        if (y < gy + 1) box(x, y, 1, 1, life < 8 ? GR.white : GR.lime);
      }
    }
    ctx.restore();
    // victim burn: green / white X-ray flicker of the fighter that just took a beam hit
    const v = g.f.find((o) => o !== f);
    if (v && t - B.burn < 10 && v.state === 'hit') {
      const cv = ctx.canvas; burnCv = burnCv || document.createElement('canvas');
      if (burnCv.width !== cv.width || burnCv.height !== cv.height) { burnCv.width = cv.width; burnCv.height = cv.height; }
      const o = burnCv.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, burnCv.width, burnCv.height);
      o.setTransform(ctx.getTransform()); o.imageSmoothingEnabled = false; A.drawFighter(o, v, null);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop'; o.fillStyle = (t >> 1) % 2 ? GR.lime : GR.white; o.fillRect(0, 0, burnCv.width, burnCv.height); o.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = (t >> 1) % 2 ? 0.8 : 0.6; ctx.drawImage(burnCv, 0, 0); ctx.restore();
    }
    if (bt < 2) { ctx.fillStyle = 'rgba(252,252,252,0.85)'; ctx.fillRect(-40, -40, A.W + 80, A.H + 80); } // slam flash
    else if (bt < 5) { ctx.fillStyle = 'rgba(184,248,24,0.3)'; ctx.fillRect(-40, -40, A.W + 80, A.H + 80); }
  }

  function add(a, b, k = 1) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }

  // projectile: big pixel rocket (~50 px) + flickering exhaust flame + smoke puffs left hanging in the air behind it
  function drawRocket(ctx, p, t) {
    const K = A.S, dir = p.dir, ox = Math.round(p.x / K), oy = Math.round(p.y / K), half = ROCKET[0].length >> 1;
    const dot = (gx, gy, c) => { ctx.fillStyle = c; ctx.fillRect((dir > 0 ? ox + gx : ox - gx - 1) * K, (oy + gy) * K, K, K); };
    // smoke: one puff every 12 px along the path; each grows, drifts up and darkens after the rocket passes
    const tail = (p.x - p.x0) * dir / K - 16;
    for (let k = 0; k * 12 < tail; k++) {
      const age = (tail - k * 12) * K / Math.abs(p.vx); if (age > 36) continue;
      const r = 1.6 + age * 0.12, cx = k * 12 - tail - 16 - half + 9, cy = ((k * 5) % 3) - 1 - age * 0.12;
      const c = age < 10 ? ROCKET_COLS.s : age < 24 ? ROCKET_COLS.S : ROCKET_COLS.T;
      for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++)
        if (x * x + y * y <= r * r && !(age > 24 && (x + y + k) % 2)) dot(Math.round(cx + x), Math.round(cy + y), c);
    }
    // exhaust flame behind the nozzle (grid column 9)
    const L = 13 + ((t >> 1) % 3) * 2;
    for (let i = 0; i < L; i++) {
      const h = 2.8 * Math.pow(1 - i / L, 0.7), gx = 9 - half - 1 - i;
      for (let y = -Math.floor(h); y <= h; y++) {
        const a = Math.abs(y) / (h + 0.01), c = i < 4 && a < 0.5 ? ROCKET_COLS.y : a < 0.6 && i < L * 0.55 ? ROCKET_COLS.F : i < L * 0.8 ? ROCKET_COLS.f : ROCKET_COLS.R;
        dot(gx, y, c);
      }
    }
    if (t % 4 < 2) { dot(9 - half - L - 2, -1, ROCKET_COLS.f); dot(9 - half - L - 4, 1, ROCKET_COLS.F); }
    A.drawPixelGrid(ctx, ROCKET, ROCKET_COLS, p.x, p.y, dir);
  }
})();
