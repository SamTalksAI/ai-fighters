// AI Fighters - player input: keyboard + multi-touch on-screen controls -> one input state object.
(function () {
  const A = window.AIF;
  const state = A.blankInput();
  const latch = A.blankInput(); // remembers quick taps that start and end between two game frames
  const press = (k) => { state[k] = true; latch[k] = true; };
  // called once per simulation step: held keys OR taps since last step
  A.readInput = () => { const r = {}; for (const k in state) { r[k] = state[k] || latch[k]; latch[k] = false; } return r; };
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up',
    ArrowDown: 'down', KeyS: 'down', KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick',
    KeyL: 'block', KeyC: 'block', KeyI: 'special', KeyV: 'special',
  };
  A.input = state;
  addEventListener('keydown', (e) => { const k = KEYS[e.code]; if (k) { press(k); e.preventDefault(); } });
  addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) state[k] = false; });
  addEventListener('blur', () => Object.keys(state).forEach((k) => (state[k] = false)));

  A.initTouch = function () {
    // action buttons: each tracks its own pointers, so several can be held at once
    document.querySelectorAll('[data-k]').forEach((btn) => {
      const k = btn.dataset.k, ids = new Set();
      const set = () => { state[k] = ids.size > 0; btn.classList.toggle('on', state[k]); };
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); ids.add(e.pointerId); btn.setPointerCapture?.(e.pointerId); press(k); set(); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, (e) => { ids.delete(e.pointerId); set(); });
    });
    // D-pad: 8-way direction from thumb position, slide-friendly
    const pad = document.getElementById('dpad');
    let padId = null;
    const dir = (e) => {
      const r = pad.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5, dz = 0.16;
      state.left = dx < -dz; state.right = dx > dz; state.up = dy < -dz * 1.4; state.down = dy > dz * 1.4;
      pad.classList.add('on');
    };
    const clear = () => { padId = null; state.left = state.right = state.up = state.down = false; pad.classList.remove('on'); };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); padId = e.pointerId; pad.setPointerCapture?.(e.pointerId); dir(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) dir(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, (e) => { if (e.pointerId === padId) clear(); });
    // no page scroll / pinch / double-tap zoom
    for (const ev of ['touchmove', 'gesturestart', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  };
})();
