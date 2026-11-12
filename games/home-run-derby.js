/* Home Run Derby: time your swing to crush pitches over the fence. 10 outs. */
(function () {
  const A = Arcade;
  const W = 360, H = 540;
  const PLATE_Y = 452, MOUND_Y = 150, FENCE = 350, OUTS = 10;
  let stands = null; // outfield crowd, drawn once
  const LEVEL = {
    easy: { speeds: [300, 360], window: 56, changeup: 0.15 },
    medium: { speeds: [360, 470], window: 44, changeup: 0.25 },
    hard: { speeds: [430, 580], window: 34, changeup: 0.35 },
  };

  A.register({
    id: 'home-run-derby',
    section: 'sports',
    title: 'Home Run Derby',
    color: 'math',
    art: `<svg width="170" height="104" viewBox="0 0 170 104" aria-hidden="true">
      <path d="M85 98 L20 40 Q85 -6 150 40 Z" style="fill:var(--card);opacity:.35"/>
      <path d="M85 98 L60 74 L85 50 L110 74 Z" style="fill:#D9A066;stroke:var(--ink);stroke-width:2.5"/>
      <path d="M48 96 L104 66" style="stroke:#B5793E;stroke-width:8;stroke-linecap:round"/>
      <path d="M48 96 L104 66" style="stroke:var(--ink);stroke-width:2;stroke-linecap:round;fill:none;opacity:.6"/>
      <circle cx="118" cy="28" r="8" style="fill:#fff;stroke:var(--ink);stroke-width:2.5"/>
      <path d="M113 24 q5 4 0 9 M123 24 q-5 4 0 9" style="fill:none;stroke:var(--p1);stroke-width:1.5"/>
    </svg>`,
    blurb: 'Watch the pitch, then swing at just the right moment. Crush it past 350 feet for a home run. You get 10 outs.',
    tags: ['Baseball', 'Timing', 'One button'],
    best() { const b = A.store.get('hr-best', 0); return b ? b + ' HR' : null; },
    mount(el) {
      let level = A.store.get('hr-level', 'medium');
      let raf = 0, g = null, ctx = null, cv = null;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Swing for the fences</h2>
            <p>The pitcher throws from the top of the screen. Tap, click or press Space to swing when the ball reaches the plate. The better your timing, the farther it flies.</p>
            <p>Anything that doesn’t clear the 350-foot fence is an out, and so is a miss or a foul ball. Watch out for slow changeups. How many home runs can you hit before 10 outs?</p>
          </div>
          ${A.modePicker(level, true)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Play ball</button>
            <span class="best" style="align-self:center">Most home runs: <b>${A.store.get('hr-best', 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Home runs</small><b id="hr-hr">0</b></div>
              <div class="stat"><small>Longest</small><b id="hr-long">–</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Outs</small><b id="hr-outs">0/${OUTS}</b></div></div>
          </div>`;
        ({ cv, ctx } = A.makeCanvas(el, W, H));
        cv.addEventListener('pointerdown', e => { e.preventDefault(); swing(); });
        g = { cfg: LEVEL[level], hr: 0, outs: 0, longest: 0, phase: 'windup', t: 0, ball: null, swingT: -1, hit: null, msg: '', last: performance.now(), fx: A.particles() };
        raf = requestAnimationFrame(frame);
      }

      function pitch() {
        const cfg = g.cfg;
        const change = Math.random() < cfg.changeup;
        const v = change ? cfg.speeds[0] * 0.62 : cfg.speeds[0] + Math.random() * (cfg.speeds[1] - cfg.speeds[0]);
        g.ball = { y: MOUND_Y, v, x: 180, drift: (Math.random() - 0.5) * 30, change };
        g.phase = 'pitch'; g.t = 0; g.swung = false;
      }

      function swing() {
        if (!g || g.phase !== 'pitch' || g.swung) return;
        g.swung = true; g.swingT = 0;
        const off = g.ball.y - PLATE_Y; // negative = early, positive = late
        const win = g.cfg.window;
        if (Math.abs(off) > win * 1.6) return; // whiff; counted when the ball passes
        if (off < -win || off > win) {
          g.fx.burst(180, PLATE_Y, ['#FFFFFF', '#D9A066'], 8, { speed: 140, size: 3 });
          result('foul'); return;
        }
        const q = 1 - Math.abs(off) / win; // 1 = perfect timing
        const dist = Math.round(200 + q * 260 + Math.random() * 25);
        const angle = (off / win) * 0.6 + (Math.random() - 0.5) * 0.2; // early pulls left, late goes right
        g.hit = { dist, angle, t: 0, homer: dist >= FENCE };
        g.phase = 'flight'; g.t = 0;
        // crack of the bat
        g.fx.burst(170, PLATE_Y - 6, ['#FFFFFF', '#FFE14D', '#D9A066'], 16, { speed: 240, size: 4 });
        g.fx.ring(170, PLATE_Y - 6, '#FFFFFF', 46, 0.3);
        g.fx.shake(q > 0.6 ? 8 : 4, 0.2);
      }

      function result(kind) {
        g.phase = 'result'; g.t = 0;
        const words = { foul: 'Foul ball! Out', miss: 'Strike! Out', homer: 'HOME RUN!', out: 'Caught! Out' };
        if (kind === 'homer') {
          g.hr++;
          // fireworks over the outfield
          const cols = ['#FFE14D', '#FF6B9B', '#5CC0FF', '#3DCB7A', '#FFFFFF'];
          for (let k = 0; k < 5; k++) {
            const fx = 50 + Math.random() * 260, fy = 50 + Math.random() * 110;
            g.fx.burst(fx, fy, cols, 26, { speed: 170, gravity: 90, life: 1.1, size: 4 });
            g.fx.ring(fx, fy, cols[k], 50, 0.6);
          }
        } else g.outs++;
        g.msg = kind === 'homer' || kind === 'out' ? `${words[kind]} · ${g.hit.dist} ft` : words[kind];
        g.kind = kind;
        el.querySelector('#hr-hr').textContent = g.hr;
        el.querySelector('#hr-outs').textContent = `${g.outs}/${OUTS}`;
        if (g.hit && (kind === 'homer' || kind === 'out')) {
          g.longest = Math.max(g.longest, g.hit.dist);
          el.querySelector('#hr-long').textContent = g.longest + ' ft';
        }
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        g.t += dt;
        g.fx.update(dt);
        if (g.swingT >= 0) { g.swingT += dt; if (g.swingT > 0.3) g.swingT = -1; }
        if (g.phase === 'windup' && g.t > 1.0) pitch();
        if (g.phase === 'pitch') {
          const b = g.ball;
          b.y += b.v * dt;
          if (b.y > PLATE_Y + 70) { g.hit = null; result('miss'); }
        }
        if (g.phase === 'flight') {
          g.hit.t += dt;
          if (g.hit.t > 1.5) result(g.hit.homer ? 'homer' : 'out');
        }
        if (g.phase === 'result' && g.t > 1.5) {
          if (g.outs >= OUTS) return finish();
          g.hit = null; g.phase = 'windup'; g.t = 0;
        }
        A.fxFrame(ctx, g.fx, draw);
        raf = requestAnimationFrame(frame);
      }

      function drawPitcher(x, y, wind, thrown) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        const kick = Math.sin(wind * Math.PI) * 8;
        ctx.strokeStyle = '#E8E8F0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-4, 11); ctx.moveTo(3, -2); ctx.lineTo(5 + kick * 0.4, 11 - kick); ctx.stroke();
        ctx.fillStyle = '#F2B400'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-7, -16, 14, 16, 4) : ctx.rect(-7, -16, 14, 16); ctx.fill();
        // throwing arm: up and back during the wind-up, forward on release
        const a = -0.4 - wind * 2.4 + thrown * 3.2;
        ctx.strokeStyle = '#F2B400'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(6 + Math.sin(a) * 11, -13 - Math.cos(a) * 11); ctx.stroke();
        ctx.fillStyle = '#8B5A2B'; ctx.beginPath(); ctx.arc(-9, -9, 4, 0, Math.PI * 2); ctx.fill(); // glove
        ctx.fillStyle = '#C68E5E'; ctx.beginPath(); ctx.arc(0, -21, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1A2238'; ctx.beginPath(); ctx.arc(0, -23, 5.2, Math.PI, 0); ctx.fill(); ctx.fillRect(-7, -23, 14, 2);
        ctx.restore();
      }
      function drawCrouch(x, y, body, gear, s) {
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 8, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -2, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = gear; ctx.fillRect(-6, -8, 12, 10);
        ctx.fillStyle = '#1A2238'; ctx.beginPath(); ctx.arc(0, -14, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#9AA3B5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.moveTo(-4, -11); ctx.lineTo(4, -11); ctx.stroke();
        ctx.restore();
      }
      function drawBatter(x, y, swing) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 18, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-7, 18); ctx.moveTo(4, 4); ctx.lineTo(6 + swing * 3, 18); ctx.stroke();
        ctx.rotate(swing * 0.35);
        const jg = ctx.createLinearGradient(-10, 0, 10, 0);
        jg.addColorStop(0, '#FF5A5E'); jg.addColorStop(1, '#B4252A');
        ctx.fillStyle = jg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-10, -14, 20, 20, 5) : ctx.rect(-10, -14, 20, 20); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 9px Bungee, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('7', 0, 0);
        ctx.fillStyle = '#C68E5E'; ctx.beginPath(); ctx.arc(0, -20, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E03A3E'; ctx.beginPath(); ctx.arc(0, -22, 7.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
        ctx.fillStyle = '#B4252A'; ctx.fillRect(2, -22, 9, 3);
        ctx.restore();
        // the bat sweeps through the zone
        const batA = -2.3 + swing * 2.4;
        ctx.save(); ctx.translate(x + 10, y - 4); ctx.rotate(batA);
        const bg = ctx.createLinearGradient(0, -5, 0, 5);
        bg.addColorStop(0, '#E0A868'); bg.addColorStop(1, '#8F5A2A');
        ctx.fillStyle = bg; ctx.strokeStyle = '#3A2410'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(54, -6); ctx.quadraticCurveTo(58, 0, 54, 6); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1A2238'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (swing > 0 && swing < 1) {
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - swing)})`; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.arc(x + 10, y - 4, 50, -2.3, batA); ctx.stroke();
        }
      }

      function draw() {
        const t = performance.now() / 1000;
        // ---- night ballpark: sky, outfield stands, lights ----
        if (!stands) stands = A.crowd(W, 58, [[4, 30, '#141B3A'], [30, 58, '#182045']], '#070B1E');
        const sky = ctx.createLinearGradient(0, 0, 0, 70);
        sky.addColorStop(0, '#050A1F'); sky.addColorStop(1, '#1B2B63');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 70);
        ctx.drawImage(stands, 0, 8, W, 58);
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [30, W - 30]) { ctx.globalAlpha = 0.85; ctx.drawImage(A.glow('#FFF4D6'), lx - 50, -40, 100, 100); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // grass with a mowed diamond pattern, lit by the floodlights
        ctx.fillStyle = '#2F8A3F'; ctx.fillRect(0, 66, W, H - 66);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 80, W, H - 80); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,.055)';
        for (let i = -12; i < 14; i++) {
          ctx.beginPath(); ctx.moveTo(180 + i * 40, 80); ctx.lineTo(180 + i * 40 + 300, 80 + 380); ctx.lineTo(180 + i * 40 + 320, 80 + 380); ctx.lineTo(180 + i * 40 + 20, 80); ctx.fill();
        }
        ctx.restore();
        const pool = ctx.createRadialGradient(180, 330, 40, 180, 330, 360);
        pool.addColorStop(0, 'rgba(255,255,220,.12)'); pool.addColorStop(1, 'rgba(0,0,20,.25)');
        ctx.fillStyle = pool; ctx.fillRect(0, 66, W, H - 66);
        // padded outfield wall with the distance marker
        const wall = ctx.createLinearGradient(0, 64, 0, 84);
        wall.addColorStop(0, '#1F5A35'); wall.addColorStop(1, '#174528');
        ctx.fillStyle = wall; ctx.fillRect(0, 64, W, 20);
        ctx.fillStyle = '#F2B400'; ctx.fillRect(0, 64, W, 3);
        ctx.fillStyle = '#FFFFFF'; ctx.font = '400 12px Bungee, "Arial Black", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${FENCE} FT`, W / 2, 80); ctx.fillText('330', 40, 80); ctx.fillText('330', W - 40, 80);
        // foul lines
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(180, PLATE_Y + 8); ctx.lineTo(-20, 150); ctx.moveTo(180, PLATE_Y + 8); ctx.lineTo(W + 20, 150); ctx.stroke();
        // infield dirt with a little texture
        const dirt = ctx.createLinearGradient(0, 130, 0, PLATE_Y + 40);
        dirt.addColorStop(0, '#C98E55'); dirt.addColorStop(1, '#DCA56C');
        ctx.fillStyle = dirt;
        ctx.beginPath(); ctx.moveTo(180, PLATE_Y + 40); ctx.lineTo(40, 300); ctx.quadraticCurveTo(180, 70, 320, 300); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2F8A3F';
        ctx.beginPath(); ctx.moveTo(180, PLATE_Y - 20); ctx.lineTo(90, 300); ctx.lineTo(180, 200); ctx.lineTo(270, 300); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        ctx.beginPath(); ctx.moveTo(180, PLATE_Y - 20); ctx.lineTo(135, 360); ctx.lineTo(180, 200); ctx.closePath(); ctx.fill();
        // mound and home-plate circle
        ctx.fillStyle = '#D29A60'; ctx.beginPath(); ctx.ellipse(180, MOUND_Y + 8, 28, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(173, MOUND_Y + 6, 14, 3);
        ctx.fillStyle = '#D9A066'; ctx.beginPath(); ctx.ellipse(180, PLATE_Y + 6, 58, 28, 0, 0, Math.PI * 2); ctx.fill();
        // bases with shadows, plate, batter's boxes
        for (const [x, y] of [[40, 300], [180, 130], [320, 300]]) {
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 5, y - 4, 12, 12);
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 6, y - 6, 12, 12);
        }
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(120, PLATE_Y - 18, 34, 46); ctx.strokeRect(206, PLATE_Y - 18, 34, 46);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.moveTo(168, PLATE_Y); ctx.lineTo(192, PLATE_Y); ctx.lineTo(192, PLATE_Y + 8); ctx.lineTo(180, PLATE_Y + 16); ctx.lineTo(168, PLATE_Y + 8); ctx.closePath(); ctx.fill();
        // strike zone guide
        ctx.strokeStyle = 'rgba(255,225,77,.6)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
        ctx.strokeRect(150, PLATE_Y - g.cfg.window, 60, g.cfg.window * 2); ctx.setLineDash([]);
        // pitcher with a wind-up: arm rises, then whips forward as the pitch is thrown
        const wind = g.phase === 'windup' ? Math.min(1, g.t / 1.0) : 0;
        const thrown = g.phase === 'pitch' ? Math.min(1, g.t * 6) : 0;
        drawPitcher(180, MOUND_Y, wind, thrown);
        // catcher and umpire behind the plate
        drawCrouch(180, PLATE_Y + 34, '#1A2238', '#2E5BFF', 1);
        drawCrouch(180, PLATE_Y + 58, '#232A3D', '#3A4150', 1.12);
        // batter: helmet, jersey and a swing that twists the body
        const swingP = g.swingT >= 0 ? Math.min(1, g.swingT / 0.12) : 0;
        drawBatter(134, PLATE_Y, swingP);
        ctx.textAlign = 'center'; // the distance and result text below are centered
        // ball
        if (g.phase === 'pitch' && g.ball) {
          const b = g.ball, p = (b.y - MOUND_Y) / (PLATE_Y - MOUND_Y);
          const x = 180 + b.drift * Math.sin(p * Math.PI);
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, b.y + 10, 5 + p * 4, 2 + p, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, b.y, 4 + p * 4, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = '#1A2238'; ctx.stroke();
        }
        if ((g.phase === 'flight' || (g.phase === 'result' && g.hit)) && g.hit) {
          const h = g.hit, p = Math.min(1, h.t / 1.4);
          const reach = (h.dist / 460) * (PLATE_Y - 20);
          const x = 180 + Math.sin(h.angle) * reach * p;
          const y = PLATE_Y - Math.cos(h.angle) * reach * p;
          const lift = Math.sin(p * Math.PI) * 26;
          if (g.phase === 'flight') g.fx.trail(x, y - lift, 'rgba(255,255,255,.6)', 4, 0.3);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y - lift, 5 + lift * 0.18, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = '#1A2238'; ctx.stroke();
          ctx.font = '400 22px Bungee, "Arial Black", sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#1A2238'; ctx.fillStyle = '#FFFFFF';
          const ft = Math.round(h.dist * p) + ' ft';
          ctx.strokeText(ft, W / 2, 80); ctx.fillText(ft, W / 2, 80);
        }
        if (g.phase === 'result') {
          ctx.font = '400 26px Bungee, "Arial Black", sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#1A2238';
          ctx.fillStyle = g.kind === 'homer' ? '#FFE14D' : '#FFFFFF';
          ctx.strokeText(g.msg, W / 2, 380); ctx.fillText(g.msg, W / 2, 380);
        }
        if (g.phase === 'windup') {
          ctx.font = '700 16px "Atkinson Hyperlegible", system-ui, sans-serif'; ctx.fillStyle = '#FFFFFF';
          ctx.fillText('Here comes the pitch…', W / 2, 380);
        }
        ctx.textAlign = 'start';
      }

      function finish() {
        cancelAnimationFrame(raf);
        const res = { hr: g.hr, longest: g.longest };
        g = null;
        const prev = A.store.get('hr-best', 0);
        const isBest = res.hr > prev;
        if (isBest) A.store.set('hr-best', res.hr);
        el.innerHTML = `
          <div class="result">
            <span class="label">10 outs · Home runs</span>
            <span class="big">${res.hr}</span>
            ${isBest ? '<span class="newbest">New record!</span>' : `<span class="label">Record: ${prev}</span>`}
            <div class="result-stats"><div class="stat"><small>Longest hit</small><b>${res.longest ? res.longest + ' ft' : '–'}</b></div></div>
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
        else if (b.dataset.mode) { level = b.dataset.mode; A.store.set('hr-level', level); intro(); }
      };
      const onKey = e => { if (g && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); swing(); } };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { cancelAnimationFrame(raf); g = null; document.removeEventListener('keydown', onKey); };
    },
  });
})();
