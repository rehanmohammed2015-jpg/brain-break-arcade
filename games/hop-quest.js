/* Hop Quest: a 3-level platformer. Run, jump over gaps and spikes, stomp critters, grab coins, reach the flag. */
(function () {
  const A = Arcade;
  const T = 24, ROWS = 13, VW = 480, VH = ROWS * T;
  const PW = 16, PH = 22, EW = 20, EH = 18;
  const GRAV = 1500, JUMP = 560, RUN = 180, MAXFALL = 700;

  const LEVELS = [
    { name: 'Green Meadow', w: 72, flag: 69, check: 37,
      ground: [[0, 16], [19, 34], [37, 52], [55, 72]],
      plats: [[8, 8, 3], [24, 8, 4], [29, 6, 3], [44, 8, 3], [47, 5, 3], [60, 8, 4]],
      spikes: [[40, 2], [66, 1]],
      enemies: [[22, 10], [46, 10], [63, 10]],
      coins: [[9, 7], [10, 7], [17, 9], [18, 9], [25, 7], [26, 7], [30, 5], [31, 5], [35, 9], [36, 9], [45, 7], [48, 4], [49, 4], [53, 9], [61, 7], [62, 7]] },
    { name: 'Rocky Ridge', w: 84, flag: 81, check: 45,
      ground: [[0, 12], [16, 24], [28, 40], [45, 58], [62, 70], [74, 84]],
      plats: [[13, 9, 2], [25, 8, 2], [32, 7, 3], [36, 5, 3], [41, 9, 3], [50, 7, 3], [53, 4, 3], [59, 8, 2], [71, 9, 2], [78, 7, 3]],
      spikes: [[20, 2], [34, 2], [48, 1], [66, 2]],
      enemies: [[8, 10], [19, 10], [30, 10], [38, 10], [55, 10], [68, 10]],
      coins: [[13, 8], [14, 8], [25, 7], [26, 7], [33, 6], [37, 4], [38, 4], [42, 8], [43, 8], [51, 6], [54, 3], [55, 3], [59, 7], [60, 7], [71, 8], [72, 8], [79, 6], [80, 6]] },
    { name: 'Sky Castle', w: 96, flag: 93, check: 53,
      ground: [[0, 10], [14, 20], [25, 30], [36, 48], [53, 60], [66, 76], [81, 96]],
      plats: [[11, 9, 2], [21, 9, 3], [31, 9, 2], [34, 7, 2], [40, 7, 4], [43, 4, 3], [49, 8, 3], [61, 9, 2], [64, 7, 2], [68, 6, 4], [77, 8, 3], [86, 7, 3], [90, 5, 3]],
      spikes: [[16, 2], [27, 2], [38, 1], [45, 2], [56, 2], [70, 2], [84, 2]],
      enemies: [[6, 10], [18, 10], [41, 6], [47, 10], [58, 10], [69, 5], [73, 10], [88, 10]],
      coins: [[11, 8], [12, 8], [22, 8], [23, 8], [31, 8], [34, 6], [35, 6], [41, 5], [44, 3], [45, 3], [50, 7], [61, 8], [64, 6], [69, 4], [70, 4], [78, 7], [87, 6], [91, 4], [92, 4]] },
  ];

  function build(spec) {
    const grid = Array.from({ length: ROWS }, () => new Array(spec.w).fill('.'));
    for (const [a, b] of spec.ground) for (let c = a; c < b; c++) { grid[11][c] = '#'; grid[12][c] = '#'; }
    for (const [c, r, w] of spec.plats) for (let i = 0; i < w; i++) grid[r][c + i] = '=';
    for (const [c, w] of spec.spikes) for (let i = 0; i < w; i++) grid[10][c + i] = '^';
    return grid;
  }

  A.css('hq-css', `
    .hq-pad { display: flex; justify-content: space-between; gap: 12px; max-width: 520px; margin: 14px auto 0; touch-action: none; user-select: none; -webkit-user-select: none; }
    .hq-pad div { display: flex; gap: 10px; }
    .hq-pad button { width: 76px; height: 60px; font-size: 24px; padding: 0; }
    .hq-pad button.on { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--shadow); background: var(--accent); color: var(--on-accent); }
  `);

  A.register({
    id: 'hop-quest',
    section: 'strategy',
    title: 'Hop Quest',
    color: 'pop',
    artBg: 'linear-gradient(180deg, #7cc7ff 0%, #e6f7ff 100%)',
    art: `<svg width="190" height="120" viewBox="0 0 190 120" aria-hidden="true">
      <path d="M0 120 L40 60 L70 85 L100 50 L150 120Z" fill="#a8c6ea"/><ellipse cx="150" cy="122" rx="70" ry="40" fill="#8fd18a"/>
      <rect x="0" y="94" width="66" height="26" fill="#9a6a3c"/><rect x="0" y="92" width="66" height="7" fill="#5cc15a"/>
      <rect x="104" y="94" width="86" height="26" fill="#9a6a3c"/><rect x="104" y="92" width="86" height="7" fill="#5cc15a"/>
      <rect x="70" y="58" width="44" height="11" rx="3" fill="#c98a4b"/>
      <g transform="translate(40 30) rotate(-8)"><path d="M0 9 L-14 6 L-13 12Z" fill="#ffd878"/><rect x="-1" y="0" width="17" height="19" rx="6" fill="#e0454f"/><rect x="-1" y="8" width="17" height="4" fill="#ffd878"/><circle cx="11" cy="5" r="3.5" fill="#fff"/><circle cx="12" cy="5.3" r="1.7" fill="#1a1438"/></g>
      <circle cx="90" cy="42" r="7" fill="#ffc93c" style="filter:drop-shadow(0 0 5px #ffd878)"/>
      <path d="M168 92 V36" stroke="#d8dce8" stroke-width="3"/><path d="M170 38 q12 4 24 0 v16 q-12 4 -24 0z" fill="#ff77b7"/>
    </svg>`,
    blurb: 'Run and jump through three levels. Plan your jumps over gaps and spikes, stomp the critters, grab coins and reach the flag.',
    tags: ['Platformer', '3 levels', 'Keys or touch'],
    best() { const b = A.store.get('hq-best', 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null;
      const keys = {}, touch = { left: false, right: false, jump: false };

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Reach the flag</h2>
            <p>Move with ← → or A and D, and jump with Space, W or ↑. Hold jump longer to jump higher. On a phone or tablet, use the buttons under the game.</p>
            <p>Jump on top of critters to stomp them, but don’t run into them. Avoid the spikes and don’t fall in the gaps. Touch the halfway flag to save your spot. You have 3 lives for all 3 levels.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start quest</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get('hq-best', 0)}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Level</small><b id="hq-level">1/3</b></div>
              <div class="stat"><small>Score</small><b id="hq-score">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Lives</small><b id="hq-lives" style="color:var(--p1)">♥♥♥</b></div></div>
          </div>`;
        ({ cv, ctx } = A.makeCanvas(el, VW, VH));
        cv.style.aspectRatio = `${VW} / ${VH}`;
        cv.style.width = 'min(100%, 720px)';
        el.insertAdjacentHTML('beforeend', `
          <div class="hq-pad">
            <div><button class="btn" data-hold="left" aria-label="Move left">◀</button><button class="btn" data-hold="right" aria-label="Move right">▶</button></div>
            <div><button class="btn" data-hold="jump" aria-label="Jump">▲</button></div>
          </div>`);
        el.querySelectorAll('[data-hold]').forEach(b => {
          const k = b.dataset.hold;
          const on = e => { e.preventDefault(); touch[k] = true; b.classList.add('on'); if (k === 'jump' && g) g.jumpBuf = 0.12; };
          const off = () => { touch[k] = false; b.classList.remove('on'); };
          b.addEventListener('pointerdown', on);
          b.addEventListener('pointerup', off);
          b.addEventListener('pointerleave', off);
          b.addEventListener('pointercancel', off);
        });
        g = { level: 0, lives: 3, score: 0, last: performance.now(), hud: {}, fx: A.particles() };
        loadLevel(0);
        raf = requestAnimationFrame(frame);
      }

      function loadLevel(i) {
        const spec = LEVELS[i];
        g.level = i; g.spec = spec; g.grid = build(spec);
        g.coins = spec.coins.map(([c, r]) => ({ x: c * T + T / 2, y: r * T + T / 2, got: false }));
        g.enemies = spec.enemies.map(([c, r]) => ({ x: c * T + 2, y: r * T + T - EH, vx: -50, vy: 0, dead: false, squash: 0 }));
        g.checkpoint = false;
        g.banner = spec.name; g.bannerT = 2;
        spawn();
      }
      function spawn() {
        const c = g.checkpoint ? g.spec.check : 2;
        g.p = { x: c * T + 4, y: 9 * T, vx: 0, vy: 0, ground: false, coyote: 0, face: 1, inv: 1, sq: 0 };
        g.jumpBuf = 0;
        g.cam = Math.max(0, g.p.x - VW * 0.4);
      }

      const solid = (c, r) => {
        if (c < 0 || c >= g.spec.w) return true;
        if (r < 0 || r >= ROWS) return false;
        const t = g.grid[r][c];
        return t === '#' || t === '=';
      };
      function hits(x, y, w, h) {
        for (let r = Math.floor(y / T); r <= Math.floor((y + h - 1) / T); r++)
          for (let c = Math.floor(x / T); c <= Math.floor((x + w - 1) / T); c++) if (solid(c, r)) return { c, r };
        return null;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        update(dt);
        if (!g) return;
        A.fxFrame(ctx, g.fx, () => draw(now / 1000), true);
        raf = requestAnimationFrame(frame);
      }

      function die() {
        g.fx.burst(g.p.x + PW / 2, Math.min(g.p.y + PH / 2, VH - 10), ['#E03A3E', '#FFFFFF', '#1A2238'], 20, { speed: 220, size: 5 });
        g.fx.shake(8, 0.35);
        g.lives--;
        if (g.lives <= 0) return finish(false);
        g.banner = 'Ouch! Try again'; g.bannerT = 1.2;
        spawn();
      }

      function update(dt) {
        const p = g.p;
        g.bannerT -= dt;
        p.inv = Math.max(0, p.inv - dt);
        g.fx.update(dt);
        p.sq += (0 - p.sq) * Math.min(1, dt * 12); // squash and stretch relax back
        if (p.ground && Math.abs(p.vx) > 150 && Math.random() < 0.18) {
          g.fx.burst(p.x + PW / 2 - p.face * 6, p.y + PH, '#E8DCC8', 1, { speed: 40, angle: -Math.PI / 2 - p.face * 0.8, spread: 0.6, gravity: 60, size: 4, life: 0.35 });
        }
        const left = keys.ArrowLeft || keys.a || touch.left, right = keys.ArrowRight || keys.d || touch.right;
        const jumpHeld = keys[' '] || keys.ArrowUp || keys.w || touch.jump;
        const dir = (right ? 1 : 0) - (left ? 1 : 0);
        if (dir) p.face = dir;
        const accel = p.ground ? 1600 : 1000;
        const targetV = dir * RUN;
        if (p.vx < targetV) p.vx = Math.min(targetV, p.vx + accel * dt);
        else if (p.vx > targetV) p.vx = Math.max(targetV, p.vx - accel * dt);

        g.jumpBuf -= dt; p.coyote -= dt;
        if (g.jumpBuf > 0 && (p.ground || p.coyote > 0)) {
          p.vy = -JUMP; p.ground = false; p.coyote = 0; g.jumpBuf = 0; p.sq = -0.28;
          g.fx.burst(p.x + PW / 2, p.y + PH, '#E8DCC8', 6, { speed: 80, angle: -Math.PI / 2, spread: Math.PI, gravity: 160, size: 3, life: 0.35 });
        }
        if (!jumpHeld && p.vy < -220) p.vy = -220; // short hop when jump is released early
        p.vy = Math.min(MAXFALL, p.vy + GRAV * dt);

        // move x then y against the tiles
        p.x += p.vx * dt;
        let h = hits(p.x, p.y, PW, PH);
        if (h) { p.x = p.vx > 0 ? h.c * T - PW : (h.c + 1) * T; p.vx = 0; }
        const prevBottom = p.y + PH;
        p.y += p.vy * dt;
        h = hits(p.x, p.y, PW, PH);
        const wasGround = p.ground;
        p.ground = false;
        if (h) {
          if (p.vy > 0) {
            if (!wasGround && p.vy > 300) {
              p.sq = Math.min(0.35, p.vy / 1800);
              g.fx.burst(p.x + PW / 2, h.r * T, '#E8DCC8', 8, { speed: 90, angle: -Math.PI / 2, spread: Math.PI, gravity: 200, size: 3, life: 0.35 });
            }
            p.y = h.r * T - PH; p.ground = true;
          } else p.y = (h.r + 1) * T;
          p.vy = 0;
        }
        if (wasGround && !p.ground) p.coyote = 0.1;

        if (p.y > VH + 40) return die();
        // spikes (bottom half of their tile)
        for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + PH - 1) / T); r++)
          for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + PW - 1) / T); c++)
            if (r >= 0 && r < ROWS && c >= 0 && c < g.spec.w && g.grid[r][c] === '^') {
              const sx = c * T + 3, sy = r * T + 12;
              if (p.x < sx + T - 6 && p.x + PW > sx && p.y + PH > sy && p.y < sy + 12 && p.inv <= 0) return die();
            }
        // coins
        for (const c of g.coins) if (!c.got && Math.abs(p.x + PW / 2 - c.x) < 14 && Math.abs(p.y + PH / 2 - c.y) < 16) {
          c.got = true; g.score += 10;
          g.fx.burst(c.x, c.y, ['#F2B400', '#FFE14D', '#FFFFFF'], 10, { speed: 110, gravity: 60, size: 3 });
          g.fx.text(c.x, c.y - 10, '+10', '#F2B400', 12);
        }
        // critters
        for (const e of g.enemies) {
          if (e.dead) { e.squash -= dt; continue; }
          e.vy = Math.min(MAXFALL, e.vy + GRAV * dt);
          e.x += e.vx * dt;
          const front = e.vx > 0 ? e.x + EW : e.x - 1;
          const footR = Math.floor((e.y + EH + 2) / T);
          if (hits(e.x, e.y, EW, EH) || !solid(Math.floor(front / T), footR)) { e.x -= e.vx * dt; e.vx = -e.vx; }
          e.y += e.vy * dt;
          const eh = hits(e.x, e.y, EW, EH);
          if (eh) { e.y = eh.r * T - EH; e.vy = 0; }
          if (e.y > VH + 40) e.dead = true;
          if (p.x < e.x + EW && p.x + PW > e.x && p.y < e.y + EH && p.y + PH > e.y) {
            if (p.vy > 0 && prevBottom <= e.y + 8) {
              e.dead = true; e.squash = 0.4; p.vy = -380; g.score += 50; p.sq = -0.3;
              g.fx.burst(e.x + EW / 2, e.y + EH, ['#8E5BD9', '#FFFFFF'], 12, { speed: 150, angle: -Math.PI / 2, spread: 2.6, size: 4 });
              g.fx.ring(e.x + EW / 2, e.y + EH / 2, '#FFFFFF', 30, 0.3);
              g.fx.text(e.x + EW / 2, e.y - 8, '+50', '#FFFFFF', 14);
              g.fx.shake(3, 0.12);
            }
            else if (p.inv <= 0) return die();
          }
        }
        // checkpoint and flag
        if (!g.checkpoint && p.x >= g.spec.check * T) {
          g.checkpoint = true; g.banner = 'Checkpoint!'; g.bannerT = 1;
          g.fx.burst(g.spec.check * T + 22, 11 * T - 60, ['#3DCB7A', '#FFFFFF', '#F2B400'], 20, { speed: 160, shape: 'confetti', size: 6 });
        }
        if (p.x >= g.spec.flag * T) {
          g.score += 100;
          if (g.level + 1 < LEVELS.length) A.confetti(100);
          if (g.level + 1 >= LEVELS.length) return finish(true);
          loadLevel(g.level + 1);
        }
        g.cam = Math.max(0, Math.min(g.spec.w * T - VW, p.x - VW * 0.4));
        setHud('hq-level', `${g.level + 1}/${LEVELS.length}`);
        setHud('hq-score', g.score);
        setHud('hq-lives', '♥'.repeat(g.lives));
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
      }

      // each level has its own look: sunny meadow, sunset ridge, night-time sky castle
      const THEMES = [
        { sky: ['#7cc7ff', '#e6f7ff'], far: '#a8c6ea', mid: '#8fd18a', top: '#5cc15a', top2: '#86e07a', dirt: '#9a6a3c', dirt2: '#7c5230', plat: '#c98a4b', plat2: '#8f5a2b', stars: false, sun: '#fff3c4' },
        { sky: ['#ff8f6b', '#ffd59e'], far: '#b46a8a', mid: '#8a5a7a', top: '#d4a64a', top2: '#f0c868', dirt: '#7a5136', dirt2: '#5e3c27', plat: '#a8a0b8', plat2: '#6c6580', stars: false, sun: '#ffe8a8' },
        { sky: ['#141a46', '#4a3a7a'], far: '#2a2556', mid: '#3a3770', top: '#b79cff', top2: '#dccfff', dirt: '#4a4170', dirt2: '#383160', plat: '#6b5ca8', plat2: '#463a80', stars: true, sun: '#f2efe0' },
      ];

      // the level's tiles never change, so draw them once into a long strip
      function makeTiles() {
        const th = THEMES[g.level], dpr = Math.min(2, window.devicePixelRatio || 1);
        const c = document.createElement('canvas'); c.width = g.spec.w * T * dpr; c.height = VH * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        const G = g.grid;
        for (let r = 0; r < ROWS; r++) for (let col = 0; col < g.spec.w; col++) {
          const t = G[r][col], px = col * T, py = r * T;
          if (t === '#') {
            const gr = x.createLinearGradient(0, py, 0, py + T); gr.addColorStop(0, th.dirt); gr.addColorStop(1, th.dirt2);
            x.fillStyle = gr; x.fillRect(px, py, T, T);
            x.fillStyle = 'rgba(0,0,0,.18)';
            for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(px + 4 + ((col * 7 + k * 9 + r * 5) % 17), py + 6 + ((col * 3 + k * 11) % 14), 1.6 + (k % 2), 0, Math.PI * 2); x.fill(); }
            const isTop = r === 0 || G[r - 1][col] !== '#';
            if (isTop) {
              x.fillStyle = th.top; x.fillRect(px, py, T, 8);
              x.fillStyle = th.top2; x.fillRect(px, py, T, 3);
              // grass tufts hanging over the edge
              x.fillStyle = th.top;
              for (let k = 0; k < 4; k++) { const bx = px + k * 6 + 2; x.beginPath(); x.moveTo(bx, py + 7); x.lineTo(bx + 3, py + 11 + (k % 2) * 2); x.lineTo(bx + 6, py + 7); x.fill(); }
              const leftEdge = col === 0 || G[r][col - 1] !== '#', rightEdge = col === g.spec.w - 1 || G[r][col + 1] !== '#';
              if (leftEdge) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px, py, 3, T); }
              if (rightEdge) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(px + T - 3, py, 3, T); }
            }
          } else if (t === '=') {
            const gr = x.createLinearGradient(0, py, 0, py + 13); gr.addColorStop(0, th.plat); gr.addColorStop(1, th.plat2);
            x.fillStyle = gr; x.beginPath(); x.roundRect ? x.roundRect(px + 0.5, py, T - 1, 13, 3) : x.rect(px, py, T, 13); x.fill();
            x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(px + 2, py + 1, T - 4, 2);
            x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(px + T - 2, py + 2, 1, 9);
          } else if (t === '^') {
            for (let k = 0; k < 3; k++) {
              const sg = x.createLinearGradient(px + k * 8, 0, px + k * 8 + 8, 0); sg.addColorStop(0, '#eef2fa'); sg.addColorStop(0.5, '#a9b2c6'); sg.addColorStop(1, '#5d6680');
              x.fillStyle = sg; x.beginPath(); x.moveTo(px + k * 8, py + T); x.lineTo(px + k * 8 + 4, py + 9); x.lineTo(px + k * 8 + 8, py + T); x.closePath(); x.fill();
            }
          }
        }
        return c;
      }

      function draw(time) {
        const th = THEMES[g.level];
        if (!g.tiles || g.tilesFor !== g.level) { g.tiles = makeTiles(); g.tilesFor = g.level; }
        const sky = ctx.createLinearGradient(0, 0, 0, VH);
        sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
        ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
        if (th.stars) { ctx.fillStyle = '#fff'; for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 1.5 + i)); ctx.fillRect((i * 97 - g.cam * 0.05) % VW + (i * 97 - g.cam * 0.05 < 0 ? VW : 0), (i * 53) % 180, 1.5, 1.5); } ctx.globalAlpha = 1; }
        // sun or moon
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(A.glow(th.sun === '#f2efe0' ? '#b79cff' : '#ffd27a'), 330 - 70, 70 - 70, 140, 140); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(330, 70, 22, 0, Math.PI * 2); ctx.fill();
        // far mountains (or castle towers), mid hills, drifting clouds: each scrolls at its own speed
        ctx.fillStyle = th.far;
        for (let i = -1; i < 5; i++) {
          const hx = i * 200 - (g.cam * 0.15) % 200;
          if (g.level === 2) { ctx.fillRect(hx + 40, 150, 34, 140); ctx.fillRect(hx + 110, 120, 26, 170); ctx.beginPath(); ctx.moveTo(hx + 36, 150); ctx.lineTo(hx + 57, 118); ctx.lineTo(hx + 78, 150); ctx.moveTo(hx + 106, 120); ctx.lineTo(hx + 123, 88); ctx.lineTo(hx + 140, 120); ctx.fill(); ctx.fillStyle = '#ffde8c88'; ctx.fillRect(hx + 52, 175, 6, 9); ctx.fillRect(hx + 119, 150, 6, 9); ctx.fillStyle = th.far; }
          else { ctx.beginPath(); ctx.moveTo(hx, VH); ctx.lineTo(hx + 70, 140); ctx.lineTo(hx + 110, 175); ctx.lineTo(hx + 150, 120); ctx.lineTo(hx + 220, VH); ctx.fill(); }
        }
        ctx.fillStyle = th.mid;
        for (let i = -1; i < 6; i++) {
          const hx = i * 160 - (g.cam * 0.35) % 160;
          ctx.beginPath(); ctx.ellipse(hx + 80, VH - 30, 110, 85, 0, Math.PI, 0); ctx.fill();
        }
        ctx.fillStyle = g.level === 2 ? 'rgba(200,190,255,.25)' : 'rgba(255,255,255,.85)';
        for (let i = 0; i < 5; i++) {
          const cx = ((i * 170 + time * 10 - g.cam * 0.25) % (VW + 200) + VW + 200) % (VW + 200) - 100, cy = 40 + (i * 37) % 70;
          ctx.beginPath(); ctx.ellipse(cx, cy, 34, 10, 0, 0, Math.PI * 2); ctx.ellipse(cx - 14, cy - 5, 16, 10, 0, 0, Math.PI * 2); ctx.ellipse(cx + 12, cy - 7, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save(); ctx.translate(-Math.round(g.cam), 0);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const sx = Math.max(0, Math.round(g.cam)), sw = Math.min(VW + 2, g.spec.w * T - sx);
        ctx.drawImage(g.tiles, sx * dpr, 0, sw * dpr, VH * dpr, sx, 0, sw, VH);
        // checkpoint + goal flags, cloth waving in the wind
        const flagAt = (col, color, goal) => {
          const x = col * T + 10, y = 11 * T, top = y - (goal ? 84 : 70);
          ctx.fillStyle = '#d8dce8'; ctx.fillRect(x - 1.5, top, 3, y - top);
          ctx.fillStyle = '#ffd878'; ctx.beginPath(); ctx.arc(x, top, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + 1, top + 3);
          for (let k = 0; k <= 10; k++) ctx.lineTo(x + 1 + k * 2.8, top + 3 + Math.sin(time * 6 - k * 0.6) * 2.5 * (k / 10));
          for (let k = 10; k >= 0; k--) ctx.lineTo(x + 1 + k * 2.8, top + 21 + Math.sin(time * 6 - k * 0.6) * 2.5 * (k / 10) - k * 0.6);
          ctx.fill();
          if (goal) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.2; ctx.drawImage(A.glow('#ffd878'), x - 30, top - 20, 70, 70); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
        };
        flagAt(g.spec.check, g.checkpoint ? '#3DCB7A' : '#9aa3b8', false);
        flagAt(g.spec.flag, '#ff77b7', true);
        // coins: spinning, shiny, softly glowing
        for (const c of g.coins) if (!c.got) {
          const s = Math.cos(time * 3 + c.x * 0.05), cy = c.y + Math.sin(time * 4 + c.x) * 2;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(A.glow('#ffd878'), c.x - 16, cy - 16, 32, 32); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          const cg = ctx.createLinearGradient(c.x - 7, cy - 8, c.x + 7, cy + 8); cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.5, '#ffc93c'); cg.addColorStop(1, '#c98a14');
          ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(c.x, cy, 7 * Math.abs(s) + 1, 8, 0, 0, Math.PI * 2); ctx.fill();
          if (Math.abs(s) > 0.4) { ctx.fillStyle = '#c98a14'; ctx.fillRect(c.x - 1, cy - 4, 2, 8); }
        }
        // critters: bouncy slimes
        for (const e of g.enemies) {
          if (e.dead && e.squash <= 0) continue;
          const squashed = e.dead, bob = squashed ? 0 : Math.abs(Math.sin(time * 8 + e.x * 0.1));
          const hgt = squashed ? 6 : EH - 3 + bob * 3, wid = squashed ? EW + 6 : EW + (1 - bob) * 2;
          const bx = e.x + EW / 2, by = e.y + EH;
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(bx, by, wid / 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          const sg = ctx.createRadialGradient(bx - 4, by - hgt * 0.75, 1, bx, by - hgt / 2, wid * 0.7);
          if (g.level === 2) { sg.addColorStop(0, '#e8ffc4'); sg.addColorStop(0.5, '#8fe05a'); sg.addColorStop(1, '#3f8a2a'); }
          else { sg.addColorStop(0, '#e2c8ff'); sg.addColorStop(0.5, '#9a6ae6'); sg.addColorStop(1, '#5a33a8'); }
          ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(bx - wid / 2, by); ctx.quadraticCurveTo(bx - wid / 2, by - hgt, bx, by - hgt); ctx.quadraticCurveTo(bx + wid / 2, by - hgt, bx + wid / 2, by); ctx.closePath(); ctx.fill();
          if (!squashed) {
            const ex = e.vx > 0 ? 2 : -2;
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx - 4 + ex, by - hgt * 0.6, 3.2, 0, Math.PI * 2); ctx.arc(bx + 4 + ex, by - hgt * 0.6, 3.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1438'; ctx.beginPath(); ctx.arc(bx - 4 + ex * 1.5, by - hgt * 0.6, 1.6, 0, Math.PI * 2); ctx.arc(bx + 4 + ex * 1.5, by - hgt * 0.6, 1.6, 0, Math.PI * 2); ctx.fill();
          }
        }
        // player: a little hero with a flowing scarf and running legs
        const p = g.p;
        if (!(p.inv > 0 && Math.floor(p.inv * 12) % 2)) {
          const w = PW * (1 + p.sq), hh = PH * (1 - p.sq);
          const x = p.x + (PW - w) / 2, y = p.y + PH - hh, cx = x + w / 2;
          const run = p.ground && Math.abs(p.vx) > 20 ? Math.sin(time * 18) : 0;
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, p.y + PH, w / 2 + 1, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          // legs
          ctx.strokeStyle = '#2a2d45'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          const legY = y + hh - 6;
          if (p.ground) { ctx.beginPath(); ctx.moveTo(cx - 3, legY); ctx.lineTo(cx - 3 + run * 4, y + hh - 1); ctx.moveTo(cx + 3, legY); ctx.lineTo(cx + 3 - run * 4, y + hh - 1); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(cx - 3, legY); ctx.lineTo(cx - 5, y + hh - 2); ctx.moveTo(cx + 3, legY); ctx.lineTo(cx + 5, y + hh - 4); ctx.stroke(); }
          // scarf trailing behind
          ctx.fillStyle = '#ffd878';
          const sw2 = Math.sin(time * 12) * 2;
          ctx.beginPath(); ctx.moveTo(cx - p.face * 3, y + 9); ctx.lineTo(cx - p.face * (12 + Math.abs(p.vx) / 25), y + 8 + sw2); ctx.lineTo(cx - p.face * (11 + Math.abs(p.vx) / 25), y + 13 + sw2); ctx.lineTo(cx - p.face * 3, y + 13); ctx.fill();
          // body
          const bg = ctx.createLinearGradient(x, y, x + w, y + hh); bg.addColorStop(0, '#ff8a8d'); bg.addColorStop(1, '#c42a3a');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, hh - 5, 7) : ctx.rect(x, y, w, hh - 5); ctx.fill();
          ctx.fillStyle = '#ffd878'; ctx.fillRect(x, y + 9, w, 4);
          // face
          const ex = cx + p.face * 3;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, y + 5.5, 3.6, 3.8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1438'; ctx.beginPath(); ctx.arc(ex + p.face * 1.2, y + 5.8, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        g.fx.draw(ctx);
        ctx.restore();
        if (g.bannerT > 0) {
          ctx.globalAlpha = Math.min(1, g.bannerT * 2);
          ctx.textAlign = 'center'; ctx.font = '700 26px "Space Grotesk", sans-serif';
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,18,50,.8)'; ctx.fillStyle = '#FFFFFF';
          ctx.strokeText(g.banner, VW / 2, 64); ctx.fillText(g.banner, VW / 2, 64);
          ctx.textAlign = 'start'; ctx.globalAlpha = 1;
        }
      }

      function finish(won) {
        cancelAnimationFrame(raf);
        const res = { score: g.score + (won ? g.lives * 100 : 0), level: g.level + 1, lives: g.lives };
        g = null;
        const prev = A.store.get('hq-best', 0);
        const isBest = res.score > prev;
        if (isBest) A.store.set('hq-best', res.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">${won ? 'Quest complete!' : `Game over on level ${res.level}`}</span>
            <span class="big">${res.score}</span>
            ${isBest ? '<span class="newbest">New high score!</span>' : `<span class="label">High score: ${prev}</span>`}
            ${won ? `<div class="result-stats"><div class="stat"><small>Lives bonus</small><b>+${res.lives * 100}</b></div></div>` : ''}
            <div class="row"><button class="btn primary" data-act="go">Play again</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => { if (e.target.closest('[data-act="go"]')) start(); };
      const CTRL = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', ' '];
      const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const down = e => {
        if (!g) return;
        const k = norm(e);
        if (!CTRL.includes(k)) return;
        e.preventDefault();
        if ((k === ' ' || k === 'ArrowUp' || k === 'w') && !keys[k]) g.jumpBuf = 0.12;
        keys[k] = true;
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
