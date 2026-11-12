/* Snack Snake: steer a growing snake to eat snacks without hitting the walls or yourself. */
(function () {
  const A = Arcade;
  const N = 18, CELL = 20, S = N * CELL;
  let board = null; // the neon board, drawn once
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const BEST = 'ss-best';

  A.css('ss-css', `
    .ss-pad { display: grid; grid-template-columns: repeat(3, 58px); grid-template-rows: repeat(2, 50px); gap: 8px; justify-content: center; margin: 16px auto 0; }
    .ss-pad button { font-size: 22px; padding: 0; }
    .ss-pad [data-dir="up"] { grid-column: 2; grid-row: 1; }
    .ss-pad [data-dir="left"] { grid-column: 1; grid-row: 2; }
    .ss-pad [data-dir="down"] { grid-column: 2; grid-row: 2; }
    .ss-pad [data-dir="right"] { grid-column: 3; grid-row: 2; }
  `);
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const KEYDIR = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };

  A.register({
    id: 'snack-snake',
    section: 'play',
    title: 'Snack Snake',
    color: 'good',
    art: `<svg width="170" height="104" viewBox="0 0 170 104" aria-hidden="true">
      ${[[20, 70], [38, 70], [56, 70], [74, 70], [74, 52], [74, 34], [92, 34], [110, 34]].map(([x, y]) =>
        `<rect x="${x}" y="${y}" width="16" height="16" rx="4" style="fill:var(--card);stroke:var(--ink);stroke-width:2.5"/>`).join('')}
      <circle cx="146" cy="42" r="9" style="fill:var(--p1);stroke:var(--ink);stroke-width:2.5"/>
      <path d="M146 33 q4 -6 9 -5" style="fill:none;stroke:var(--ink);stroke-width:2.5"/>
    </svg>`,
    blurb: 'Steer a hungry snake to eat snacks. Every bite makes it longer and faster. Don’t hit the wall or your own tail!',
    tags: ['Arcade', 'Classic', 'Swipe or keys'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Eat, grow, don’t crash</h2>
            <p>Steer with the arrow keys or W A S D. On a phone or tablet, swipe on the board or use the arrow buttons under it.</p>
            <p>Each apple is worth 10 points and makes the snake faster. Golden stars are worth 50 and add three segments, but they vanish after a few seconds.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get(BEST, 0)}</b></span>
          </div>`;
      }

      function freeCell() {
        let x, y;
        do { x = A.rand(0, N - 1); y = A.rand(0, N - 1); }
        while (g.snake.some(s => s.x === x && s.y === y) || (g.food && g.food.x === x && g.food.y === y) || (g.gold && g.gold.x === x && g.gold.y === y));
        return { x, y };
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="ss-score">0</b></div>
              <div class="stat"><small>Length</small><b id="ss-len">4</b></div>
            </div>
          </div>`;
        ({ cv, ctx } = A.makeCanvas(el, S, S));
        cv.style.aspectRatio = '1 / 1';
        cv.style.width = 'min(100%, 440px, 60vh)';
        el.insertAdjacentHTML('beforeend', `<div class="ss-pad">
          <button class="btn" data-dir="up" aria-label="Up">↑</button>
          <button class="btn" data-dir="left" aria-label="Left">←</button>
          <button class="btn" data-dir="down" aria-label="Down">↓</button>
          <button class="btn" data-dir="right" aria-label="Right">→</button>
        </div>`);
        // swipe on the board
        let sx = null, sy = null;
        cv.addEventListener('pointerdown', e => { e.preventDefault(); sx = e.clientX; sy = e.clientY; });
        cv.addEventListener('pointermove', e => {
          if (sx === null) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
          turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
          sx = e.clientX; sy = e.clientY;
        });
        const endSwipe = () => { sx = sy = null; };
        cv.addEventListener('pointerup', endSwipe);
        cv.addEventListener('pointercancel', endSwipe);

        const mid = Math.floor(N / 2);
        g = {
          snake: [{ x: 6, y: mid }, { x: 5, y: mid }, { x: 4, y: mid }, { x: 3, y: mid }],
          dir: DIRS.right, queue: [], food: null, gold: null, grow: 0, score: 0, eaten: 0,
          tick: 0.14, acc: -0.5, last: performance.now(), dead: false, deadT: 0,
          col: { card: A.color('card'), paper: A.color('paper'), ink: A.color('ink'), snake: A.color('good'), food: A.color('p1'), gold: A.color('gold') },
          fx: A.particles(), bite: 0,
        };
        g.food = freeCell();
        raf = requestAnimationFrame(frame);
      }

      function turn(name) {
        if (!g || g.dead) return;
        const d = DIRS[name];
        const lastDir = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
        if ((d.x === lastDir.x && d.y === lastDir.y) || (d.x === -lastDir.x && d.y === -lastDir.y)) return;
        if (g.queue.length < 3) g.queue.push(d);
      }

      function step() {
        g.prev = g.snake.map(s => ({ x: s.x, y: s.y })); // remembered so the body can glide smoothly
        if (g.queue.length) g.dir = g.queue.shift();
        const head = { x: g.snake[0].x + g.dir.x, y: g.snake[0].y + g.dir.y };
        const willGrow = g.grow > 0 || (g.food.x === head.x && g.food.y === head.y);
        const body = willGrow ? g.snake : g.snake.slice(0, -1);
        if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || body.some(s => s.x === head.x && s.y === head.y)) {
          g.dead = true; g.deadT = 0.9;
          const h0 = g.snake[0];
          g.fx.shake(9, 0.4);
          g.fx.burst(h0.x * CELL + 10, h0.y * CELL + 10, [g.col.snake, g.col.food, '#FFFFFF'], 20, { speed: 200, size: 5 });
          return;
        }
        g.snake.unshift(head);
        if (head.x === g.food.x && head.y === g.food.y) {
          g.eaten++; g.score += 10; g.bite = 0.15;
          g.fx.burst(head.x * CELL + 10, head.y * CELL + 10, [g.col.food, '#FFFFFF', g.col.snake], 12, { speed: 130, size: 4 });
          g.fx.text(head.x * CELL + 10, head.y * CELL - 6, '+10', g.col.food, 15);
          g.tick = Math.max(0.065, 0.14 - g.eaten * 0.0035);
          g.food = freeCell();
          if (!g.gold && Math.random() < 0.22) { const c = freeCell(); g.gold = { ...c, until: 5.5 }; }
        } else if (g.gold && head.x === g.gold.x && head.y === g.gold.y) {
          g.score += 50; g.grow += 3; g.gold = null; g.snake.pop(); g.bite = 0.15;
          g.fx.burst(head.x * CELL + 10, head.y * CELL + 10, [g.col.gold, '#FFFFFF'], 22, { speed: 190, shape: 'confetti', size: 6 });
          g.fx.ring(head.x * CELL + 10, head.y * CELL + 10, g.col.gold, 44);
          g.fx.text(head.x * CELL + 10, head.y * CELL - 6, '+50', g.col.gold, 18);
        } else if (g.grow > 0) {
          g.grow--;
        } else {
          g.snake.pop();
        }
        el.querySelector('#ss-score').textContent = g.score;
        el.querySelector('#ss-len').textContent = g.snake.length;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.05, (now - g.last) / 1000);
        g.last = now;
        g.fx.update(dt);
        g.bite = Math.max(0, g.bite - dt);
        if (g.dead) {
          g.deadT -= dt;
          A.fxFrame(ctx, g.fx, draw);
          if (g.deadT <= 0) return finish();
        } else {
          if (g.gold) { g.gold.until -= dt; if (g.gold.until <= 0) g.gold = null; }
          g.acc += dt;
          while (g.acc >= g.tick && !g.dead) { g.acc -= g.tick; step(); }
          A.fxFrame(ctx, g.fx, draw);
        }
        raf = requestAnimationFrame(frame);
      }

      function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      }

      function draw() {
        // ---- neon arcade board (one fixed look in both themes) ----
        const t = performance.now() / 1000, LIME = '#9BFF6B', TEAL = '#2CCBB5', APPLE = '#FF4D6D', GOLD = '#FFC83D';
        if (!board) {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          board = document.createElement('canvas'); board.width = S * dpr; board.height = S * dpr;
          const b = board.getContext('2d'); b.scale(dpr, dpr);
          const bg = b.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.75);
          bg.addColorStop(0, '#12224A'); bg.addColorStop(1, '#060A1C');
          b.fillStyle = bg; b.fillRect(0, 0, S, S);
          b.strokeStyle = 'rgba(92,225,230,.08)'; b.lineWidth = 1;
          for (let i = 0; i <= N; i++) { b.beginPath(); b.moveTo(i * CELL + 0.5, 0); b.lineTo(i * CELL + 0.5, S); b.moveTo(0, i * CELL + 0.5); b.lineTo(S, i * CELL + 0.5); b.stroke(); }
          b.strokeStyle = 'rgba(92,225,230,.5)'; b.lineWidth = 2; b.strokeRect(1, 1, S - 2, S - 2);
        }
        ctx.drawImage(board, 0, 0, S, S);
        ctx.globalCompositeOperation = 'lighter';
        // apple: a pulsing glowing orb
        const f = g.food, fx = f.x * CELL + 10, fy = f.y * CELL + 10, pulse = 1 + Math.sin(t * 6) * 0.08;
        ctx.globalAlpha = 0.7; ctx.drawImage(A.glow(APPLE), fx - 22 * pulse, fy - 22 * pulse, 44 * pulse, 44 * pulse);
        if (g.gold) {
          const gx = g.gold.x * CELL + 10, gy = g.gold.y * CELL + 10;
          ctx.globalAlpha = 0.85; ctx.drawImage(A.glow(GOLD), gx - 26, gy - 26, 52, 52);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const ag = ctx.createRadialGradient(fx - 2.5, fy - 2.5, 1, fx, fy, 8 * pulse);
        ag.addColorStop(0, '#FFFFFF'); ag.addColorStop(0.35, APPLE); ag.addColorStop(1, '#A01735');
        ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(fx, fy, 7.5 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = LIME; ctx.beginPath(); ctx.ellipse(fx + 3, fy - 8, 3.5, 1.8, -0.6, 0, Math.PI * 2); ctx.fill();
        // golden star with a shrinking timer ring
        if (g.gold) {
          const gx = g.gold.x * CELL + 10, gy = g.gold.y * CELL + 10;
          ctx.save(); ctx.translate(gx, gy); ctx.rotate(t * 1.5);
          ctx.beginPath();
          for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.8 : 9; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fillStyle = GOLD; ctx.fill();
          ctx.restore();
          ctx.beginPath(); ctx.arc(gx, gy, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (g.gold.until / 5.5));
          ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.shadowColor = GOLD; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
        }
        // snake: one smooth glowing tube that glides between grid steps
        const frac = g.dead ? 1 : clamp01(g.acc / g.tick);
        const pts = g.snake.map((s, i) => {
          // each body point glides from where that point was last step (a new tail piece just appears)
          const from = g.prev ? g.prev[i] || null : null;
          const px = from ? from.x + (s.x - from.x) * frac : s.x, py = from ? from.y + (s.y - from.y) * frac : s.y;
          return { x: px * CELL + 10, y: py * CELL + 10 };
        });
        const blink = g.dead && Math.floor(g.deadT * 8) % 2;
        const bodyCol = blink ? APPLE : LIME;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const tube = (w, col, blur) => {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = blur;
          ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        };
        tube(15, blink ? '#8C1530' : TEAL, 18);
        tube(11, bodyCol, 0);
        ctx.shadowBlur = 0;
        tube(3.5, 'rgba(255,255,255,.55)', 0);
        // head
        const hd = pts[0], d = g.dir, big = g.bite / 0.15 * 3;
        const hg = ctx.createRadialGradient(hd.x - 3, hd.y - 3, 1, hd.x, hd.y, 10 + big);
        hg.addColorStop(0, '#FFFFFF'); hg.addColorStop(0.35, bodyCol); hg.addColorStop(1, TEAL);
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hd.x, hd.y, 9.5 + big, 0, Math.PI * 2); ctx.fill();
        const px = -d.y, py = d.x;
        for (const sgn of [1, -1]) {
          ctx.beginPath(); ctx.arc(hd.x + d.x * 3 + px * 4 * sgn, hd.y + d.y * 3 + py * 4 * sgn, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.beginPath(); ctx.arc(hd.x + d.x * 4 + px * 4 * sgn, hd.y + d.y * 4 + py * 4 * sgn, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = '#06101C'; ctx.fill();
        }
        if (g.acc < 0) {
          ctx.textAlign = 'center'; ctx.font = '400 30px Bungee, "Arial Black", sans-serif';
          ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = LIME; ctx.shadowBlur = 18;
          ctx.fillText('GO!', S / 2, S / 2 - 30); ctx.shadowBlur = 0;
          ctx.textAlign = 'start';
        }
      }

      function finish() {
        cancelAnimationFrame(raf);
        const res = { score: g.score, len: g.snake.length, eaten: g.eaten };
        g = null;
        const prev = A.store.get(BEST, 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set(BEST, res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">Crash! · Final score</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            <div class="result-stats">
              <div class="stat"><small>Apples</small><b>${res.eaten}</b></div>
              <div class="stat"><small>Length</small><b>${res.len}</b></div>
            </div>
            <div class="row"><button class="btn primary" data-act="go">Play again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => { if (e.target.closest('[data-act="go"]')) start(); };
      // arrow buttons react on press, not release, so quick turns land in time
      el.onpointerdown = e => {
        const b = e.target.closest('[data-dir]');
        if (b) { e.preventDefault(); turn(b.dataset.dir); }
      };
      const onKey = e => {
        if (!g) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (KEYDIR[k]) { e.preventDefault(); turn(KEYDIR[k]); }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { cancelAnimationFrame(raf); g = null; document.removeEventListener('keydown', onKey); };
    },
  });
})();
