/* Hoop Shot: pull back and release to shoot baskets. 60 seconds on the clock. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, FLOOR = 500, BR = 14, GRAV = 900;
  let arena = null; // the crowd backdrop, drawn once
  const ROUND = 60;
  const LEVEL = {
    easy: { preview: 14, moveAt: Infinity },
    medium: { preview: 6, moveAt: 20 },
    hard: { preview: 0, moveAt: 10 },
  };

  A.register({
    id: 'hoop-shot',
    section: 'sports',
    title: 'Hoop Shot',
    color: 'words',
    art: `<svg width="170" height="104" viewBox="0 0 170 104" aria-hidden="true">
      <rect x="128" y="10" width="8" height="52" style="fill:var(--card);stroke:var(--ink);stroke-width:2.5"/>
      <path d="M92 40 H128" style="stroke:var(--ink);stroke-width:4"/>
      <path d="M95 41 L101 62 H119 L125 41 M101 62 L104 41 M119 62 L116 41" style="fill:none;stroke:var(--card);stroke-width:2"/>
      <path d="M22 92 Q50 0 98 30" style="fill:none;stroke:var(--card);stroke-width:2;stroke-dasharray:4 5"/>
      <circle cx="98" cy="30" r="11" style="fill:#F07D2E;stroke:var(--ink);stroke-width:2.5"/>
      <path d="M87 30 H109 M98 19 V41" style="stroke:var(--ink);stroke-width:1.5"/>
    </svg>`,
    blurb: 'Pull back and let it fly. Sink as many baskets as you can in 60 seconds. A swish with no rim is worth 3.',
    tags: ['Basketball', '60 sec', 'Drag to shoot'],
    best() { const b = A.store.get('hs-best', 0); return b ? b + ' pts' : null; },
    mount(el) {
      let level = A.store.get('hs-level', 'medium');
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;
      const keys = {};

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Beat the buzzer</h2>
            <p>Press on the court, pull back away from the hoop, and let go to shoot, like a slingshot. The farther you pull, the harder the throw.</p>
            <p>On a keyboard, aim with ← → and set power with ↑ ↓, then press Space. Baskets are worth 2, a clean swish is worth 3, and three in a row earns a bonus point. On Medium and Hard, the hoop starts moving once you’re scoring.</p>
          </div>
          ${A.modePicker(level, true)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Tip off</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get('hs-best', 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="hs-score">0</b></div>
              <div class="stat"><small>Baskets</small><b id="hs-made">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Time</small><b id="hs-time">60</b></div></div>
          </div>
          <div class="timerbar" id="hs-bar"><i></i></div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        cv.addEventListener('pointerdown', e => {
          if (!g || !g.ball.ready) return;
          e.preventDefault();
          try { cv.setPointerCapture(e.pointerId); } catch (err) {}
          g.drag = { from: toLogical(e), to: toLogical(e) };
        });
        cv.addEventListener('pointermove', e => { if (g && g.drag) g.drag.to = toLogical(e); });
        const release = () => {
          if (!g || !g.drag) return;
          const v = dragVel();
          g.drag = null;
          if (Math.hypot(v.x, v.y) > 120) launch(v.x, v.y);
        };
        cv.addEventListener('pointerup', release);
        cv.addEventListener('pointercancel', () => { if (g) g.drag = null; });
        g = {
          cfg: LEVEL[level], time: ROUND, score: 0, made: 0, streak: 0, hoopY: 210, hoopT: 0,
          ball: null, drag: null, aimAng: -60, aimPow: 620, msg: '', msgT: 0, last: performance.now(), hud: {},
          col: { paper: A.color('paper'), grid: A.color('grid'), ink: A.color('ink'), card: A.color('card') },
          fx: A.particles(), netT: 0,
        };
        spawn();
        raf = requestAnimationFrame(frame);
      }

      function spawn() {
        g.ball = { x: 40 + Math.random() * 150, y: FLOOR - BR, vx: 0, vy: 0, ready: true, t: 0, touched: false, scored: false, prevY: 0, spin: 0 };
      }
      function dragVel() {
        const dx = g.drag.from.x - g.drag.to.x, dy = g.drag.from.y - g.drag.to.y;
        let vx = dx * 5.2, vy = dy * 5.2;
        const sp = Math.hypot(vx, vy), max = 960;
        if (sp > max) { vx *= max / sp; vy *= max / sp; }
        return { x: vx, y: vy };
      }
      function keyVel() {
        const a = g.aimAng * Math.PI / 180;
        return { x: Math.cos(a) * g.aimPow, y: Math.sin(a) * g.aimPow };
      }
      function launch(vx, vy) {
        const b = g.ball;
        b.vx = vx; b.vy = vy; b.ready = false; b.t = 0; b.prevY = b.y;
      }

      const rim = () => ({ front: { x: 262, y: g.hoopY }, back: { x: 316, y: g.hoopY } });

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        update(dt);
        if (!g) return;
        A.fxFrame(ctx, g.fx, draw, true);
        raf = requestAnimationFrame(frame);
      }

      function update(dt) {
        g.time -= dt;
        g.msgT -= dt;
        g.netT = Math.max(0, g.netT - dt);
        g.fx.update(dt);
        if (!g.ball.ready) {
          g.ball.rimCD = (g.ball.rimCD || 0) - dt;
          g.fx.trail(g.ball.x, g.ball.y, 'rgba(240,125,46,.45)', BR * 0.8, 0.16);
        }
        if (g.score >= g.cfg.moveAt) { g.hoopT += dt; g.hoopY = 200 + Math.sin(g.hoopT * 1.2) * 55; }
        // keyboard aiming
        if (keys.ArrowLeft) g.aimAng = Math.max(-88, g.aimAng - 70 * dt);
        if (keys.ArrowRight) g.aimAng = Math.min(-15, g.aimAng + 70 * dt);
        if (keys.ArrowUp) g.aimPow = Math.min(960, g.aimPow + 300 * dt);
        if (keys.ArrowDown) g.aimPow = Math.max(250, g.aimPow - 300 * dt);

        const b = g.ball;
        if (!b.ready) {
          b.t += dt;
          const STEPS = 4, s = dt / STEPS;
          for (let i = 0; i < STEPS; i++) {
            b.prevY = b.y;
            b.vy += GRAV * s; b.x += b.vx * s; b.y += b.vy * s;
            b.spin += b.vx * s * 0.05;
            const r = rim();
            for (const p of [r.front, r.back]) {
              const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
              if (d < BR + 4 && d > 0) {
                const nx = dx / d, ny = dy / d;
                b.x = p.x + nx * (BR + 4); b.y = p.y + ny * (BR + 4);
                const vn = b.vx * nx + b.vy * ny;
                if (vn < 0) { b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny; }
                b.touched = true;
                if (b.rimCD <= 0 && vn < -120) { g.fx.burst(p.x, p.y, ['#E8590C', '#FFE14D'], 6, { speed: 130, size: 3 }); b.rimCD = 0.15; }
              }
            }
            // backboard
            if (b.x + BR > 322 && b.x < 334 && b.y > g.hoopY - 92 && b.y < g.hoopY + 20) {
              b.x = 322 - BR; b.vx = -Math.abs(b.vx) * 0.6; b.touched = true;
            }
            if (b.y + BR > FLOOR) { b.y = FLOOR - BR; b.vy = -Math.abs(b.vy) * 0.55; b.vx *= 0.8; }
            if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * 0.6; }
            // basket: center passes down through the rim between the two rim points
            if (!b.scored && b.vy > 0 && b.prevY < g.hoopY && b.y >= g.hoopY && b.x > r.front.x + 4 && b.x < r.back.x - 4) {
              b.scored = true;
              g.made++; g.streak++;
              let pts = b.touched ? 2 : 3;
              if (g.streak >= 3) pts += 1;
              g.score += pts;
              g.msg = (g.streak >= 3 ? 'On fire! ' : b.touched ? 'Bucket! ' : 'Swish! ') + `+${pts}`;
              g.msgT = 1.1;
              g.netT = 0.6;
              g.fx.burst(289, g.hoopY + 24, ['#E8590C', '#FFFFFF', '#F2B400'], b.touched ? 18 : 30, { speed: 220, shape: 'confetti', size: 7 });
              g.fx.ring(289, g.hoopY, '#E8590C', b.touched ? 46 : 70, 0.5);
              g.fx.shake(b.touched ? 3 : 6, 0.2);
            }
          }
          const resting = b.y >= FLOOR - BR - 1 && Math.abs(b.vy) < 60 && Math.abs(b.vx) < 30;
          if ((b.scored && b.t > 1.2) || b.x > W + 40 || resting || b.t > 4) {
            if (!b.scored) g.streak = 0;
            spawn();
          }
        }
        setHud('hs-score', g.score);
        setHud('hs-made', g.made);
        setHud('hs-time', Math.max(0, Math.ceil(g.time)));
        const bar = el.querySelector('#hs-bar');
        bar.firstElementChild.style.width = Math.max(0, g.time / ROUND * 100) + '%';
        bar.classList.toggle('low', g.time < 10);
        if (g.time <= 0) finish();
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
      }

      function draw() {
        const c = g.col, t = g.time === undefined ? 0 : ROUND - g.time;
        // ---- arena backdrop: crowd in the stands, jumbotron, spotlights ----
        if (!arena) arena = A.crowd(W, 330, [[70, 150, '#141B3A'], [150, 240, '#182045'], [240, 330, '#1C2550']], '#070B1E');
        ctx.drawImage(arena, 0, 0, W, 330);
        // the wall between the stands and the court, with a glowing rail
        const wallG = ctx.createLinearGradient(0, 326, 0, 404);
        wallG.addColorStop(0, '#1A2148'); wallG.addColorStop(1, '#0A0F24');
        ctx.fillStyle = wallG; ctx.fillRect(0, 326, W, 78);
        ctx.fillStyle = '#5CE1E6'; ctx.globalAlpha = 0.6; ctx.fillRect(0, 328, W, 2); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        for (let x = 0; x < W; x += 30) ctx.fillRect(x, 334, 22, 64);
        const sky = ctx.createLinearGradient(0, 0, 0, 90);
        sky.addColorStop(0, '#04060F'); sky.addColorStop(1, 'rgba(4,6,15,0)');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 90);
        // jumbotron with the live score and clock
        ctx.fillStyle = '#0B0F22'; ctx.strokeStyle = '#2A3150'; ctx.lineWidth = 2;
        ctx.beginPath(); rr(W / 2 - 74, 10, 148, 50, 8); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.font = '400 22px Bungee, "Arial Black", sans-serif'; ctx.fillStyle = '#FFB347'; ctx.shadowColor = '#FFB347'; ctx.shadowBlur = 10;
        ctx.fillText(String(g.score).padStart(3, '0'), W / 2 - 34, 46);
        ctx.fillStyle = g.time < 10 ? '#FF5A5A' : '#5CE1E6'; ctx.shadowColor = ctx.fillStyle;
        ctx.fillText(String(Math.max(0, Math.ceil(g.time))).padStart(2, '0'), W / 2 + 42, 46);
        ctx.shadowBlur = 0;
        ctx.font = '700 8px "Atkinson Hyperlegible", sans-serif'; ctx.fillStyle = '#8892B0';
        ctx.fillText('POINTS', W / 2 - 34, 22); ctx.fillText('SHOT CLOCK', W / 2 + 42, 22);
        ctx.textAlign = 'start';
        // camera flashes in the crowd
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 2 + (g.netT > 0 ? 18 : 0); i++) if (Math.random() < 0.5) ctx.fillRect(Math.random() * W, 80 + Math.random() * 240, 2, 2);
        // courtside LED boards
        ctx.fillStyle = '#0A0F24'; ctx.fillRect(0, 404, W, 34);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 404, W, 34); ctx.clip();
        ctx.font = '400 18px Bungee, "Arial Black", sans-serif'; ctx.textBaseline = 'middle';
        const led = '  BRAIN BREAK ARCADE  ✦  BEAT THE BUZZER  ✦ ';
        const lw = ctx.measureText(led).width, off = -((t * 45) % lw);
        ctx.fillStyle = Math.floor(t / 4) % 2 ? '#5CE1E6' : '#FFB347'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        for (let x = off; x < W; x += lw) ctx.fillText(led, x, 421);
        ctx.restore(); ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
        // polished hardwood court seen at an angle
        const wood = ctx.createLinearGradient(0, 438, 0, H);
        wood.addColorStop(0, '#B97A3F'); wood.addColorStop(1, '#D9A066');
        ctx.fillStyle = wood; ctx.fillRect(0, 438, W, H - 438);
        ctx.strokeStyle = 'rgba(120,70,30,.35)'; ctx.lineWidth = 1;
        for (let y = 444; y < H; y += 7 + (y - 438) * 0.08) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        // painted key under the hoop, three-point line, reflections of the lights
        ctx.fillStyle = 'rgba(224,58,62,.55)';
        ctx.beginPath(); ctx.moveTo(220, 438); ctx.lineTo(W, 438); ctx.lineTo(W, H); ctx.lineTo(180, H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(220, 438); ctx.lineTo(180, H); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(W + 20, 495, 300, 60, 0, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [60, 300]) { ctx.globalAlpha = 0.18; ctx.drawImage(A.glow('#FFF4D6'), lx - 60, 470, 120, 50); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // stadium spotlights
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [40, W - 40]) { ctx.globalAlpha = 0.8; ctx.drawImage(A.glow('#FFF4D6'), lx - 55, -30, 110, 110); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // stanchion, padded base, glass backboard, rim, net
        const hy = g.hoopY;
        ctx.fillStyle = '#2B3350'; ctx.fillRect(338, hy - 60, 12, 440 - hy + 60);
        ctx.fillStyle = '#1E2540'; ctx.beginPath(); rr(326, 430, 34, 40, 6); ctx.fill();
        ctx.fillStyle = 'rgba(200,230,255,.28)'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
        ctx.beginPath(); rr(318, hy - 96, 16, 118, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#E8590C'; ctx.lineWidth = 2; ctx.strokeRect(320, hy - 40, 12, 34);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.6;
        // the net stretches and sways after a basket
        const k = g.netT / 0.6, sway = Math.sin(g.netT * 28) * 5 * k, drop = 38 + 12 * k;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const t = i / 4; ctx.moveTo(262 + t * 54, hy); ctx.lineTo(272 + t * 34 + sway, hy + drop); }
        ctx.moveTo(266 + sway * 0.35, hy + drop * 0.34); ctx.lineTo(312 + sway * 0.35, hy + drop * 0.34);
        ctx.moveTo(270 + sway * 0.7, hy + drop * 0.68); ctx.lineTo(308 + sway * 0.7, hy + drop * 0.68);
        ctx.stroke();
        g.fx.draw(ctx);
        // glowing rim
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + (g.netT > 0 ? 0.5 : 0);
        ctx.drawImage(A.glow('#FF7A1A'), 252, hy - 30, 80, 60);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#E8590C'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(262, hy); ctx.lineTo(322, hy); ctx.stroke();
        ctx.strokeStyle = '#FF9A4D'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(264, hy - 1.5); ctx.lineTo(320, hy - 1.5); ctx.stroke();
        ctx.lineCap = 'butt';
        // aim preview: glowing dots
        const b = g.ball;
        if (b.ready) {
          const v = g.drag ? dragVel() : keyVel();
          const dots = g.drag ? Math.max(3, g.cfg.preview) : Math.max(4, g.cfg.preview);
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 1; i <= dots; i++) {
            const tt = i * 0.06;
            ctx.globalAlpha = 1 - i / (dots + 2);
            ctx.drawImage(A.glow('#FFE14D'), b.x + v.x * tt - 7, b.y + v.y * tt + 0.5 * GRAV * tt * tt - 7, 14, 14);
          }
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        // ball shadow on the court
        const hgt = Math.max(0, FLOOR - BR - b.y);
        ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.max(0.15, 1 - hgt / 300)})`;
        ctx.beginPath(); ctx.ellipse(b.x, FLOOR - 2, BR * (1 + hgt / 400), BR * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // ball with real shading and seams
        ctx.save(); ctx.translate(b.x, b.y);
        const shade = ctx.createRadialGradient(-BR * 0.35, -BR * 0.4, 1, 0, 0, BR);
        shade.addColorStop(0, '#FFB36B'); shade.addColorStop(0.6, '#F07D2E'); shade.addColorStop(1, '#A9471A');
        ctx.beginPath(); ctx.arc(0, 0, BR, 0, Math.PI * 2); ctx.fillStyle = shade; ctx.fill();
        ctx.rotate(b.spin);
        ctx.strokeStyle = '#3A1A0C'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-BR, 0); ctx.lineTo(BR, 0); ctx.moveTo(0, -BR); ctx.lineTo(0, BR);
        ctx.moveTo(-BR * 0.7, -BR * 0.7); ctx.quadraticCurveTo(0, 0, -BR * 0.7, BR * 0.7);
        ctx.moveTo(BR * 0.7, -BR * 0.7); ctx.quadraticCurveTo(0, 0, BR * 0.7, BR * 0.7); ctx.stroke();
        ctx.restore();
        if (g.msgT > 0) {
          const k = Math.min(1, (1.1 - g.msgT) * 5);
          ctx.save(); ctx.translate(W / 2, 120); ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k); ctx.rotate(-0.05);
          ctx.textAlign = 'center'; ctx.font = '400 30px Bungee, "Arial Black", sans-serif';
          for (let i = 5; i > 0; i--) { ctx.fillStyle = '#0B0F22'; ctx.fillText(g.msg, i * 0.8, i); }
          const gr = ctx.createLinearGradient(0, -26, 0, 6);
          gr.addColorStop(0, '#FFF6B0'); gr.addColorStop(1, '#FF8A1A');
          ctx.fillStyle = gr; ctx.fillText(g.msg, 0, 0);
          ctx.restore();
        }
      }
      function rr(x, y, w, h, r) { if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

      function finish() {
        cancelAnimationFrame(raf);
        const res = { score: g.score, made: g.made };
        g = null;
        const prev = A.store.get('hs-best', 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set('hs-best', res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">Buzzer! · Final score</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            <div class="result-stats"><div class="stat"><small>Baskets</small><b>${res.made}</b></div></div>
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
        else if (b.dataset.mode) { level = b.dataset.mode; A.store.set('hs-level', level); intro(); }
      };
      const down = e => {
        if (!g) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { keys[e.key] = true; e.preventDefault(); }
        if (e.code === 'Space') { e.preventDefault(); if (g.ball.ready) { const v = keyVel(); launch(v.x, v.y); } }
      };
      const up = e => { keys[e.key] = false; };
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
