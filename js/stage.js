// AI Fighters - SF2-style stage: tech-campus rooftop arena at night, with a pixel crowd behind the railing,
// server racks with blinking LEDs and a perspective tiled floor. Pre-rendered once at low res; only the
// crowd (2-frame cheer) and LEDs animate. All colours are in the master palette.
(function () {
  const A = window.AIF;
  let far, crowd, near;
  const mk = () => { const c = document.createElement('canvas'); c.width = A.LW; c.height = A.LH; return [c, c.getContext('2d')]; };
  const rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(7);

  function build() {
    const LW = A.LW, LH = A.LH, G = Math.round(A.GROUND / A.S); // ground line (188)
    const FLOOR = G - 22; // back edge of the rooftop floor
    let b; const r = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); };

    // ---------- far layer: sky, moon, skyline, campus tower ----------
    [far, b] = mk();
    const sky = ['#100818', '#181028', '#241838', '#302050', '#402870', '#583088'];
    sky.forEach((c, i) => {
      const y0 = i * 20; r(0, y0, LW, LH, c);
      if (i) for (let y = y0; y < y0 + 4; y++) for (let x = (y % 2); x < LW; x += 2) if ((y - y0) < 2 || x % 4 < 2) r(x, y, 1, 1, sky[i - 1]); // dither
    });
    for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * LW), y = Math.floor(rnd() * 90); r(x, y, 1, 1, i % 9 ? '#bcbcbc' : '#fcfcfc'); if (i % 13 === 0) { r(x - 1, y, 3, 1, '#fcfcfc'); r(x, y - 1, 1, 3, '#fcfcfc'); } }
    // moon with shading
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
      const d = x * x + y * y; if (d > 100) continue;
      r(286 + x, 62 + y, 1, 1, (x + 4) ** 2 + (y + 3) ** 2 < 40 ? '#f8f0a0' : d > 70 ? '#d8c060' : '#f8d878');
    }
    r(282, 58, 3, 2, '#d8c060'); r(290, 66, 2, 2, '#d8c060'); r(285, 68, 2, 1, '#d8c060');
    // distant skyline
    for (let x = 0; x < LW;) {
      const w = 10 + Math.floor(rnd() * 18), h = 30 + Math.floor(rnd() * 50);
      r(x, 132 - h, w, h + 20, '#141c24');
      for (let wy = 132 - h + 4; wy < 140; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < 0.28) r(wx, wy, 2, 2, rnd() < 0.7 ? '#d8c060' : '#20a0c8');
      if (rnd() < 0.25) { r(x + (w >> 1), 132 - h - 10, 1, 10, '#202c38'); r(x + (w >> 1), 132 - h - 11, 1, 1, '#f86060'); }
      x += w + 1;
    }
    // campus glass tower (centre-left) with a pixel sign
    const tx = 120, tw = 112, ty = 40;
    r(tx, ty, tw, 120, '#1c2c48'); r(tx, ty, tw, 2, '#50687c'); r(tx - 4, ty - 4, tw + 8, 5, '#283c5c'); r(tx - 4, ty - 4, tw + 8, 1, '#6c8098');
    for (let y = ty + 26; y < 150; y += 7) for (let x = tx + 4; x < tx + tw - 4; x += 8) {
      const lit = rnd(); r(x, y, 6, 5, lit < 0.35 ? '#60e8f8' : lit < 0.5 ? '#f8f0a0' : '#283c5c'); r(x, y + 4, 6, 1, '#141c24');
    }
    r(tx + tw - 10, ty, 10, 120, '#141c24'); // shaded side
    // sign "AI ARENA" (3x5 pixel letters)
    const F = { A: ['010', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'], R: ['110', '101', '110', '101', '101'],
      E: ['111', '100', '110', '100', '111'], N: ['101', '111', '111', '111', '101'], ' ': ['000', '000', '000', '000', '000'] };
    const sx = tx + 12, sy = ty + 8; r(sx - 4, sy - 4, 96, 18, '#100818'); r(sx - 4, sy - 4, 96, 1, '#f878f8'); r(sx - 4, sy + 13, 96, 1, '#f878f8');
    [...'AI ARENA'].forEach((ch, i) => F[ch].forEach((row, y) => [...row].forEach((v, x) => {
      if (v === '1') { r(sx + i * 11 + x * 2, sy + y * 2, 2, 2, i < 2 ? '#f8b800' : '#f878f8'); }
    })));
    // water tower + antenna dish on the right
    r(330, 92, 26, 22, '#3c2c1c'); r(330, 92, 26, 2, '#5c4430'); for (let x = 332; x < 356; x += 5) r(x, 94, 1, 20, '#5c4430');
    r(333, 114, 2, 30, '#202c38'); r(351, 114, 2, 30, '#202c38'); r(333, 124, 20, 1, '#202c38');
    r(40, 96, 20, 3, '#38506c'); r(44, 92, 12, 4, '#50687c'); r(49, 99, 2, 40, '#283c5c');

    // ---------- crowd behind the railing: two frames ----------
    crowd = [0, 1].map((fr) => {
      const [c, cb] = mk(); b = cb;
      const shirts = ['#d82800', '#0058f8', '#00a800', '#f8b800', '#940084', '#e45c10', '#3cbcfc', '#7c7c7c', '#f878f8'];
      const skins = ['#f0c8a8', '#e0a070', '#a86840', '#fce8d8', '#7c5434'], hairs = ['#1c140c', '#7c5434', '#f8d878', '#3c2a1c', '#a81000', '#bcbcbc'];
      let x = 6, i = 0;
      while (x < LW - 6) {
        const tall = (i * 7) % 3, by = FLOOR - 24 - tall * 2 - ((fr + i) % 2 ? 1 : 0), sh = shirts[(i * 5) % shirts.length];
        const sk = skins[(i * 3) % skins.length], hr = hairs[(i * 11) % hairs.length], cheer = fr === 1 && i % 3 === 0;
        if (i % 9 === 4) { // a little robot fan
          r(x, by + 1, 10, 9, '#100818'); r(x + 1, by + 2, 8, 7, '#bcbcbc'); r(x + 2, by + 4, 2, 2, '#f86060'); r(x + 6, by + 4, 2, 2, '#f86060');
          r(x + 4, by - 2, 2, 3, '#7c7c7c'); r(x + 4, by - 3, 2, 1, fr ? '#f8b800' : '#f86060'); r(x - 1, by + 10, 12, 20, '#100818'); r(x, by + 11, 10, 20, '#7c7c7c');
        } else {
          r(x - 1, by + 9, 14, 22, '#100818'); r(x, by + 10, 12, 21, sh); r(x, by + 10, 3, 21, '#100818'); // body (shaded side)
          r(x + 1, by - 1, 10, 11, '#100818'); r(x + 2, by, 8, 9, sk); r(x + 2, by, 8, 3, hr); r(x + 2, by, 2, 6, hr);
          r(x + 7, by + 4, 1, 1, '#100818'); r(x + 4, by + 4, 1, 1, '#100818'); // eyes
          if (cheer) { r(x - 3, by - 6, 3, 16, '#100818'); r(x - 2, by - 5, 1, 14, sk); r(x - 3, by - 8, 3, 3, sk); }
          if (i % 4 === 1) { r(x + 9, by + 12 - fr, 4, 6, '#100818'); r(x + 10, by + 13 - fr, 2, 4, '#60e8f8'); } // phone filming
        }
        x += 13 + (i % 3); i++;
      }
      return c;
    });

    // ---------- near layer: railing, racks, floor ----------
    [near, b] = mk();
    const railY = FLOOR - 16;
    r(0, railY + 3, LW, FLOOR - railY - 3, '#202c38'); // railing glass (dark tint)
    for (let x = 0; x < LW; x += 3) r(x, railY + 3 + ((x / 3) % 4), 1, 1, '#2c3c4c');
    for (let x = 10; x < LW; x += 46) { r(x, railY + 6, 1, 8, '#38506c'); r(x + 2, railY + 4, 1, 4, '#38506c'); } // reflections
    r(0, railY, LW, 3, '#bcbcbc'); r(0, railY, LW, 1, '#fcfcfc'); r(0, railY + 3, LW, 1, '#545454');
    for (let x = 4; x < LW; x += 32) { r(x, railY, 3, FLOOR - railY, '#7c7c7c'); r(x, railY, 1, FLOOR - railY, '#bcbcbc'); }
    // server racks at both sides
    [[0, 34], [LW - 34, 34]].forEach(([x, w]) => {
      r(x, 92, w, FLOOR - 92 + 6, '#100818'); r(x + 2, 94, w - 4, FLOOR - 94 + 4, '#202c38'); r(x + 2, 94, w - 4, 1, '#38506c');
      for (let y = 98; y < FLOOR - 2; y += 6) { r(x + 4, y, w - 8, 4, '#141c24'); r(x + 4, y, w - 8, 1, '#2c3c4c'); }
    });
    // floor: perspective tiles + hazard stripe at the back edge
    r(0, FLOOR, LW, LH - FLOOR, '#283c5c');
    let y = FLOOR + 2, gap = 2; const rows = [];
    while (y < LH) { rows.push(y); y += gap; gap += 2; }
    rows.forEach((yy, i) => r(0, yy, LW, 1, i % 2 ? '#1c2c48' : '#38506c'));
    for (let k = -14; k <= 14; k++) {
      for (let yy = FLOOR; yy < LH; yy++) { const t = (yy - FLOOR) / (LH - FLOOR), xx = Math.round(LW / 2 + k * (16 + t * 26)); r(xx, yy, 1, 1, '#1c2c48'); }
    }
    for (let x = 0; x < LW; x += 8) { r(x, FLOOR, 4, 3, '#f8b800'); r(x + 4, FLOOR, 4, 3, '#100818'); }
    r(0, FLOOR + 3, LW, 1, '#100818');
  }

  A.drawBackground = function (ctx, g) {
    if (!far) build();
    const W = A.W, H = A.H, t = g ? g.frame : 0, excited = g && g.phase === 'ko';
    ctx.drawImage(far, 0, 0, W, H);
    ctx.drawImage(crowd[Math.floor(t / (excited ? 8 : 26)) % 2], 0, 0, W, H);
    ctx.drawImage(near, 0, 0, W, H);
    // blinking rack LEDs
    const K = A.S, G = Math.round(A.GROUND / K) - 22;
    for (const x0 of [6, A.LW - 28]) for (let y = 99, i = 0; y < G - 2; y += 6, i++) for (let j = 0; j < 4; j++) {
      const on = ((i * 7 + j * 3 + (t >> 3)) % 5) < 2;
      ctx.fillStyle = on ? (j === 3 ? '#f86060' : '#70f070') : '#141c24'; ctx.fillRect((x0 + j * 5) * K, (y + 1) * K, 2 * K, K);
    }
  };
})();
