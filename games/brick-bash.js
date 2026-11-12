/* Brick Bash: bounce the ball off your paddle to smash every brick. Catch power-ups. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, PY = 496, PH = 12, BR = 7, COLS = 8, GAP = 4, MARGIN = 12, BH = 16, TOP = 64;
  const BW = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
  const BEST = 'bb-best';
  const POWERS = {
    wide: { letter: 'W', label: 'Wide paddle' },
    multi: { letter: 'M', label: 'Multi-ball' },
    slow: { letter: 'S', label: 'Slow ball' },
    life: { letter: '+', label: 'Extra life' },
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let stars = null;
  // hue -> #RRGGBB, for the glow sprites (cached)
  const hexCache = {};
  function hslHex(h) {
    const k = Math.round(h) % 360;
    if (hexCache[k]) return hexCache[k];
    const f = n => { const a = 0.8 * Math.min(0.6, 0.4); const kk = (n + k / 30) % 12; const c = 0.6 - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
    return (hexCache[k] = '#' + f(0) + f(8) + f(4));
  }

  function layout(level) {
    const rows = Math.min(8, 3 + level);
    const pat = (level - 1) % 4;
    const bricks = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
      let keep = true;
      if (pat === 1) keep = (r + c) % 2 === 0 || r < 2;
      if (pat === 2) keep = Math.abs(c - 3.5) <= rows - r - 0.5;
      if (pat === 3) keep = !(r % 3 === 1 && c % 3 === 1);
      if (!keep) continue;
      const hp = level >= 3 && r < Math.floor(level / 2) ? 2 : 1;
      bricks.push({ x: MARGIN + c * (BW + GAP), y: TOP + r * (BH + GAP), w: BW, h: BH, hp, hue: (r * 34 + level * 25) % 360 });
    }
    return bricks;
  }

  A.register({
    id: 'brick-bash',
    section: 'play',
    title: 'Brick Bash',
    color: 'words',
    art: `<svg width="170" height="104" viewBox="0 0 170 104" aria-hidden="true">
      ${[0, 1, 2].map(r => [0, 1, 2, 3, 4].map(c => (r === 2 && c === 2) ? '' :
        `<rect x="${8 + c * 32}" y="${8 + r * 16}" width="28" height="12" rx="2" style="fill:hsl(${r * 45 + 40} 85% 65%);stroke:var(--ink);stroke-width:2.5"/>`).join('')).join('')}
      <circle cx="96" cy="66" r="6" style="fill:var(--ink)"/>
      <rect x="58" y="86" width="56" height="10" rx="5" style="fill:var(--card);stroke:var(--ink);stroke-width:3"/>
    </svg>`,
    blurb: 'Bounce the ball off your paddle to smash every brick. Catch falling power-ups for a wider paddle or extra balls.',
    tags: ['Arcade', 'Levels', 'Power-ups'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;
      const keys = {};

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Smash every brick</h2>
            <p>Move the paddle with your mouse, your finger, or the arrow keys. Tap or press Space to launch the ball. Darker bricks take two hits.</p>
            <p>Catch the falling capsules: <b>W</b> widens your paddle, <b>M</b> splits the ball into three, <b>S</b> slows the ball, and <b>+</b> gives you an extra life.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get(BEST, 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="bb-score">0</b></div>
              <div class="stat"><small>Level</small><b id="bb-level">1</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Lives</small><b id="bb-lives" style="color:var(--p1)">♥♥♥</b></div></div>
          </div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!g) return; g.target = toLogical(e).x; launch(); });
        cv.addEventListener('pointermove', e => { if (g && (e.pointerType === 'mouse' || e.buttons)) g.target = toLogical(e).x; });
        g = {
          paddle: { x: W / 2, w: 72 }, target: null, balls: [], bricks: layout(1), drops: [], parts: [],
          lives: 3, score: 0, level: 1, wideT: 0, slowT: 0, msg: 'Tap or press Space to launch', msgT: 99, last: performance.now(), hud: {},
          col: { paper: A.color('paper'), grid: A.color('grid'), ink: A.color('ink'), card: A.color('card'), accent: A.color('words') },
          fx: A.particles(), padHit: 0,
        };
        newBall();
        raf = requestAnimationFrame(frame);
      }

      const speed = () => 300 * (1 + 0.07 * (g.level - 1));
      function newBall() { g.balls = [{ x: g.paddle.x, y: PY - BR - 1, vx: 0, vy: 0, stuck: true, off: (Math.random() - 0.5) * 20 }]; }
      function launch() {
        for (const b of g.balls) if (b.stuck) {
          const a = (Math.random() - 0.5) * 0.6;
          b.vx = speed() * Math.sin(a); b.vy = -speed() * Math.cos(a); b.stuck = false;
        }
        if (g.msgT > 2) g.msgT = 0;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        update(dt);
        if (!g) return;
        A.fxFrame(ctx, g.fx, draw, true);
        raf = requestAnimationFrame(frame);
      }

      function burst(x, y, color) {
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
          g.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color });
        }
      }

      function hitBrick(br) {
        br.hp--;
        if (br.hp > 0) { g.fx.ring(br.x + br.w / 2, br.y + br.h / 2, '#FFFFFF', 24, 0.25); return; }
        g.fx.burst(br.x + br.w / 2, br.y + br.h / 2, [`hsl(${br.hue} 80% 62%)`, `hsl(${br.hue} 80% 75%)`], 12, { speed: 180, size: 6 });
        g.fx.shake(2.5, 0.1);
        g.bricks.splice(g.bricks.indexOf(br), 1);
        g.score += 10 * g.level;
        burst(br.x + br.w / 2, br.y + br.h / 2, `hsl(${br.hue} 80% 62%)`);
        if (Math.random() < 0.14) {
          const r = Math.random();
          const type = r < 0.06 ? 'life' : r < 0.4 ? 'wide' : r < 0.72 ? 'multi' : 'slow';
          g.drops.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type });
        }
      }

      function brickAt(b) {
        for (const br of g.bricks) {
          const cx = clamp(b.x, br.x, br.x + br.w), cy = clamp(b.y, br.y, br.y + br.h);
          if ((b.x - cx) ** 2 + (b.y - cy) ** 2 < BR * BR) return br;
        }
        return null;
      }

      function update(dt) {
        const p = g.paddle;
        const dir = ((keys.ArrowRight || keys.d) ? 1 : 0) - ((keys.ArrowLeft || keys.a) ? 1 : 0);
        if (dir) { g.target = null; p.x += dir * 460 * dt; }
        else if (g.target !== null) { const d = g.target - p.x; p.x += Math.sign(d) * Math.min(Math.abs(d), 1500 * dt); }
        p.w += ((g.wideT > 0 ? 112 : 72) - p.w) * Math.min(1, dt * 8);
        p.x = clamp(p.x, p.w / 2, W - p.w / 2);
        g.wideT = Math.max(0, g.wideT - dt);
        g.slowT = Math.max(0, g.slowT - dt);
        g.msgT += dt;
        g.padHit = Math.max(0, g.padHit - dt);
        g.fx.update(dt);
        for (const b of g.balls) if (!b.stuck) g.fx.trail(b.x, b.y, g.slowT > 0 ? '#2C8FD6' : g.col.accent, 6, 0.2);

        const m = g.slowT > 0 ? 0.62 : 1;
        const STEPS = 3, s = dt * m / STEPS;
        for (const b of g.balls) {
          if (b.stuck) { b.x = p.x + b.off; b.y = PY - BR - 1; continue; }
          for (let k = 0; k < STEPS; k++) {
            b.x += b.vx * s;
            if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
            if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); }
            let br = brickAt(b);
            if (br) { b.x -= b.vx * s; b.vx = -b.vx; hitBrick(br); }
            b.y += b.vy * s;
            if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); }
            br = brickAt(b);
            if (br) { b.y -= b.vy * s; b.vy = -b.vy; hitBrick(br); }
            // paddle bounce: where it hits sets the angle
            if (b.vy > 0 && b.y + BR >= PY && b.y + BR <= PY + PH + 10 && Math.abs(b.x - p.x) <= p.w / 2 + BR) {
              const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
              const a = off * 1.05;
              const sp = speed();
              b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a);
              b.y = PY - BR;
              g.padHit = 0.15;
              g.fx.burst(b.x, PY, [g.col.accent, '#FFFFFF'], 6, { speed: 120, angle: -Math.PI / 2, spread: 1.8, size: 3 });
            }
          }
        }
        g.balls = g.balls.filter(b => b.y < H + 20);

        for (const d of g.drops) d.y += 150 * dt;
        g.drops = g.drops.filter(d => {
          if (d.y > H + 10) return false;
          if (d.y + 9 >= PY && d.y - 9 <= PY + PH && Math.abs(d.x - p.x) <= p.w / 2 + 12) { power(d.type); return false; }
          return true;
        });
        for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
        g.parts = g.parts.filter(q => q.life > 0);

        if (!g.balls.length) {
          g.lives--;
          g.fx.shake(9, 0.35);
          if (g.lives <= 0) return finish();
          g.wideT = g.slowT = 0; g.drops = [];
          newBall();
          g.msg = 'Ball lost! Tap to launch'; g.msgT = 0;
        }
        if (!g.bricks.length) {
          A.confetti(90);
          g.level++;
          g.bricks = layout(g.level);
          g.drops = []; g.wideT = g.slowT = 0;
          newBall();
          g.msg = `Level ${g.level}! Tap to launch`; g.msgT = 0;
        }
        setHud('bb-score', g.score);
        setHud('bb-level', g.level);
        setHud('bb-lives', '♥'.repeat(g.lives));
      }

      function power(type) {
        g.msg = POWERS[type].label + '!'; g.msgT = 0;
        g.fx.ring(g.paddle.x, PY, g.col.accent, 60, 0.45);
        g.fx.burst(g.paddle.x, PY, [g.col.accent, '#FFFFFF', '#F2B400'], 14, { speed: 160, angle: -Math.PI / 2, spread: 2.4, shape: 'confetti', size: 6 });
        if (type === 'wide') g.wideT = 12;
        if (type === 'slow') g.slowT = 10;
        if (type === 'life') g.lives = Math.min(5, g.lives + 1);
        if (type === 'multi') {
          const moving = g.balls.filter(b => !b.stuck);
          const src = moving[0];
          if (!src) { launch(); return; }
          for (const da of [-0.4, 0.4]) {
            if (g.balls.length >= 7) break;
            const c = Math.cos(da), s = Math.sin(da);
            g.balls.push({ x: src.x, y: src.y, vx: src.vx * c - src.vy * s, vy: src.vx * s + src.vy * c, stuck: false });
          }
        }
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
      }

      function rrect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      }

      function draw() {
        // ---- neon arcade look (one fixed look in both themes) ----
        const t = performance.now() / 1000, ORANGE = '#FF8A3D', CYAN = '#5CE1E6';
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0A0626'); bg.addColorStop(0.6, '#1A0F45'); bg.addColorStop(1, '#2B0F4A');
        ctx.fillStyle = bg; ctx.fillRect(-12, -12, W + 24, H + 24);
        // drifting stars
        if (!stars) stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() }));
        for (const s of stars) {
          const y = (s.y + t * (6 + s.s * 14)) % H;
          ctx.globalAlpha = 0.25 + s.s * 0.55; ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(s.x, y, 1 + s.s, 1 + s.s);
        }
        ctx.globalAlpha = 1;
        // glowing perspective floor under the paddle
        ctx.strokeStyle = 'rgba(255,92,180,.28)'; ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) { const y = 430 + Math.pow(i / 6, 1.6) * 110; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 14, 430); ctx.lineTo(W / 2 + i * 70, H); ctx.stroke(); }
        // bricks: glossy, bevelled, glowing
        ctx.globalCompositeOperation = 'lighter';
        for (const br of g.bricks) {
          ctx.globalAlpha = 0.28;
          ctx.drawImage(A.glow(hslHex(br.hue)), br.x - 10, br.y - 12, br.w + 20, br.h + 24);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        for (const br of g.bricks) {
          const tough = br.hp > 1;
          const gr = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
          gr.addColorStop(0, `hsl(${br.hue} 95% ${tough ? 62 : 78}%)`);
          gr.addColorStop(0.5, `hsl(${br.hue} 85% ${tough ? 42 : 58}%)`);
          gr.addColorStop(1, `hsl(${br.hue} 80% ${tough ? 28 : 40}%)`);
          rrect(br.x, br.y, br.w, br.h, 4); ctx.fillStyle = gr; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(br.x + 3, br.y + 2, br.w - 6, 2);
          if (tough) {
            // metal studs show it takes two hits
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.beginPath(); ctx.arc(br.x + 6, br.y + br.h / 2, 1.6, 0, Math.PI * 2); ctx.arc(br.x + br.w - 6, br.y + br.h / 2, 1.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (const q of g.parts) { ctx.globalAlpha = q.life / 0.5; ctx.fillStyle = q.color; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
        ctx.globalAlpha = 1;
        // power-up capsules glow and spin their letter
        for (const d of g.drops) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
          ctx.drawImage(A.glow(CYAN), d.x - 26, d.y - 20, 52, 40);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          rrect(d.x - 15, d.y - 9, 30, 18, 9);
          const cg = ctx.createLinearGradient(0, d.y - 9, 0, d.y + 9);
          cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(1, '#9FEFF2');
          ctx.fillStyle = cg; ctx.fill();
          ctx.save(); ctx.translate(d.x, d.y + 5); ctx.scale(Math.cos(t * 4), 1);
          ctx.fillStyle = '#0A0626'; ctx.font = '700 13px "Atkinson Hyperlegible", system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(POWERS[d.type].letter, 0, 0);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        g.fx.draw(ctx); // trails and sparks glow, under the paddle and balls
        const p = g.paddle;
        ctx.globalAlpha = 0.55; ctx.drawImage(A.glow(ORANGE), p.x - p.w * 0.9, PY - 26, p.w * 1.8, 64);
        for (const b of g.balls) { ctx.globalAlpha = 0.8; ctx.drawImage(A.glow(g.slowT > 0 ? '#5CC0FF' : '#FFFFFF'), b.x - 18, b.y - 18, 36, 36); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const sq = g.padHit / 0.15; // paddle squashes when the ball hits it
        rrect(p.x - p.w / 2 - sq * 4, PY + sq * 3, p.w + sq * 8, PH - sq * 3, 6);
        const pg = ctx.createLinearGradient(0, PY, 0, PY + PH);
        pg.addColorStop(0, '#FFE0C2'); pg.addColorStop(0.4, ORANGE); pg.addColorStop(1, '#B4461A');
        ctx.fillStyle = pg; ctx.fill();
        ctx.fillStyle = CYAN; ctx.fillRect(p.x - p.w / 2 + 3, PY + PH / 2 - 1, 5, 2); ctx.fillRect(p.x + p.w / 2 - 8, PY + PH / 2 - 1, 5, 2);
        for (const b of g.balls) {
          ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, Math.PI * 2);
          ctx.fillStyle = g.slowT > 0 ? '#BFE6FF' : '#FFFFFF'; ctx.fill();
        }
        if (g.msgT < 2.2 || g.balls.some(b => b.stuck)) {
          ctx.textAlign = 'center'; ctx.font = '400 15px Bungee, "Arial Black", sans-serif';
          ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = '#FF5CB4'; ctx.shadowBlur = 14;
          ctx.fillText(g.msg, W / 2, 400); ctx.shadowBlur = 0;
        }
        ctx.textAlign = 'start';
      }

      function finish() {
        cancelAnimationFrame(raf);
        const res = { score: g.score, level: g.level };
        g = null;
        const prev = A.store.get(BEST, 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set(BEST, res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">Game over · Final score</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            <div class="result-stats"><div class="stat"><small>Reached level</small><b>${res.level}</b></div></div>
            <div class="row"><button class="btn primary" data-act="go">Play again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => { if (e.target.closest('[data-act="go"]')) start(); };
      const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const down = e => {
        if (!g) return;
        const k = norm(e);
        if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); }
        if (e.code === 'Space' || k === 'ArrowUp' || k === 'w') { e.preventDefault(); launch(); }
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
