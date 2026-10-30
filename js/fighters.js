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
      stats: { hp: 100, speed: 4.4, jump: 15.5, power: 1.0 },
      special: {
        name: 'Mars Rocket', frames: 40, fireAt: 14, cooldown: 150, aiRange: [180, 2000],
        run: (f, g) => g.spawnProjectile(f, { speed: 9, damage: 14, chip: 3, w: 110, h: 40, yOff: -125, xOff: 90, draw: drawRocket }),
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
        poses: {
          spWind: { hip: [-5, -46], sh: [-7, -78], ff: [16, -4], fb: [-15, -4], hf: [20, -74], hb: [-18, -103], prop: { grid: 'rocket', anchor: [12, 4], hand: 'hb' } },
          spLaunch: { hip: [2, -46], sh: [9, -78], ff: [21, -4], fb: [-12, -4], hf: [42, -82], hb: [4, -66] },
          win: { hip: [0, -50], sh: [0, -82], ff: [9, -4], fb: [-9, -4], hf: [17, -114], hb: [-7, -55] }, // fist pump
        },
      },
    },
    {
      id: 'zuck', name: 'Mark Zuckerberg', bio: 'Jiu-jitsu enjoyer. Loves a metaverse.',
      stats: { hp: 100, speed: 4.0, jump: 14.5, power: 1.1 },
      special: {
        name: 'Jiu-Jitsu Throw', frames: 40, fireAt: 8, cooldown: 150, aiRange: [0, 150],
        run: (f, g) => g.tryGrab(f, { range: 150, damage: 20 }),
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
        poses: {
          spGrab: { hip: [2, -44], sh: [11, -73], ff: [21, -4], fb: [-12, -4], hf: [36, -66], hb: [30, -62], armsFront: true },
          spHeave: { hip: [-2, -42], sh: [-9, -73], ff: [18, -4], fb: [-17, -4], hf: [-8, -100], hb: [1, -98], armsFront: true, head: [1, 1] },
          win: { hip: [0, -50], sh: [1, -82], ff: [10, -4], fb: [-10, -4], hf: [-3, -66], hb: [10, -68], armsFront: true }, // arms crossed
        },
      },
    },
  ];

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
