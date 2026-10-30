// AI Fighters - SF2-style pixel sprites. Fighter-agnostic renderer: every fighter supplies `sprite` data in
// fighters.js (colour ramps, body build, head pixel grid, optional pose overrides / decals / props).
// Poses are skeletal keyframes in low-res pixels (x = forward, y = up is negative, origin = ground under the
// fighter). Limbs are solved with 2-bone IK and rasterised by a tiny software rasteriser with a dark 1px outline
// and 3-tone cel shading (highlight / base / shadow). Visual only: gameplay never reads anything from here.
(function () {
  const A = window.AIF;
  const SW = 176, SH = 150, AX = 88, AY = 140; // sprite buffer and its ground anchor
  const LX = 0.5, LY = -0.62, LZ = 0.6; // light from the front, above, toward the viewer
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1]) || 1e-6; return [v[0] / l, v[1] / l]; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // ---- generic pose library (fighters may override any of these in sprite.poses) ----
  // hip / sh = hip and shoulder centre, ff / fb = front / back ankle, hf / hb = front / back wrist
  const POSES = {
    idle1: { hip: [-2, -45], sh: [3, -77], ff: [15, -4], fb: [-15, -4], hf: [24, -73], hb: [20, -61] },
    idle2: { hip: [-2, -44], sh: [3, -75], ff: [15, -4], fb: [-15, -4], hf: [24, -71], hb: [20, -59] },
    walk0: { hip: [-1, -45], sh: [4, -77], ff: [16, -4], fb: [-14, -4], hf: [24, -73], hb: [20, -61] },
    walk1: { hip: [1, -47], sh: [6, -79], ff: [19, -9], fb: [-10, -4], hf: [26, -75], hb: [22, -63] },
    walk2: { hip: [2, -46], sh: [7, -78], ff: [17, -4], fb: [-7, -4], hf: [27, -74], hb: [23, -62] },
    walk3: { hip: [0, -47], sh: [5, -79], ff: [15, -4], fb: [-11, -9], hf: [25, -75], hb: [21, -63] },
    jumpUp: { hip: [0, -52], sh: [2, -84], ff: [8, -6], fb: [-7, -10], hf: [18, -86], hb: [6, -80] },
    jump: { hip: [0, -54], sh: [3, -86], ff: [12, -34], fb: [-10, -36], hf: [20, -80], hb: [8, -74] },
    crouch: { hip: [-4, -26], sh: [5, -56], ff: [17, -4], fb: [-17, -4], hf: [23, -52], hb: [12, -46] },
    punch0: { hip: [-4, -45], sh: [-1, -77], ff: [15, -4], fb: [-15, -4], hf: [9, -70], hb: [8, -64] },
    punch1: { hip: [0, -45], sh: [7, -77], ff: [18, -4], fb: [-13, -4], hf: [41, -77], hb: [8, -67] },
    jpunch: { hip: [0, -54], sh: [6, -85], ff: [12, -34], fb: [-10, -36], hf: [40, -80], hb: [6, -76] },
    crpunch: { hip: [-2, -26], sh: [8, -56], ff: [17, -4], fb: [-17, -4], hf: [42, -55], hb: [12, -47] },
    kick0: { hip: [-6, -47], sh: [-7, -79], ff: [12, -34], fb: [-8, -4], hf: [14, -72], hb: [2, -66] },
    kick1: { hip: [-8, -48], sh: [-15, -78], ff: [41, -50], fb: [-9, -4], hf: [6, -72], hb: [-8, -66] },
    jkick: { hip: [0, -54], sh: [-8, -84], ff: [36, -42], fb: [-8, -36], hf: [10, -80], hb: [-4, -74] },
    block: { hip: [-4, -44], sh: [-1, -75], ff: [13, -4], fb: [-17, -4], hf: [9, -87], hb: [17, -83], armsFront: true },
    hit: { hip: [-4, -45], sh: [-13, -74], ff: [13, -4], fb: [-16, -4], hf: [4, -58], hb: [-27, -70], face: 'hurt' },
    fall: { hip: [0, -42], sh: [-24, -62], ff: [24, -34], fb: [16, -28], hf: [-12, -48], hb: [-38, -70], face: 'hurt' },
    lie: { hip: [4, -8], sh: [-28, -9], ff: [32, -12], fb: [27, -5], hf: [-16, -3], hb: [-40, -3], face: 'ko' },
    win: { hip: [0, -50], sh: [0, -82], ff: [9, -4], fb: [-9, -4], hf: [7, -118], hb: [-6, -55] },
  };
  A.POSES = POSES;

  // per-fighter compiled colours + buffers (cached on the config)
  function compile(cfg) {
    if (cfg._spr) return cfg._spr;
    const sp = cfg.sprite, cols = [null], idx = {};
    const col = (h) => { h = h.toLowerCase(); if (!(h in idx)) { idx[h] = cols.length; cols.push(hex(h)); } return idx[h]; };
    const OUTL = col(sp.outline || '#100818'), ramps = {};
    for (const k in sp.ramps) ramps[k] = sp.ramps[k].map(col);
    const LEG = Object.assign({ H: 'hair.0', k: 'hair.1', K: 'hair.2', l: 'skin.0', s: 'skin.1', S: 'skin.2',
      w: '#f8f8f8', e: 'eye.1', E: 'eye.2', m: 'mouth.1', M: 'mouth.2' }, sp.legend);
    const legend = { o: OUTL };
    for (const ch in LEG) { const v = LEG[ch]; legend[ch] = v[0] === '#' ? col(v) : ramps[v.split('.')[0]][+v.split('.')[1]]; }
    if (A.addColors) A.addColors(Object.keys(idx)); // keep them in the master palette
    const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
    const cx = cv.getContext('2d');
    return (cfg._spr = { cols, ramps, OUTL, legend, buf: new Uint8Array(SW * SH), cv, cx, img: cx.createImageData(SW, SH) });
  }

  function tone(nx, ny) {
    const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), i = nx * LX + ny * LY + z * LZ;
    return i > 0.8 ? 0 : i > 0.3 ? 1 : 2;
  }
  // shapes: capsule a->b (radius ra..rb, optional mid bulge for muscles) or tapered body a->b with width profile
  const cap = (a, b, ra, rb, ramp, bulge = 0) => ({ k: 0, a, b, ra, rb, ramp, bulge });
  const tap = (a, b, prof, maxw, ramp) => ({ k: 1, a, b, prof, maxw, ramp });
  function raster(S, sh, pass) { // pass 0 = outline (grown by 1px), pass 1 = shaded fill
    const buf = S.buf, ax = sh.a[0] + AX, ay = sh.a[1] + AY, bx = sh.b[0] + AX, by = sh.b[1] + AY;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6, Ln = Math.sqrt(L2), ux = dx / Ln, uy = dy / Ln;
    const g = pass ? 0 : 1, R = (sh.k ? sh.maxw : Math.max(sh.ra, sh.rb) + sh.bulge) + 2;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), x1 = Math.min(SW - 1, Math.ceil(Math.max(ax, bx) + R));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), y1 = Math.min(SH - 1, Math.ceil(Math.max(ay, by) + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = (px * dx + py * dy) / L2;
      let nx, ny;
      if (sh.k === 0) {
        const tc = t < 0 ? 0 : t > 1 ? 1 : t, r = sh.ra + (sh.rb - sh.ra) * tc + sh.bulge * Math.sin(Math.PI * tc);
        nx = px - dx * tc; ny = py - dy * tc;
        if (nx * nx + ny * ny > (r + g) * (r + g)) continue;
        nx /= r; ny /= r;
      } else {
        if (t * Ln < -g || t * Ln > Ln + g) continue;
        const tc = t < 0 ? 0 : t > 1 ? 1 : t, s = px * -uy + py * ux, r = sh.prof(tc, s > 0);
        if (Math.abs(s) > r + g) continue;
        const q = s / r, e = Math.max(0, tc - 0.7) * 2.6 - Math.max(0, 0.25 - tc) * 1.6;
        nx = -uy * q * 0.92 + ux * e; ny = ux * q * 0.92 + uy * e;
      }
      buf[y * SW + x] = pass ? sh.ramp[tone(nx, ny)] : S.OUTL;
    }
  }
  // a group shares one outline: all outlines first, then all fills (so no seams inside a limb)
  function group(S, shapes) { for (const s of shapes) raster(S, s, 0); for (const s of shapes) raster(S, s, 1); }
  function px(S, x, y, c) { x = Math.round(x) + AX; y = Math.round(y) + AY; if (x >= 0 && y >= 0 && x < SW && y < SH) S.buf[y * SW + x] = c; }
  // pixel grid (array of strings, '.' = empty) drawn so grid cell `anchor` lands on point p, rotated q quarter turns
  function grid(S, rows, anchor, p, q = 0, flip = false) {
    for (let gy = 0; gy < rows.length; gy++) for (let gx = 0; gx < rows[gy].length; gx++) {
      const ch = rows[gy][gx]; if (ch === '.' || ch === ' ') continue;
      let x = (flip ? -1 : 1) * (gx - anchor[0]), y = gy - anchor[1];
      if (q === 1) [x, y] = [-y, x]; else if (q === -1) [x, y] = [y, -x]; else if (q === 2) [x, y] = [-x, -y];
      px(S, p[0] + x, p[1] + y, S.legend[ch] ?? S.OUTL);
    }
  }
  function ik(root, target, l1, l2, bend) { // 2-bone IK -> [joint, end]
    let d = sub(target, root), dist = Math.hypot(d[0], d[1]);
    const max = l1 + l2 - 0.01, dir = nrm(d); if (dist > max) { dist = max; target = add(root, dir, max); }
    dist = Math.max(dist, Math.abs(l1 - l2) + 0.5);
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [add(add(root, dir, a), [-dir[1], dir[0]], h * bend), target];
  }

  function pickPose(f, g) {
    const sp = f.cfg.sprite, P = (n) => Object.assign({ name: n }, (sp.poses && sp.poses[n]) || POSES[n]);
    const s = f.state, t = f.anim, clk = g ? g.frame : 0, air = f.y < A.GROUND - 1;
    if (g && (g.phase === 'ko' || g.phase === 'over') && g.f[g.roundWinner] === f && !air && g.phaseT < 125 &&
      (s === 'idle' || s === 'walk' || s === 'crouch' || s === 'block')) return P('win');
    switch (s) {
      case 'walk': { let i = Math.floor(t / 7) % 4; if (f.vx * f.facing < 0) i = 3 - i; return P('walk' + i); }
      case 'jump': return P(f.vy < -3 ? 'jumpUp' : 'jump');
      case 'crouch': return P('crouch');
      case 'block': case 'blockstun': return P('block');
      case 'punch': case 'kick': {
        const a = A.ATTACKS[s], out = t > a.startup - 2 && t <= a.startup + a.active + 4;
        if (s === 'punch') return P(out ? (air ? 'jpunch' : 'punch1') : air ? 'jump' : 'punch0');
        return P(out ? (air ? 'jkick' : 'kick1') : air ? 'jump' : 'kick0');
      }
      case 'special': return P(sp.specialPose ? sp.specialPose(t, f.cfg.special) : 'punch1');
      case 'hit': return P('hit');
      case 'thrown': return Object.assign({}, P('hit'), { rot: -Math.floor(t * 0.22 / (Math.PI / 2)) % 4 });
      case 'ko': case 'down': return P(air || t < 5 ? 'fall' : 'lie');
      default: return P(Math.floor(clk / 24) % 2 ? 'idle2' : 'idle1');
    }
  }

  A.renderFighter = function (f, g) {
    const cfg = f.cfg, sp = cfg.sprite, S = compile(cfg), B = sp.build, R = S.ramps;
    const P = pickPose(f, g);
    S.buf.fill(0);
    const hip = P.hip, shc = P.sh, u = nrm(sub(shc, hip)), p = [-u[1], u[0]]; // u = up the spine, p = toward the front
    const shF = add(add(shc, p, B.shFront), u, -3), shB = add(add(shc, p, -B.shBack), u, -3.5);
    const hF = add(hip, p, 3), hB = add(hip, p, -3);
    const kF = ik(hF, P.ff, B.thigh, B.shin, -1), kB = ik(hB, P.fb, B.thigh, B.shin, -1);
    const eF = ik(shF, P.hf, B.upper, B.fore, 1), eB = ik(shB, P.hb, B.upper, B.fore, 1);
    const leg = (h, [k, a]) => {
      const sd = nrm(sub(a, k)), toe = a[1] > -8 ? [1, 0.12] : [sd[1], -sd[0]];
      return [cap(h, k, B.rThigh[0], B.rThigh[1], R.pants, 0.7), cap(k, a, B.rShin[0], B.rShin[1], R.pants, B.calf),
        cap(lerp(k, a, B.bootTop), a, B.rBoot - 0.4, B.rBoot, R.boots), cap(a, add(a, toe, B.foot), B.rBoot, B.rBoot - 0.8, R.boots)];
    };
    const arm = (s, [e, w]) => {
      const fd = nrm(sub(w, e));
      return [cap(s, e, B.rUpper[0], B.rUpper[1], R.skin, B.bicep), cap(e, w, B.rFore[0], B.rFore[1], R.skin, B.forearm),
        cap(s, lerp(s, e, B.sleeveLen), B.delt, B.sleeve, R.shirt),
        cap(add(w, fd, 1.2), add(w, fd, 3.4), B.fist, B.fist - 0.2, R.skin)];
    };
    // torso width profile, front (chest) and back sides separately: narrow waist, big chest, rounded traps
    const sm = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    const prof = (t, front) => {
      const w = front ? [B.waist, B.chest, B.chest - 3] : [B.waist - 1.5, B.shoulder - 2, B.shoulder - 6];
      return t < 0.62 ? sm(w[0], w[1], t / 0.62) : sm(w[1], w[2], (t - 0.62) / 0.38);
    };
    const torso = [cap(hB, hF, B.seat, B.seat, R.pants), cap(add(shc, u, -3), add(shc, u, B.neckLen), B.neck, B.neck, R.skin),
      tap(add(hip, u, -3), add(shc, u, 1), prof, B.shoulder + 2, R.shirt)];
    const J = { hip, sh: shc, u, p, shF, shB, hF, hB, kF: kF[0], kB: kB[0], aF: kF[1], aB: kB[1], eF: eF[0], eB: eB[0], wF: eF[1], wB: eB[1], P };
    const api = { S, R, J, cap, group: (l) => group(S, l), px: (x, y, c) => px(S, x, y, c), grid: (r, an, at, q, fl) => grid(S, r, an, at, q, fl) };
    const knuckles = (e, w) => { const fd = nrm(sub(w, e)), k = add(w, fd, 3.2); px(S, k[0] - fd[1] * 1.5, k[1] + fd[0] * 1.5, R.skin[2]); };

    if (!P.armsFront) { group(S, arm(shB, eB)); knuckles(eB[0], eB[1]); }
    group(S, leg(hB, kB));
    group(S, torso);
    // muscle / fabric definition on the chest: pec line + side shadow
    for (let s = -B.chest + 3; s <= B.chest - 2; s++) { const c = add(add(shc, u, -9 - Math.abs(s - 2) * 0.18), p, s); px(S, c[0], c[1], R.shirt[2]); }
    group(S, leg(hF, kF));
    if (sp.decals) sp.decals(api);
    // head (pixel grid) on top of the neck; rotates in quarter turns with the spine (lying down etc.)
    const q = Math.round(Math.atan2(u[0], -u[1]) / (Math.PI / 2));
    const H = sp.head, rows = P.face && H[P.face] ? H.rows.map((r, i) => H[P.face][i] || r) : H.rows;
    grid(S, rows, H.anchor, add(add(shc, u, B.neckLen + 1), P.head || [0, 0]), q === -2 ? 2 : q);
    if (P.armsFront) { group(S, arm(shB, eB)); knuckles(eB[0], eB[1]); }
    group(S, arm(shF, eF)); knuckles(eF[0], eF[1]);
    if (P.prop && sp.grids[P.prop.grid]) grid(S, sp.grids[P.prop.grid], P.prop.anchor, P.prop.hand === 'hb' ? eB[1] : eF[1]);

    const d = S.img.data, buf = S.buf, cols = S.cols;
    for (let i = 0, j = 0; i < buf.length; i++, j += 4) {
      const c = buf[i]; if (!c) { d[j + 3] = 0; continue; }
      const k = cols[c]; d[j] = k[0]; d[j + 1] = k[1]; d[j + 2] = k[2]; d[j + 3] = 255;
    }
    S.cx.putImageData(S.img, 0, 0);
    S.rot = P.rot || 0;
    return S;
  };

  // ---- image art (img/): loaded via relative paths; on file:// from data URIs (js/art.js) so the canvas
  // is not tainted (A.quantize reads pixels back). Missing / not-yet-loaded images fall back to procedural art.
  const icache = new Map();
  A.image = function (path) {
    let im = icache.get(path);
    if (!im) { im = new Image(); im.src = (A.ART && A.ART[path]) || path; icache.set(path, im); }
    return im.complete && im.naturalWidth ? im : null;
  };
  const artFiles = (cfg) => {
    const sp = cfg.sprite || {}, I = sp.images, pt = sp.portrait, out = [];
    if (I) Object.keys(I.poses).forEach((n) => out.push(I.dir + n + '.png'));
    if (pt) ['big', 'bigHurt', 'mid', 'small', 'smallHurt'].forEach((k) => pt[k] && out.push(pt[k]));
    if (A.addColors) { if (I) A.addColors(I.palette); if (pt) A.addColors(pt.palette); } // keep them in the master palette
    return out;
  };
  // resolves once every fighter's images loaded (or failed -> fallback); used before drawing the select cards
  A.loadArt = (cfgs) => Promise.all(cfgs.flatMap(artFiles).map((p) => new Promise((res) => {
    A.image(p); const im = icache.get(p);
    if (im.complete) return res();
    im.addEventListener('load', res); im.addEventListener('error', res);
  })));
  // engine pose name -> image pose (2-frame idle / walk cycles; startup frames reuse idle)
  const IMG = { idle1: 'idle1', idle2: 'idle2', walk0: 'walkA', walk1: 'walkB', walk2: 'walkA', walk3: 'walkB',
    jump: 'jump', jumpUp: 'jump', crouch: 'crouch', block: 'block', punch0: 'idle1', punch1: 'punch', jpunch: 'punch',
    kick0: 'idle1', kick1: 'kick', jkick: 'kick', hit: 'hit', fall: 'hit', lie: 'lie', win: 'win' };
  function imagePose(f, g) {
    const sp = f.cfg.sprite, I = sp.images; if (!I) return null;
    const P = pickPose(f, g), n = (sp.imageMap && sp.imageMap[P.name]) || IMG[P.name], m = n && I.poses[n];
    const im = m && A.image(I.dir + n + '.png');
    return im ? { im, m, rot: P.rot || 0 } : null;
  }
  const shadow = (ctx, f, px) => { // pixel drop shadow on the floor
    const K = A.S, gy = Math.round(A.GROUND / K), w = f.y < A.GROUND - 40 ? 18 : 28;
    ctx.fillStyle = '#100818';
    [[w - 10, -1], [w, 0], [w - 6, 1]].forEach(([ww, r]) => ctx.fillRect((px - ww / 2) * K, (gy + r) * K, ww * K, K));
  };

  // draw a fighter into a context whose transform is world -> low-res (1/S)
  A.drawFighter = function (ctx, f, g) {
    if (f.cfg.draw) return f.cfg.draw(ctx, f, g);
    const K = A.S, px = Math.round(f.x / K), py = Math.round(f.y / K), ip = imagePose(f, g);
    if (g) shadow(ctx, f, px);
    ctx.save(); ctx.translate(px * K, py * K); ctx.scale(f.facing * K, K);
    ctx.imageSmoothingEnabled = false;
    if (ip) { // image sprite (art faces right; flipped by `facing`)
      if (ip.rot) { ctx.translate(0, -50); ctx.rotate(ip.rot * Math.PI / 2); ctx.translate(0, 50); }
      ctx.drawImage(ip.im, -ip.m[2], -ip.m[3]);
    } else {
      const S = A.renderFighter(f, g);
      if (S.rot) { ctx.translate(0, -45); ctx.rotate(S.rot * Math.PI / 2); ctx.translate(0, 45); }
      ctx.drawImage(S.cv, -AX, -AY);
    }
    ctx.restore();
  };

  // small helper for props / projectiles drawn straight onto the game canvas (world coordinates)
  A.drawPixelGrid = function (ctx, rows, colors, x, y, dir = 1) {
    const K = A.S, ox = Math.round(x / K), oy = Math.round(y / K), w = rows[0].length, h = rows.length;
    for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
      const c = colors[rows[gy][gx]]; if (!c) continue;
      ctx.fillStyle = c; ctx.fillRect((ox + (dir > 0 ? gx - (w >> 1) : (w >> 1) - gx - 1)) * K, (oy + gy - (h >> 1)) * K, K, K);
    }
  };

  // pixel portrait from the image-generator art (select cards, VS screen, HUD), in low-res pixel coordinates.
  // o.size: 32 (HUD face), 64 (select card) or 128 (VS); o.hurt -> bruised variant (32 / 128); o.face = 1 / -1 direction it should look
  // (the image is mirrored when its own `faces` differs).
  A.drawPortrait = function (ctx, cfg, x, y, o = {}) {
    const pt = cfg.sprite.portrait; if (!pt) return;
    const sz = o.size || 128, v = sz <= 32 ? 'small' : sz <= 64 ? 'mid' : 'big';
    const im = (o.hurt && pt[v + 'Hurt'] && A.image(pt[v + 'Hurt'])) || A.image(pt[v]), k = o.scale || 1, W = sz * k, flip = o.face && o.face !== pt.faces;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(x, y, W, W); }
    if (im) {
      if (flip) { ctx.translate(x + W, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, W, W); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      else ctx.drawImage(im, x, y, W, W);
    }
    if (o.frame) { ctx.fillStyle = o.frame;
      ctx.fillRect(x - 1, y - 1, W + 2, 1); ctx.fillRect(x - 1, y + W, W + 2, 1); ctx.fillRect(x - 1, y, 1, W); ctx.fillRect(x + W, y, 1, W); }
    ctx.restore();
  };
})();
