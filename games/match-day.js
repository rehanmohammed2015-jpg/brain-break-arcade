/* Match Day: a real-time 5-a-side soccer match under the floodlights.
   You control one player at a time; your teammates and the other team are run by the computer. */
(function () {
  const A = Arcade;
  const W = 600, H = 400;
  const L = 60, WD = 36, GY0 = 15, GY1 = 21, GH = 2.2, GMID = 18;
  const K = 22, FAR = 150, NEAR = 372;           // camera: pixels per metre at the near touchline, far/near touchline screen rows
  const MATCH_SECONDS = 180;                     // 3 real minutes shown as 90 match minutes
  const LEVEL = {
    easy: { speed: 0.86, tackle: 0.2, acc: 0.5, gkReact: 0.34, pass: 0.45 },
    medium: { speed: 0.95, tackle: 0.34, acc: 0.68, gkReact: 0.22, pass: 0.65 },
    hard: { speed: 1.04, tackle: 0.5, acc: 0.82, gkReact: 0.13, pass: 0.85 },
  };
  const MATES = { speed: 0.97, tackle: 0.34, acc: 0.68, gkReact: 0.2, pass: 0.65 };
  const TEAMS = [
    { name: 'RED', shirt: '#E03A3E', shorts: '#FFFFFF', socks: '#E03A3E', num: '#FFFFFF', gk: '#7CFF6B', hair: '#2A1C14' },
    { name: 'YELLOW', shirt: '#F2B400', shorts: '#1A2238', socks: '#F2B400', num: '#1A2238', gk: '#2BB3D6', hair: '#3B2A1E' },
  ];
  // home positions for the team attacking to the right (mirrored for the other team)
  const FORM = [{ x: 1.4, y: 18, gk: true, n: 1 }, { x: 15, y: 11, n: 4 }, { x: 15, y: 25, n: 5 }, { x: 27, y: 13, n: 10 }, { x: 27, y: 23, n: 9 }];
  const SKIN = ['#E8B98A', '#C68E5E', '#8D5A3B', '#F1C9A5', '#A86B45'];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  A.css('md-css', `
    .md-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .md-canvas { display: block; width: min(100%, 900px); aspect-ratio: 3 / 2; height: auto; border: var(--bw) solid var(--ink); border-radius: 14px; background: #0E1A44; touch-action: none; }
    .md-controls { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: min(100%, 900px); flex-wrap: wrap; }
    .md-stick { width: 118px; height: 118px; border-radius: 50%; border: 3px solid var(--ink); background: radial-gradient(circle, var(--paper) 0 30%, var(--grid) 31% 100%); position: relative; touch-action: none; flex: none; }
    .md-stick i { position: absolute; left: 50%; top: 50%; width: 50px; height: 50px; margin: -25px; border-radius: 50%; background: var(--accent); border: 3px solid var(--ink); box-shadow: 2px 2px 0 var(--shadow); }
    .md-btns { display: grid; grid-template-columns: repeat(2, 92px); gap: 10px; touch-action: none; }
    .md-btns button { height: 52px; padding: 0; font-size: 15px; touch-action: none; user-select: none; -webkit-user-select: none; }
    .md-btns button.held { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--shadow); filter: brightness(1.1); }
    .md-keys { font-size: 13px; color: var(--ink-soft); flex: 1 1 220px; min-width: 0; text-align: center; }
    .md-keys b { color: var(--ink); }
    @media (hover: hover) and (pointer: fine) { .md-stick { display: none; } }
    .md-art { position: relative; width: 100%; height: 100%; }
  `);

  // ---------- stadium backdrop, drawn once and scrolled for parallax ----------
  let stadium = null;
  function buildStadium() {
    const SW = 1200, SH = 170, dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas'); c.width = SW * dpr; c.height = SH * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const sky = x.createLinearGradient(0, 0, 0, SH);
    sky.addColorStop(0, '#050A1F'); sky.addColorStop(1, '#1B2B63');
    x.fillStyle = sky; x.fillRect(0, 0, SW, SH);
    const cols = ['#E03A3E', '#E03A3E', '#FFFFFF', '#F2B400', '#F2B400', '#2E5BFF', '#F4C9A0', '#C68E5E', '#8D5A3B', '#1A2238', '#E8E8F0'];
    for (const [y0, y1, col] of [[36, 82, '#141B3A'], [82, 128, '#182045'], [128, 170, '#1C2550']]) {
      x.fillStyle = col; x.fillRect(0, y0, SW, y1 - y0);
      for (let y = y0 + 3; y < y1 - 3; y += 4.5) for (let px = Math.random() * 3; px < SW; px += 3.6 + Math.random() * 1.6) {
        x.fillStyle = cols[Math.floor(Math.random() * cols.length)]; x.globalAlpha = 0.5 + Math.random() * 0.45;
        x.fillRect(px, y + Math.random(), 2.3, 2.8);
      }
      x.globalAlpha = 1; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y1 - 2, SW, 2);
    }
    x.fillStyle = '#070B1E'; x.fillRect(0, 0, SW, 30);
    for (const fx of [140, 600, 1060]) {
      x.fillStyle = '#2A3150'; x.fillRect(fx - 26, 6, 52, 16);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { x.fillStyle = '#FFFBE8'; x.fillRect(fx - 23 + i * 8.2, 8 + j * 7, 6, 5); }
    }
    return c;
  }
  const glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, color); gr.addColorStop(0.2, color + 'AA'); gr.addColorStop(1, color + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (glowCache[color] = c);
  }

  A.register({
    id: 'match-day',
    section: 'sports',
    title: 'Match Day',
    color: 'good',
    featured: true,
    artBg: 'linear-gradient(#0E1A44, #1B2B63 42%, #37984A 42%, #2F8A3F)',
    art: `<svg width="200" height="112" viewBox="0 0 200 112" aria-hidden="true">
      <circle cx="30" cy="12" r="9" fill="#FFFBE8" opacity=".9"/><circle cx="170" cy="12" r="9" fill="#FFFBE8" opacity=".9"/>
      <path d="M20 108 L60 50 H140 L180 108 Z" fill="none" stroke="#fff" stroke-width="2" opacity=".75"/>
      <path d="M100 50 V108" stroke="#fff" stroke-width="2" opacity=".75"/><ellipse cx="100" cy="78" rx="18" ry="9" fill="none" stroke="#fff" stroke-width="2" opacity=".75"/>
      <g transform="translate(70 60)"><rect x="-6" y="-14" width="12" height="15" rx="4" fill="#E03A3E" stroke="#1A2238" stroke-width="1.5"/><circle cy="-18" r="4" fill="#E8B98A" stroke="#1A2238" stroke-width="1.5"/><path d="M-3 1 L-5 10 M3 1 L6 10" stroke="#1A2238" stroke-width="3" stroke-linecap="round"/></g>
      <g transform="translate(128 70)"><rect x="-6" y="-14" width="12" height="15" rx="4" fill="#F2B400" stroke="#1A2238" stroke-width="1.5"/><circle cy="-18" r="4" fill="#C68E5E" stroke="#1A2238" stroke-width="1.5"/><path d="M-3 1 L-6 10 M3 1 L5 10" stroke="#1A2238" stroke-width="3" stroke-linecap="round"/></g>
      <circle cx="96" cy="76" r="4" fill="#fff" stroke="#1A2238" stroke-width="1.5"/>
    </svg>`,
    blurb: 'A real 5-a-side match under the floodlights. Dribble, pass, charge up shots and tackle against a computer team. Three minutes, winner takes the cup.',
    tags: ['Soccer', 'Real-time match', 'vs Computer'],
    best() { const w = A.store.get('md-wins', 0); return w ? w + (w === 1 ? ' win' : ' wins') : null; },
    mount(el) {
      let level = A.store.get('md-level', 'medium');
      let raf = 0, g = null, ctx = null, cv = null;
      const keys = {};
      const inp = { x: 0, y: 0, sprint: false, shoot: false, shootT: 0, stickX: 0, stickY: 0 };

      function intro() {
        cancelAnimationFrame(raf); g = null; A.sound.crowd(false);
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Kick-off under the lights</h2>
            <p>You’re <b>Red</b>, attacking to the right. You control the player with the glowing ring. Your teammates and the yellow team play on their own.</p>
            <p><b>Keyboard:</b> move with the arrows or W A S D, <b>E</b> to pass, hold <b>Space</b> to charge a shot and let go to shoot, <b>Shift</b> to sprint, <b>Q</b> to switch players. Run into the player with the ball to tackle. <b>Touch:</b> use the stick and the buttons under the pitch.</p>
          </div>
          ${A.modePicker(level, true)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Kick off</button>
            <span class="best" style="align-self:center">Matches won: <b>${A.store.get('md-wins', 0)}</b></span>
          </div>`;
      }

      function start() {
        if (!stadium) stadium = buildStadium();
        el.innerHTML = `
          <div class="md-wrap">
            <canvas class="md-canvas" id="md-canvas" aria-label="Soccer match"></canvas>
            <div class="md-controls">
              <div class="md-stick" id="md-stick" aria-label="Movement stick"><i></i></div>
              <p class="md-keys"><b>Arrows/WASD</b> move · <b>E</b> pass · hold <b>Space</b> shoot · <b>Shift</b> sprint · <b>Q</b> switch</p>
              <div class="md-btns">
                <button class="btn" data-btn="switch">Switch</button>
                <button class="btn" data-btn="sprint">Sprint</button>
                <button class="btn" data-btn="pass">Pass</button>
                <button class="btn primary" data-btn="shoot">Shoot</button>
              </div>
            </div>
          </div>`;
        cv = el.querySelector('#md-canvas');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = W * dpr; cv.height = H * dpr;
        ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
        bindTouch();
        g = {
          cfg: LEVEL[level], score: [0, 0], clock: 0, half: 1, phase: 'kickoff', phaseT: 0, slow: 1,
          cam: { x: L / 2, shake: 0 }, fx: A.particles(), msg: null, players: [], ball: null, ctrl: null,
          shots: [0, 0], poss: [0, 0], last: performance.now(), time: 0, flash: 0,
        };
        for (let t = 0; t < 2; t++) FORM.forEach((f, i) => g.players.push({
          team: t, idx: i, gk: !!f.gk, num: f.n, home: { x: t ? L - f.x : f.x, y: f.y },
          x: 0, y: 0, vx: 0, vy: 0, fx: t ? -1 : 1, fy: 0, run: Math.random() * 6, kickCD: 0, tackleCD: 0, hold: 0,
          skin: SKIN[(i + t * 2) % SKIN.length], lunge: 0, dive: 0, stamina: 1,
        }));
        g.ball = { x: L / 2, y: GMID, z: 0, vx: 0, vy: 0, vz: 0, owner: null, spin: 0, last: 0, inNet: false, trail: [] };
        A.sound.crowd(true);
        kickoff(0);
        raf = requestAnimationFrame(frame);
      }

      // ---------- touch controls ----------
      function bindTouch() {
        const stick = el.querySelector('#md-stick'), knob = stick.querySelector('i');
        let sid = null;
        const moveStick = e => {
          const r = stick.getBoundingClientRect();
          let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          const d = Math.hypot(dx, dy), max = r.width / 2 - 20;
          if (d > max) { dx *= max / d; dy *= max / d; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          inp.stickX = dx / max; inp.stickY = dy / max;
        };
        stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); });
        stick.addEventListener('pointermove', e => { if (e.pointerId === sid) moveStick(e); });
        const endStick = () => { sid = null; inp.stickX = inp.stickY = 0; knob.style.transform = ''; };
        stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
        el.querySelectorAll('[data-btn]').forEach(b => {
          const k = b.dataset.btn;
          b.addEventListener('pointerdown', e => {
            e.preventDefault(); b.classList.add('held');
            if (k === 'pass') press('pass'); if (k === 'switch') press('switch');
            if (k === 'sprint') inp.sprintBtn = true;
            if (k === 'shoot') startShoot();
          });
          const up = () => { b.classList.remove('held'); if (k === 'sprint') inp.sprintBtn = false; if (k === 'shoot') releaseShoot(); };
          b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
        });
      }

      // ---------- projection: a raised broadcast camera on the near side ----------
      const scaleAt = y => 0.68 + 0.32 * clamp(y / WD, -0.3, 1.3);
      function P(x, y, z = 0) {
        const s = scaleAt(y);
        return { x: W / 2 + (x - g.cam.x) * K * s, y: FAR + (NEAR - FAR) * (y / WD) - z * K * s * 0.92, s: K * s };
      }

      // ---------- set pieces ----------
      function kickoff(team) {
        g.players.forEach(p => {
          const kx = p.team === 0 ? Math.min(p.home.x, L / 2 - 2.5) : Math.max(p.home.x, L / 2 + 2.5);
          p.x = kx; p.y = p.home.y; p.vx = p.vy = 0; p.fx = p.team ? -1 : 1; p.fy = 0; p.hold = 0; p.kickCD = 0.5; p.dive = 0;
        });
        const taker = g.players.find(p => p.team === team && p.idx === 3);
        taker.x = L / 2 + (team ? 0.7 : -0.7); taker.y = GMID;
        const b = g.ball; Object.assign(b, { x: L / 2, y: GMID, z: 0, vx: 0, vy: 0, vz: 0, owner: null, inNet: false, trail: [] });
        g.ctrl = team === 0 ? taker : g.players.find(p => p.team === 0 && p.idx === 3);
        g.phase = 'kickoff'; g.phaseT = 0; g.kickTeam = team;
        g.msg = { text: g.half === 2 && g.clock < MATCH_SECONDS / 2 + 1 ? 'SECOND HALF' : 'KICK OFF', t: 0, small: true };
        A.sound.play('whistle');
      }

      // ---------- actions ----------
      function press(what) {
        if (!g || g.phase !== 'play') return;
        const me = g.ctrl, b = g.ball;
        if (what === 'switch') { switchPlayer(true); return; }
        if (what === 'pass') {
          if (b.owner === me) { const t = bestPass(me, true); if (t) pass(me, t); }
          else tryTackle(me, true);
        }
      }
      function startShoot() { if (!g || g.phase !== 'play') return; inp.shoot = true; inp.shootT = 0; }
      function releaseShoot() {
        if (!inp.shoot) return; inp.shoot = false;
        if (!g || g.phase !== 'play') return;
        const me = g.ctrl;
        if (g.ball.owner === me) {
          const charge = clamp(inp.shootT / 0.9, 0.15, 1);
          // hold up/down while shooting to pick the far or near corner; otherwise aim across the keeper
          const aimY = Math.abs(inp.y) > 0.2 ? clamp(inp.y * 2.6, -2.6, 2.6) : (me.y < GMID ? 1.8 : -1.8);
          shoot(me, charge, aimY, 0.88);
        } else tryTackle(me, true);
      }

      function switchPlayer(manual) {
        const b = g.ball;
        const mates = g.players.filter(p => p.team === 0 && !p.gk && p !== g.ctrl);
        const ref = b.owner && b.owner.team === 1 ? b.owner : b;
        mates.sort((a, c) => dist(a, ref) - dist(c, ref));
        if (mates[0] && (manual || dist(mates[0], ref) + 3 < dist(g.ctrl, ref))) g.ctrl = mates[0];
      }

      function kickFx(p) {
        const q = P(g.ball.x, g.ball.y);
        g.fx.burst(q.x, q.y, ['#8FD18F', '#FFFFFF', '#5E9E5E'], 6, { speed: 70, angle: -Math.PI / 2, spread: 2.2, size: 2.5, silent: true, gravity: 220 });
      }

      function pass(p, t) {
        const b = g.ball;
        const lead = { x: t.x + t.vx * 0.45, y: t.y + t.vy * 0.45 };
        const d = dist(p, lead);
        const sp = clamp(8.5 + d * 0.55, 9, 21);
        b.owner = null; b.last = p.team; b.passTo = t;
        b.vx = (lead.x - b.x) / d * sp; b.vy = (lead.y - b.y) / d * sp; b.vz = d > 17 ? 4.2 : 0.4;
        p.kickCD = 0.3; p.hold = 0;
        A.sound.play('kick'); kickFx(p);
      }
      function shoot(p, charge, aimY, acc) {
        const b = g.ball, dir = p.team === 0 ? 1 : -1, gx = p.team === 0 ? L + 0.2 : -0.2;
        const miss = (1 - acc) * (Math.random() * 2 - 1) * 3.2 + (charge > 0.9 ? (Math.random() * 2 - 1) * 1.2 : 0);
        const ty = GMID + aimY + miss;
        const dx = gx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
        const sp = 15 + charge * 15;
        b.owner = null; b.last = p.team; b.passTo = null; b.shot = true;
        b.vx = dx / d * sp; b.vy = dy / d * sp;
        const tt = d / sp; // aim the height so it arrives low for soft shots, higher for hard ones
        const zAt = 0.3 + charge * 1.5 + (Math.random() * 0.6) + (charge > 0.92 ? 0.9 : 0);
        b.vz = (zAt + 0.5 * 9.8 * tt * tt) / tt;
        p.kickCD = 0.45; p.hold = 0; p.lunge = 0.25;
        g.shots[p.team]++;
        A.sound.play('kick'); kickFx(p); g.fx.shake(2 + charge * 3, 0.15);
        const q = P(b.x, b.y);
        g.fx.ring(q.x, q.y, '#FFFFFF', 18 + charge * 18, 0.3);
      }
      function tryTackle(p, user) {
        const b = g.ball, o = b.owner;
        if (!o || o.team === p.team || p.tackleCD > 0) return;
        p.tackleCD = user ? 0.55 : 0.9; p.lunge = 0.3;
        if (dist(p, o) > (user ? 1.7 : 1.1)) return;
        const chance = user ? 0.62 : (p.team === 1 ? g.cfg.tackle : MATES.tackle);
        if (Math.random() < chance) {
          b.owner = p; b.last = p.team; p.hold = 0; o.kickCD = 0.6;
          const q = P(b.x, b.y);
          g.fx.ring(q.x, q.y, '#FFFFFF', 26, 0.3);
          A.sound.play('thud');
          if (p.team === 0) g.ctrl = p;
        }
      }
      function laneOpen(a, t) {
        // how close is the nearest opponent to the passing line?
        let best = 9;
        const dx = t.x - a.x, dy = t.y - a.y, len2 = dx * dx + dy * dy || 1;
        for (const o of g.players) {
          if (o.team === a.team) continue;
          const u = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / len2, 0, 1);
          best = Math.min(best, Math.hypot(a.x + dx * u - o.x, a.y + dy * u - o.y));
        }
        return best;
      }
      function bestPass(p, user) {
        const dir = p.team === 0 ? 1 : -1;
        let best = null, bs = -Infinity;
        for (const t of g.players) {
          if (t.team !== p.team || t === p || t.gk) continue;
          const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy) || 1;
          const open = laneOpen(p, t);
          let s = (dx * dir) / 12 + Math.min(open, 4) / 2 - d / 25;
          if (user) { const face = (dx * p.fx + dy * p.fy) / d; s += face * 2.2; }
          if (open < 1.1) s -= 2;
          if (s > bs) { bs = s; best = t; }
        }
        return best;
      }

      // ---------- main loop ----------
      function frame(now) {
        if (!g) return;
        const real = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        const dt = real * g.slow;
        g.time += real;
        update(dt, real);
        if (!g) return;
        draw();
        raf = requestAnimationFrame(frame);
      }

      function readInput() {
        let x = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
        let y = ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
        if (!x && !y && (Math.abs(inp.stickX) > 0.15 || Math.abs(inp.stickY) > 0.15)) { x = inp.stickX; y = inp.stickY; }
        inp.x = x; inp.y = y;
        inp.sprint = !!(keys.Shift || inp.sprintBtn);
      }

      function update(dt, real) {
        g.fx.update(real);
        g.flash = Math.max(0, g.flash - real * 1.4);
        if (g.msg) g.msg.t += real;
        readInput();
        if (inp.shoot) inp.shootT += real;

        if (g.phase === 'kickoff') {
          g.phaseT += real;
          if (g.phaseT > 1.3) { g.phase = 'play'; const taker = g.players.find(p => p.team === g.kickTeam && p.idx === 3); g.ball.owner = taker; taker.hold = 0; }
        }
        if (g.phase === 'goal') {
          g.phaseT += real;
          if (g.phaseT > 0.9) g.slow = 1;
          if (g.phaseT > 2.6) { if (g.clock >= MATCH_SECONDS) return finish(); kickoff(g.concede); }
        }
        if (g.phase === 'half') { g.phaseT += real; if (g.phaseT > 2.2) { g.half = 2; kickoff(1); } }
        if (g.phase === 'play') {
          g.clock += dt;
          if (g.ball.owner) g.poss[g.ball.owner.team] += dt;
          if (g.half === 1 && g.clock >= MATCH_SECONDS / 2) { g.phase = 'half'; g.phaseT = 0; g.msg = { text: 'HALF TIME', t: 0, big: true }; A.sound.play('whistle'); }
          else if (g.clock >= MATCH_SECONDS) { A.sound.play('whistle'); return finish(); }
        }

        const live = g.phase === 'play';
        for (const p of g.players) {
          p.kickCD = Math.max(0, p.kickCD - dt); p.tackleCD = Math.max(0, p.tackleCD - dt);
          p.lunge = Math.max(0, p.lunge - dt); p.dive = Math.max(0, p.dive - dt);
          if (!live) { p.vx *= 0.85; p.vy *= 0.85; continue; }
          if (p === g.ctrl) controlUser(p, dt);
          else if (p.gk) keeperAI(p, dt);
          else outfieldAI(p, dt);
        }
        // keep players from stacking on top of each other
        for (let i = 0; i < g.players.length; i++) for (let j = i + 1; j < g.players.length; j++) {
          const a = g.players[i], c = g.players[j], d = dist(a, c);
          if (d < 0.75 && d > 0.001) { const push = (0.75 - d) / 2, nx = (c.x - a.x) / d, ny = (c.y - a.y) / d; a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push; }
        }
        for (const p of g.players) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.x = clamp(p.x, 0.4, L - 0.4); p.y = clamp(p.y, 0.4, WD - 0.4);
          const sp = Math.hypot(p.vx, p.vy);
          p.run += dt * sp * 2.2;
          if (sp > 0.4) { p.fx = p.vx / sp; p.fy = p.vy / sp; }
        }
        updateBall(dt);
        if (live && !(g.ball.owner && g.ball.owner.team === 0)) {
          g.switchT = (g.switchT || 0) + dt;
          if (g.switchT > 0.6) { g.switchT = 0; switchPlayer(false); }
        }
        // camera eases after the ball, leading a little in its direction of travel
        const b = g.ball, view = W / 2 / K;
        const target = clamp(b.x + b.vx * 0.25, view - 4, L - view + 4);
        g.cam.x += (target - g.cam.x) * Math.min(1, real * 4);
      }

      function move(p, tx, ty, speed, dt) {
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const want = d > 0.25 ? speed * Math.min(1, d / 1.2) : 0;
        const vx = d > 0.001 ? dx / d * want : 0, vy = d > 0.001 ? dy / d * want : 0;
        const k = Math.min(1, dt * 7);
        p.vx += (vx - p.vx) * k; p.vy += (vy - p.vy) * k;
      }

      function controlUser(p, dt) {
        const len = Math.hypot(inp.x, inp.y);
        const sprinting = inp.sprint && p.stamina > 0.05 && len > 0.1;
        p.stamina = clamp(p.stamina + (sprinting ? -0.35 : 0.18) * dt, 0, 1);
        const sp = (sprinting ? 8.1 : 6.4) * (g.ball.owner === p ? 0.9 : 1);
        if (len > 0.1) {
          const k = Math.min(1, dt * 9);
          p.vx += (inp.x / Math.max(1, len) * sp - p.vx) * k;
          p.vy += (inp.y / Math.max(1, len) * sp - p.vy) * k;
        } else { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
        // run into a carrier to tackle
        const o = g.ball.owner;
        if (o && o.team !== p.team && dist(p, o) < 0.9 && p.tackleCD <= 0) tryTackle(p, true);
      }

      function keeperAI(p, dt) {
        const b = g.ball, dir = p.team === 0 ? 1 : -1, gx = p.team === 0 ? 0.9 : L - 0.9;
        const cfg = p.team === 1 ? g.cfg : MATES;
        if (b.owner === p) {
          p.hold += dt;
          move(p, gx + dir * 1.2, GMID, 2, dt);
          if (p.hold > 1.1) { const t = bestPass(p, false); if (t) pass(p, t); }
          return;
        }
        const towards = !b.owner && b.vx * dir < -6;
        let ty;
        if (towards) {
          b.seenT = (b.seenT || 0) + dt;
          const tHit = (b.x - gx) / -b.vx;
          ty = b.seenT > cfg.gkReact ? b.y + b.vy * tHit : GMID + (b.y - GMID) * 0.4;
          if (b.seenT > cfg.gkReact && Math.abs(ty - p.y) > 0.6 && tHit < 0.6) p.dive = 0.35;
        } else { b.seenT = 0; ty = GMID + (b.y - GMID) * 0.45; }
        ty = clamp(ty, GY0 + 0.3, GY1 - 0.3);
        const out = Math.abs(b.x - gx) < 12 && !towards ? 1.6 : 0.2;
        move(p, gx + dir * out, ty, towards ? 8.5 : 5, dt);
      }

      function outfieldAI(p, dt) {
        const b = g.ball, o = b.owner, cfg = p.team === 1 ? g.cfg : MATES;
        const dir = p.team === 0 ? 1 : -1;
        const run = 6.2 * cfg.speed;
        if (o === p) return carrierAI(p, dt, cfg);
        const attacking = o && o.team === p.team;
        if (attacking) {
          // find space ahead of the ball
          const hx = clamp(p.home.x + (b.x - L / 2) * 0.6 + dir * 7, 4, L - 4);
          const hy = clamp(p.home.y * 0.7 + b.y * 0.3 + Math.sin(g.time * 0.7 + p.idx) * 2, 3, WD - 3);
          move(p, hx, hy, run * 0.85, dt);
          return;
        }
        // loose ball or defending
        if (b.passTo === p && !o) { move(p, b.x + b.vx * 0.2, b.y + b.vy * 0.2, run * 1.1, dt); return; }
        const team = g.players.filter(q => q.team === p.team && !q.gk && q !== g.ctrl);
        const ref = o || b;
        team.sort((a, c) => dist(a, ref) - dist(c, ref));
        const userPressing = p.team === 0 && dist(g.ctrl, ref) < dist(team[0], ref) + 1.5;
        if (team[0] === p && !userPressing) {
          // press the ball
          move(p, ref.x + (o ? -dir * 0.3 : b.vx * 0.15), ref.y + (o ? 0 : b.vy * 0.15), run * 1.08, dt);
          if (o && dist(p, o) < 1.0) tryTackle(p, false);
        } else if (team[1] === p || (team[0] === p && userPressing)) {
          // cover: stay goal-side of the ball
          const ox = p.team === 0 ? 0 : L;
          move(p, lerp(ref.x, ox, 0.35), lerp(ref.y, GMID, 0.35), run, dt);
        } else {
          const hx = clamp(p.home.x + (b.x - L / 2) * 0.5 - dir * 3, 3, L - 3);
          move(p, hx, clamp(p.home.y * 0.75 + b.y * 0.25, 3, WD - 3), run * 0.8, dt);
        }
      }

      function carrierAI(p, dt, cfg) {
        p.hold += dt;
        const dir = p.team === 0 ? 1 : -1, gx = p.team === 0 ? L : 0;
        const dGoal = Math.hypot(gx - p.x, GMID - p.y);
        let near = null, nd = 99;
        for (const o of g.players) if (o.team !== p.team && !o.gk) { const d = dist(p, o); if (d < nd) { nd = d; near = o; } }
        if (p.hold > 0.3 && dGoal < 15 && Math.abs(p.y - GMID) < 10 && p.kickCD <= 0) {
          const keeper = g.players.find(q => q.team !== p.team && q.gk);
          const aim = keeper.y > GMID ? -2.2 : 2.2;
          return shoot(p, 0.45 + Math.random() * 0.45, aim + (Math.random() - 0.5), cfg.acc);
        }
        if (p.hold > 0.45 && nd < 2.4 && Math.random() < cfg.pass * dt * 5) {
          const t = bestPass(p, false);
          if (t && laneOpen(p, t) > 1.1) return pass(p, t);
        }
        // dribble toward goal, steering away from defenders
        let tx = gx - dir * 2, ty = GMID + (p.y - GMID) * 0.35;
        let ax = tx - p.x, ay = ty - p.y; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        for (const o of g.players) {
          if (o.team === p.team) continue;
          const d = dist(p, o);
          if (d < 4 && d > 0.01) { ax += (p.x - o.x) / d * (4 - d) * 0.25; ay += (p.y - o.y) / d * (4 - d) * 0.45; }
        }
        const n = Math.hypot(ax, ay) || 1;
        move(p, p.x + ax / n * 3, p.y + ay / n * 3, 5.6 * cfg.speed, dt);
      }

      // ---------- ball ----------
      function updateBall(dt) {
        const b = g.ball;
        if (b.owner) {
          const o = b.owner;
          b.x = clamp(o.x + o.fx * 0.55, 0.25, L - 0.25); b.y = clamp(o.y + o.fy * 0.45, 0.3, WD - 0.3); b.z = 0;
          b.vx = o.vx; b.vy = o.vy; b.vz = 0; b.passTo = null; b.shot = false;
          b.spin += Math.hypot(o.vx, o.vy) * dt * 2;
        } else {
          b.vz -= 9.8 * dt;
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
          b.spin += Math.hypot(b.vx, b.vy) * dt * 2;
          if (b.z <= 0) {
            b.z = 0;
            if (b.vz < -2.5) b.vz = -b.vz * 0.42; else b.vz = 0;
          }
          const drag = b.z > 0.05 ? Math.pow(0.9, dt) : Math.pow(0.42, dt);
          b.vx *= drag; b.vy *= drag;
          // side boards
          if (b.y < 0.25) { b.y = 0.25; b.vy = Math.abs(b.vy) * 0.65; board(b); }
          if (b.y > WD - 0.25) { b.y = WD - 0.25; b.vy = -Math.abs(b.vy) * 0.65; board(b); }
          // ends: goal, post, crossbar or boards
          for (const end of [0, L]) {
            const crossing = end === 0 ? b.x < 0.1 : b.x > L - 0.1;
            if (!crossing || b.inNet) continue;
            const inMouth = b.y > GY0 + 0.12 && b.y < GY1 - 0.12;
            if (inMouth && b.z < GH - 0.1) { b.inNet = true; goal(end === 0 ? 1 : 0); }
            else if (inMouth && b.z < GH + 0.25) { b.vz = -Math.abs(b.vz) - 1; b.vx = -b.vx * 0.5; b.x = end === 0 ? 0.15 : L - 0.15; post(b); }
            else if (Math.abs(b.y - GY0) < 0.3 || Math.abs(b.y - GY1) < 0.3) { b.vx = -b.vx * 0.6; b.vy += (Math.random() - 0.5) * 4; b.x = end === 0 ? 0.15 : L - 0.15; post(b); }
            else { b.vx = -b.vx * 0.6; b.x = end === 0 ? 0.15 : L - 0.15; board(b); }
          }
          if (b.inNet) {
            const back = b.x < L / 2 ? -1.3 : L + 1.3;
            if ((b.x < L / 2 && b.x < back) || (b.x > L / 2 && b.x > back)) { b.x = back; b.vx *= -0.2; }
            b.y = clamp(b.y, GY0 + 0.2, GY1 - 0.2); b.z = Math.min(b.z, GH - 0.2);
          }
          if (g.phase === 'play' && !b.inNet) pickup(b);
        }
        b.trail.push({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 8) b.trail.shift();
      }
      function board(b) { if (Math.hypot(b.vx, b.vy) > 6) A.sound.play('thud'); }
      function post(b) { A.sound.play('post'); setTimeout(() => A.sound.play('ooh'), 100); g.fx.shake(4, 0.2); b.shot = false; }

      function pickup(b) {
        const speed = Math.hypot(b.vx, b.vy);
        let best = null, bd = 99;
        for (const p of g.players) {
          if (p.kickCD > 0) continue;
          const reach = p.gk ? 1.25 + (p.dive > 0 ? 0.6 : 0) : 0.8;
          const zMax = p.gk ? 2.5 : 0.8;
          const d = dist(p, b);
          if (d < reach && b.z < zMax && d < bd) { bd = d; best = p; }
        }
        if (!best) return;
        if (best.gk && speed > 19 && Math.random() < 0.55) {
          // parried away
          b.vx = -b.vx * 0.35 + (Math.random() - 0.5) * 6; b.vy = (Math.random() - 0.5) * 10; b.vz = 3; best.kickCD = 0.5;
          A.sound.play('thud'); setTimeout(() => A.sound.play('ooh'), 60);
          const q = P(b.x, b.y, b.z); g.fx.burst(q.x, q.y, ['#FFFFFF', '#C9CED8'], 12, { speed: 150, silent: true });
          g.msg = { text: 'GREAT SAVE!', t: 0, small: true };
          b.shot = false;
          return;
        }
        if (!best.gk && speed > 16 && Math.random() < 0.5) { b.vx *= 0.4; b.vy = b.vy * 0.4 + (Math.random() - 0.5) * 5; best.kickCD = 0.3; return; }
        if (best.gk && b.shot) { g.msg = { text: 'SAVED!', t: 0, small: true }; A.sound.play('ooh'); }
        b.owner = best; b.last = best.team; best.hold = 0; b.shot = false;
        if (best.team === 0 && !best.gk) g.ctrl = best;
      }

      function goal(team) {
        g.score[team]++; g.concede = 1 - team;
        g.phase = 'goal'; g.phaseT = 0; g.slow = 0.35;
        g.msg = { text: 'GOAL!', t: 0, big: true, good: team === 0 };
        A.sound.play('net'); setTimeout(() => A.sound.play('roar'), 80);
        g.fx.shake(team === 0 ? 9 : 5, 0.45);
        if (team === 0) g.flash = 1;
        const q = P(team === 0 ? L : 0, GMID, 1);
        g.fx.burst(q.x, q.y, ['#FFFFFF', '#FFE14D', TEAMS[team].shirt], 50, { speed: 300, shape: 'confetti', size: 7, gravity: 140, life: 1.3, silent: true });
      }

      // ---------- drawing ----------
      function quad(pts, fill) {
        ctx.fillStyle = fill; ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath(); ctx.fill();
      }
      function polyline(pts, color, w) {
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
        pts.forEach((p, i) => { const q = P(p[0], p[1], p[2] || 0); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.stroke();
      }

      function draw() {
        const [sx, sy] = g.fx.offset();
        ctx.save(); ctx.translate(sx, sy);
        // stadium, scrolled slower than the pitch for depth
        const sw = 1200, off = -((g.cam.x - 10) / (L - 20)) * (sw - W);
        ctx.drawImage(stadium, clamp(off, -(sw - W), 0) - 10, -14, sw, 170);
        const flashes = 3 + (g.phase === 'goal' ? 30 : 0);
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < flashes; i++) if (Math.random() < 0.5) ctx.fillRect(Math.random() * W, 30 + Math.random() * 110, 2, 2);
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [90, W - 90]) { ctx.globalAlpha = 0.7; ctx.drawImage(glow('#FFF4D6'), lx - 70, 4 - 70, 140, 140); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

        // ground around the pitch, then mowing stripes
        ctx.fillStyle = '#2A7A38'; ctx.fillRect(-20, FAR - 14, W + 40, H);
        for (let x = 0; x < L; x += 5) {
          quad([P(x, 0), P(x + 5, 0), P(x + 5, WD), P(x, WD)], (x / 5) % 2 ? '#2F8A3F' : '#37984A');
        }
        // floodlight pools
        const pool = ctx.createRadialGradient(W / 2, (FAR + NEAR) / 2, 30, W / 2, (FAR + NEAR) / 2, 380);
        pool.addColorStop(0, 'rgba(255,255,220,.10)'); pool.addColorStop(1, 'rgba(0,0,20,.18)');
        ctx.fillStyle = pool; ctx.fillRect(0, FAR - 14, W, H);
        // far LED boards
        drawBoards();
        // pitch markings
        const wl = 'rgba(255,255,255,.85)';
        polyline([[0, 0], [L, 0], [L, WD], [0, WD], [0, 0]], wl, 2);
        polyline([[L / 2, 0], [L / 2, WD]], wl, 2);
        const circ = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; circ.push([L / 2 + Math.cos(a) * 5, GMID + Math.sin(a) * 5]); }
        polyline(circ, wl, 2);
        for (const e of [0, L]) {
          const s = e === 0 ? 1 : -1;
          polyline([[e, 9], [e + s * 9, 9], [e + s * 9, 27], [e, 27]], wl, 2);
          polyline([[e, 13], [e + s * 3, 13], [e + s * 3, 23], [e, 23]], wl, 2);
          const sp = P(e + s * 7, GMID); ctx.fillStyle = wl; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, 2.4, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        }
        const cs = P(L / 2, GMID); ctx.fillStyle = wl; ctx.beginPath(); ctx.ellipse(cs.x, cs.y, 2.4, 1.2, 0, 0, Math.PI * 2); ctx.fill();

        drawGoal(0); drawGoal(L);

        // players and ball, back to front
        const ents = g.players.map(p => ({ y: p.y, p }));
        ents.push({ y: g.ball.y + 0.01, ball: true });
        ents.sort((a, c) => a.y - c.y);
        drawBallShadow();
        for (const e of ents) e.ball ? drawBall() : drawPlayer(e.p);
        drawGoalFront(0); drawGoalFront(L);
        g.fx.draw(ctx);
        ctx.restore();

        // vignette, flash, HUD
        const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.7);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
        drawHUD();
        drawRadar();
        drawMessage();
      }

      function drawBoards() {
        const x0 = g.cam.x - 20, x1 = g.cam.x + 20;
        const a = P(x0, -1.6, 0.9), b = P(x1, -1.6, 0.9), c = P(x1, -1.6, 0), d = P(x0, -1.6, 0);
        quad([a, b, c, d], '#0A0F24');
        ctx.save(); ctx.beginPath(); ctx.rect(0, a.y, W, c.y - a.y); ctx.clip();
        const h = c.y - a.y;
        ctx.font = `400 ${Math.round(h * 0.6)}px Bungee, "Arial Black", sans-serif`; ctx.textBaseline = 'middle';
        const msg = '  BRAIN BREAK ARCADE  ✦  MATCH DAY  ✦  PLAY FAIR  ✦ ';
        const wt = ctx.measureText(msg).width, scroll = -((g.time * 50 + g.cam.x * K * 0.7) % wt);
        ctx.fillStyle = Math.floor(g.time / 5) % 2 ? '#5CE1E6' : '#FFB347'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        for (let x = scroll; x < W; x += wt) ctx.fillText(msg, x, a.y + h / 2);
        ctx.restore(); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
      }

      function drawGoal(e) {
        const s = e === 0 ? -1 : 1, back = e + s * 1.5;
        // net: back, roof and sides
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        quad([P(e, GY0, GH), P(back, GY0, GH * 0.75), P(back, GY1, GH * 0.75), P(e, GY1, GH)], 'rgba(255,255,255,.07)');
        quad([P(back, GY0, 0), P(back, GY0, GH * 0.75), P(back, GY1, GH * 0.75), P(back, GY1, 0)], 'rgba(255,255,255,.1)');
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
        for (let y = GY0; y <= GY1 + 0.01; y += 0.6) polyline([[back, y, 0], [back, y, GH * 0.75], [e, y, GH]], 'rgba(255,255,255,.28)', 1);
        for (let z = 0; z <= GH * 0.75 + 0.01; z += 0.4) polyline([[back, GY0, z], [back, GY1, z]], 'rgba(255,255,255,.28)', 1);
        for (const y of [GY0, GY1]) for (let z = 0; z <= GH; z += 0.45) polyline([[e, y, z], [back, y, z * 0.75]], 'rgba(255,255,255,.22)', 1);
        // far post (the one further from the camera)
        drawPost(e, GY0);
      }
      function drawGoalFront(e) {
        drawPost(e, GY1);
        const a = P(e, GY0, GH), b = P(e, GY1, GH);
        ctx.strokeStyle = '#F4F6FA'; ctx.lineWidth = Math.max(2, a.s * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.lineCap = 'butt';
      }
      function drawPost(e, y) {
        const a = P(e, y, 0), b = P(e, y, GH);
        ctx.strokeStyle = '#F4F6FA'; ctx.lineWidth = Math.max(2, a.s * 0.12);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      function drawBallShadow() {
        const b = g.ball, q = P(b.x, b.y, 0);
        ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0.3, 1 - b.z / 5)})`;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, q.s * 0.2 * (1 + b.z * 0.1), q.s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      }
      function drawBall() {
        const b = g.ball;
        if (!b.owner && Math.hypot(b.vx, b.vy) > 12) {
          b.trail.forEach((t, i) => {
            const q = P(t.x, t.y, t.z + 0.11);
            ctx.globalAlpha = (i / b.trail.length) * 0.3; ctx.fillStyle = '#FFFFFF';
            ctx.beginPath(); ctx.arc(q.x, q.y, q.s * 0.11 * (i / b.trail.length), 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
        const q = P(b.x, b.y, b.z + 0.11), r = Math.max(3, q.s * 0.14);
        const gr = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.4, r * 0.1, q.x, q.y, r);
        gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.7, '#E6E9F0'); gr.addColorStop(1, '#9AA3B5');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#1A2238';
        for (let i = 0; i < 4; i++) { const a = b.spin + i * Math.PI / 2; ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * r * 0.65, q.y + Math.sin(a) * r * 0.4, r * 0.25, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(26,34,56,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke();
      }

      function drawPlayer(p) {
        const kit = TEAMS[p.team], base = P(p.x, p.y, 0), m = v => v * base.s;
        const sp = Math.hypot(p.vx, p.vy), runAmt = Math.min(1, sp / 6), ph = p.run;
        const face = p.fx >= 0 ? 1 : -1;
        const isCtrl = p === g.ctrl;
        // shadow and the "this is you" ring
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(base.x, base.y, m(0.42), m(0.13), 0, 0, Math.PI * 2); ctx.fill();
        if (isCtrl) {
          const pulse = 1 + Math.sin(g.time * 6) * 0.06;
          ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(base.x, base.y, m(0.62) * pulse, m(0.22) * pulse, 0, 0, Math.PI * 2); ctx.stroke();
          if (inp.shoot && g.ball.owner === p) {
            const c = clamp(inp.shootT / 0.9, 0, 1);
            ctx.strokeStyle = c > 0.92 ? '#FF5A5A' : '#FFFFFF'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.ellipse(base.x, base.y, m(0.78), m(0.3), 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c); ctx.stroke();
          }
        }
        ctx.save(); ctx.translate(base.x, base.y);
        let tilt = 0;
        if (p.gk && p.dive > 0) tilt = Math.sign(p.vy || 1) * 0.9 * Math.sin((p.dive / 0.35) * Math.PI);
        if (p.lunge > 0) tilt = face * 0.25;
        ctx.rotate(tilt);
        ctx.scale(face, 1);
        ctx.lineCap = 'round';
        const hipY = -m(0.92) - Math.abs(Math.sin(ph)) * m(0.04) * runAmt;
        // legs with a run cycle
        for (const leg of [0, 1]) {
          const swing = Math.sin(ph + leg * Math.PI) * 0.38 * runAmt + (p.lunge > 0 && leg === 0 ? 0.5 : 0);
          const kx = Math.sin(swing) * m(0.42), ky = hipY + Math.cos(swing) * m(0.45);
          const fx2 = kx + Math.sin(swing - 0.3 * runAmt) * m(0.42), fy2 = ky + m(0.43);
          ctx.strokeStyle = leg ? shade(kit.socks, -20) : kit.socks; ctx.lineWidth = m(0.13);
          ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx2, Math.min(0, fy2)); ctx.stroke();
          ctx.fillStyle = '#11162B'; ctx.beginPath(); ctx.ellipse(fx2 + m(0.05), Math.min(0, fy2), m(0.09), m(0.05), 0, 0, Math.PI * 2); ctx.fill();
        }
        // shorts and shirt
        ctx.fillStyle = kit.shorts; ctx.beginPath(); rr(-m(0.2), hipY - m(0.06), m(0.4), m(0.26), m(0.05)); ctx.fill();
        const shirt = p.gk ? kit.gk : kit.shirt;
        ctx.fillStyle = shirt; ctx.beginPath(); rr(-m(0.22), hipY - m(0.62), m(0.44), m(0.6), m(0.1)); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(m(0.08), hipY - m(0.6), m(0.14), m(0.56));
        // arms
        for (const arm of [0, 1]) {
          const s2 = Math.sin(ph + arm * Math.PI + Math.PI) * 0.5 * runAmt;
          const up = p.gk && p.dive > 0 ? -1.4 : 0;
          ctx.strokeStyle = arm ? shade(shirt, -25) : shirt; ctx.lineWidth = m(0.11);
          ctx.beginPath(); ctx.moveTo(0, hipY - m(0.52)); ctx.lineTo(Math.sin(s2) * m(0.3), hipY - m(0.52) + Math.cos(s2 + up) * m(0.36)); ctx.stroke();
          if (p.gk) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(Math.sin(s2) * m(0.3), hipY - m(0.52) + Math.cos(s2 + up) * m(0.36), m(0.07), 0, Math.PI * 2); ctx.fill(); }
        }
        // head
        ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(m(0.03), hipY - m(0.78), m(0.13), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = kit.hair; ctx.beginPath(); ctx.arc(m(0.01), hipY - m(0.82), m(0.13), Math.PI * 1.05, Math.PI * 2.05); ctx.fill();
        ctx.restore();
        // number on the shirt (drawn unflipped so it reads)
        ctx.fillStyle = kit.num; ctx.textAlign = 'center';
        ctx.font = `400 ${Math.max(7, Math.round(m(0.24)))}px Bungee, "Arial Black", sans-serif`;
        ctx.fillText(String(p.num), base.x, base.y + hipY - m(0.22));
        if (isCtrl) {
          const ay = base.y + hipY - m(1.15) + Math.sin(g.time * 6) * 2;
          ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(base.x - 5, ay - 7); ctx.lineTo(base.x + 5, ay - 7); ctx.lineTo(base.x, ay); ctx.fill();
          // stamina bar
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(base.x - 12, ay - 12, 24, 3);
          ctx.fillStyle = p.stamina > 0.3 ? '#3DCB7A' : '#FF5A5A'; ctx.fillRect(base.x - 12, ay - 12, 24 * p.stamina, 3);
        }
        ctx.textAlign = 'start';
      }
      function rr(x, y, w, h, r) { if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
      function shade(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = clamp((n >> 16) + amt, 0, 255), gg = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
        return `rgb(${r},${gg},${b})`;
      }

      function drawHUD() {
        const x = 12, y = 12;
        ctx.fillStyle = 'rgba(8,12,32,.85)';
        ctx.beginPath(); rr(x, y, 200, 30, 8); ctx.fill();
        ctx.fillStyle = TEAMS[0].shirt; ctx.fillRect(x, y, 6, 30);
        ctx.fillStyle = TEAMS[1].shirt; ctx.fillRect(x + 130, y, 6, 30);
        ctx.font = '400 13px Bungee, "Arial Black", sans-serif'; ctx.fillStyle = '#FFFFFF';
        ctx.fillText('RED', x + 12, y + 20);
        ctx.fillText(`${g.score[0]} - ${g.score[1]}`, x + 66, y + 20);
        ctx.fillText('YEL', x + 142, y + 20);
        ctx.fillStyle = 'rgba(8,12,32,.85)'; ctx.beginPath(); rr(x + 204, y, 52, 30, 8); ctx.fill();
        const mins = Math.min(90, Math.floor(g.clock / MATCH_SECONDS * 90));
        ctx.fillStyle = '#3DCB7A'; ctx.fillText(`${mins}'`, x + 214, y + 20);
      }

      function drawRadar() {
        const rw = 120, rh = 72, rx = W - rw - 12, ry = H - rh - 12;
        ctx.fillStyle = 'rgba(8,12,32,.6)'; ctx.beginPath(); rr(rx, ry, rw, rh, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
        ctx.beginPath(); ctx.moveTo(rx + rw / 2, ry + 4); ctx.lineTo(rx + rw / 2, ry + rh - 4); ctx.stroke();
        const mx = x => rx + 4 + x / L * (rw - 8), my = y => ry + 4 + y / WD * (rh - 8);
        for (const p of g.players) {
          ctx.fillStyle = p === g.ctrl ? '#FFE14D' : TEAMS[p.team].shirt;
          ctx.beginPath(); ctx.arc(mx(p.x), my(p.y), p === g.ctrl ? 3.2 : 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(mx(g.ball.x), my(g.ball.y), 2, 0, Math.PI * 2); ctx.fill();
      }

      function drawMessage() {
        const m = g.msg;
        if (!m) return;
        ctx.textAlign = 'center';
        if (m.big) {
          const k = Math.min(1, m.t * 4), sc = 0.6 + ease(k) * 0.4, fade = clamp((2.4 - m.t) * 2, 0, 1);
          if (fade <= 0) { ctx.textAlign = 'start'; return; }
          ctx.save(); ctx.translate(W / 2, H / 2 - 10); ctx.scale(sc, sc); ctx.rotate(-0.05); ctx.globalAlpha = fade;
          ctx.font = `400 ${m.text.length > 6 ? 40 : 58}px Bungee, "Arial Black", sans-serif`;
          for (let i = 7; i > 0; i--) { ctx.fillStyle = '#0B0F22'; ctx.fillText(m.text, i * 0.8, i); }
          const gr = ctx.createLinearGradient(0, -40, 0, 10);
          if (m.good !== false) { gr.addColorStop(0, '#FFF6B0'); gr.addColorStop(1, '#FFB000'); } else { gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#B9C2D8'); }
          ctx.fillStyle = gr; ctx.fillText(m.text, 0, 0);
          ctx.globalCompositeOperation = 'source-atop';
          const sw = ((m.t * 1.4) % 1.6 - 0.3) * 320;
          const shine = ctx.createLinearGradient(sw - 50, 0, sw + 50, 0);
          shine.addColorStop(0, 'rgba(255,255,255,0)'); shine.addColorStop(0.5, 'rgba(255,255,255,.7)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = shine; ctx.fillRect(-220, -60, 440, 80);
          ctx.restore();
        } else if (m.t < 1.6) {
          const a = Math.min(1, m.t * 4) * clamp((1.6 - m.t) * 3, 0, 1);
          ctx.globalAlpha = a;
          ctx.fillStyle = 'rgba(8,12,32,.8)'; ctx.beginPath(); rr(W / 2 - 90, 54, 180, 32, 10); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.font = '400 15px Bungee, "Arial Black", sans-serif'; ctx.fillText(m.text, W / 2, 76);
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'start';
      }

      function finish() {
        cancelAnimationFrame(raf);
        A.sound.crowd(false);
        const s = g.score, totalPoss = g.poss[0] + g.poss[1] || 1, poss = Math.round(g.poss[0] / totalPoss * 100), shots = g.shots;
        g = null;
        const won = s[0] > s[1];
        if (won) A.store.set('md-wins', A.store.get('md-wins', 0) + 1);
        el.innerHTML = `
          <div class="result">
            <span class="label">Full time</span>
            <span class="big">${s[0]} – ${s[1]}</span>
            <span class="newbest">${won ? 'Red wins the cup!' : s[0] === s[1] ? 'A hard-fought draw.' : 'The computer wins this time.'}</span>
            <div class="result-stats">
              <div class="stat"><small>Possession</small><b>${poss}%</b></div>
              <div class="stat"><small>Your shots</small><b>${shots[0]}</b></div>
              <div class="stat"><small>Their shots</small><b>${shots[1]}</b></div>
            </div>
            <div class="row">
              <button class="btn primary" data-act="go">Play again</button>
              <button class="btn" data-act="menu">Change difficulty</button>
            </div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b || b.dataset.btn) return;
        if (b.dataset.act === 'go') start();
        else if (b.dataset.act === 'menu') intro();
        else if (b.dataset.mode) { level = b.dataset.mode; A.store.set('md-level', level); intro(); }
      };
      const MOVE = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
      const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const down = e => {
        if (!g) return;
        const k = norm(e);
        if (MOVE.includes(k) || k === 'Shift') { keys[k] = true; e.preventDefault(); }
        if (e.repeat) return;
        if (e.code === 'Space') { e.preventDefault(); startShoot(); }
        if (k === 'e' || k === 'j') { e.preventDefault(); press('pass'); }
        if (k === 'q') { e.preventDefault(); press('switch'); }
      };
      const up = e => {
        const k = norm(e); keys[k] = false;
        if (e.code === 'Space') releaseShoot();
      };
      const blur = () => { for (const k in keys) keys[k] = false; inp.shoot = false; };
      document.addEventListener('keydown', down);
      document.addEventListener('keyup', up);
      window.addEventListener('blur', blur);
      intro();
      return () => {
        cancelAnimationFrame(raf); A.sound.crowd(false); g = null;
        document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); window.removeEventListener('blur', blur);
      };
    },
  });
})();
