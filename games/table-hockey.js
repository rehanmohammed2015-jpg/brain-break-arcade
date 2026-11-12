/* Table Hockey: 2 players on one screen. Each player guards a goal and knocks the puck into the other one. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, PR = 25, R = 13, GOAL = 124, WIN = 7;
  let table = null; // the table surface, drawn once
  const MAX_SPEED = 950, KEY_SPEED = 400, DRAG_SPEED = 1100;
  // computer paddle: top speed (px/s), how often it re-reads the puck (s), and how far its aim wobbles (px)
  const AI = {
    easy: { speed: 230, think: 0.22, wobble: 22 },
    medium: { speed: 340, think: 0.11, wobble: 10 },
    hard: { speed: 470, think: 0.04, wobble: 3 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  A.register({
    id: 'table-hockey',
    section: 'sports',
    title: 'Table Hockey',
    color: 'stack',
    foot: '1 or 2 players',
    art: `<svg width="170" height="104" viewBox="0 0 170 104" aria-hidden="true">
      <rect x="4" y="4" width="162" height="96" rx="14" style="fill:var(--card);stroke:var(--ink);stroke-width:3"/>
      <line x1="85" y1="4" x2="85" y2="100" style="stroke:var(--ink);stroke-width:2;stroke-dasharray:5 5"/>
      <rect x="1" y="34" width="6" height="36" style="fill:var(--ink)"/><rect x="163" y="34" width="6" height="36" style="fill:var(--ink)"/>
      <circle cx="40" cy="58" r="15" style="fill:var(--p1);stroke:var(--ink);stroke-width:3"/>
      <circle cx="132" cy="42" r="15" style="fill:var(--gold);stroke:var(--ink);stroke-width:3"/>
      <circle cx="94" cy="64" r="8" style="fill:var(--ink)"/>
    </svg>`,
    blurb: 'Slide your paddle to smack the puck into the other goal. Play a friend on a tablet or shared keyboard, or take on the computer.',
    tags: ['Action', '1–2 players', 'Touch or keys'],
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;
      let mode = A.store.get('th-mode', '2p');
      const keys = {};
      const isAI = () => mode !== '2p';
      const names = () => (isAI() ? ['You', 'Computer'] : ['Red', 'Yellow']);

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Face off on the table</h2>
            ${isAI()
              ? `<p>You are <b>Red</b> and guard the bottom goal. The computer guards the top. First to ${WIN} goals wins.</p>
                 <p>Drag your paddle with your finger or mouse, or move it with the arrow keys or W A S D.</p>`
              : `<p><b>Red</b> guards the bottom goal and <b>Yellow</b> guards the top goal. First to ${WIN} goals wins.</p>
                 <p>On a tablet or phone, lay it flat between you and each drag your own paddle with a finger. On a keyboard, Red uses the arrow keys and Yellow uses W A S D.</p>`}
          </div>
          ${A.modePicker(mode)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start match</button>
          </div>`;
      }

      function resetPositions(serveTo) {
        g.p[0].x = W / 2; g.p[0].y = H - 70;
        g.p[1].x = W / 2; g.p[1].y = 70;
        g.p.forEach(p => { p.vx = p.vy = 0; p.tx = p.ty = null; });
        g.puck.x = W / 2;
        g.puck.y = serveTo === 0 ? H / 2 + 60 : serveTo === 1 ? H / 2 - 60 : H / 2;
        g.puck.vx = g.puck.vy = 0;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats"><div class="stat"><small>${names()[0]}</small><b id="th-0" style="color:var(--p1)">0</b></div></div>
            <div class="stats"><div class="stat"><small>${names()[1]}</small><b id="th-1">0</b></div></div>
          </div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        const ptrs = {};
        cv.addEventListener('pointerdown', e => {
          if (!g) return;
          e.preventDefault();
          const pos = toLogical(e);
          const who = g.ai || pos.y > H / 2 ? 0 : 1; // vs the computer, any touch steers Red
          ptrs[e.pointerId] = who;
          try { cv.setPointerCapture(e.pointerId); } catch (err) {}
          g.p[who].tx = pos.x; g.p[who].ty = pos.y;
        });
        cv.addEventListener('pointermove', e => {
          if (!g || !(e.pointerId in ptrs)) return;
          const pos = toLogical(e);
          const p = g.p[ptrs[e.pointerId]];
          p.tx = pos.x; p.ty = pos.y;
        });
        const release = e => {
          if (!(e.pointerId in ptrs)) return;
          if (g) { const p = g.p[ptrs[e.pointerId]]; p.tx = p.ty = null; }
          delete ptrs[e.pointerId];
        };
        cv.addEventListener('pointerup', release);
        cv.addEventListener('pointercancel', release);

        g = {
          p: [{ x: 0, y: 0, vx: 0, vy: 0, tx: null, ty: null }, { x: 0, y: 0, vx: 0, vy: 0, tx: null, ty: null }],
          puck: { x: 0, y: 0, vx: 0, vy: 0 }, score: [0, 0], pause: 1.2, msg: 'Ready…', last: performance.now(),
          ai: isAI() ? AI[mode] : null, aiClock: 0, aiTx: W / 2, aiTy: 70, fx: A.particles(), hitCD: 0,
          col: { card: A.color('card'), ink: A.color('ink'), soft: A.color('ink-soft'), grid: A.color('grid'), p1: A.color('p1'), p2: A.color('gold') },
        };
        resetPositions(null);
        raf = requestAnimationFrame(frame);
      }

      // Pick where the computer's paddle should go: attack a puck in its half, otherwise guard the goal.
      function aiTarget(p) {
        const pk = g.puck, ai = g.ai;
        const wob = () => (Math.random() * 2 - 1) * ai.wobble;
        if (pk.y < H / 2 + 10) {
          if (pk.y > p.y + 6) {
            // puck is in front: strike it from slightly above so it heads toward the bottom goal
            const aimX = W / 2 + (pk.x - W / 2) * 0.3;
            const dx = pk.x - aimX, dy = pk.y - (H + 20);
            const d = Math.hypot(dx, dy) || 1;
            return { x: pk.x + dx / d * (PR + R - 6) + wob(), y: pk.y + dy / d * (PR + R - 6) + wob() };
          }
          // puck got behind the paddle: swing around the side to get back on goal
          return { x: pk.x + (pk.x < W / 2 ? 46 : -46), y: Math.max(PR, pk.y - 30) };
        }
        // puck in the other half: guard the goal, shading toward the puck
        return { x: W / 2 + (pk.x - W / 2) * 0.45 + wob(), y: 62 };
      }

      function movePaddle(p, i, dt) {
        const ox = p.x, oy = p.y;
        if (i === 1 && g.ai) {
          g.aiClock -= dt;
          if (g.aiClock <= 0) { g.aiClock = g.ai.think; const t = aiTarget(p); g.aiTx = t.x; g.aiTy = t.y; }
          const dx = g.aiTx - p.x, dy = g.aiTy - p.y, d = Math.hypot(dx, dy);
          const step = Math.min(d, g.ai.speed * dt);
          if (d > 0) { p.x += dx / d * step; p.y += dy / d * step; }
          p.x = clamp(p.x, PR, W - PR); p.y = clamp(p.y, PR, H / 2 - PR);
          p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
          return;
        }
        const k = i === 0
          ? (g.ai
            ? { l: keys.ArrowLeft || keys.a, r: keys.ArrowRight || keys.d, u: keys.ArrowUp || keys.w, d: keys.ArrowDown || keys.s }
            : { l: keys.ArrowLeft, r: keys.ArrowRight, u: keys.ArrowUp, d: keys.ArrowDown })
          : { l: keys.a, r: keys.d, u: keys.w, d: keys.s };
        const kx = (k.r ? 1 : 0) - (k.l ? 1 : 0), ky = (k.d ? 1 : 0) - (k.u ? 1 : 0);
        if (kx || ky) {
          const len = Math.hypot(kx, ky);
          p.x += kx / len * KEY_SPEED * dt; p.y += ky / len * KEY_SPEED * dt;
        } else if (p.tx !== null) {
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
          const step = Math.min(d, DRAG_SPEED * dt);
          if (d > 0) { p.x += dx / d * step; p.y += dy / d * step; }
        }
        p.x = clamp(p.x, PR, W - PR);
        p.y = i === 0 ? clamp(p.y, H / 2 + PR, H - PR) : clamp(p.y, PR, H / 2 - PR);
        p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.max(0.001, Math.min(0.033, (now - g.last) / 1000));
        g.last = now;
        update(dt);
        if (!g) return;
        A.fxFrame(ctx, g.fx, draw, true);
        raf = requestAnimationFrame(frame);
      }

      function update(dt) {
        g.fx.update(dt);
        g.hitCD = Math.max(0, g.hitCD - dt);
        if (Math.hypot(g.puck.vx, g.puck.vy) > 260) g.fx.trail(g.puck.x, g.puck.y, g.col.soft, R * 0.8, 0.18);
        g.p.forEach((p, i) => movePaddle(p, i, dt));
        if (g.pause > 0) {
          g.pause -= dt;
          if (g.pause <= 0) { g.msg = ''; if (g.done) return finish(); }
          return;
        }
        const pk = g.puck;
        const STEPS = 4, sdt = dt / STEPS;
        const gl = (W - GOAL) / 2, gr = (W + GOAL) / 2;
        for (let s = 0; s < STEPS; s++) {
          pk.x += pk.vx * sdt; pk.y += pk.vy * sdt;
          if (pk.x < R) { pk.x = R; pk.vx = Math.abs(pk.vx) * 0.9; }
          if (pk.x > W - R) { pk.x = W - R; pk.vx = -Math.abs(pk.vx) * 0.9; }
          const inMouth = pk.x > gl + 2 && pk.x < gr - 2;
          if (!inMouth) {
            if (pk.y < R) { pk.y = R; pk.vy = Math.abs(pk.vy) * 0.9; }
            if (pk.y > H - R) { pk.y = H - R; pk.vy = -Math.abs(pk.vy) * 0.9; }
          }
          if (pk.y < -R) return goal(0);
          if (pk.y > H + R) return goal(1);
          for (const p of g.p) {
            const dx = pk.x - p.x, dy = pk.y - p.y, d = Math.hypot(dx, dy);
            if (d > 0 && d < PR + R) {
              const nx = dx / d, ny = dy / d;
              pk.x = p.x + nx * (PR + R); pk.y = p.y + ny * (PR + R);
              const rvx = pk.vx - p.vx, rvy = pk.vy - p.vy;
              const vn = rvx * nx + rvy * ny;
              if (vn < 0) { pk.vx -= 1.9 * vn * nx; pk.vy -= 1.9 * vn * ny; }
              if (vn < -160 && g.hitCD <= 0) {
                g.fx.burst(pk.x - nx * R, pk.y - ny * R, ['#FFFFFF', g.col.p1, g.col.p2], 9, { speed: 170, size: 3, gravity: 0 });
                g.fx.ring(pk.x, pk.y, g.col.soft, 34, 0.25);
                if (vn < -500) g.fx.shake(3, 0.12);
                g.hitCD = 0.12;
              }
            }
          }
          const sp = Math.hypot(pk.vx, pk.vy);
          if (sp > MAX_SPEED) { pk.vx *= MAX_SPEED / sp; pk.vy *= MAX_SPEED / sp; }
        }
        const f = Math.pow(0.7, dt);
        pk.vx *= f; pk.vy *= f;
      }

      function goal(scorer) {
        const gx = g.puck.x, gy = scorer === 0 ? 0 : H, gc = scorer === 0 ? g.col.p1 : g.col.p2;
        g.fx.burst(gx, gy, [gc, '#FFFFFF', g.col.ink], 34, { speed: 280, shape: 'confetti', size: 7, gravity: 0, angle: scorer === 0 ? Math.PI / 2 : -Math.PI / 2, spread: 2.6, life: 0.9 });
        g.fx.ring(gx, gy, gc, 100, 0.6);
        g.fx.shake(10, 0.4);
        g.score[scorer]++;
        el.querySelector('#th-' + scorer).textContent = g.score[scorer];
        const done = g.score[scorer] >= WIN;
        const n = names()[scorer];
        g.msg = n === 'You' ? (done ? 'You win!' : 'You score!') : (done ? `${n} wins!` : `${n} scores!`);
        g.pause = done ? 1.6 : 1.3;
        g.done = done; g.winner = scorer;
        resetPositions(1 - scorer); // the player who was scored on serves
      }

      function draw() {
        // ---- neon air-hockey table (one fixed look in both themes) ----
        const RED = '#FF3B5C', GOLD = '#FFC83D', CYAN = '#5CE1E6';
        if (!table) {
          // the table surface with its grid of air holes, drawn once
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          table = document.createElement('canvas'); table.width = W * dpr; table.height = H * dpr;
          const t = table.getContext('2d'); t.scale(dpr, dpr);
          const bg = t.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.75);
          bg.addColorStop(0, '#16204A'); bg.addColorStop(1, '#070B1E');
          t.fillStyle = bg; t.fillRect(0, 0, W, H);
          t.fillStyle = 'rgba(140,170,255,.13)';
          for (let y = 12; y < H; y += 16) for (let x = 12 + ((y / 16) % 2) * 8; x < W; x += 16) { t.beginPath(); t.arc(x, y, 1.2, 0, Math.PI * 2); t.fill(); }
        }
        ctx.drawImage(table, 0, 0, W, H);
        const neon = (color, width, path) => {
          ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.lineWidth = width;
          ctx.beginPath(); path(); ctx.stroke(); ctx.shadowBlur = 0;
        };
        // centre line and circle
        neon(CYAN, 2.5, () => { ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); });
        neon(CYAN, 2.5, () => ctx.arc(W / 2, H / 2, 52, 0, Math.PI * 2));
        ctx.fillStyle = CYAN; ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2); ctx.fill();
        // goal creases in each player's color
        neon(GOLD, 2.5, () => ctx.arc(W / 2, 0, GOAL / 2 + 16, 0, Math.PI));
        neon(RED, 2.5, () => ctx.arc(W / 2, H, GOAL / 2 + 16, Math.PI, Math.PI * 2));
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(W / 2, 0, GOAL / 2 + 16, 0, Math.PI); ctx.fill();
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W / 2, H, GOAL / 2 + 16, Math.PI, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // glowing rails and goal slots
        const gl = (W - GOAL) / 2;
        neon('#8E9BFF', 4, () => { ctx.moveTo(gl, 2); ctx.lineTo(2, 2); ctx.lineTo(2, H - 2); ctx.lineTo(gl, H - 2); ctx.moveTo(W - gl, 2); ctx.lineTo(W - 2, 2); ctx.lineTo(W - 2, H - 2); ctx.lineTo(W - gl, H - 2); });
        ctx.fillStyle = '#000'; ctx.fillRect(gl, 0, GOAL, 6); ctx.fillRect(gl, H - 6, GOAL, 6);
        neon(GOLD, 3, () => { ctx.moveTo(gl, 5); ctx.lineTo(W - gl, 5); });
        neon(RED, 3, () => { ctx.moveTo(gl, H - 5); ctx.lineTo(W - gl, H - 5); });
        // big neon scores in each half
        ctx.textAlign = 'center'; ctx.font = '400 84px Bungee, "Arial Black", sans-serif';
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = GOLD; ctx.fillText(String(g.score[1]), W / 2, H / 4 + 30);
        ctx.fillStyle = RED; ctx.fillText(String(g.score[0]), W / 2, H * 3 / 4 + 30);
        ctx.globalAlpha = 1;
        // trails and sparks glow
        ctx.globalCompositeOperation = 'lighter';
        g.fx.draw(ctx);
        // light pools under the paddles and puck
        g.p.forEach((p, i) => { ctx.globalAlpha = 0.45; ctx.drawImage(A.glow(i === 0 ? RED : GOLD), p.x - PR * 2.4, p.y - PR * 2.4, PR * 4.8, PR * 4.8); });
        ctx.globalAlpha = 0.6; ctx.drawImage(A.glow('#FFFFFF'), g.puck.x - R * 3, g.puck.y - R * 3, R * 6, R * 6);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // puck: dark glossy disc with a glowing rim
        const pk = g.puck;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(pk.x + 2, pk.y + 3, R, 0, Math.PI * 2); ctx.fill();
        const pg = ctx.createRadialGradient(pk.x - 4, pk.y - 4, 1, pk.x, pk.y, R);
        pg.addColorStop(0, '#4A5270'); pg.addColorStop(1, '#0B0F22');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pk.x, pk.y, R, 0, Math.PI * 2); ctx.fill();
        neon('#FFFFFF', 2, () => ctx.arc(pk.x, pk.y, R - 1, 0, Math.PI * 2));
        // paddles: glossy mallets with a raised knob
        g.p.forEach((p, i) => {
          const col = i === 0 ? RED : GOLD, dark = i === 0 ? '#8C1530' : '#8A6200';
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(p.x + 3, p.y + 4, PR, 0, Math.PI * 2); ctx.fill();
          const mg = ctx.createRadialGradient(p.x - PR * 0.4, p.y - PR * 0.4, 2, p.x, p.y, PR);
          mg.addColorStop(0, '#FFFFFF'); mg.addColorStop(0.25, col); mg.addColorStop(1, dark);
          ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(p.x, p.y, PR, 0, Math.PI * 2); ctx.fill();
          neon(col, 2, () => ctx.arc(p.x, p.y, PR, 0, Math.PI * 2));
          const kg = ctx.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, PR * 0.45);
          kg.addColorStop(0, '#FFFFFF'); kg.addColorStop(1, dark);
          ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(p.x, p.y, PR * 0.45, 0, Math.PI * 2); ctx.fill();
        });
        if (g.msg) {
          ctx.font = '400 30px Bungee, "Arial Black", sans-serif';
          ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = CYAN; ctx.shadowBlur = 18;
          ctx.fillText(g.msg, W / 2, H / 2 + 11); ctx.shadowBlur = 0;
        }
        ctx.textAlign = 'start';
      }

      function finish() {
        cancelAnimationFrame(raf);
        const { score, winner } = g;
        g = null;
        el.innerHTML = `
          <div class="result">
            <span class="label">Final score</span>
            <span class="big" style="color:var(--${winner === 0 ? 'p1' : 'ink'})">${score[0]} – ${score[1]}</span>
            <span class="newbest">${isAI() ? (winner === 0 ? 'You beat the computer!' : 'The computer wins this time.') : names()[winner] + ' wins the match!'}</span>
            <div class="row">
              <button class="btn primary" data-act="go">Rematch</button>
              <button class="btn" data-act="menu">Change opponent</button>
            </div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'go') start();
        else if (b.dataset.act === 'menu') intro();
        else if (b.dataset.mode) { mode = b.dataset.mode; A.store.set('th-mode', mode); intro(); }
      };
      const CONTROL = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'];
      const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const down = e => { const k = norm(e); if (g && CONTROL.includes(k)) { keys[k] = true; e.preventDefault(); } };
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
