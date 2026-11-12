/* Comet Dash: steer a rocket through a meteor shower. Grab stars, skim past rocks for near-miss bonuses,
   and catch shield orbs to survive a hit. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, SHIP_Y = 470;
  const BEST = 'cd-best';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function starPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  // Deep-space backdrop: nebula clouds and a distant ringed planet, drawn once.
  function makeSpace() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * 2 * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, 0, H * 2);
    g.addColorStop(0, '#070a1f'); g.addColorStop(0.5, '#120b2e'); g.addColorStop(1, '#070a1f');
    x.fillStyle = g; x.fillRect(0, 0, W, H * 2);
    const clouds = [['#ff77b7', 80, 160, 170], ['#6f7bff', 280, 420, 200], ['#78e5dc', 60, 700, 160], ['#b79cff', 300, 900, 190], ['#ff77b7', 120, 1040, 150]];
    x.globalCompositeOperation = 'lighter';
    for (const [col, cx, cy, r] of clouds) {
      for (let k = 0; k < 6; k++) {
        const rx = cx + (Math.random() - 0.5) * r, ry = cy + (Math.random() - 0.5) * r * 0.7, rr = r * (0.4 + Math.random() * 0.5);
        const gr = x.createRadialGradient(rx, ry, 0, rx, ry, rr);
        gr.addColorStop(0, col + '30'); gr.addColorStop(1, col + '00');
        x.fillStyle = gr; x.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
      }
    }
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 220; i++) { x.globalAlpha = 0.2 + Math.random() * 0.5; x.fillStyle = '#fff'; const s = Math.random() < 0.1 ? 1.6 : 0.9; x.fillRect(Math.random() * W, Math.random() * H * 2, s, s); }
    x.globalAlpha = 1;
    // tile = this image followed by its mirror image, so the scroll loops with no seam
    const t = document.createElement('canvas'); t.width = W * dpr; t.height = H * 4 * dpr;
    const tx = t.getContext('2d');
    tx.drawImage(c, 0, 0);
    tx.save(); tx.translate(0, H * 4 * dpr); tx.scale(1, -1); tx.drawImage(c, 0, 0); tx.restore();
    return t;
  }
  function makePlanet() {
    const c = document.createElement('canvas'); c.width = c.height = 240;
    const x = c.getContext('2d');
    x.translate(120, 120);
    const g = x.createRadialGradient(-22, -26, 6, 0, 0, 62);
    g.addColorStop(0, '#9fe8c9'); g.addColorStop(0.6, '#3d8f8a'); g.addColorStop(1, '#16314a');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 60, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 0.25; x.fillStyle = '#ffffff';
    for (let i = -2; i <= 2; i++) { x.fillRect(-60, i * 18 - 3, 120, 4); }
    x.globalAlpha = 1;
    x.strokeStyle = '#ffe9a8aa'; x.lineWidth = 7; x.beginPath(); x.ellipse(0, 4, 104, 24, -0.32, 0.1, Math.PI - 0.1); x.stroke();
    return c;
  }

  A.register({
    id: 'comet-dash',
    section: 'play',
    title: 'Comet Dash',
    color: 'dash',
    artBg: 'radial-gradient(ellipse at 25% 30%, #ff77b744, transparent 50%), radial-gradient(ellipse at 80% 70%, #6f7bff55, transparent 50%), linear-gradient(160deg, #120b2e, #070a1f)',
    art: `<svg width="170" height="110" viewBox="0 0 170 110" aria-hidden="true">
      <defs><radialGradient id="cdr" cx="35%" cy="30%"><stop offset="0" stop-color="#d9c2a8"/><stop offset="1" stop-color="#5b4636"/></radialGradient>
      <linearGradient id="cds" x1="0" x2="1"><stop offset="0" stop-color="#ffd0e6"/><stop offset=".5" stop-color="#ff77b7"/><stop offset="1" stop-color="#b8357a"/></linearGradient></defs>
      <circle cx="30" cy="28" r="13" fill="url(#cdr)"/><circle cx="142" cy="22" r="9" fill="url(#cdr)"/><circle cx="130" cy="74" r="15" fill="url(#cdr)"/>
      <path d="M78 64 L85 98 L92 64 Z" fill="#ffd878" style="filter:drop-shadow(0 0 8px #ffb347)"/>
      <path d="M85 12 C96 26 100 44 99 62 L85 56 L71 62 C70 44 74 26 85 12 Z" fill="url(#cds)"/><circle cx="85" cy="38" r="5" fill="#bfe6ff"/>
      <path d="M40 72 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 Z" fill="#ffd878" style="filter:drop-shadow(0 0 6px #ffd878)"/>
    </svg>`,
    blurb: 'Steer your rocket through a meteor shower. Grab stars, skim past rocks for near-miss bonuses, and catch shields to survive.',
    tags: ['Dodge', 'Endless', 'Near misses'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null, space = null, planet = null;
      const keys = {};

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Survive the meteor shower</h2>
            <p>Move with the arrow keys or A and D. On a phone or tablet, drag your finger across the game.</p>
            <p>You score 10 points a second and 50 for each gold star. Skim close past a rock for a near-miss bonus that grows if you keep doing it. Blue orbs give you a shield that blocks one hit.</p>
            <p>Three hits and the run is over. The rocks fall faster the longer you last.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Launch</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get(BEST, 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="cd-score">0</b></div>
              <div class="stat"><small>Stars</small><b id="cd-stars">0</b></div>
              <div class="stat"><small>Near misses</small><b id="cd-near">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Lives</small><b id="cd-lives" style="color:var(--dash)">♥♥♥</b></div></div>
          </div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        if (!space) { space = makeSpace(); planet = makePlanet(); }
        cv.addEventListener('pointerdown', e => { g && (g.target = toLogical(e).x); });
        cv.addEventListener('pointermove', e => { if (g && (e.pointerType === 'mouse' || e.buttons)) g.target = toLogical(e).x; });
        cv.addEventListener('pointerup', e => { if (g && e.pointerType !== 'mouse') g.target = null; });
        cv.addEventListener('pointerleave', () => { g && (g.target = null); });

        const sky = [];
        for (let i = 0; i < 60; i++) sky.push({ x: Math.random() * W, y: Math.random() * H, layer: A.rand(0, 2) });
        g = {
          x: W / 2, vx: 0, t: 0, score: 0, bonus: 0, stars: 0, near: 0, chain: 0, chainT: 0, lives: 3, inv: 0, shield: 0, target: null,
          rocks: [], pickups: [], spawn: 1.0, starSpawn: 2.5, orbSpawn: 9, sky, scroll: 0, last: performance.now(), hud: {},
          accent: A.color('dash'), gold: '#ffd878', fx: A.particles(),
        };
        raf = requestAnimationFrame(frame);
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

      function update(dt) {
        g.t += dt;
        const speed = 1 + g.t / 28;
        g.fx.update(dt);
        g.scrollY = ((g.scrollY || 0) + 28 * speed * dt) % (H * 4);
        // engine exhaust
        g.fx.burst(g.x + (Math.random() - 0.5) * 6, SHIP_Y + 22, [g.gold, '#FF8A3D', '#FFFFFF'], 1, { speed: 160, angle: Math.PI / 2, spread: 0.45, gravity: 0, life: 0.3, size: 5, silent: true });

        const px = g.x;
        const dir = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
        if (dir) { g.target = null; g.x += dir * 320 * dt; }
        else if (g.target !== null) { const d = g.target - g.x; g.x += Math.sign(d) * Math.min(Math.abs(d), 460 * dt); }
        g.x = clamp(g.x, 18, W - 18);
        g.vx = g.vx * 0.8 + ((g.x - px) / Math.max(dt, 0.001)) * 0.2; // used to bank the ship

        g.spawn -= dt;
        if (g.spawn <= 0) {
          g.spawn = Math.max(0.2, 0.85 - g.t * 0.018);
          const r = A.rand(11, 26);
          const pts = [];
          for (let i = 0; i < 10; i++) pts.push(0.78 + Math.random() * 0.3);
          const craters = Array.from({ length: 3 }, () => ({ a: Math.random() * 6.3, d: Math.random() * 0.5, s: 0.12 + Math.random() * 0.14 }));
          const hot = Math.random() < 0.25; // some rocks are glowing comets
          g.rocks.push({ x: A.rand(r, W - r), y: -r, r, vy: (110 + Math.random() * 90) * speed * (hot ? 1.25 : 1), vx: (Math.random() - 0.5) * 40, rot: 0, vr: (Math.random() - 0.5) * 3, pts, craters, hot, passed: false });
        }
        g.starSpawn -= dt;
        if (g.starSpawn <= 0) {
          g.starSpawn = 1.8 + Math.random() * 2;
          g.pickups.push({ kind: 'star', x: A.rand(18, W - 18), y: -14, vy: 120 * speed, spin: 0 });
        }
        g.orbSpawn -= dt;
        if (g.orbSpawn <= 0) {
          g.orbSpawn = 11 + Math.random() * 6;
          if (!g.shield) g.pickups.push({ kind: 'orb', x: A.rand(24, W - 24), y: -16, vy: 100 * speed, spin: 0 });
        }

        for (const r of g.rocks) {
          r.y += r.vy * dt; r.x += r.vx * dt; r.rot += r.vr * dt;
          if (r.hot) g.fx.trail(r.x + (Math.random() - 0.5) * r.r * 0.6, r.y - r.r * 0.6, Math.random() < 0.5 ? '#ff9f43' : '#ffd878', r.r * 0.35, 0.35);
        }
        for (const p of g.pickups) { p.y += p.vy * dt; p.spin += dt * 3; }
        for (const s of g.sky) { s.y += (60 + s.layer * 90) * speed * dt; if (s.y > H) { s.y = -10; s.x = Math.random() * W; } }
        g.inv = Math.max(0, g.inv - dt);
        g.chainT = Math.max(0, g.chainT - dt);
        if (g.chainT === 0) g.chain = 0;

        g.rocks = g.rocks.filter(r => {
          if (r.y - r.r > H) return false;
          const d = Math.hypot(r.x - g.x, r.y - (SHIP_Y + 4));
          if (g.inv <= 0 && d < r.r * 0.85 + 12) {
            g.fx.burst(r.x, r.y, ['#C9B8A6', '#8c7b6b', '#ff9f43'], 16, { speed: 220 });
            if (g.shield) {
              g.shield = 0; g.inv = 0.6;
              g.fx.ring(g.x, SHIP_Y, '#6fc6ff', 70, 0.5); g.fx.text(g.x, SHIP_Y - 40, 'BLOCKED!', '#6fc6ff', 18); g.fx.shake(4);
            } else {
              g.lives--; g.inv = 1.6; g.chain = 0;
              g.fx.ring(g.x, SHIP_Y, '#FF6B6B', 60, 0.5); g.fx.text(g.x, SHIP_Y - 34, 'OUCH!', '#FF6B6B', 18); g.fx.shake(8, 0.35);
            }
            return false;
          }
          // near miss: the rock passes the ship's line close by without touching
          if (!r.passed && r.y > SHIP_Y + 4) {
            r.passed = true;
            if (g.inv <= 0 && d < r.r + 34) {
              g.near++; g.chain++; g.chainT = 2.5;
              const pts = 15 * Math.min(g.chain, 6);
              g.bonus += pts;
              g.fx.text(g.x + (r.x < g.x ? -34 : 34), SHIP_Y - 26, g.chain > 1 ? `CLOSE ×${g.chain}` : 'CLOSE!', '#78e5dc', 14);
              g.fx.burst(r.x, r.y, '#78e5dc', 6, { speed: 90, gravity: 0, silent: true, shape: 'dot', size: 3 });
              A.sound.play('swish');
            }
          }
          return true;
        });
        g.pickups = g.pickups.filter(p => {
          if (p.y > H + 20) return false;
          if (Math.hypot(p.x - g.x, p.y - SHIP_Y) < 28) {
            if (p.kind === 'star') {
              g.stars++;
              g.fx.burst(p.x, p.y, [g.gold, '#fff6c4'], 12, { shape: 'confetti' });
              g.fx.ring(p.x, p.y, g.gold, 40); g.fx.text(p.x, p.y - 16, '+50', g.gold, 18);
            } else {
              g.shield = 1;
              g.fx.ring(g.x, SHIP_Y, '#6fc6ff', 60, 0.5); g.fx.text(p.x, p.y - 18, 'SHIELD', '#6fc6ff', 16);
            }
            return false;
          }
          return true;
        });

        g.score = Math.floor(g.t * 10) + g.stars * 50 + g.bonus;
        setHud('cd-score', g.score);
        setHud('cd-stars', g.stars);
        setHud('cd-near', g.near);
        setHud('cd-lives', '♥'.repeat(Math.max(0, g.lives)) + '♡'.repeat(3 - Math.max(0, g.lives)));
        if (g.lives <= 0) finish();
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
      }

      function drawRock(r) {
        ctx.save(); ctx.translate(r.x, r.y);
        if (r.hot) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55; ctx.drawImage(A.glow('#ff9f43'), -r.r * 2, -r.r * 2.4, r.r * 4, r.r * 4); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        ctx.rotate(r.rot);
        ctx.beginPath();
        r.pts.forEach((k, i) => { const a = i / r.pts.length * Math.PI * 2; ctx.lineTo(Math.cos(a) * r.r * k, Math.sin(a) * r.r * k); });
        ctx.closePath();
        // light comes from the top-left, so shade against the rotation
        const la = -r.rot - 2.2;
        const gr = ctx.createRadialGradient(Math.cos(la) * r.r * 0.4, Math.sin(la) * r.r * 0.4, r.r * 0.1, 0, 0, r.r * 1.1);
        if (r.hot) { gr.addColorStop(0, '#ffe2a0'); gr.addColorStop(0.5, '#d9733a'); gr.addColorStop(1, '#5a2414'); }
        else { gr.addColorStop(0, '#cdb69c'); gr.addColorStop(0.55, '#7d6857'); gr.addColorStop(1, '#2e241c'); }
        ctx.fillStyle = gr; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
        for (const c of r.craters) {
          const cx = Math.cos(c.a) * c.d * r.r, cy = Math.sin(c.a) * c.d * r.r, cr = c.s * r.r;
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, cr, Math.PI * 0.1, Math.PI * 1.1); ctx.stroke();
        }
        ctx.restore();
      }

      function draw() {
        A.fxFrame(ctx, g.fx, () => {
          // scrolling nebula
          const off = g.scrollY % (H * 4) - H * 4;
          ctx.drawImage(space, 0, off, W, H * 4); ctx.drawImage(space, 0, off + H * 4, W, H * 4);
          ctx.globalAlpha = 0.9; ctx.drawImage(planet, 220, 40 + g.t * 1.5 % 600, 150, 150); ctx.globalAlpha = 1;
          // speed streaks
          for (const s of g.sky) {
            if (s.layer < 2) { ctx.fillStyle = `rgba(220,230,255,${0.3 + s.layer * 0.25})`; ctx.fillRect(s.x, s.y, 1.2 + s.layer * 0.5, 1.2 + s.layer * 0.5); continue; }
            const len = 6 + 6 * Math.min(2, g.t / 40);
            const sg = ctx.createLinearGradient(0, s.y - len, 0, s.y); sg.addColorStop(0, 'rgba(200,220,255,0)'); sg.addColorStop(1, 'rgba(220,235,255,.6)');
            ctx.strokeStyle = sg; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y - len); ctx.stroke();
          }
          for (const p of g.pickups) {
            ctx.save(); ctx.translate(p.x, p.y);
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + Math.sin(p.spin * 2) * 0.2;
            ctx.drawImage(A.glow(p.kind === 'star' ? '#ffd878' : '#6fc6ff'), -34, -34, 68, 68);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            if (p.kind === 'star') {
              ctx.rotate(Math.sin(p.spin) * 0.4); ctx.scale(Math.cos(p.spin * 1.3) * 0.25 + 0.95, 1);
              starPath(ctx, 0, 0, 13);
              const sg = ctx.createLinearGradient(0, -13, 0, 13); sg.addColorStop(0, '#fff6c4'); sg.addColorStop(1, '#f0a020');
              ctx.fillStyle = sg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff6c4'; ctx.stroke();
            } else {
              const og = ctx.createRadialGradient(-4, -5, 1, 0, 0, 12); og.addColorStop(0, '#ffffff'); og.addColorStop(0.4, '#9fdcff'); og.addColorStop(1, '#2a6fd6');
              ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(p.spin * 3) * 2, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
          }
          g.rocks.forEach(drawRock);
          g.fx.draw(ctx);
          // rocket (blinks while invincible), banking as it moves
          if (!(g.inv > 0 && !g.shield && Math.floor(g.inv * 10) % 2)) {
            const x = g.x, y = SHIP_Y;
            ctx.save(); ctx.translate(x, y); ctx.rotate(clamp(g.vx / 900, -0.35, 0.35));
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
            ctx.drawImage(A.glow('#ff9f43'), -22, 6, 44, 44 + Math.random() * 10);
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            const flame = 12 + Math.random() * 10;
            const fg = ctx.createLinearGradient(0, 14, 0, 14 + flame); fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.4, '#ffd878'); fg.addColorStop(1, 'rgba(255,120,40,0)');
            ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-7, 14); ctx.quadraticCurveTo(0, 14 + flame * 1.3, 7, 14); ctx.closePath(); ctx.fill();
            // fins
            ctx.fillStyle = '#9a2f63';
            ctx.beginPath(); ctx.moveTo(-9, 4); ctx.lineTo(-17, 18); ctx.lineTo(-7, 14); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(9, 4); ctx.lineTo(17, 18); ctx.lineTo(7, 14); ctx.closePath(); ctx.fill();
            // body
            const bg = ctx.createLinearGradient(-11, 0, 11, 0); bg.addColorStop(0, '#ffd0e6'); bg.addColorStop(0.45, '#ff77b7'); bg.addColorStop(1, '#a52c6a');
            ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, -24); ctx.bezierCurveTo(12, -12, 12, 6, 9, 16); ctx.lineTo(-9, 16); ctx.bezierCurveTo(-12, 6, -12, -12, 0, -24); ctx.fill();
            ctx.fillStyle = '#ffffff33'; ctx.fillRect(-4, -14, 2.5, 22);
            // window
            const wg = ctx.createRadialGradient(-1.5, -4.5, 0.5, 0, -3, 5.5); wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#3c8fd6');
            ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffd0e6'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.restore();
            if (g.shield) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.35 + Math.sin(g.t * 6) * 0.1; ctx.drawImage(A.glow('#6fc6ff'), x - 40, y - 40, 80, 80);
              ctx.globalAlpha = 0.8; ctx.strokeStyle = '#9fdcff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke();
              ctx.restore();
            }
          }
          // combo meter
          if (g.chain > 1) {
            ctx.fillStyle = 'rgba(120,229,220,.18)'; ctx.fillRect(W / 2 - 50, 14, 100, 5);
            ctx.fillStyle = '#78e5dc'; ctx.fillRect(W / 2 - 50, 14, 100 * g.chainT / 2.5, 5);
          }
        }, true);
      }

      function finish() {
        cancelAnimationFrame(raf);
        const res = { score: g.score, stars: g.stars, near: g.near, secs: Math.floor(g.t) };
        g = null;
        const prev = A.store.get(BEST, 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set(BEST, res.score);
        setTimeout(() => {
          el.innerHTML = `
            <div class="result">
              <span class="label">Rocket down · Final score</span>
              <span class="big">${res.score}</span>
              ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
              <div class="result-stats">
                <div class="stat"><small>Survived</small><b>${res.secs}s</b></div>
                <div class="stat"><small>Stars</small><b>${res.stars}</b></div>
                <div class="stat"><small>Near misses</small><b>${res.near}</b></div>
              </div>
              <div class="row"><button class="btn primary" data-act="go">Fly again</button></div>
            </div>`;
          el.querySelector('[data-act="go"]').focus();
        }, 400);
      }

      el.onclick = e => { const b = e.target.closest('[data-act="go"]'); if (b) start(); };
      const down = e => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (g && ['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); }
      };
      const up = e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; };
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
