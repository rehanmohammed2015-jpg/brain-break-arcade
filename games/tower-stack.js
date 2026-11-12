/* Tower Stack: drop sliding blocks to build the tallest tower. Overhangs get chopped off. */
(function () {
  const A = Arcade;
  const W = 360, H = 540, BH = 26, BASE_W = 200, GROUND = H - 34;
  const BEST = 'ts-best';
  const PERFECT_PX = 5;

  A.register({
    id: 'tower-stack',
    section: 'play',
    title: 'Tower Stack',
    color: 'stack',
    artBg: 'linear-gradient(180deg, #2b2a6b 0%, #8a4f9e 55%, #ff8a6b 100%)',
    art: `<span style="display:flex;flex-direction:column;align-items:flex-start;gap:0">
      ${[[50, 22], [60, 12], [64, 6], [70, 0], [70, 0]].map(([w, m], i) =>
        `<span style="display:flex;gap:5px;padding:4px 6px;height:18px;width:${w}px;margin-left:${m}px;background:linear-gradient(90deg,hsl(${30 + i * 40} 70% 70%),hsl(${30 + i * 40} 65% 42%))">${'<i style="flex:1;background:#ffde8c;opacity:.85"></i>'.repeat(Math.floor(w / 16))}</span>`).join('')}
    </span>`,
    blurb: 'Tap to drop each sliding block. Anything that hangs over the edge gets chopped off. How high can you go?',
    tags: ['Timing', 'One button', 'Endless'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' floors' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Build it to the clouds</h2>
            <p>A block slides back and forth above your tower. Tap the game, click, or press Space to drop it.</p>
            <p>The part that hangs over gets cut off, so your blocks get thinner. Land a perfect drop to keep the full width. Miss completely and the tower is done.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start building</button>
            <span class="best" style="align-self:center">Tallest tower: <b>${A.store.get(BEST, 0)} floors</b></span>
          </div>`;
      }

      const hue = i => (28 + i * 11) % 360;
      const layerY = i => GROUND - (i + 1) * BH; // world y of the top of layer i

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Floors</small><b id="ts-floors">0</b></div>
              <div class="stat"><small>Perfect streak</small><b id="ts-perfect">0</b></div>
            </div>
          </div>`;
        ({ cv, ctx } = A.makeCanvas(el, W, H));
        cv.addEventListener('pointerdown', e => { e.preventDefault(); drop(); });
        g = {
          layers: [{ x: (W - BASE_W) / 2, w: BASE_W }],
          cur: null, debris: [], cam: 0, perfect: 0, bestPerfect: 0, over: false, overT: 0,
          flash: 0, flashText: '', last: performance.now(),
          paper: A.color('paper'), grid: A.color('grid'), ink: A.color('ink'), gold: A.color('gold'), fx: A.particles(), land: 0, t: 0,
          stars: Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.15 ? 2 : 1, tw: 1 + Math.random() * 3 })),
          clouds: Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * W, y: 300 - i * 170 - Math.random() * 60, v: 8 + Math.random() * 14 })),
          city: (() => { const out = []; for (let x = -10; x < W; x += 26 + Math.random() * 16) out.push({ x, w: 22 + Math.random() * 18, h: 30 + Math.random() * 70, c: ['#5d6a9a', '#4c5788', '#6b78a8'][out.length % 3] }); return out; })(),
        };
        spawn();
        raf = requestAnimationFrame(frame);
      }

      function spawn() {
        const n = g.layers.length;
        const w = g.layers[n - 1].w;
        const fromLeft = n % 2 === 1;
        g.cur = { x: fromLeft ? -w * 0.4 : W - w * 0.6, w, dir: fromLeft ? 1 : -1, speed: Math.min(330, 130 + n * 7) };
      }

      function drop() {
        if (!g || g.over || !g.cur) return;
        const n = g.layers.length;
        const prev = g.layers[n - 1];
        const c = g.cur;
        const y = layerY(n);
        if (Math.abs(c.x - prev.x) <= PERFECT_PX) {
          c.x = prev.x;
          g.perfect++;
          g.bestPerfect = Math.max(g.bestPerfect, g.perfect);
          // every 3 perfect drops in a row, the block grows back a little
          const w = g.perfect % 3 === 0 ? Math.min(BASE_W, prev.w + 16) : prev.w;
          const x = w > prev.w ? Math.max(0, prev.x - (w - prev.w) / 2) : prev.x;
          g.layers.push({ x, w });
          g.flash = 0.8; g.flashText = g.perfect % 3 === 0 ? 'PERFECT! WIDER!' : 'PERFECT!';
          g.fx.burst(x + w / 2, y + BH / 2, [g.gold, '#FFFFFF', `hsl(${hue(n)} 80% 62%)`], 22, { speed: 230, gravity: 260, shape: 'confetti', size: 8 });
          g.fx.ring(x + w / 2, y + BH / 2, g.gold, w * 0.7, 0.5);
          g.fx.shake(3, 0.15);
        } else {
          const left = Math.max(c.x, prev.x);
          const right = Math.min(c.x + c.w, prev.x + prev.w);
          const overlap = right - left;
          g.perfect = 0;
          if (overlap <= 0) {
            g.debris.push({ x: c.x, w: c.w, y, vy: 0, rot: 0, vr: c.dir * 1.5, hue: hue(n) });
            g.cur = null; g.over = true; g.overT = 1.1;
            g.fx.shake(9, 0.4);
            return;
          }
          const cutX = c.x < prev.x ? c.x : right;
          const cutW = c.w - overlap;
          g.debris.push({ x: cutX, w: cutW, y, vy: 0, rot: 0, vr: (c.x < prev.x ? -1 : 1) * 2, hue: hue(n) });
          g.layers.push({ x: left, w: overlap });
          g.fx.burst(c.x < prev.x ? left : right, y + BH / 2, `hsl(${hue(n)} 80% 62%)`, 10, { speed: 150, size: 5 });
          g.fx.shake(2.5, 0.12);
        }
        g.land = 0.18;
        spawn();
        const nfl = g.layers.length - 1;
        el.querySelector('#ts-floors').textContent = nfl;
        el.querySelector('#ts-perfect').textContent = g.perfect;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        g.t += dt;

        if (g.cur) {
          const c = g.cur;
          c.x += c.dir * c.speed * dt;
          if (c.x + c.w > W + c.w * 0.4) { c.x = W + c.w * 0.4 - c.w; c.dir = -1; }
          if (c.x < -c.w * 0.4) { c.x = -c.w * 0.4; c.dir = 1; }
        }
        for (const d of g.debris) { d.vy += 900 * dt; d.y += d.vy * dt; d.rot += d.vr * dt; }
        g.debris = g.debris.filter(d => d.y - g.cam < H + 100);
        g.flash = Math.max(0, g.flash - dt);
        g.land = Math.max(0, g.land - dt);
        g.fx.update(dt);

        // camera follows the top of the tower
        const topY = layerY(g.layers.length);
        const want = Math.min(0, topY - 190);
        g.cam += (want - g.cam) * Math.min(1, dt * 5);

        A.fxFrame(ctx, g.fx, draw, true);

        if (g.over) {
          g.overT -= dt;
          if (g.overT <= 0) return finish();
        }
        raf = requestAnimationFrame(frame);
      }

      // one floor of a skyscraper: glossy side panels and a row of windows (lit once the sky gets dark)
      function block(x, y, w, h, hu, idx) {
        const night = Math.min(1, Math.max(0, (-g.cam - 250) / 900));
        const gr = ctx.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, `hsl(${hu} 70% 70%)`); gr.addColorStop(0.5, `hsl(${hu} 72% 58%)`); gr.addColorStop(1, `hsl(${hu} 65% 40%)`);
        ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = `hsl(${hu} 80% 82%)`; ctx.fillRect(x, y, w, 3);
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, y + h - 3, w, 3);
        // windows
        const n = Math.max(1, Math.floor((w - 8) / 15));
        const gap = (w - n * 9) / (n + 1);
        for (let i = 0; i < n; i++) {
          const lit = ((idx * 7 + i * 13) % 5) < 3;
          ctx.fillStyle = lit && night > 0.2 ? `rgba(255,222,140,${0.4 + night * 0.6})` : `rgba(20,30,60,${0.45 + night * 0.2})`;
          ctx.fillRect(x + gap + i * (9 + gap), y + 8, 9, h - 14);
          ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + gap + i * (9 + gap), y + 8, 3, h - 14);
        }
      }

      // sky goes day → sunset → night → space as the tower rises
      const SKY = [[0, '#7cc7ff', '#d8f0ff'], [500, '#ff8a6b', '#ffd59e'], [1100, '#2b2a6b', '#8a4f9e'], [1900, '#05061a', '#151a44']];
      function skyAt(alt, k) {
        for (let i = 0; i < SKY.length - 1; i++) {
          const a = SKY[i], b = SKY[i + 1];
          if (alt <= b[0]) return mix(a[k], b[k], (alt - a[0]) / (b[0] - a[0]));
        }
        return SKY[SKY.length - 1][k];
      }
      function mix(c1, c2, t) {
        t = Math.max(0, Math.min(1, t));
        const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
        const a = p(c1), b = p(c2);
        return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
      }

      function draw() {
        const alt = -g.cam;
        const sg = ctx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, skyAt(alt + 500, 1)); sg.addColorStop(1, skyAt(alt, 2));
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
        // stars fade in at night
        const night = Math.min(1, Math.max(0, (alt - 700) / 900));
        if (night > 0) {
          for (const s of g.stars) {
            ctx.globalAlpha = night * (0.4 + 0.6 * Math.abs(Math.sin(g.t * s.tw + s.x)));
            ctx.fillStyle = '#fff'; ctx.fillRect(s.x, (s.y + alt * 0.05) % H, s.s, s.s);
          }
          ctx.globalAlpha = 1;
        }
        // sun sinks, moon rises
        const sunY = 120 + alt * 0.25;
        if (sunY < H + 60) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(A.glow('#ffd27a'), 230, sunY - 70, 140, 140); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(300, sunY, 24, 0, Math.PI * 2); ctx.fill(); }
        if (night > 0.3) { ctx.globalAlpha = night; ctx.fillStyle = '#f2efe0'; ctx.beginPath(); ctx.arc(70, 110, 20, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = skyAt(alt + 500, 1); ctx.beginPath(); ctx.arc(80, 104, 18, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        // clouds drift past at their own heights
        for (const c of g.clouds) {
          const cy = c.y - g.cam * 0.6;
          if (cy < -60 || cy > H + 60) continue;
          const cx = ((c.x + g.t * c.v) % (W + 160)) - 80;
          ctx.globalAlpha = 0.75 * (1 - night * 0.6); ctx.fillStyle = night > 0.5 ? '#8a86b8' : '#ffffff';
          ctx.beginPath(); ctx.ellipse(cx, cy, 44, 13, 0, 0, Math.PI * 2); ctx.ellipse(cx - 20, cy - 6, 22, 13, 0, 0, Math.PI * 2); ctx.ellipse(cx + 16, cy - 9, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.save();
        ctx.translate(0, -g.cam);
        // distant city skyline and the street
        for (const b of g.city) { ctx.fillStyle = b.c; ctx.fillRect(b.x, GROUND - b.h, b.w, b.h); ctx.fillStyle = 'rgba(255,230,160,.35)'; for (let wy = GROUND - b.h + 6; wy < GROUND - 6; wy += 10) for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 8) if ((wx * 7 + wy) % 3 === 0) ctx.fillRect(wx, wy, 3, 4); }
        ctx.fillStyle = '#2a2d45'; ctx.fillRect(0, GROUND, W, 400);
        ctx.fillStyle = '#3c4060'; ctx.fillRect(0, GROUND, W, 6);
        ctx.fillStyle = '#ffd878'; for (let x = 10; x < W; x += 40) ctx.fillRect(x, GROUND + 18, 20, 3);
        // height markers every 10 floors
        ctx.font = '600 12px "DM Mono", monospace';
        for (let f = 10; f < g.layers.length + 12; f += 10) {
          const y = layerY(f) + BH;
          ctx.globalAlpha = 0.75; ctx.fillStyle = night > 0.4 ? '#ffffff' : '#1a2238'; ctx.fillRect(0, y, 14, 2); ctx.fillText(f + ' FL', 18, y + 4); ctx.globalAlpha = 1;
        }
        const top = g.layers.length - 1;
        g.layers.forEach((l, i) => {
          // the newest block squashes a little as it lands
          const sq = i === top && i > 0 ? g.land / 0.18 : 0;
          block(l.x - sq * 4, layerY(i) + sq * 4, l.w + sq * 8, BH - sq * 4, i === 0 ? 230 : hue(i), i);
        });
        if (g.cur) {
          // guide lines show where the block will land
          const prev = g.layers[g.layers.length - 1];
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(prev.x + 0.5, layerY(g.layers.length)); ctx.lineTo(prev.x + 0.5, layerY(g.layers.length) - 40);
          ctx.moveTo(prev.x + prev.w - 0.5, layerY(g.layers.length)); ctx.lineTo(prev.x + prev.w - 0.5, layerY(g.layers.length) - 40); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(0,0,0,.2)';
          ctx.fillRect(g.cur.x, layerY(g.layers.length) + BH, g.cur.w, 4); // drop shadow on the tower
          block(g.cur.x, layerY(g.layers.length), g.cur.w, BH, hue(g.layers.length), g.layers.length);
        }
        for (const d of g.debris) {
          ctx.save(); ctx.translate(d.x + d.w / 2, d.y + BH / 2); ctx.rotate(d.rot);
          block(-d.w / 2, -BH / 2, d.w, BH, d.hue, 3); ctx.restore();
        }
        g.fx.draw(ctx);
        ctx.restore();

        // big floor counter
        ctx.textAlign = 'center';
        ctx.font = '700 54px "Space Grotesk", sans-serif';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,12,40,.35)'; ctx.strokeText(String(g.layers.length - 1), W / 2, 68);
        ctx.fillStyle = '#ffffff'; ctx.fillText(String(g.layers.length - 1), W / 2, 68);
        ctx.font = '500 11px "DM Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText('FLOORS', W / 2, 86);
        if (g.flash > 0) {
          ctx.globalAlpha = Math.min(1, g.flash * 2);
          const s = 1 + Math.max(0, g.flash - 0.6) * 2;
          ctx.font = `700 ${Math.round(24 * s)}px "Space Grotesk", sans-serif`;
          ctx.lineWidth = 5; ctx.strokeStyle = '#2a1f5a'; ctx.strokeText(g.flashText, W / 2, 122 - (0.8 - g.flash) * 20);
          ctx.fillStyle = '#ffd878'; ctx.fillText(g.flashText, W / 2, 122 - (0.8 - g.flash) * 20);
          ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'start';
      }

      function finish() {
        cancelAnimationFrame(raf);
        const floors = g.layers.length - 1, bestPerfect = g.bestPerfect;
        g = null;
        const prev = A.store.get(BEST, 0);
        const isBest = floors > prev;
        if (isBest) A.store.set(BEST, floors);
        el.innerHTML = `
          <div class="result">
            <span class="label">Your tower</span>
            <span class="big">${floors}</span>
            <span class="label">floors high</span>
            ${isBest ? '<span class="newbest">New record tower!</span>' : `<span class="label">Tallest: ${prev} floors</span>`}
            <div class="result-stats"><div class="stat"><small>Best perfect streak</small><b>${bestPerfect}</b></div></div>
            <div class="row"><button class="btn primary" data-act="go">Build again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => { if (e.target.closest('[data-act="go"]')) start(); };
      const onKey = e => {
        if (g && (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown')) { e.preventDefault(); drop(); }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { cancelAnimationFrame(raf); g = null; document.removeEventListener('keydown', onKey); };
    },
  });
})();
