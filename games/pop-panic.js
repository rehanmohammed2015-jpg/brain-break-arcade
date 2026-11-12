/* Pop Panic: bubbles float up through a glowing reef. Pop one and every touching bubble of the same color
   pops too, in a chain. Gold stars blast everything nearby. Don't tap the sea mines. 30 seconds. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, ROUND = 30;
  const BEST = 'pp-best';
  const COLORS = ['#ff77b7', '#78e5dc', '#cbf56a', '#b79cff'];

  A.register({
    id: 'pop-panic',
    section: 'play',
    title: 'Pop Panic',
    color: 'pop',
    artBg: 'radial-gradient(ellipse at 50% 0%, #2a86a6 0, transparent 60%), linear-gradient(180deg, #0f3a5a, #071a33)',
    art: `<svg width="170" height="110" viewBox="0 0 170 110" aria-hidden="true">
      ${[[40, 70, 18, 0], [66, 52, 14, 0], [88, 74, 16, 0], [118, 40, 20, 1], [140, 76, 13, 3], [70, 22, 11, 2]].map(([x, y, r, c]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${['#ff77b7', '#78e5dc', '#cbf56a', '#b79cff'][c]}" opacity=".9" style="filter:drop-shadow(0 0 6px ${['#ff77b7', '#78e5dc', '#cbf56a', '#b79cff'][c]})"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.22}" fill="#fff" opacity=".8"/>`).join('')}
      <path d="M40 70 L66 52 L88 74" stroke="#fff" stroke-width="2" stroke-dasharray="3 4" fill="none" opacity=".7"/>
    </svg>`,
    blurb: 'Bubbles float up through a glowing reef. Pop one and every touching bubble of the same color goes too. Build huge chains, grab gold stars, avoid the mines.',
    tags: ['Chain reactions', '30 sec', 'Combos'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, bg = null;
      const fx = A.particles();

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Start a chain reaction</h2>
            <p>Tap a bubble to pop it. Every bubble of the same color that touches it pops too, and so on down the chain. Bigger chains are worth way more: the 5th bubble in a chain scores 5 times as much as the first.</p>
            <p>Gold stars blast every bubble around them. Sea mines cost 40 points. Wait for bubbles to bunch up, then strike! On a keyboard, move the aim with the arrow keys and pop with Space.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start popping</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get(BEST, 0)}</b></span>
          </div>`;
      }

      function makeBg() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        let gr = x.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#0f4a6e'); gr.addColorStop(0.5, '#0a2b4d'); gr.addColorStop(1, '#06142b');
        x.fillStyle = gr; x.fillRect(0, 0, W, H);
        // light rays from the surface
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const sx = 30 + i * 60 + Math.random() * 20;
          gr = x.createLinearGradient(0, 0, 0, H * 0.8); gr.addColorStop(0, 'rgba(160,230,255,.13)'); gr.addColorStop(1, 'rgba(160,230,255,0)');
          x.fillStyle = gr; x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + 26, 0); x.lineTo(sx + 80, H * 0.8); x.lineTo(sx + 20, H * 0.8); x.fill();
        }
        x.globalCompositeOperation = 'source-over';
        // reef silhouettes and glowing coral
        x.fillStyle = '#051024';
        x.beginPath(); x.moveTo(0, H);
        for (let px = 0; px <= W; px += 12) x.lineTo(px, H - 40 - Math.sin(px * 0.05) * 14 - Math.random() * 10);
        x.lineTo(W, H); x.fill();
        for (let i = 0; i < 9; i++) {
          const cx = 20 + i * 40 + Math.random() * 16, base = H - 36, col = ['#ff77b7', '#78e5dc', '#b79cff'][i % 3];
          x.strokeStyle = col; x.lineWidth = 3; x.lineCap = 'round'; x.shadowColor = col; x.shadowBlur = 10;
          const branch = (bx, by, len, ang, d) => {
            if (d > 3) return;
            const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
            x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
            branch(ex, ey, len * 0.7, ang - 0.5, d + 1); branch(ex, ey, len * 0.7, ang + 0.45, d + 1);
          };
          branch(cx, base, 14 + Math.random() * 10, -Math.PI / 2, 0);
        }
        x.shadowBlur = 0;
        return c;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="pp-score">0</b></div>
              <div class="stat"><small>Best chain</small><b id="pp-chain">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Time</small><b id="pp-time">30</b></div></div>
          </div>
          <div class="timerbar" id="pp-bar"><i></i></div>`;
        const { cv, ctx, toLogical } = A.makeCanvas(el, W, H);
        cv.setAttribute('aria-label', 'Bubble field. Tap bubbles, or aim with the arrow keys and press Space.');
        if (!bg) bg = makeBg();
        g = { ctx, t: 0, left: ROUND, score: 0, bestChain: 0, popped: 0, mines: 0, bubbles: [], spawn: 0, aim: { x: W / 2, y: H / 2, show: false },
          queue: [], motes: Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4 })), hud: {} };
        for (let i = 0; i < 14; i++) spawnBubble(H * 0.3 + Math.random() * H * 0.7);
        cv.onpointerdown = e => { e.preventDefault(); const p = toLogical(e); g.aim.show = false; tap(p.x, p.y); };
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
      let last = 0;

      function spawnBubble(y) {
        const prog = 1 - g.left / ROUND, r = Math.random();
        let kind = 'bubble';
        if (r < 0.07 + prog * 0.06) kind = 'mine';
        else if (r < 0.12 + prog * 0.06) kind = 'star';
        const rad = kind === 'bubble' ? 15 + Math.random() * 13 : 17;
        g.bubbles.push({ kind, x: rad + Math.random() * (W - rad * 2), y: y == null ? H + rad : y, r: rad, c: A.rand(0, COLORS.length - 1),
          vy: -(28 + Math.random() * 26 + prog * 30), ph: Math.random() * 6, popping: 0 });
      }

      function tap(x, y) {
        if (!g || g.left <= 0) return;
        A.sound.play('click');
        let hitB = null, bd = Infinity;
        for (const b of g.bubbles) { if (b.popping) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < b.r + 8 && d < bd) { bd = d; hitB = b; } }
        if (!hitB) return;
        if (hitB.kind === 'mine') {
          hitB.popping = 1; g.mines++;
          g.score = Math.max(0, g.score - 40);
          fx.burst(hitB.x, hitB.y, ['#ff6b7a', '#ffd878', '#2a2d45'], 20, { speed: 240 }); fx.ring(hitB.x, hitB.y, '#ff6b7a', 60);
          fx.text(hitB.x, hitB.y - 20, '−40', '#ff6b7a', 20); fx.shake(9, 0.3);
          return;
        }
        // chain: flood through touching bubbles of the same color (stars blast everything within range)
        const chain = [hitB], seen = new Set([hitB]);
        for (let i = 0; i < chain.length; i++) {
          const a = chain[i];
          for (const b of g.bubbles) {
            if (seen.has(b) || b.popping) continue;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const star = a.kind === 'star' && d < 90;
            const same = a.kind === 'bubble' && b.kind === 'bubble' && b.c === a.c && d < a.r + b.r + 10;
            const fromStar = b.kind === 'star' && a.kind === 'bubble' && d < a.r + b.r + 6; // touching a star sets it off
            if (star || same || fromStar) { seen.add(b); chain.push(b); }
          }
        }
        chain.forEach((b, i) => { b.popping = 1; g.queue.push({ b, at: g.t + i * 0.055, n: i + 1, total: chain.length }); });
        g.bestChain = Math.max(g.bestChain, chain.length);
      }

      function popNow(q) {
        const b = q.b;
        if (b.kind === 'mine') { // a star blast clears mines safely, for a small bonus
          g.score += 20; fx.burst(b.x, b.y, ['#ffd878', '#ffffff'], 10, { speed: 160, silent: true }); fx.text(b.x, b.y - 16, '+20', '#ffd878', 15);
        } else {
          const pts = b.kind === 'star' ? 50 : 10 * q.n;
          g.score += pts; g.popped++;
          const col = b.kind === 'star' ? '#ffd878' : COLORS[b.c];
          fx.burst(b.x, b.y, [col, '#ffffff'], b.kind === 'star' ? 18 : 8, { speed: 170, gravity: -30, shape: 'dot', size: 4, silent: q.n > 1 });
          fx.ring(b.x, b.y, col, b.r * 1.6, 0.35);
          if (q.n === q.total && q.total >= 3) fx.text(b.x, b.y - 20, `CHAIN ×${q.total}`, '#ffffff', Math.min(30, 14 + q.total * 1.5));
          else if (q.total < 3 || b.kind === 'star') fx.text(b.x, b.y - 16, '+' + pts, col, 15);
          if (b.kind === 'star') { fx.ring(b.x, b.y, '#ffd878', 90, 0.5); fx.shake(5); }
        }
        A.sound.play(q.n % 2 ? 'pop' : 'blip');
        b.dead = true;
      }

      function loop(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        g.t += dt;
        g.left = Math.max(0, g.left - dt);
        const prog = 1 - g.left / ROUND;
        g.spawn -= dt;
        if (g.spawn <= 0 && g.left > 0) { spawnBubble(); g.spawn = (0.42 - prog * 0.18) * (0.6 + Math.random() * 0.8); }
        for (const b of g.bubbles) {
          b.ph += dt * 2;
          b.y += b.vy * dt;
          b.x += Math.sin(b.ph) * 12 * dt;
          b.x = Math.max(b.r, Math.min(W - b.r, b.x));
        }
        // gentle separation so bubbles bunch up without overlapping
        for (let i = 0; i < g.bubbles.length; i++) for (let j = i + 1; j < g.bubbles.length; j++) {
          const a = g.bubbles[i], b = g.bubbles[j], d = Math.hypot(a.x - b.x, a.y - b.y), m = a.r + b.r + 2;
          if (d > 0 && d < m) { const push = (m - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d; a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push; }
        }
        g.queue = g.queue.filter(q => { if (g.t >= q.at) { popNow(q); return false; } return true; });
        g.bubbles = g.bubbles.filter(b => !b.dead && !(b.popping && b.kind === 'mine') && b.y > -b.r - 10);
        for (const m of g.motes) { m.y -= m.s * 10 * dt; if (m.y < 0) { m.y = H; m.x = Math.random() * W; } }
        fx.update(dt);
        render();
        setHud('pp-score', g.score); setHud('pp-chain', g.bestChain); setHud('pp-time', Math.ceil(g.left));
        const bar = el.querySelector('#pp-bar');
        if (bar) { bar.firstElementChild.style.width = (g.left / ROUND * 100) + '%'; bar.classList.toggle('low', g.left < 6); }
        if (g.left <= 0 && !g.queue.length) { if (!g.endAt) g.endAt = g.t + 0.5; if (g.t > g.endAt) return finish(); }
        raf = requestAnimationFrame(loop);
      }
      function setHud(id, v) { if (g.hud[id] === v) return; g.hud[id] = v; const n = el.querySelector('#' + id); if (n) n.textContent = v; }

      function render() {
        const ctx = g.ctx;
        A.fxFrame(ctx, fx, () => {
          ctx.drawImage(bg, 0, 0, W, H);
          ctx.fillStyle = 'rgba(200,240,255,.35)';
          for (const m of g.motes) ctx.fillRect(m.x, m.y, m.s, m.s);
          for (const b of g.bubbles) {
            if (b.dead) continue;
            const s = b.popping ? 1.15 : 1 + Math.sin(b.ph * 1.7) * 0.03;
            ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, 2 - s);
            if (b.kind === 'mine') {
              ctx.strokeStyle = '#5a6080'; ctx.lineWidth = 4;
              for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + g.t * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * (b.r + 6), Math.sin(a) * (b.r + 6)); ctx.stroke(); }
              const mg = ctx.createRadialGradient(-5, -6, 2, 0, 0, b.r); mg.addColorStop(0, '#6a7090'); mg.addColorStop(1, '#1b1e30');
              ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = Math.sin(g.t * 8) > 0 ? '#ff4d5e' : '#7a1c26'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
            } else {
              const col = b.kind === 'star' ? '#ffd878' : COLORS[b.c];
              ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45;
              ctx.drawImage(A.glow(col), -b.r * 1.9, -b.r * 1.9, b.r * 3.8, b.r * 3.8);
              ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
              const bg2 = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.4, b.r * 0.1, 0, 0, b.r);
              bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.25, col); bg2.addColorStop(1, col + '66');
              ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1.5; ctx.stroke();
              ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.ellipse(-b.r * 0.38, -b.r * 0.42, b.r * 0.22, b.r * 0.13, -0.7, 0, Math.PI * 2); ctx.fill();
              if (b.kind === 'star') {
                ctx.rotate(g.t * 2); ctx.fillStyle = '#7a4a00'; ctx.beginPath();
                for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 4 : 9; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
                ctx.fill();
              }
            }
            ctx.restore();
          }
          fx.draw(ctx);
          if (g.aim.show) {
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(g.aim.x, g.aim.y, 14, 0, Math.PI * 2);
            ctx.moveTo(g.aim.x - 22, g.aim.y); ctx.lineTo(g.aim.x - 8, g.aim.y); ctx.moveTo(g.aim.x + 8, g.aim.y); ctx.lineTo(g.aim.x + 22, g.aim.y);
            ctx.moveTo(g.aim.x, g.aim.y - 22); ctx.lineTo(g.aim.x, g.aim.y - 8); ctx.moveTo(g.aim.x, g.aim.y + 8); ctx.lineTo(g.aim.x, g.aim.y + 22); ctx.stroke();
          }
        }, true);
      }

      function finish() {
        cancelAnimationFrame(raf); raf = 0;
        const res = g; g = null;
        const prev = A.store.get(BEST, 0), isBest = res.score > prev;
        if (isBest) A.store.set(BEST, res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">Time's up · Final score</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            <div class="result-stats">
              <div class="stat"><small>Popped</small><b>${res.popped}</b></div>
              <div class="stat"><small>Biggest chain</small><b>${res.bestChain}</b></div>
              <div class="stat"><small>Mines hit</small><b>${res.mines}</b></div>
            </div>
            <div class="row"><button class="btn primary" data-act="go">Play again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => { if (e.target.closest('[data-act="go"]')) start(); };
      const held = {};
      const onKey = e => {
        if (!g) return;
        if (/^Arrow/.test(e.key)) {
          e.preventDefault(); g.aim.show = true;
          const step = 18;
          if (e.key === 'ArrowLeft') g.aim.x -= step; if (e.key === 'ArrowRight') g.aim.x += step;
          if (e.key === 'ArrowUp') g.aim.y -= step; if (e.key === 'ArrowDown') g.aim.y += step;
          g.aim.x = Math.max(10, Math.min(W - 10, g.aim.x)); g.aim.y = Math.max(10, Math.min(H - 10, g.aim.y));
        } else if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!held.space) { held.space = true; g.aim.show = true; tap(g.aim.x, g.aim.y); } }
      };
      const onUp = e => { if (e.code === 'Space' || e.key === 'Enter') held.space = false; };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onUp);
      intro();
      return () => { cancelAnimationFrame(raf); g = null; document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onUp); };
    },
  });
})();
