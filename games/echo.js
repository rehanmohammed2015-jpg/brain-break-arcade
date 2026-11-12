/* Echo: a Brain Break original. You're a bat in a pitch-black cave. Send out sound pulses;
   the walls light up as glowing points where your echo lands. Collect moths, dodge spiders, find the way out. */
(function () {
  const A = Arcade;
  const VW = 360, VH = 540, T = 24;
  const PING_SPEED = 330, PING_RANGE = 310, RAYS = 360, DOT_LIFE = 2.8;
  const MAX_CHARGES = 3, RECHARGE = 1.1;
  const CYAN = '#5CE1E6', MOTH = '#FFD866', SPIDER = '#FF4D6D', EXIT = '#7CFFB2';

  A.css('echo-css', `
    .echo-bar { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 14px; }
    .echo-charges { display: flex; gap: 8px; }
    .echo-charges i { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--ink); background: conic-gradient(var(--pop) var(--fill, 0%), transparent 0); transition: box-shadow .2s; }
    .echo-charges i.on { background: var(--pop); box-shadow: 0 0 12px var(--pop); }
    .echo-art { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }
    .echo-art i { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px; border: 2px solid #5CE1E6; border-radius: 50%; opacity: 0; animation: echo-ring 2.4s ease-out infinite; }
    .echo-art i:nth-child(2) { animation-delay: .8s; } .echo-art i:nth-child(3) { animation-delay: 1.6s; }
    .echo-art b { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #FFD866; box-shadow: 0 0 10px 3px #FFD86688; animation: echo-twinkle 1.8s ease-in-out infinite; }
    .echo-art b:nth-of-type(2) { animation-delay: .6s; } .echo-art b:nth-of-type(3) { animation-delay: 1.2s; }
    .echo-art svg { position: relative; animation: bob 1.4s ease-in-out infinite; filter: drop-shadow(0 0 6px #5CE1E6); }
    @keyframes echo-ring { from { transform: scale(.3); opacity: .9; } to { transform: scale(4.2); opacity: 0; } }
    @keyframes echo-twinkle { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.2); } }
  `);

  // soft round glow sprites, one per color, drawn additively
  const sprites = {};
  function glow(color) {
    if (sprites[color]) return sprites[color];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color + 'AA'); gr.addColorStop(1, color + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (sprites[color] = c);
  }

  // ---------- cave generation (cellular automata + keep the biggest cave) ----------
  function makeCave(level) {
    const cols = Math.min(40, 24 + level * 3), rows = Math.min(64, 36 + level * 4);
    for (let attempt = 0; attempt < 20; attempt++) {
      let g = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) =>
        r === 0 || c === 0 || r === rows - 1 || c === cols - 1 || Math.random() < 0.46 ? 1 : 0));
      for (let it = 0; it < 5; it++) {
        const n = g.map(row => row.slice());
        for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
          let walls = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) walls += g[r + dr][c + dc];
          n[r][c] = walls >= 5 ? 1 : 0;
        }
        g = n;
      }
      // biggest connected open region
      const seen = Array.from({ length: rows }, () => new Array(cols).fill(-1));
      let best = [], id = 0;
      for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
        if (g[r][c] || seen[r][c] >= 0) continue;
        const cells = [], q = [[r, c]]; seen[r][c] = id;
        while (q.length) {
          const [cr, cc] = q.pop(); cells.push([cr, cc]);
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nr = cr + dr, nc = cc + dc;
            if (!g[nr][nc] && seen[nr][nc] < 0) { seen[nr][nc] = id; q.push([nr, nc]); }
          }
        }
        if (cells.length > best.length) best = cells;
        id++;
      }
      if (best.length < cols * rows * 0.3) continue;
      const keep = new Set(best.map(([r, c]) => r * cols + c));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!keep.has(r * cols + c)) g[r][c] = 1;
      // start near the top, exit at the farthest point
      const top = best.filter(([r]) => r < rows * 0.25);
      const [sr, sc] = (top.length ? top : best)[Math.floor(Math.random() * (top.length || best.length))];
      const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));
      const q = [[sr, sc]]; dist[sr][sc] = 0; let far = [sr, sc];
      for (let i = 0; i < q.length; i++) {
        const [cr, cc] = q[i];
        if (dist[cr][cc] > dist[far[0]][far[1]]) far = [cr, cc];
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (!g[nr][nc] && dist[nr][nc] < 0) { dist[nr][nc] = dist[cr][cc] + 1; q.push([nr, nc]); }
        }
      }
      if (dist[far[0]][far[1]] < rows * 0.8) continue;
      return { g, cols, rows, start: [sr, sc], exit: far, open: best, dist };
    }
    return makeCave(level); // extremely unlikely
  }

  A.register({
    id: 'echo',
    section: 'original',
    title: 'Echo',
    color: 'pop',
    featured: true,
    artBg: '#060814',
    art: `<span class="echo-art" aria-hidden="true">
      <i></i><i></i><i></i>
      <svg width="64" height="40" viewBox="0 0 64 40"><path d="M32 14 C26 4 14 2 2 10 C10 12 12 18 10 24 C18 18 24 20 28 26 L32 30 L36 26 C40 20 46 18 54 24 C52 18 54 12 62 10 C50 2 38 4 32 14 Z" fill="#1B1F3A" stroke="#5CE1E6" stroke-width="2"/><circle cx="29" cy="17" r="1.8" fill="#fff"/><circle cx="35" cy="17" r="1.8" fill="#fff"/></svg>
      <b style="left:18%;top:26%"></b><b style="left:76%;top:62%"></b><b style="left:64%;top:20%"></b>
    </span>`,
    blurb: 'You’re a bat in a pitch-black cave. Send out sound pulses and watch the walls glow where your echo lands. Catch moths, dodge spiders and find the way out.',
    tags: ['Original', 'Explore', 'Sonar'],
    best() { const b = A.store.get('echo-best', 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;
      const keys = {};

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Find your way by sound</h2>
            <p>The cave is completely dark. Press <b>Space</b> or tap the <b>Echo</b> button to send out a pulse. Where the sound hits rock, the walls light up for a few seconds, then fade. You get 3 pulses at a time, and they recharge.</p>
            <p>Fly with the arrow keys or W A S D, or hold your finger on the game to fly toward it. A quick tap also sends a pulse. Catch glowing moths for points. Spiders hide in the dark and only their red eyes show, so stay away. Find the green glow to escape to a deeper cave.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Enter the cave</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get('echo-best', 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Depth</small><b id="ec-level">1</b></div>
              <div class="stat"><small>Moths</small><b id="ec-moths">0</b></div>
              <div class="stat"><small>Score</small><b id="ec-score">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Lives</small><b id="ec-lives" style="color:var(--p1)">♥♥♥</b></div></div>
          </div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, VW, VH));
        cv.style.background = '#04050C';
        el.insertAdjacentHTML('beforeend', `
          <div class="echo-bar">
            <div class="echo-charges" id="ec-charges" aria-label="Echo charges"></div>
            <button class="btn primary" data-act="ping">◉ Echo</button>
          </div>`);
        let down = null;
        cv.addEventListener('pointerdown', e => {
          if (!g) return; e.preventDefault();
          try { cv.setPointerCapture(e.pointerId); } catch (err) {}
          down = { t: performance.now(), x: e.clientX, y: e.clientY };
          g.hold = toLogical(e);
        });
        cv.addEventListener('pointermove', e => { if (g && down) g.hold = toLogical(e); });
        const up = e => {
          if (!g || !down) return;
          const quick = performance.now() - down.t < 220 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12;
          if (quick) ping();
          down = null; g.hold = null;
        };
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', () => { down = null; if (g) g.hold = null; });
        g = { level: 1, lives: 3, moths: 0, score: 0, time: 0, last: performance.now(), hud: {}, fx: A.particles() };
        loadLevel();
        raf = requestAnimationFrame(frame);
      }

      function loadLevel() {
        const cave = makeCave(g.level);
        Object.assign(g, cave);
        g.bat = { x: (cave.start[1] + 0.5) * T, y: (cave.start[0] + 0.5) * T, vx: 0, vy: 0, face: 1, flap: 0, inv: 1.5 };
        g.exitPos = { x: (cave.exit[1] + 0.5) * T, y: (cave.exit[0] + 0.5) * T, seen: 0 };
        g.reveal = new Float32Array(cave.cols * cave.rows).fill(-99);
        g.pings = []; g.dots = []; g.charges = MAX_CHARGES; g.recharge = 0;
        const far = cave.open.filter(([r, c]) => cave.dist[r][c] > 8);
        const pick = n => A.shuffle(far).slice(0, n);
        g.mothList = pick(5 + g.level).map(([r, c]) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T, ph: Math.random() * 6, got: false }));
        const ceilings = cave.open.filter(([r, c]) => cave.g[r - 1][c] === 1 && cave.dist[r][c] > 12);
        g.spiders = A.shuffle(ceilings).slice(0, Math.min(12, g.level + 1)).map(([r, c]) => ({
          ax: (c + 0.5) * T, ay: r * T, len: 0, ph: Math.random() * 6, reach: 30 + Math.random() * 40, seen: -99,
        }));
        g.banner = g.level === 1 ? 'Press Space to echo' : `Depth ${g.level}`; g.bannerT = 2.2;
        g.cam = { x: g.bat.x, y: g.bat.y };
        g.done = 0;
        ping(true);
      }

      const wall = (c, r) => c < 0 || r < 0 || c >= g.cols || r >= g.rows || g.g[r][c] === 1;

      // cast rays now; the dots appear as the ring sweeps outward
      function ping(free) {
        if (!g || g.done) return;
        if (!free) { if (g.charges < 1) { g.fx.text(g.bat.x, g.bat.y - 20, 'Recharging…', '#8892B0', 11); return; } g.charges--; }
        const ox = g.bat.x, oy = g.bat.y, hits = [];
        for (let i = 0; i < RAYS; i++) {
          const a = i / RAYS * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
          for (let d = 4; d < PING_RANGE; d += 3) {
            const x = ox + dx * d, y = oy + dy * d;
            if (wall(Math.floor(x / T), Math.floor(y / T))) { hits.push({ x, y, d, tile: Math.floor(y / T) * g.cols + Math.floor(x / T) }); break; }
          }
        }
        hits.sort((a, b) => a.d - b.d);
        g.pings.push({ x: ox, y: oy, r: 0, hits, idx: 0 });
        g.fx.ring(ox, oy, CYAN, 26, 0.35);
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        update(dt);
        if (!g) return;
        draw();
        raf = requestAnimationFrame(frame);
      }

      function hurt() {
        const b = g.bat;
        g.lives--; b.inv = 1.6;
        g.fx.burst(b.x, b.y, [SPIDER, '#FFFFFF'], 18, { speed: 180, gravity: 0, size: 3 });
        g.fx.shake(8, 0.35);
        if (g.lives <= 0) { g.done = 1; setTimeout(() => finish(), 900); }
      }

      function update(dt) {
        g.time += dt;
        g.bannerT -= dt;
        g.fx.update(dt);
        // echo charges
        if (g.charges < MAX_CHARGES) { g.recharge += dt; if (g.recharge >= RECHARGE) { g.recharge = 0; g.charges++; } }
        const b = g.bat;
        b.inv = Math.max(0, b.inv - dt);
        b.flap += dt * (Math.hypot(b.vx, b.vy) > 30 ? 16 : 9);
        if (!g.done) {
          let ax = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
          let ay = ((keys.ArrowDown || keys.s) ? 1 : 0) - ((keys.ArrowUp || keys.w) ? 1 : 0);
          if (!ax && !ay && g.hold) {
            const tx = g.hold.x + g.cam.x - VW / 2, ty = g.hold.y + g.cam.y - VH / 2;
            const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
            if (d > 8) { ax = dx / d; ay = dy / d; }
          }
          const len = Math.hypot(ax, ay) || 1;
          b.vx += ax / len * 700 * dt; b.vy += ay / len * 700 * dt;
        }
        const damp = Math.pow(0.04, dt);
        b.vx *= damp; b.vy *= damp;
        const sp = Math.hypot(b.vx, b.vy), MAX = 165;
        if (sp > MAX) { b.vx *= MAX / sp; b.vy *= MAX / sp; }
        if (Math.abs(b.vx) > 10) b.face = Math.sign(b.vx);
        // move and bounce off rock (a bump also makes a tiny local echo)
        const R = 7;
        const blocked = (x, y) => wall(Math.floor((x - R) / T), Math.floor((y - R) / T)) || wall(Math.floor((x + R) / T), Math.floor((y - R) / T))
          || wall(Math.floor((x - R) / T), Math.floor((y + R) / T)) || wall(Math.floor((x + R) / T), Math.floor((y + R) / T));
        const nx = b.x + b.vx * dt;
        if (blocked(nx, b.y)) { bump(b.vx); b.vx = -b.vx * 0.4; } else b.x = nx;
        const ny = b.y + b.vy * dt;
        if (blocked(b.x, ny)) { bump(b.vy); b.vy = -b.vy * 0.4; } else b.y = ny;

        // pings sweep outward and light up the rock they reach
        for (const p of g.pings) {
          p.r += PING_SPEED * dt;
          while (p.idx < p.hits.length && p.hits[p.idx].d <= p.r) {
            const h = p.hits[p.idx++];
            g.dots.push({ x: h.x, y: h.y, t: g.time });
            g.reveal[h.tile] = g.time;
          }
          for (const s of g.spiders) if (Math.abs(Math.hypot(s.ax - p.x, s.ay + s.len - p.y) - p.r) < 10) s.seen = g.time;
          if (Math.abs(Math.hypot(g.exitPos.x - p.x, g.exitPos.y - p.y) - p.r) < 10) g.exitPos.seen = g.time;
        }
        g.pings = g.pings.filter(p => p.r < PING_RANGE + 20);
        g.dots = g.dots.filter(d => g.time - d.t < DOT_LIFE);

        // moths
        for (const m of g.mothList) {
          if (m.got) continue;
          m.ph += dt;
          if (!g.done && Math.hypot(m.x - b.x, m.y - b.y) < 16) {
            m.got = true; g.moths++; g.score += 10;
            g.fx.burst(m.x, m.y, [MOTH, '#FFFFFF'], 14, { speed: 120, gravity: 0, size: 3 });
            g.fx.text(m.x, m.y - 14, '+10', MOTH, 13);
          }
        }
        // spiders bob on their threads
        for (const s of g.spiders) {
          s.ph += dt;
          s.len = s.reach * (0.5 + 0.5 * Math.sin(s.ph * 0.9));
          if (!g.done && b.inv <= 0 && Math.hypot(s.ax - b.x, s.ay + s.len - b.y) < 15) hurt();
        }
        // exit
        if (!g.done && Math.hypot(g.exitPos.x - b.x, g.exitPos.y - b.y) < 16) {
          g.done = 1;
          const bonus = 50 + g.level * 10;
          g.score += bonus;
          g.fx.burst(b.x, b.y, [EXIT, '#FFFFFF', CYAN], 40, { speed: 260, gravity: 0, size: 4, life: 1 });
          g.banner = `Escaped! +${bonus}`; g.bannerT = 1.6;
          setTimeout(() => { if (g) { g.level++; loadLevel(); } }, 1600);
        }
        // camera eases after the bat
        g.cam.x += (b.x - g.cam.x) * Math.min(1, dt * 6);
        g.cam.y += (b.y - g.cam.y) * Math.min(1, dt * 6);
        g.cam.x = Math.max(VW / 2, Math.min(g.cols * T - VW / 2, g.cam.x));
        g.cam.y = Math.max(VH / 2, Math.min(g.rows * T - VH / 2, g.cam.y));

        setHud('ec-level', g.level); setHud('ec-moths', g.moths); setHud('ec-score', g.score);
        setHud('ec-lives', '♥'.repeat(Math.max(0, g.lives)) + '♡'.repeat(3 - Math.max(0, g.lives)));
        const ch = el.querySelector('#ec-charges');
        const key = g.charges + ':' + Math.floor(g.recharge * 10);
        if (ch && g.hud.ch !== key) {
          g.hud.ch = key;
          ch.innerHTML = Array.from({ length: MAX_CHARGES }, (_, i) =>
            `<i class="${i < g.charges ? 'on' : ''}" style="${i === g.charges ? `--fill:${Math.round(g.recharge / RECHARGE * 100)}%` : ''}"></i>`).join('');
        }
      }

      function bump(v) {
        if (Math.abs(v) < 60) return;
        const b = g.bat;
        // a small local echo where you touch the rock
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 14;
          const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
          if (wall(Math.floor(x / T), Math.floor(y / T))) g.dots.push({ x, y, t: g.time });
        }
        g.fx.shake(2, 0.1);
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
      }

      function draw() {
        const t = g.time, b = g.bat;
        const [sx, sy] = g.fx.offset();
        ctx.save();
        ctx.fillStyle = '#04050C'; ctx.fillRect(0, 0, VW, VH);
        ctx.translate(Math.round(VW / 2 - g.cam.x + sx), Math.round(VH / 2 - g.cam.y + sy));
        const c0 = Math.max(0, Math.floor((g.cam.x - VW / 2) / T) - 1), c1 = Math.min(g.cols - 1, c0 + Math.ceil(VW / T) + 2);
        const r0 = Math.max(0, Math.floor((g.cam.y - VH / 2) / T) - 1), r1 = Math.min(g.rows - 1, r0 + Math.ceil(VH / T) + 2);

        // rock faces: lit by recent echoes, and faintly by the bat's own glow
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          if (!g.g[r][c]) continue;
          const age = t - g.reveal[r * g.cols + c];
          const near = Math.max(0, 1 - Math.hypot((c + 0.5) * T - b.x, (r + 0.5) * T - b.y) / 70);
          const k = Math.max(age < DOT_LIFE ? (1 - age / DOT_LIFE) * 0.55 : 0, near * 0.45);
          if (k <= 0.01) continue;
          ctx.fillStyle = `rgba(40,70,110,${k * 0.22})`;
          ctx.fillRect(c * T, r * T, T, T);
          ctx.strokeStyle = `rgba(92,225,230,${k * 0.4})`; ctx.lineWidth = 1;
          ctx.beginPath();
          if (!wall(c, r - 1)) { ctx.moveTo(c * T, r * T); ctx.lineTo(c * T + T, r * T); }
          if (!wall(c, r + 1)) { ctx.moveTo(c * T, r * T + T); ctx.lineTo(c * T + T, r * T + T); }
          if (!wall(c - 1, r)) { ctx.moveTo(c * T, r * T); ctx.lineTo(c * T, r * T + T); }
          if (!wall(c + 1, r)) { ctx.moveTo(c * T + T, r * T); ctx.lineTo(c * T + T, r * T + T); }
          ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';
        // echo points
        const dotGlow = glow(CYAN);
        for (const d of g.dots) {
          const k = 1 - (t - d.t) / DOT_LIFE;
          const fresh = Math.max(0, 1 - (t - d.t) * 4);
          ctx.globalAlpha = k * 0.55;
          const s = 10 + fresh * 14;
          ctx.drawImage(dotGlow, d.x - s / 2, d.y - s / 2, s, s);
          ctx.globalAlpha = k;
          ctx.fillStyle = fresh > 0.2 ? '#FFFFFF' : CYAN;
          ctx.fillRect(d.x - 1, d.y - 1, 2, 2);
        }
        // expanding sound rings
        for (const p of g.pings) {
          const k = 1 - p.r / (PING_RANGE + 20);
          for (let i = 0; i < 3; i++) {
            const rr = p.r - i * 9;
            if (rr <= 0) continue;
            ctx.globalAlpha = k * (0.35 - i * 0.1);
            ctx.strokeStyle = CYAN; ctx.lineWidth = 2 - i * 0.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
          }
        }
        // exit portal: glows when nearby or when an echo finds it
        const ex = g.exitPos;
        const exSeen = Math.max(0, 1 - (t - ex.seen) / 4), exNear = Math.max(0, 1 - Math.hypot(ex.x - b.x, ex.y - b.y) / 160);
        const exK = Math.max(exSeen, exNear, 0.08);
        ctx.globalAlpha = exK;
        const eg = glow(EXIT), pulse = 70 + Math.sin(t * 3) * 10;
        ctx.drawImage(eg, ex.x - pulse / 2, ex.y - pulse / 2, pulse, pulse);
        ctx.strokeStyle = EXIT; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(ex.x, ex.y, 9 + i * 5, t * (2 + i) + i, t * (2 + i) + i + Math.PI * 1.2); ctx.stroke();
        }
        // moths always glow a little
        const mg = glow(MOTH);
        for (const m of g.mothList) {
          if (m.got) continue;
          const mx = m.x + Math.sin(m.ph * 2.1) * 4, my = m.y + Math.cos(m.ph * 2.7) * 3;
          ctx.globalAlpha = 0.55 + Math.sin(m.ph * 5) * 0.2;
          ctx.drawImage(mg, mx - 14, my - 14, 28, 28);
          ctx.globalAlpha = 1; ctx.fillStyle = '#FFF4C2';
          const w = 3 + Math.abs(Math.sin(m.ph * 18)) * 3;
          ctx.fillRect(mx - w, my - 1.5, w * 2, 3);
        }
        // spiders: eyes always show, bodies only when an echo finds them
        const sg = glow(SPIDER);
        for (const s of g.spiders) {
          const sx2 = s.ax, sy2 = s.ay + s.len;
          const seen = Math.max(0, 1 - (t - s.seen) / 2.5);
          ctx.globalAlpha = 0.35 + Math.sin(s.ph * 3) * 0.12 + seen * 0.4;
          ctx.drawImage(sg, sx2 - 12, sy2 - 12, 24, 24);
          ctx.globalAlpha = 1; ctx.fillStyle = '#FF8FA3';
          ctx.fillRect(sx2 - 4, sy2 - 2, 2.5, 2.5); ctx.fillRect(sx2 + 1.5, sy2 - 2, 2.5, 2.5);
          if (seen > 0) {
            ctx.globalAlpha = seen;
            ctx.strokeStyle = SPIDER; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(sx2, sy2 - 6); ctx.stroke();
            ctx.lineWidth = 1.5; ctx.beginPath();
            for (const side of [-1, 1]) for (let l = 0; l < 4; l++) {
              ctx.moveTo(sx2, sy2); ctx.lineTo(sx2 + side * (9 + l), sy2 - 6 + l * 4); ctx.lineTo(sx2 + side * (12 + l), sy2 + l * 4);
            }
            ctx.stroke();
            ctx.beginPath(); ctx.arc(sx2, sy2, 6, 0, Math.PI * 2); ctx.stroke();
          }
        }
        // the bat's own soft light
        ctx.globalAlpha = 0.5;
        const bg = glow('#6C7BFF');
        ctx.drawImage(bg, b.x - 50, b.y - 50, 100, 100);
        ctx.globalAlpha = 1;
        g.fx.draw(ctx);
        ctx.globalCompositeOperation = 'source-over';

        // bat
        if (!(b.inv > 0 && Math.floor(b.inv * 10) % 2)) {
          const wing = Math.sin(b.flap) * 0.9;
          ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.face, 1);
          ctx.fillStyle = '#1B1F3A'; ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5;
          for (const side of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(side * 9, -10 * wing - 4, side * 16, -6 * wing);
            ctx.quadraticCurveTo(side * 12, 2, side * 13, 5 - 3 * wing);
            ctx.quadraticCurveTo(side * 6, 2, 0, 4);
            ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          ctx.beginPath(); ctx.ellipse(0, 1, 5, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-3, -9); ctx.lineTo(-1, -5); ctx.moveTo(4, -4); ctx.lineTo(3, -9); ctx.lineTo(1, -5); ctx.stroke();
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0.5, -1.5, 2, 2); ctx.fillRect(-2.5, -1.5, 2, 2);
          ctx.restore();
        }
        ctx.restore();

        // vignette
        const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.7);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

        if (g.bannerT > 0) {
          ctx.globalAlpha = Math.min(1, g.bannerT * 2);
          ctx.textAlign = 'center'; ctx.font = '400 22px Bungee, "Arial Black", sans-serif';
          ctx.fillStyle = CYAN; ctx.shadowColor = CYAN; ctx.shadowBlur = 16;
          ctx.fillText(g.banner, VW / 2, 70);
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'start';
        }
      }

      function finish() {
        if (!g) return;
        cancelAnimationFrame(raf);
        const res = { score: g.score, level: g.level, moths: g.moths };
        g = null;
        const prev = A.store.get('echo-best', 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set('echo-best', res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">The cave went quiet · Final score</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            <div class="result-stats">
              <div class="stat"><small>Deepest cave</small><b>${res.level}</b></div>
              <div class="stat"><small>Moths</small><b>${res.moths}</b></div>
            </div>
            <div class="row"><button class="btn primary" data-act="go">Fly again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'go') start();
        else if (b.dataset.act === 'ping') ping();
      };
      const CTRL = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
      const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const down = e => {
        if (!g) return;
        const k = norm(e);
        if (CTRL.includes(k)) { keys[k] = true; e.preventDefault(); }
        if (e.code === 'Space' && !e.repeat) { e.preventDefault(); ping(); }
      };
      const up = e => { keys[norm(e)] = false; };
      document.addEventListener('keydown', down);
      document.addEventListener('keyup', up);
      intro();
      return () => {
        cancelAnimationFrame(raf); g = null;
        document.removeEventListener('keydown', down); document.removeEventListener('keyup', up);
      };
    },
  });
})();
