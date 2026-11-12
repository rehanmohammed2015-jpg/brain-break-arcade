/* Penalty Shootout: a night-stadium shootout in 3D perspective.
   Swipe to shoot (curve the swipe to bend the ball), then tap where to dive when you're in goal. */
(function () {
  const A = Arcade;
  const W = 360, H = 540;
  const CAM = { y: 3.2, z: -9 }, F0 = 683, HZ = 200; // raised broadcast camera behind the spot
  const GOAL_Z = 11, HALF_W = 3.66, BAR_H = 2.44, BALL_R = 0.17;
  const LEVEL = {
    easy: { read: 0.25, err: 0.9, react: 0.22, cpuMiss: 0.28, cpuDur: 0.9, preview: true },
    medium: { read: 0.45, err: 0.6, react: 0.14, cpuMiss: 0.16, cpuDur: 0.74, preview: false },
    hard: { read: 0.62, err: 0.38, react: 0.08, cpuMiss: 0.08, cpuDur: 0.6, preview: false },
  };
  const KIT = { you: { shirt: '#E03A3E', trim: '#FFFFFF', shorts: '#FFFFFF', socks: '#E03A3E' }, cpu: { shirt: '#F2B400', trim: '#1A2238', shorts: '#1A2238', socks: '#F2B400' } };
  const GK = { you: { shirt: '#6A45DE', gloves: '#7CFF6B' }, cpu: { shirt: '#2BB3D6', gloves: '#FF8A3D' } };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);

  // ---------- static stadium art, drawn once ----------
  let stadium = null;
  function buildStadium() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas'); c.width = W * dpr; c.height = 270 * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const sky = x.createLinearGradient(0, 0, 0, 270);
    sky.addColorStop(0, '#050A1F'); sky.addColorStop(0.5, '#0E1A44'); sky.addColorStop(1, '#1B2B63');
    x.fillStyle = sky; x.fillRect(0, 0, W, 270);
    // stands in three tiers
    const tiers = [[48, 112, '#141B3A'], [112, 176, '#182045'], [176, 252, '#1C2550']];
    const crowdCols = ['#E03A3E', '#E03A3E', '#FFFFFF', '#F2B400', '#F2B400', '#2E5BFF', '#F4C9A0', '#C68E5E', '#8D5A3B', '#1A2238', '#E8E8F0'];
    for (const [y0, y1, col] of tiers) {
      x.fillStyle = col; x.fillRect(0, y0, W, y1 - y0);
      for (let y = y0 + 4; y < y1 - 4; y += 5) {
        for (let px = (y % 10 ? 0 : 2.5); px < W; px += 4.2 + Math.random() * 1.6) {
          x.fillStyle = crowdCols[Math.floor(Math.random() * crowdCols.length)];
          x.globalAlpha = 0.55 + Math.random() * 0.4;
          x.fillRect(px, y + Math.random() * 1.5, 2.6, 3.2);
        }
      }
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y1 - 3, W, 3);
      x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, y0, W, 1);
    }
    // roof edge
    x.fillStyle = '#070B1E'; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 40); x.quadraticCurveTo(W / 2, 58, 0, 40); x.fill();
    // floodlight banks
    for (const fx of [46, W - 46]) {
      x.fillStyle = '#2A3150'; x.fillRect(fx - 22, 14, 44, 16);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
        x.fillStyle = '#FFFBE8'; x.fillRect(fx - 19 + i * 8.5, 16 + j * 7, 6, 5);
      }
    }
    return c;
  }
  const glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color); gr.addColorStop(0.2, color + 'AA'); gr.addColorStop(1, color + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (glowCache[color] = c);
  }

  A.register({
    id: 'penalty-shootout',
    section: 'sports',
    title: 'Penalty Shootout',
    color: 'good',
    featured: true,
    artBg: 'linear-gradient(#0E1A44, #1B2B63 55%, #2E8B3E 55%)',
    art: `<svg width="190" height="110" viewBox="0 0 190 110" aria-hidden="true">
      <circle cx="22" cy="14" r="10" fill="#FFFBE8" opacity=".9"/><circle cx="168" cy="14" r="10" fill="#FFFBE8" opacity=".9"/>
      <path d="M45 66 V30 H145 V66" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
      <path d="M55 30 V66 M70 30 V66 M85 30 V66 M100 30 V66 M115 30 V66 M130 30 V66 M45 42 H145 M45 54 H145" stroke="#fff" stroke-width="1" opacity=".45"/>
      <rect x="86" y="40" width="16" height="26" rx="5" fill="#2BB3D6" stroke="#1A2238" stroke-width="2"/>
      <circle cx="94" cy="35" r="5" fill="#F4C9A0" stroke="#1A2238" stroke-width="2"/>
      <circle cx="131" cy="38" r="6" fill="#fff" stroke="#1A2238" stroke-width="2"/>
      <path d="M96 104 Q 120 70 131 40" fill="none" stroke="#FFE14D" stroke-width="2.5" stroke-dasharray="5 5"/>
    </svg>`,
    blurb: 'A night-stadium shootout. Swipe to shoot and curve the ball into the corners, then dive to stop the computer’s kicks. Five kicks each, then sudden death.',
    tags: ['Soccer', 'Swipe to shoot', 'vs Computer'],
    best() { const w = A.store.get('ps-wins', 0); return w ? w + (w === 1 ? ' win' : ' wins') : null; },
    mount(el) {
      let level = A.store.get('ps-level', 'medium');
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">The whole stadium is watching</h2>
            <p><b>To shoot:</b> swipe up from the ball toward the goal. Swipe left or right to aim, and swipe longer to shoot higher. Curve your swipe to bend the ball around the keeper. Too long and it flies over the bar. On a keyboard, press Space twice to lock the side, then the height.</p>
            <p><b>In goal:</b> watch the kicker, then tap the spot in the goal where you want to dive, or use the arrow keys. Five kicks each, then sudden death.</p>
          </div>
          ${A.modePicker(level, true)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Walk out</button>
            <span class="best" style="align-self:center">Shootouts won: <b>${A.store.get('ps-wins', 0)}</b></span>
          </div>`;
      }

      function start() {
        if (!stadium) stadium = buildStadium();
        el.innerHTML = '';
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        cv.style.background = '#0E1A44';
        cv.style.width = 'min(100%, 440px, calc(74vh * 2 / 3))';
        cv.addEventListener('pointerdown', onDown);
        cv.addEventListener('pointermove', onMove);
        cv.addEventListener('pointerup', onUp);
        cv.addEventListener('pointercancel', () => { if (g) g.swipe = null; });
        g = {
          cfg: LEVEL[level], you: [], cpu: [], time: 0, last: performance.now(), slow: 1, zoom: 0,
          fx: A.particles(), flash: 0, crowdJump: 0, msg: null,
          ball: null, keeper: null, kicker: null, swipe: null, keyAim: null, dive: null, netBulge: null,
        };
        A.sound.crowd(true);
        A.sound.play('whistle');
        setupKick('you');
        raf = requestAnimationFrame(frame);
      }

      // ---------- projection ----------
      const F = () => F0 * (1 + g.zoom * 0.08);
      function P(x, y, z) {
        const d = Math.max(0.3, z - CAM.z), s = F() / d;
        return { x: W / 2 + x * s, y: HZ - (y - CAM.y) * s, s };
      }
      function toGoalPlane(sx, sy) {
        const s = F() / (GOAL_Z - CAM.z);
        return { x: (sx - W / 2) / s, y: CAM.y - (sy - HZ) / s };
      }

      // ---------- turns ----------
      function setupKick(who) {
        g.turn = who; g.phase = who === 'you' ? 'aim' : 'cpuRun'; g.t = 0;
        g.ball = { x: 0, y: BALL_R, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, mode: 'rest', trail: [] };
        g.keeper = { x: 0, y: 0, lean: 0, pose: 0, dir: 0, tx: 0, ty: 1, start: 0, diving: false };
        g.kicker = { x: -1.0, z: -1.5, run: 0, kick: 0, kit: who === 'you' ? KIT.you : KIT.cpu, num: who === 'you' ? '10' : '7', name: who === 'you' ? 'YOU' : 'CPU' };
        g.dive = null; g.netBulge = null; g.result = null; g.swipe = null; g.keyAim = null;
        g.msg = who === 'you'
          ? { text: 'YOUR KICK', sub: 'Swipe up from the ball', t: 0, big: false }
          : { text: 'YOU’RE IN GOAL', sub: 'Tap where to dive', t: 0, big: false };
      }

      // a shot from the spot to (tx, ty) on the goal plane, bending by `curl`
      function launch(tx, ty, curl, dur) {
        const b = g.ball;
        b.mode = 'flight'; b.shot = { tx, ty, curl, dur, t: 0 };
        b.arc = Math.max(0.15, 1.2 - Math.abs(ty - 1.2) * 0.4) * (dur > 0.7 ? 1.2 : 0.8);
        A.sound.play('kick');
        g.fx.burst(P(0, 0, 0).x, P(0, 0, 0).y, ['#FFFFFF', '#8FD18F'], 10, { speed: 140, angle: -Math.PI / 2, spread: 2, size: 3, silent: true });
        // keeper decides
        const k = g.keeper;
        if (g.turn === 'you') {
          const cfg = g.cfg;
          let kx, ky;
          if (Math.random() < cfg.read) { kx = tx + (Math.random() * 2 - 1) * cfg.err; ky = ty + (Math.random() * 2 - 1) * cfg.err * 0.6; }
          else { kx = Math.random() < 0.2 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2.4); ky = 0.4 + Math.random() * 1.6; }
          diveTo(kx, ky, cfg.react);
        }
        g.outcome = judge(tx, ty, dur);
      }
      function diveTo(x, y, delay) {
        const k = g.keeper;
        k.tx = clamp(x, -3.3, 3.3); k.ty = clamp(y, 0.3, 2.3);
        k.start = g.t + delay; k.diving = true;
      }
      // where are the keeper's hands at time `at` (seconds into the shot)?
      function handsAt(at) {
        const k = g.keeper;
        if (!k.diving) return { x: k.x, y: 1.2, q: 0 };
        const q = clamp((at - (k.start - g.shotStartT)) / 0.4, 0, 1);
        return { x: lerp(0, k.tx, ease(q)), y: lerp(1.2, k.ty, ease(q)), q };
      }
      function judge(tx, ty, dur) {
        const ax = Math.abs(tx);
        if (ax > HALF_W + BALL_R + 0.05 || ty > BAR_H + BALL_R + 0.05) {
          if (ax < HALF_W + BALL_R + 0.05 && ty > BAR_H - BALL_R && ty < BAR_H + BALL_R + 0.05) return 'bar';
          if (ax > HALF_W - BALL_R && ax < HALF_W + BALL_R + 0.05 && ty < BAR_H) return 'post';
          return ty > BAR_H ? 'over' : 'wide';
        }
        if (ax > HALF_W - BALL_R) return 'post';
        if (ty > BAR_H - BALL_R) return 'bar';
        return 'onTarget'; // the keeper gets a say once the ball arrives
      }

      // ---------- input ----------
      function onDown(e) {
        if (!g) return;
        e.preventDefault();
        const p = toLogical(e);
        if (g.phase === 'aim') {
          try { cv.setPointerCapture(e.pointerId); } catch (err) {}
          g.swipe = { pts: [{ ...p, t: performance.now() }] };
        } else if (g.phase === 'cpuRun' || (g.phase === 'flight' && g.turn === 'cpu')) {
          if (!g.dive) {
            const gp = toGoalPlane(p.x, p.y);
            g.dive = gp;
            diveTo(gp.x, gp.y, 0);
            A.sound.play('swish');
          }
        }
      }
      function onMove(e) {
        if (!g || !g.swipe) return;
        const p = toLogical(e);
        g.swipe.pts.push({ ...p, t: performance.now() });
      }
      function onUp(e) {
        if (!g || !g.swipe) return;
        const pts = g.swipe.pts; g.swipe = null;
        const a = pts[0], b = pts[pts.length - 1];
        const dx = b.x - a.x, dy = a.y - b.y, L = Math.hypot(dx, dy);
        if (dy < 30 || L < 45) { g.msg = { text: 'SWIPE UP', sub: 'Start on the ball, swipe toward the goal', t: 0 }; return; }
        const ms = Math.max(40, b.t - a.t), speed = L / ms;
        // curl: how far the swipe bows away from a straight line
        let dev = 0;
        for (const p of pts) {
          const cross = ((p.x - a.x) * (-dy) - (p.y - a.y) * dx) / L; // signed distance
          if (Math.abs(cross) > Math.abs(dev)) dev = cross;
        }
        const tx = clamp((dx / dy) * 6.2, -6, 6);
        const ty = clamp((L - 55) / 190 * 2.9, 0.15, 3.6);
        const curl = clamp(-dev / 45, -1, 1) * 1.7;
        const dur = clamp(0.82 - speed * 0.22, 0.45, 0.82);
        takeKick(tx, ty, curl, dur);
      }
      function takeKick(tx, ty, curl, dur) {
        g.pending = { tx, ty, curl, dur };
        g.phase = 'run'; g.t = 0; g.msg = null;
      }

      // ---------- simulation ----------
      function frame(now) {
        if (!g) return;
        const real = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        const dt = real * g.slow;
        g.time += dt; g.t += dt;
        update(dt, real);
        if (!g) return;
        draw();
        raf = requestAnimationFrame(frame);
      }

      function update(dt, real) {
        g.fx.update(dt);
        g.flash = Math.max(0, g.flash - real * 1.5);
        g.crowdJump = Math.max(0, g.crowdJump - real * 0.6);
        if (g.msg) g.msg.t += real;
        const kk = g.kicker, b = g.ball, k = g.keeper;

        // keyboard aim: an oscillating marker, Space to lock side then height
        if (g.keyAim) {
          g.keyAim.t += real;
          if (g.keyAim.stage === 0) g.keyAim.x = Math.sin(g.keyAim.t * 2.2) * 4.3;
          else g.keyAim.y = 1.3 + Math.sin(g.keyAim.t * 2.6) * 1.35;
        }

        // the run-up: kicker jogs in, strikes at the end
        if (g.phase === 'run' || g.phase === 'cpuRun') {
          const runT = g.phase === 'run' ? 0.5 : 1.25;
          const p = clamp(g.t / runT, 0, 1);
          kk.x = lerp(-1.0, -0.32, p); kk.z = lerp(-1.5, -0.5, p); kk.run += dt * 13;
          if (p >= 1) {
            g.shotStartT = g.t;
            if (g.phase === 'run') { const s = g.pending; launch(s.tx, s.ty, s.curl, s.dur); }
            else cpuShot();
            g.phase = 'flight'; kk.kick = 0.001;
          }
        }
        if (kk.kick > 0) kk.kick = Math.min(1, kk.kick + dt * 4);

        // keeper idle bounce and dive
        if (k.diving) {
          const q = clamp((g.t - k.start) / 0.4, 0, 1);
          k.x = lerp(0, k.tx, ease(q)); k.y = Math.max(0, (k.ty - 1.0) * ease(q)) + Math.sin(q * Math.PI) * 0.25;
          k.lean = clamp(k.tx / 3, -1, 1) * ease(q); k.pose = q;
        } else { k.pose = 0; k.y = 0; }

        if (b.mode === 'flight') {
          const s = b.shot;
          s.t += dt;
          const p = clamp(s.t / s.dur, 0, 1);
          b.x = lerp(0, s.tx, p) + s.curl * Math.sin(Math.PI * p);
          b.y = lerp(BALL_R, s.ty, p) + b.arc * Math.sin(Math.PI * p) * (1 - p * 0.6);
          b.z = GOAL_Z * (1 - Math.pow(1 - p, 1.25));
          b.spin += dt * 25;
          b.trail.push({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 10) b.trail.shift();
          // dramatic slow-motion as a close one arrives
          if (p > 0.72 && g.outcome === 'onTarget') g.slow = 0.38;
          g.zoom = Math.min(1, g.zoom + dt * 1.6);
          if (p >= 1) arrive();
        } else if (b.mode === 'free') {
          b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spin += dt * 10;
          if (b.y < BALL_R) { b.y = BALL_R; b.vy = -b.vy * 0.45; b.vx *= 0.8; b.vz *= 0.8; }
          if (b.inNet && b.z > GOAL_Z + 1.7) { b.z = GOAL_Z + 1.7; b.vz = 0; b.vx *= 0.5; }
          b.trail.push({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 10) b.trail.shift();
        }
        if (g.netBulge) g.netBulge.t += dt;
        if (g.phase !== 'flight') g.zoom = Math.max(0, g.zoom - real * 1.2);

        if (g.phase === 'after') g.afterT += real;
        if (g.phase === 'after' && g.afterT > 2.1) {
          const d = decided();
          if (d) return finish(d);
          setupKick(g.turn === 'you' ? 'cpu' : 'you');
          A.sound.play('whistle');
        }
      }

      function cpuShot() {
        const cfg = g.cfg;
        let tx = (Math.random() * 2 - 1) * 3.1, ty = 0.25 + Math.random() * 1.95, curl = (Math.random() * 2 - 1) * 0.8;
        if (Math.random() < cfg.cpuMiss) { if (Math.random() < 0.5) tx = Math.sign(tx || 1) * (HALF_W + 0.6 + Math.random()); else ty = BAR_H + 0.4 + Math.random() * 0.5; }
        launch(tx, ty, curl, cfg.cpuDur + Math.random() * 0.12);
      }

      function arrive() {
        const b = g.ball, s = b.shot;
        let out = g.outcome;
        if (out === 'onTarget') {
          const hands = handsAt(s.dur);
          const corner = Math.abs(s.tx) > 2.5 && s.ty > 1.7;
          const reach = (corner ? 0.62 : 0.95) + (hands.q >= 1 ? 0.1 : 0);
          out = Math.hypot(hands.x - s.tx, hands.y - s.ty) < reach && hands.q > 0.35 ? 'save' : 'goal';
          if (g.turn === 'cpu' && !g.keeper.diving) out = Math.abs(s.tx) < 0.7 && s.ty < 1.9 ? 'save' : 'goal'; // stood still
        }
        g.slow = 1; g.result = out; g.phase = 'after'; g.afterT = 0;
        b.mode = 'free';
        const pp = P(s.tx, s.ty, GOAL_Z);
        const scorer = g.turn;
        if (out === 'goal') {
          b.inNet = true; b.vx = s.curl * 0.6; b.vy = 0.5; b.vz = 6;
          g.netBulge = { x: s.tx, y: s.ty, t: 0 };
          A.sound.play('net'); setTimeout(() => A.sound.play('roar'), 80);
          if (scorer === 'you') { g.crowdJump = 1; g.flash = 1; g.fx.shake(8, 0.4); }
          else g.fx.shake(4, 0.25);
          g.fx.burst(pp.x, pp.y, ['#FFFFFF', '#FFE14D', scorer === 'you' ? '#E03A3E' : '#F2B400'], 40, { speed: 280, shape: 'confetti', size: 7, gravity: 160, life: 1.2, silent: true });
        } else if (out === 'save') {
          b.vx = (b.x - g.keeper.x) * 2 + (Math.random() - 0.5) * 3; b.vy = 3.5; b.vz = -5;
          A.sound.play('thud'); setTimeout(() => A.sound.play('ooh'), 60);
          g.fx.burst(pp.x, pp.y, ['#FFFFFF', '#C9CED8'], 18, { speed: 180, size: 4, silent: true });
          if (scorer === 'cpu') { g.flash = 0.6; g.crowdJump = 0.7; }
        } else if (out === 'post' || out === 'bar') {
          b.vx = -Math.sign(s.tx || 1) * 2; b.vy = out === 'bar' ? 4 : 2; b.vz = -6;
          A.sound.play('post'); setTimeout(() => A.sound.play('ooh'), 120);
          g.fx.shake(5, 0.25);
        } else {
          b.vx = s.tx * 0.3; b.vy = 1; b.vz = 9;
          A.sound.play('ooh');
        }
        (scorer === 'you' ? g.you : g.cpu).push(out === 'goal');
        const words = { goal: 'GOAL!', save: 'SAVED!', post: 'OFF THE POST!', bar: 'OFF THE BAR!', wide: 'WIDE!', over: 'OVER THE BAR!' };
        const good = (scorer === 'you') === (out === 'goal');
        g.msg = { text: words[out], sub: '', t: 0, big: true, good };
      }

      function decided() {
        const y = g.you.filter(Boolean).length, c = g.cpu.filter(Boolean).length, ny = g.you.length, nc = g.cpu.length;
        if (ny <= 5 && nc <= 5) {
          if (y > c + (5 - nc)) return 'you';
          if (c > y + (5 - ny)) return 'cpu';
          if (ny === 5 && nc === 5) return y === c ? null : y > c ? 'you' : 'cpu';
          return null;
        }
        if (ny === nc && y !== c) return y > c ? 'you' : 'cpu';
        return null;
      }

      // ---------- drawing ----------
      function draw() {
        const t = g.time;
        const [sx, sy] = g.fx.offset();
        ctx.save(); ctx.translate(sx, sy);
        // stadium backdrop (scaled a touch with the camera push-in)
        const zs = 1 + g.zoom * 0.04;
        const jump = Math.sin(t * 18) * 2 * g.crowdJump;
        ctx.drawImage(stadium, W / 2 - (W / 2) * zs, HZ - HZ * zs + jump, W * zs, 270 * zs);
        // camera flashes in the crowd
        const flashes = 3 + Math.floor(g.crowdJump * 25);
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < flashes; i++) if (Math.random() < 0.5) ctx.fillRect(Math.random() * W, 52 + Math.random() * 190, 2, 2);
        // floodlight glow and beams
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [46, W - 46]) {
          ctx.globalAlpha = 0.85; ctx.drawImage(glow('#FFF4D6'), lx - 70, 22 - 70, 140, 140);
          const beam = ctx.createLinearGradient(lx, 30, W / 2, 330);
          beam.addColorStop(0, 'rgba(255,248,220,.18)'); beam.addColorStop(1, 'rgba(255,248,220,0)');
          ctx.fillStyle = beam; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.moveTo(lx - 14, 26); ctx.lineTo(lx + 14, 26); ctx.lineTo(W / 2 + (lx < W / 2 ? 120 : -20), 360); ctx.lineTo(W / 2 + (lx < W / 2 ? 20 : -120), 360); ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

        drawPitch();
        drawBoards(t);
        drawNet();
        const ballBehind = g.ball.z > GOAL_Z + 0.05;
        if (ballBehind) drawBall();
        drawFrame();
        drawKeeper();
        if (!ballBehind) drawBall();
        drawKicker();
        g.fx.draw(ctx);
        drawAimHelpers();
        ctx.restore();

        // floodlit vignette and goal flash
        const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
        drawScoreboard();
        drawMessage();
      }

      function quad(a, b, c, d, fill) {
        ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
      }
      function line3(pts, color, w) {
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
        pts.forEach((p, i) => { const q = P(p[0], p[1], p[2]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.stroke();
      }

      function drawPitch() {
        // mowing stripes from far to near
        const zs = [];
        for (let z = 42; z > CAM.z + 0.4; z -= 2.2) zs.push(z);
        for (let i = 0; i < zs.length - 1; i++) {
          const z0 = zs[i], z1 = zs[i + 1];
          quad(P(-40, 0, z0), P(40, 0, z0), P(40, 0, z1), P(-40, 0, z1), i % 2 ? '#2F8A3F' : '#37984A');
        }
        // lighting: brighter pool around the goal mouth
        const c = P(0, 0, GOAL_Z - 3);
        const pool = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 260);
        pool.addColorStop(0, 'rgba(255,255,220,.14)'); pool.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = pool; ctx.fillRect(0, HZ - 10, W, H - HZ + 10);
        // lines
        const white = 'rgba(255,255,255,.85)';
        line3([[-30, 0, GOAL_Z], [30, 0, GOAL_Z]], white, 2);
        line3([[-9.16, 0, GOAL_Z], [-9.16, 0, GOAL_Z - 5.5], [9.16, 0, GOAL_Z - 5.5], [9.16, 0, GOAL_Z]], white, 2);
        line3([[-20.16, 0, GOAL_Z], [-20.16, 0, GOAL_Z - 16.5]], white, 2.5);
        line3([[20.16, 0, GOAL_Z], [20.16, 0, GOAL_Z - 16.5]], white, 2.5);
        const spot = P(0, 0, 0);
        ctx.fillStyle = white; ctx.beginPath(); ctx.ellipse(spot.x, spot.y, spot.s * 0.12, spot.s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      }

      function drawBoards(t) {
        const a = P(-16, 0.95, 16), b = P(16, 0.95, 16), c = P(16, 0, 16), d = P(-16, 0, 16);
        quad(a, b, c, d, '#0A0F24');
        ctx.save();
        ctx.beginPath(); ctx.rect(a.x, a.y, b.x - a.x, d.y - a.y); ctx.clip();
        const h = d.y - a.y;
        ctx.font = `400 ${Math.round(h * 0.62)}px Bungee, "Arial Black", sans-serif`;
        ctx.textBaseline = 'middle';
        const msg = '  BRAIN BREAK ARCADE  ✦  PLAY FAIR  ✦  NEVER GIVE UP  ✦ ';
        const wText = ctx.measureText(msg).width;
        const off = -((t * 40) % wText);
        for (let x = a.x + off; x < b.x; x += wText) {
          ctx.fillStyle = Math.floor(t / 4) % 2 ? '#5CE1E6' : '#FFB347';
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
          ctx.fillText(msg, x, a.y + h / 2);
        }
        ctx.restore(); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
      }

      // net with a bulge where the ball hits
      function netPoint(x, y, z) {
        const nb = g.netBulge;
        if (nb) {
          const k = Math.max(0, 1 - Math.hypot(x - nb.x, y - nb.y) / 1.6) * Math.exp(-nb.t * 2.2) * Math.cos(nb.t * 9);
          z += k * 0.9;
        }
        return P(x, y, z);
      }
      function drawNet() {
        const back = GOAL_Z + 2, roof = GOAL_Z + 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1;
        // back panel
        for (let x = -HALF_W; x <= HALF_W + 0.01; x += 0.4) {
          ctx.beginPath();
          for (let y = 0; y <= 2.01; y += 0.25) { const p = netPoint(x, y, back - (y / 2) * (back - roof) * 0.6); y ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
          ctx.stroke();
        }
        for (let y = 0; y <= 2.01; y += 0.33) {
          ctx.beginPath();
          for (let x = -HALF_W; x <= HALF_W + 0.01; x += 0.3) { const p = netPoint(x, y, back - (y / 2) * (back - roof) * 0.6); x > -HALF_W ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
          ctx.stroke();
        }
        // sides and roof
        for (const sx of [-HALF_W, HALF_W]) for (let i = 0; i <= 5; i++) {
          const z = GOAL_Z + (i / 5) * 2;
          line3([[sx, 0, z], [sx, BAR_H - (i / 5) * 0.44, Math.min(z, GOAL_Z + (i / 5) * 1.2 + 0.0)]], 'rgba(255,255,255,.22)', 1);
        }
        for (let x = -HALF_W; x <= HALF_W + 0.01; x += 0.6) line3([[x, BAR_H, GOAL_Z], [x, 2.0, roof]], 'rgba(255,255,255,.22)', 1);
      }

      function drawFrame() {
        // posts and crossbar with simple shading so they read as round
        const post = (x) => {
          const a = P(x, 0, GOAL_Z), b = P(x, BAR_H, GOAL_Z), w = a.s * 0.12;
          ctx.fillStyle = '#F4F6FA'; ctx.fillRect(a.x - w / 2, b.y, w, a.y - b.y);
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(a.x + w * 0.15, b.y, w * 0.35, a.y - b.y);
        };
        post(-HALF_W); post(HALF_W);
        const l = P(-HALF_W, BAR_H, GOAL_Z), r = P(HALF_W, BAR_H, GOAL_Z), w = l.s * 0.12;
        ctx.fillStyle = '#F4F6FA'; ctx.fillRect(l.x - w / 2, l.y - w / 2, r.x - l.x + w, w);
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(l.x - w / 2, l.y + w * 0.1, r.x - l.x + w, w * 0.35);
      }

      function drawBall() {
        const b = g.ball;
        // ground shadow
        const sh = P(b.x, 0, b.z);
        const hgt = Math.max(0, b.y - BALL_R);
        ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0.2, 1 - hgt / 4)})`;
        ctx.beginPath(); ctx.ellipse(sh.x, sh.y, BALL_R * sh.s * (1 + hgt * 0.2), BALL_R * sh.s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        // motion trail
        if (b.trail.length > 1 && b.mode !== 'rest') {
          for (let i = 0; i < b.trail.length; i++) {
            const tp = b.trail[i], p = P(tp.x, tp.y, tp.z);
            ctx.globalAlpha = (i / b.trail.length) * 0.35;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * p.s * (i / b.trail.length), 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        const p = P(b.x, b.y, b.z), r = Math.max(2.5, BALL_R * p.s);
        const gr = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
        gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.7, '#E6E9F0'); gr.addColorStop(1, '#9AA3B5');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#1A2238';
        for (let i = 0; i < 5; i++) {
          const a = b.spin + i * (Math.PI * 2 / 5);
          const px = p.x + Math.cos(a) * r * 0.62, py = p.y + Math.sin(a * 0.7) * r * 0.55;
          ctx.beginPath(); ctx.arc(px, py, r * 0.24, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x + Math.cos(b.spin * 0.6) * r * 0.1, p.y, r * 0.26, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(26,34,56,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      }

      // keeper faces us: body rotates around the hips as they dive
      function drawKeeper() {
        const k = g.keeper, kit = g.turn === 'you' ? GK.cpu : GK.you;
        const base = P(k.x, 0, GOAL_Z - 0.3), s = base.s;
        const bob = k.diving ? 0 : Math.sin(g.time * 5) * 0.03;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(base.x, base.y, 0.5 * s, 0.12 * s, 0, 0, Math.PI * 2); ctx.fill();
        const hip = P(k.x, 0.95 + k.y + bob, GOAL_Z - 0.3);
        const ang = k.lean * 1.35;
        ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(ang);
        const m = v => v * s;
        // legs (knees bent when ready)
        ctx.strokeStyle = '#1A2238'; ctx.lineCap = 'round';
        const legSpread = k.diving ? 0.18 : 0.22;
        for (const sd of [-1, 1]) {
          ctx.lineWidth = m(0.17); ctx.strokeStyle = '#11162B';
          ctx.beginPath(); ctx.moveTo(sd * m(0.1), 0); ctx.lineTo(sd * m(legSpread + 0.08), m(0.45)); ctx.lineTo(sd * m(legSpread), m(0.92 - bob)); ctx.stroke();
          ctx.lineWidth = m(0.12); ctx.strokeStyle = kit.shirt;
          ctx.beginPath(); ctx.moveTo(sd * m(legSpread + 0.06), m(0.55)); ctx.lineTo(sd * m(legSpread), m(0.88)); ctx.stroke();
        }
        // torso
        ctx.fillStyle = kit.shirt; ctx.strokeStyle = '#0B0F22'; ctx.lineWidth = Math.max(1, m(0.03));
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-m(0.24), -m(0.62), m(0.48), m(0.66), m(0.1)); else ctx.rect(-m(0.24), -m(0.62), m(0.48), m(0.66));
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-m(0.24), -m(0.4), m(0.48), m(0.06));
        // arms: out wide when ready, reaching when diving
        const reach = k.pose;
        for (const sd of [-1, 1]) {
          const lead = sd === Math.sign(k.lean || 1);
          const ax = sd * lerp(0.55, lead ? 0.25 : 0.4, reach), ay = lerp(-0.45, -1.15, reach);
          ctx.strokeStyle = kit.shirt; ctx.lineWidth = m(0.12);
          ctx.beginPath(); ctx.moveTo(sd * m(0.2), -m(0.52)); ctx.lineTo(m(ax), m(ay)); ctx.stroke();
          ctx.fillStyle = kit.gloves;
          ctx.beginPath(); ctx.arc(m(ax), m(ay), m(0.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // head
        ctx.fillStyle = '#E8B98A';
        ctx.beginPath(); ctx.arc(0, -m(0.76), m(0.12), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2A1C14'; ctx.beginPath(); ctx.arc(0, -m(0.8), m(0.12), Math.PI, 0); ctx.fill();
        ctx.restore();
      }

      // kicker seen from behind, with run cycle and strike
      function drawKicker() {
        const kk = g.kicker, kit = kk.kit;
        const base = P(kk.x, 0, kk.z), s = base.s, m = v => v * s;
        const running = g.phase === 'run' || g.phase === 'cpuRun';
        const ph = kk.run, strike = kk.kick > 0 ? Math.sin(Math.min(1, kk.kick) * Math.PI) : 0;
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(base.x, base.y, m(0.42), m(0.1), 0, 0, Math.PI * 2); ctx.fill();
        const lift = running ? Math.abs(Math.sin(ph)) * 0.05 : 0;
        const hipY = base.y - m(0.92 + lift);
        ctx.save(); ctx.translate(base.x, 0);
        ctx.lineCap = 'round';
        // legs
        for (const sd of [-1, 1]) {
          let bend = running ? Math.max(0, Math.sin(ph + (sd > 0 ? 0 : Math.PI))) * 0.3 : 0;
          if (sd > 0 && kk.kick > 0) bend = 0.25 + strike * 0.35; // striking leg swings through
          const footY = base.y - m(bend * 0.9), footX = m(sd * 0.14 + (sd > 0 ? strike * 0.12 : 0));
          ctx.strokeStyle = '#E8B98A'; ctx.lineWidth = m(0.15);
          ctx.beginPath(); ctx.moveTo(m(sd * 0.11), hipY + m(0.15)); ctx.lineTo(footX, footY - m(0.32)); ctx.stroke();
          ctx.strokeStyle = kit.socks; ctx.lineWidth = m(0.15);
          ctx.beginPath(); ctx.moveTo(footX, footY - m(0.38)); ctx.lineTo(footX, footY - m(0.06)); ctx.stroke();
          ctx.fillStyle = '#11162B'; ctx.beginPath(); ctx.ellipse(footX, footY - m(0.03), m(0.09), m(0.05), 0, 0, Math.PI * 2); ctx.fill();
        }
        // shorts
        ctx.fillStyle = kit.shorts; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-m(0.24), hipY - m(0.06), m(0.48), m(0.28), m(0.05)); else ctx.rect(-m(0.24), hipY - m(0.06), m(0.48), m(0.28));
        ctx.fill(); ctx.stroke();
        // shirt (back view) with name and number
        const lean = strike * 0.12;
        ctx.translate(0, hipY); ctx.rotate(-lean);
        const sg = ctx.createLinearGradient(-m(0.3), 0, m(0.3), 0);
        sg.addColorStop(0, kit.shirt); sg.addColorStop(0.5, kit.shirt); sg.addColorStop(1, 'rgba(0,0,0,.25)');
        ctx.fillStyle = kit.shirt;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-m(0.29), -m(0.68), m(0.58), m(0.7), m(0.1)); else ctx.rect(-m(0.29), -m(0.68), m(0.58), m(0.7));
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(m(0.12), -m(0.66), m(0.16), m(0.66));
        ctx.fillStyle = kit.trim; ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(m(0.09))}px "Atkinson Hyperlegible", sans-serif`;
        ctx.fillText(kk.name, 0, -m(0.5));
        ctx.font = `400 ${Math.round(m(0.3))}px Bungee, "Arial Black", sans-serif`;
        ctx.fillText(kk.num, 0, -m(0.16));
        ctx.textAlign = 'start';
        // arms swing
        for (const sd of [-1, 1]) {
          const sw = running ? Math.sin(ph + (sd > 0 ? Math.PI : 0)) * 0.12 : sd * strike * 0.2;
          ctx.strokeStyle = kit.shirt; ctx.lineWidth = m(0.13);
          ctx.beginPath(); ctx.moveTo(sd * m(0.27), -m(0.6)); ctx.lineTo(sd * m(0.34 + Math.abs(sw) * 0.4), -m(0.3) + m(sw)); ctx.stroke();
          ctx.strokeStyle = '#E8B98A'; ctx.lineWidth = m(0.1);
          ctx.beginPath(); ctx.moveTo(sd * m(0.34 + Math.abs(sw) * 0.4), -m(0.3) + m(sw)); ctx.lineTo(sd * m(0.36 + Math.abs(sw) * 0.5), -m(0.08) + m(sw)); ctx.stroke();
        }
        // head from behind
        ctx.fillStyle = '#E8B98A'; ctx.beginPath(); ctx.arc(0, -m(0.82), m(0.12), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2A1C14'; ctx.beginPath(); ctx.arc(0, -m(0.84), m(0.125), Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
        ctx.restore();
      }

      function drawAimHelpers() {
        if (g.phase === 'aim') {
          // pulsing ring around the ball
          const p = P(0, BALL_R, 0), r = BALL_R * p.s * 2.2 + Math.sin(g.time * 5) * 3;
          ctx.strokeStyle = 'rgba(255,225,77,.85)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
          if (!g.swipe && !g.keyAim) {
            const k = (g.time * 0.9) % 1;
            ctx.globalAlpha = 1 - k; ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(p.x + 6, p.y - k * 90, 8, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
        if (g.swipe) {
          const pts = g.swipe.pts;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (let i = 1; i < pts.length; i++) {
            ctx.strokeStyle = `rgba(255,225,77,${0.3 + 0.7 * i / pts.length})`; ctx.lineWidth = 3 + 7 * i / pts.length;
            ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
          }
          // easy mode: preview where the ball will go
          if (g.cfg.preview && pts.length > 2) {
            const a = pts[0], b = pts[pts.length - 1], dx = b.x - a.x, dy = a.y - b.y, L = Math.hypot(dx, dy);
            if (dy > 20) {
              const q = P(clamp((dx / dy) * 6.2, -6, 6), clamp((L - 55) / 190 * 2.9, 0.15, 3.6), GOAL_Z);
              ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.stroke();
            }
          }
        }
        if (g.keyAim) {
          const ka = g.keyAim, q = P(ka.x, ka.stage ? ka.y : BAR_H + 0.4, GOAL_Z);
          ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 2.5;
          if (ka.stage === 0) { const top = P(ka.x, BAR_H + 0.6, GOAL_Z), bot = P(ka.x, 0, GOAL_Z); ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke(); ctx.setLineDash([]); }
          else { ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, Math.PI * 2); ctx.moveTo(q.x - 14, q.y); ctx.lineTo(q.x + 14, q.y); ctx.moveTo(q.x, q.y - 14); ctx.lineTo(q.x, q.y + 14); ctx.stroke(); }
        }
        if (g.turn === 'cpu' && (g.phase === 'cpuRun' || g.phase === 'flight') && !g.dive) {
          // highlight the goal mouth as a tap target
          const a = P(-HALF_W, BAR_H, GOAL_Z), b = P(HALF_W, 0, GOAL_Z);
          ctx.fillStyle = `rgba(255,255,255,${0.06 + Math.sin(g.time * 8) * 0.04})`;
          ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        }
        if (g.dive) {
          const q = P(g.dive.x, g.dive.y, GOAL_Z);
          ctx.strokeStyle = '#7CFF6B'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.stroke();
        }
      }

      function drawScoreboard() {
        // broadcast-style score bug
        const x = 12, y = 12;
        ctx.fillStyle = 'rgba(8,12,32,.82)';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, 176, 54, 10); else ctx.rect(x, y, 176, 54); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
        const row = (label, color, arr, yy) => {
          ctx.fillStyle = color; ctx.fillRect(x + 8, yy - 9, 4, 14);
          ctx.fillStyle = '#FFFFFF'; ctx.font = '400 12px Bungee, "Arial Black", sans-serif'; ctx.fillText(label, x + 18, yy + 3);
          const total = Math.max(5, g.you.length, g.cpu.length);
          for (let i = 0; i < Math.min(total, 7); i++) {
            const v = arr[i];
            ctx.beginPath(); ctx.arc(x + 70 + i * 12, yy - 2, 4, 0, Math.PI * 2);
            ctx.fillStyle = v === true ? '#3DCB7A' : v === false ? '#FF5A5A' : 'rgba(255,255,255,.18)'; ctx.fill();
          }
          ctx.fillStyle = '#FFFFFF'; ctx.font = '400 15px Bungee, "Arial Black", sans-serif'; ctx.textAlign = 'right';
          ctx.fillText(String(arr.filter(Boolean).length), x + 168, yy + 4); ctx.textAlign = 'start';
        };
        row('YOU', '#E03A3E', g.you, y + 18);
        row('CPU', '#F2B400', g.cpu, y + 40);
        const sd = g.you.length > 5 || g.cpu.length > 5;
        ctx.fillStyle = sd ? '#FF5A5A' : 'rgba(255,255,255,.75)';
        ctx.font = '700 10px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(sd ? 'SUDDEN DEATH' : 'PENALTIES', W - 12, 22); ctx.textAlign = 'start';
      }

      function drawMessage() {
        const m = g.msg;
        if (!m) return;
        ctx.textAlign = 'center';
        if (m.big) {
          const k = Math.min(1, m.t * 4), sc = 0.6 + ease(k) * 0.4 + Math.max(0, 0.15 - m.t) ;
          const fade = Math.min(1, Math.max(0, 2.0 - m.t) * 2);
          ctx.save(); ctx.translate(W / 2, 330); ctx.scale(sc, sc); ctx.rotate(-0.05); ctx.globalAlpha = fade;
          ctx.font = `400 ${m.text.length > 8 ? 30 : 46}px Bungee, "Arial Black", sans-serif`;
          // extruded 3D title
          for (let i = 6; i > 0; i--) { ctx.fillStyle = '#0B0F22'; ctx.fillText(m.text, i * 0.8, i); }
          const gr = ctx.createLinearGradient(0, -30, 0, 10);
          if (m.good) { gr.addColorStop(0, '#FFF6B0'); gr.addColorStop(1, '#FFB000'); } else { gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#B9C2D8'); }
          ctx.fillStyle = gr; ctx.fillText(m.text, 0, 0);
          // light sweep across the letters
          const sw = ((m.t * 1.4) % 1.6 - 0.3) * 260;
          ctx.globalCompositeOperation = 'source-atop';
          const shine = ctx.createLinearGradient(sw - 40, 0, sw + 40, 0);
          shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(0.5, 'rgba(255,255,255,.7)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = shine; ctx.fillRect(-180, -50, 360, 70);
          ctx.restore();
        } else if (m.t < 2.6) {
          const a = Math.min(1, m.t * 3) * Math.min(1, (2.6 - m.t) * 2);
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(8,12,32,.75)';
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - 120, 82, 240, 52, 12); else ctx.rect(W / 2 - 120, 82, 240, 52); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.font = '400 17px Bungee, "Arial Black", sans-serif'; ctx.fillText(m.text, W / 2, 106);
          ctx.fillStyle = '#B9C2D8'; ctx.font = '700 12px "Atkinson Hyperlegible", sans-serif'; ctx.fillText(m.sub, W / 2, 124);
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'start';
      }

      function finish(winner) {
        cancelAnimationFrame(raf);
        A.sound.crowd(false);
        const y = g.you.filter(Boolean).length, c = g.cpu.filter(Boolean).length;
        g = null;
        if (winner === 'you') A.store.set('ps-wins', A.store.get('ps-wins', 0) + 1);
        el.innerHTML = `
          <div class="result">
            <span class="label">Full time · Penalties</span>
            <span class="big">${y} – ${c}</span>
            <span class="newbest">${winner === 'you' ? 'You win the shootout!' : 'The computer wins this time.'}</span>
            <div class="row">
              <button class="btn primary" data-act="go">Play again</button>
              <button class="btn" data-act="menu">Change difficulty</button>
            </div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'go') start();
        else if (b.dataset.act === 'menu') intro();
        else if (b.dataset.mode) { level = b.dataset.mode; A.store.set('ps-level', level); intro(); }
      };
      const onKey = e => {
        if (!g) return;
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          if (g.phase !== 'aim') return;
          if (!g.keyAim) g.keyAim = { stage: 0, t: 0, x: 0, y: 1 };
          else if (g.keyAim.stage === 0) { g.keyAim.stage = 1; g.keyAim.t = 0; }
          else { const ka = g.keyAim; g.keyAim = null; takeKick(ka.x, ka.y, 0, 0.62); }
        }
        if (g.turn === 'cpu' && !g.dive && (g.phase === 'cpuRun' || g.phase === 'flight')) {
          const map = { ArrowLeft: [-2.6, 0.7], ArrowRight: [2.6, 0.7], ArrowUp: [0, 1.9], ArrowDown: [0, 0.5], q: [-2.6, 1.9], e: [2.6, 1.9] };
          const v = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
          if (v) { e.preventDefault(); g.dive = { x: v[0], y: v[1] }; diveTo(v[0], v[1], 0); A.sound.play('swish'); }
        }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { cancelAnimationFrame(raf); A.sound.crowd(false); g = null; document.removeEventListener('keydown', onKey); };
    },
  });
})();
