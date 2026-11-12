/* Castle Guard: tower defense. Build and upgrade towers along the road to stop 12 waves before they reach your castle. */
(function () {
  const A = Arcade;
  const COLS = 9, ROWS = 13, C = 40, W = COLS * C, H = ROWS * C;
  const WAVES = 12;
  const PATH = [[1, -1], [1, 2], [7, 2], [7, 5], [1, 5], [1, 8], [7, 8], [7, 11], [4, 11], [4, 12.6]].map(([c, r]) => ({ x: c * C + C / 2, y: r * C + C / 2 }));
  const TOWERS = {
    archer: { name: 'Archer', cost: 50, range: 96, dmg: 10, rate: 0.55, color: '#2E5BFF', info: 'Fast single shots' },
    cannon: { name: 'Cannon', cost: 90, range: 86, dmg: 24, rate: 1.5, splash: 42, color: '#3A3F4F', info: 'Splash damage' },
    frost: { name: 'Frost', cost: 70, range: 82, dmg: 4, rate: 0.9, slow: 0.5, color: '#2BB3D6', info: 'Slows enemies' },
  };
  const ENEMIES = {
    grunt: { hp: 1, speed: 1, gold: 6, color: '#8E5BD9', r: 10 },
    runner: { hp: 0.55, speed: 1.8, gold: 5, color: '#E8590C', r: 8 },
    tank: { hp: 2.8, speed: 0.6, gold: 14, color: '#5C6170', r: 13 },
    boss: { hp: 14, speed: 0.5, gold: 60, color: '#C2255C', r: 17 },
  };

  // cells the road covers (no building there)
  const ROAD = new Set();
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
    for (let s = 0; s <= steps; s++) {
      const x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
      const c = Math.floor(x / C), r = Math.floor(y / C);
      if (r >= 0 && r < ROWS) ROAD.add(r * COLS + c);
    }
  }

  A.css('cg-css', `
    .cg-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 14px; }
    .cg-tower { flex-direction: column; gap: 0; padding: 6px 12px; font-size: 15px; min-width: 96px; }
    .cg-tower small { font-weight: 400; font-size: 12px; color: var(--ink-soft); }
    .cg-tower[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
    .cg-tower[aria-pressed="true"] small { color: inherit; }
    .cg-panel { text-align: center; min-height: 44px; margin-top: 10px; display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; font-weight: 700; }
  `);

  A.register({
    id: 'castle-guard',
    section: 'strategy',
    title: 'Castle Guard',
    color: 'stack',
    artBg: 'linear-gradient(135deg, #5fb95a, #3f9445)',
    art: `<svg width="180" height="110" viewBox="0 0 180 110" aria-hidden="true">
      <path d="M0 30 H110 V78 H180" fill="none" stroke="#8a6a42" stroke-width="20" stroke-linejoin="round"/>
      <path d="M0 30 H110 V78 H180" fill="none" stroke="#d8b987" stroke-width="15" stroke-linejoin="round"/>
      <g transform="translate(52 64)"><ellipse cx="2" cy="12" rx="15" ry="5" fill="#0003"/><path d="M-14 5 V-4 A14 8 0 0 1 14 -4 V5 A14 8 0 0 1 -14 5Z" fill="#c9c6bc"/><ellipse cy="-4" rx="14" ry="8" fill="#e6e2d8"/><path d="M-3 -8 L14 -18" stroke="#2a2e40" stroke-width="8" stroke-linecap="round"/></g>
      <g transform="translate(140 42)"><ellipse cx="2" cy="12" rx="15" ry="5" fill="#0003"/><path d="M-14 5 V-4 A14 8 0 0 1 14 -4 V5 A14 8 0 0 1 -14 5Z" fill="#c9c6bc"/><ellipse cy="-4" rx="14" ry="8" fill="#e6e2d8"/><path d="M0 -26 L7 -14 L0 -4 L-7 -14Z" fill="#7fe3ff" style="filter:drop-shadow(0 0 5px #7fe3ff)"/></g>
      <circle cx="84" cy="28" r="10" fill="#9a6ae6"/><circle cx="80" cy="26" r="2.6" fill="#fff"/><circle cx="88" cy="26" r="2.6" fill="#fff"/>
      <circle cx="26" cy="28" r="7" fill="#ff8a3d"/><circle cx="24" cy="27" r="2" fill="#fff"/><circle cx="29" cy="27" r="2" fill="#fff"/>
      <circle cx="74" cy="38" r="5" fill="#ff9f43" opacity=".7" style="filter:blur(2px)"/>
    </svg>`,
    blurb: 'Build archer, cannon and frost towers along the road. Upgrade them wisely and stop 12 waves before they reach your castle.',
    tags: ['Tower defense', 'Planning', '12 waves'],
    best() { const b = A.store.get('cg-best', 0); return b ? (b > WAVES ? 'Castle saved!' : 'Wave ' + b) : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null, toLogical = null;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Defend the castle</h2>
            <p>Enemies march down the dirt road toward your castle at the bottom. Pick a tower below the map, then tap a grass square to build it. Defeated enemies give you gold for more towers.</p>
            <p><b>Archers</b> shoot fast, <b>cannons</b> hit groups, and <b>frost</b> towers slow enemies down. Tap a tower you built to upgrade or sell it. Start each wave when you’re ready. If 15 enemies get through, the castle falls.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start defending</button>
            <span class="best" style="align-self:center">Best: <b>${(() => { const b = A.store.get('cg-best', 0); return b ? (b > WAVES ? 'all 12 waves' : 'wave ' + b) : 'not played yet'; })()}</b></span>
          </div>`;
      }

      function start() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Gold</small><b id="cg-gold">0</b></div>
              <div class="stat"><small>Lives</small><b id="cg-lives" style="color:var(--p1)">15</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Wave</small><b id="cg-wave">0/${WAVES}</b></div></div>
          </div>`;
        ({ cv, ctx, toLogical } = A.makeCanvas(el, W, H));
        cv.style.aspectRatio = `${W} / ${H}`;
        cv.style.width = `min(100%, 420px, calc(66vh * ${W / H}))`;
        el.insertAdjacentHTML('beforeend', `
          <div class="cg-bar" id="cg-bar">
            ${Object.entries(TOWERS).map(([k, t]) => `<button class="btn cg-tower" data-tower="${k}" aria-pressed="${k === 'archer'}">${t.name} · ${t.cost}g<small>${t.info}</small></button>`).join('')}
          </div>
          <div class="cg-panel" id="cg-panel"></div>
          <div class="row">
            <button class="btn primary" data-act="wave">Start wave 1</button>
            <button class="btn small" data-act="speed">Speed: 1×</button>
          </div>`);
        cv.addEventListener('pointerdown', e => { e.preventDefault(); click(toLogical(e)); });
        cv.addEventListener('pointermove', e => { if (g) g.hover = toLogical(e); });
        cv.addEventListener('pointerleave', () => { if (g) g.hover = null; });
        g = {
          gold: 140, lives: 15, wave: 0, towers: [], enemies: [], shots: [], booms: [], spawnQ: [], spawnT: 0,
          pick: 'archer', sel: null, hover: null, speed: 1, inWave: false, last: performance.now(), hud: {}, fx: A.particles(),
        };
        panel();
        raf = requestAnimationFrame(frame);
      }

      const stats = tw => {
        const b = TOWERS[tw.type], m = Math.pow(1.45, tw.lvl - 1);
        return { range: b.range + (tw.lvl - 1) * 10, dmg: b.dmg * m, rate: b.rate * Math.pow(0.9, tw.lvl - 1), splash: b.splash, slow: b.slow };
      };
      const upCost = tw => Math.round(TOWERS[tw.type].cost * 0.75 * tw.lvl);

      function panel() {
        const p = el.querySelector('#cg-panel');
        if (!p) return;
        if (g.sel) {
          const t = g.sel, name = TOWERS[t.type].name;
          p.innerHTML = `<span>${name} · level ${t.lvl}</span>
            ${t.lvl < 3 ? `<button class="btn small" data-act="up" ${g.gold < upCost(t) ? 'disabled' : ''}>Upgrade (${upCost(t)}g)</button>` : '<span class="chip">Max level</span>'}
            <button class="btn small" data-act="sell">Sell (+${Math.round(t.spent * 0.6)}g)</button>
            <button class="btn small" data-act="close">Done</button>`;
        } else p.innerHTML = `<span class="best">Tap a grass square to build a ${TOWERS[g.pick].name.toLowerCase()} tower.</span>`;
      }

      function click(pos) {
        if (!g) return;
        const c = Math.floor(pos.x / C), r = Math.floor(pos.y / C);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
        const existing = g.towers.find(t => t.c === c && t.r === r);
        if (existing) { g.sel = existing; panel(); return; }
        g.sel = null;
        if (ROAD.has(r * COLS + c)) { panel(); return; }
        const cost = TOWERS[g.pick].cost;
        if (g.gold < cost) { flash(`Not enough gold. A ${TOWERS[g.pick].name.toLowerCase()} costs ${cost}.`); return; }
        g.gold -= cost;
        g.towers.push({ type: g.pick, c, r, x: c * C + C / 2, y: r * C + C / 2, lvl: 1, cd: 0, spent: cost, aim: -Math.PI / 2, born: 0.3, kick: 0 });
        g.fx.burst(c * C + C / 2, r * C + C / 2 + 12, ['#E6E2D8', '#B8935E', '#FFFFFF'], 12, { speed: 110, angle: -Math.PI / 2, spread: 3, size: 4 });
        g.fx.ring(c * C + C / 2, r * C + C / 2, '#FFFFFF', 34, 0.35);
        panel();
      }
      function flash(text) {
        const p = el.querySelector('#cg-panel');
        p.innerHTML = `<span style="color:var(--bad)">${text}</span>`;
        clearTimeout(g.flashT); g.flashT = setTimeout(() => { if (g) panel(); }, 1600);
      }

      function startWave() {
        if (!g || g.inWave || g.wave >= WAVES) return;
        g.wave++; g.inWave = true;
        const n = g.wave, list = [];
        const count = 6 + n * 2;
        for (let i = 0; i < count; i++) {
          let type = 'grunt';
          if (n >= 2 && i % 3 === 1) type = 'runner';
          if (n >= 3 && i % 5 === 4) type = 'tank';
          list.push(type);
        }
        if (n % 5 === 0 || n === WAVES) list.push('boss');
        g.spawnQ = list; g.spawnT = 0.3;
        g.hpMul = 30 * (1 + (n - 1) * 0.34);
        const btn = el.querySelector('[data-act="wave"]');
        btn.disabled = true; btn.textContent = `Wave ${n} incoming…`;
      }

      function frame(now) {
        if (!g) return;
        const real = Math.min(0.033, (now - g.last) / 1000);
        g.last = now;
        for (let i = 0; i < g.speed; i++) { update(real); if (!g) return; }
        if (!g) return;
        g.fx.update(real);
        A.fxFrame(ctx, g.fx, draw);
        raf = requestAnimationFrame(frame);
      }

      function update(dt) {
        // spawning
        if (g.spawnQ.length) {
          g.spawnT -= dt;
          if (g.spawnT <= 0) {
            const type = g.spawnQ.shift(), e = ENEMIES[type];
            const hp = e.hp * g.hpMul;
            g.enemies.push({ type, x: PATH[0].x, y: PATH[0].y, wp: 1, hp, max: hp, slowT: 0, done: 0 });
            g.spawnT = type === 'runner' ? 0.45 : type === 'boss' ? 1.2 : 0.75;
          }
        }
        // enemies walk the road
        for (const e of g.enemies) {
          const def = ENEMIES[e.type];
          e.slowT = Math.max(0, e.slowT - dt);
          let move = 48 * def.speed * (e.slowT > 0 ? 0.5 : 1) * dt;
          while (move > 0 && e.wp < PATH.length) {
            const t = PATH[e.wp], dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
            if (d <= move) { e.x = t.x; e.y = t.y; e.wp++; move -= d; }
            else { e.x += dx / d * move; e.y += dy / d * move; move = 0; }
          }
          e.done += 48 * def.speed * dt;
          if (e.wp >= PATH.length) {
            e.leaked = true; g.lives -= e.type === 'boss' ? 5 : 1;
            const end = PATH[PATH.length - 2];
            g.fx.shake(e.type === 'boss' ? 10 : 5, 0.3);
            g.fx.ring(end.x, end.y + 20, '#FF6B6B', 50, 0.4);
            g.fx.text(end.x, end.y, e.type === 'boss' ? '−5' : '−1', '#FF6B6B', 16);
          }
        }
        g.enemies = g.enemies.filter(e => !e.leaked && e.hp > 0);
        if (g.lives <= 0) return finish(false);
        // towers fire at the enemy furthest along the road
        for (const t of g.towers) {
          t.cd -= dt;
          t.kick = Math.max(0, (t.kick || 0) - dt);
          t.born = Math.max(0, (t.born || 0) - dt);
          const s = stats(t);
          let target = null;
          for (const e of g.enemies) if (Math.hypot(e.x - t.x, e.y - t.y) <= s.range && (!target || e.done > target.done)) target = e;
          if (target) t.aim = Math.atan2(target.y - t.y, target.x - t.x);
          if (target && t.cd <= 0) {
            t.cd = s.rate;
            t.kick = 0.1;
            g.shots.push({ x: t.x, y: t.y, target, type: t.type, dmg: s.dmg, splash: s.splash, slow: s.slow, speed: t.type === 'cannon' ? 260 : 380 });
          }
        }
        // projectiles
        for (const p of g.shots) {
          const e = p.target, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
          const step = p.speed * dt;
          if (d <= step + 4) {
            p.hit = true;
            if (p.splash) {
              for (const o of g.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) <= p.splash) damage(o, p.dmg);
              g.booms.push({ x: e.x, y: e.y, t: 0.3, r: p.splash });
            } else damage(e, p.dmg);
            if (p.slow) e.slowT = 1.6;
          } else { p.x += dx / d * step; p.y += dy / d * step; }
          if (e.hp <= 0 && !p.splash) p.hit = true;
        }
        g.shots = g.shots.filter(p => !p.hit);
        for (const b of g.booms) b.t -= dt;
        g.booms = g.booms.filter(b => b.t > 0);
        g.enemies = g.enemies.filter(e => e.hp > 0);
        // wave finished
        if (g.inWave && !g.spawnQ.length && !g.enemies.length) {
          g.inWave = false;
          g.gold += 20 + g.wave * 4;
          g.fx.text(W / 2, H / 2, `Wave ${g.wave} cleared! +${20 + g.wave * 4}`, '#FFFFFF', 18);
          g.fx.burst(W / 2, H / 2, ['#F2B400', '#FFFFFF', '#3DCB7A'], 24, { speed: 220, shape: 'confetti', size: 6 });
          if (g.wave >= WAVES) return finish(true);
          const btn = el.querySelector('[data-act="wave"]');
          btn.disabled = false; btn.textContent = `Start wave ${g.wave + 1}`;
        }
        setHud('cg-gold', g.gold);
        setHud('cg-lives', Math.max(0, g.lives));
        setHud('cg-wave', `${g.wave}/${WAVES}`);
      }

      function damage(e, dmg) {
        if (e.hp <= 0) return;
        e.hp -= dmg;
        if (e.hp <= 0) {
          const def = ENEMIES[e.type];
          g.gold += def.gold;
          g.fx.burst(e.x, e.y, [def.color, '#FFFFFF'], e.type === 'boss' ? 30 : 10, { speed: e.type === 'boss' ? 200 : 120, size: 4 });
          g.fx.text(e.x, e.y - 12, '+' + def.gold, '#F2B400', 13);
          if (e.type === 'boss') { g.fx.ring(e.x, e.y, def.color, 70, 0.5); g.fx.shake(6, 0.3); }
        }
      }

      function setHud(id, v) {
        if (g.hud[id] === v) return;
        g.hud[id] = v;
        const n = el.querySelector('#' + id); if (n) n.textContent = v;
        // keep the upgrade button's enabled state in sync without rebuilding the panel mid-click
        if (id === 'cg-gold' && g.sel) { const up = el.querySelector('[data-act="up"]'); if (up) up.disabled = g.gold < upCost(g.sel); }
      }

      // the map never changes, so paint it once: textured grass, a cobbled road, flowers, a cave and the castle
      let map = null;
      function makeMap() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        let gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#5fb95a'); gr.addColorStop(1, '#3f9445');
        x.fillStyle = gr; x.fillRect(0, 0, W, H);
        for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if ((r + col) % 2) { x.fillStyle = 'rgba(255,255,255,.035)'; x.fillRect(col * C, r * C, C, C); }
        for (let i = 0; i < 420; i++) {
          const gx = Math.random() * W, gy = Math.random() * H;
          x.strokeStyle = Math.random() < 0.5 ? '#7fd06a' : '#2f7a36'; x.lineWidth = 1.2;
          x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 1.5, gy - 4); x.moveTo(gx, gy); x.lineTo(gx + 2, gy - 5); x.stroke();
        }
        for (let i = 0; i < 24; i++) {
          const fx2 = Math.random() * W, fy = Math.random() * H;
          x.fillStyle = ['#ffd878', '#ff9cc8', '#ffffff', '#b79cff'][i % 4];
          for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(fx2 + Math.cos(k * 1.26) * 2.2, fy + Math.sin(k * 1.26) * 2.2, 1.6, 0, Math.PI * 2); x.fill(); }
        }
        // road: dark edge, sandy bed, then cobbles
        const road = (w, col) => { x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); PATH.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.stroke(); };
        x.save(); x.translate(0, 3); road(C, 'rgba(0,0,0,.18)'); x.restore();
        road(C - 2, '#8a6a42'); road(C - 8, '#d8b987');
        for (let i = 0; i < PATH.length - 1; i++) {
          const a = PATH[i], b = PATH[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
          for (let s = 0; s < len; s += 9) for (let k = -1; k <= 1; k++) {
            const t = s / len, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
            const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
            const ox = px + nx * k * 10 + (Math.random() - 0.5) * 3, oy = py + ny * k * 10 + (Math.random() - 0.5) * 3;
            x.fillStyle = `rgba(${150 + Math.random() * 40},${120 + Math.random() * 30},${80 + Math.random() * 20},.55)`;
            x.beginPath(); x.ellipse(ox, oy, 3.5, 2.6, Math.random() * 3, 0, Math.PI * 2); x.fill();
          }
        }
        // cave the enemies come out of
        const top = PATH[1];
        x.fillStyle = '#5d5a6e'; x.beginPath(); x.ellipse(top.x, 6, 30, 22, 0, 0, Math.PI); x.fill();
        x.fillStyle = '#16131f'; x.beginPath(); x.ellipse(top.x, 4, 19, 15, 0, 0, Math.PI); x.fill();
        // castle at the end of the road
        const cx = 4 * C + C / 2, cy = 12 * C + 2;
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(cx - 40, cy + 34, 84, 6);
        const stone = (px, py, w, h) => { const sg = x.createLinearGradient(px, 0, px + w, 0); sg.addColorStop(0, '#e6e8f0'); sg.addColorStop(1, '#9aa0b8'); x.fillStyle = sg; x.fillRect(px, py, w, h); };
        stone(cx - 36, cy + 4, 72, 34);
        stone(cx - 44, cy - 10, 18, 48); stone(cx + 26, cy - 10, 18, 48);
        x.fillStyle = '#c42a5a'; for (const tx of [cx - 35, cx + 35]) { x.beginPath(); x.moveTo(tx - 11, cy - 10); x.lineTo(tx, cy - 26); x.lineTo(tx + 11, cy - 10); x.fill(); }
        x.fillStyle = '#b9bed0'; for (let i = 0; i < 5; i++) x.fillRect(cx - 26 + i * 12, cy - 2, 7, 7);
        x.fillStyle = '#3a2a1e'; x.beginPath(); x.moveTo(cx - 9, cy + 38); x.lineTo(cx - 9, cy + 20); x.arc(cx, cy + 20, 9, Math.PI, 0); x.lineTo(cx + 9, cy + 38); x.fill();
        x.fillStyle = '#ffd878'; x.fillRect(cx - 38, cy + 6, 4, 6); x.fillRect(cx + 33, cy + 6, 4, 6);
        x.strokeStyle = '#5a5f78'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx + 35, cy - 26); x.lineTo(cx + 35, cy - 40); x.stroke();
        x.fillStyle = '#ffd878'; x.beginPath(); x.moveTo(cx + 35, cy - 40); x.lineTo(cx + 47, cy - 36); x.lineTo(cx + 35, cy - 32); x.fill();
        return c;
      }

      function draw() {
        if (!map) map = makeMap();
        ctx.drawImage(map, 0, 0, W, H);
        // build preview
        if (g.hover && !g.sel) {
          const c = Math.floor(g.hover.x / C), r = Math.floor(g.hover.y / C);
          const free = c >= 0 && c < COLS && r >= 0 && r < ROWS && !ROAD.has(r * COLS + c) && !g.towers.some(t => t.c === c && t.r === r);
          if (free) {
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(c * C, r * C, C, C);
            ctx.beginPath(); ctx.arc(c * C + C / 2, r * C + C / 2, TOWERS[g.pick].range, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(26,34,56,.5)'; ctx.lineWidth = 2; ctx.stroke();
          }
        }
        // towers
        for (const t of g.towers) {
          const def = TOWERS[t.type];
          if (g.sel === t) {
            ctx.beginPath(); ctx.arc(t.x, t.y, stats(t).range, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
          }
          // towers pop up when built or upgraded, and recoil when they fire
          const pop = 1 + Math.sin((t.born || 0) / 0.3 * Math.PI) * 0.18;
          const time = performance.now() / 1000;
          ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pop, pop);
          // round stone base with a shadow; higher levels get a gold trim
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 13, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
          const bg = ctx.createLinearGradient(-16, 0, 16, 0); bg.addColorStop(0, '#eceae4'); bg.addColorStop(1, '#9a968c');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 6, 16, 9, 0, 0, Math.PI); ctx.lineTo(-16, -4); ctx.ellipse(0, -4, 16, 9, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#d6d2c8'; ctx.beginPath(); ctx.ellipse(0, -4, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = t.lvl >= 2 ? '#ffd878' : 'rgba(0,0,0,.2)'; ctx.lineWidth = t.lvl >= 3 ? 3 : 1.5; ctx.stroke();
          if (t.type === 'frost') {
            // floating ice crystal
            const fy = -10 + Math.sin(time * 3 + t.x) * 2;
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(A.glow('#7fe3ff'), -22, fy - 22, 44, 44); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            const ig = ctx.createLinearGradient(-7, fy - 12, 7, fy + 8); ig.addColorStop(0, '#ffffff'); ig.addColorStop(1, '#2bb3d6');
            ctx.fillStyle = ig; ctx.beginPath(); ctx.moveTo(0, fy - 14); ctx.lineTo(7, fy - 2); ctx.lineTo(0, fy + 8); ctx.lineTo(-7, fy - 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, fy - 14); ctx.lineTo(0, fy + 8); ctx.stroke();
          } else {
            ctx.save(); ctx.translate(0, -6); ctx.rotate(t.aim); ctx.translate(-(t.kick || 0) * 40, 0);
            if (t.type === 'cannon') {
              const cg = ctx.createLinearGradient(0, -6, 0, 6); cg.addColorStop(0, '#6a7088'); cg.addColorStop(0.5, '#2a2e40'); cg.addColorStop(1, '#151826');
              ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-6, -6, 26, 12, 4) : ctx.rect(-6, -6, 26, 12); ctx.fill();
              ctx.fillStyle = '#151826'; ctx.fillRect(18, -7, 4, 14);
              ctx.fillStyle = '#3a3f52'; ctx.beginPath(); ctx.arc(-2, 0, 8, 0, Math.PI * 2); ctx.fill();
            } else {
              // archer: a crossbow on a turntable
              ctx.fillStyle = '#8a5a33'; ctx.fillRect(-6, -2.5, 20, 5);
              ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(8, 0, 10, -1.2, 1.2); ctx.stroke();
              ctx.strokeStyle = '#f0e6d0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8 + Math.cos(-1.2) * 10, Math.sin(-1.2) * 10); ctx.lineTo(t.cd > 0.2 ? -2 : 4, 0); ctx.lineTo(8 + Math.cos(1.2) * 10, Math.sin(1.2) * 10); ctx.stroke();
              ctx.fillStyle = '#2e5bff'; ctx.beginPath(); ctx.arc(-3, 0, 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
          }
          // level stars
          for (let i = 0; i < t.lvl; i++) { ctx.fillStyle = '#ffd878'; ctx.beginPath(); ctx.arc(-8 + i * 8, 14, 2.6, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        // enemies: little walking creatures with shadows and bobbing bodies
        const now = performance.now() / 1000;
        for (const e of g.enemies) {
          const def = ENEMIES[e.type], r = def.r;
          const bob = Math.abs(Math.sin(now * (10 * def.speed) + e.done * 0.1)) * 3;
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
          const by = e.y - bob;
          const eg = ctx.createRadialGradient(e.x - r * 0.35, by - r * 0.4, 1, e.x, by, r * 1.1);
          eg.addColorStop(0, '#ffffff'); eg.addColorStop(0.25, def.color); eg.addColorStop(1, '#1a1438');
          ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(e.x, by, r, 0, Math.PI * 2); ctx.fill();
          if (e.type === 'tank') { ctx.fillStyle = '#9aa0b8'; ctx.beginPath(); ctx.ellipse(e.x, by - r * 0.45, r * 0.95, r * 0.55, 0, Math.PI, 0); ctx.fill(); }
          if (e.type === 'runner') { ctx.fillStyle = def.color; ctx.beginPath(); ctx.moveTo(e.x - r * 0.6, by - r * 0.7); ctx.lineTo(e.x - r * 0.2, by - r * 1.5); ctx.lineTo(e.x + r * 0.1, by - r * 0.8); ctx.fill(); }
          if (e.type === 'boss') { ctx.fillStyle = '#ffd878'; ctx.beginPath(); ctx.moveTo(e.x - 9, by - r + 2); ctx.lineTo(e.x - 9, by - r - 8); ctx.lineTo(e.x - 4, by - r - 3); ctx.lineTo(e.x, by - r - 10); ctx.lineTo(e.x + 4, by - r - 3); ctx.lineTo(e.x + 9, by - r - 8); ctx.lineTo(e.x + 9, by - r + 2); ctx.fill(); }
          // eyes look the way it's walking
          const tgt = PATH[Math.min(e.wp, PATH.length - 1)], ang = Math.atan2(tgt.y - e.y, tgt.x - e.x), lx = Math.cos(ang) * r * 0.25, ly = Math.sin(ang) * r * 0.25;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x - r * 0.32 + lx, by - r * 0.1 + ly, r * 0.24, 0, Math.PI * 2); ctx.arc(e.x + r * 0.32 + lx, by - r * 0.1 + ly, r * 0.24, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1438'; ctx.beginPath(); ctx.arc(e.x - r * 0.32 + lx * 1.4, by - r * 0.1 + ly * 1.4, r * 0.12, 0, Math.PI * 2); ctx.arc(e.x + r * 0.32 + lx * 1.4, by - r * 0.1 + ly * 1.4, r * 0.12, 0, Math.PI * 2); ctx.fill();
          if (e.slowT > 0) { ctx.fillStyle = 'rgba(127,227,255,.35)'; ctx.beginPath(); ctx.arc(e.x, by, r + 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#bff3ff'; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.fillStyle = 'rgba(10,12,30,.7)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(e.x - 13, by - r - 10, 26, 5, 2.5) : ctx.rect(e.x - 13, by - r - 10, 26, 5); ctx.fill();
          const hpk = Math.max(0, e.hp / e.max);
          ctx.fillStyle = hpk > 0.5 ? '#7cf07a' : hpk > 0.25 ? '#ffd878' : '#ff6b7a'; ctx.fillRect(e.x - 12, by - r - 9, 24 * hpk, 3);
        }
        for (const p of g.shots) {
          const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          if (p.type === 'archer') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
            ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(5, 0); ctx.stroke();
            ctx.fillStyle = '#e6e8f0'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill();
            ctx.fillStyle = '#ff77b7'; ctx.fillRect(-10, -2.5, 3, 5);
            ctx.restore();
          } else if (p.type === 'cannon') {
            ctx.fillStyle = 'rgba(200,200,210,.35)'; ctx.beginPath(); ctx.arc(p.x - Math.cos(ang) * 7, p.y - Math.sin(ang) * 7, 4, 0, Math.PI * 2); ctx.fill();
            const bgr = ctx.createRadialGradient(p.x - 1.5, p.y - 1.5, 0.5, p.x, p.y, 5.5); bgr.addColorStop(0, '#8a90a8'); bgr.addColorStop(1, '#14161f');
            ctx.fillStyle = bgr; ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(A.glow('#7fe3ff'), p.x - 12, p.y - 12, 24, 24); ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (const b of g.booms) {
          const k = b.t / 0.3;
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
          ctx.drawImage(A.glow('#ff9f43'), b.x - b.r * 1.4, b.y - b.r * 1.4, b.r * 2.8, b.r * 2.8);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `rgba(255,230,180,${k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - k * 0.6), 0, Math.PI * 2); ctx.stroke();
        }
      }

      function finish(won) {
        cancelAnimationFrame(raf);
        const wave = g.wave;
        clearTimeout(g.flashT);
        g = null;
        const reached = won ? WAVES + 1 : wave;
        const prev = A.store.get('cg-best', 0);
        if (reached > prev) A.store.set('cg-best', reached);
        el.innerHTML = `
          <div class="result">
            <span class="label">${won ? 'Victory' : 'The castle has fallen'}</span>
            <span class="big">${won ? '12/12' : wave + '/' + WAVES}</span>
            <span class="label">waves</span>
            <span class="newbest">${won ? 'You saved the castle!' : 'Try a different tower plan.'}</span>
            <div class="row"><button class="btn primary" data-act="go">${won ? 'Play again' : 'Try again'}</button></div>
          </div>`;
        el.querySelector('[data-act="go"]').focus();
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'go') return start();
        if (!g) return;
        if (b.dataset.tower) {
          g.pick = b.dataset.tower; g.sel = null;
          el.querySelectorAll('[data-tower]').forEach(x => x.setAttribute('aria-pressed', x === b));
          panel();
        } else if (b.dataset.act === 'wave') startWave();
        else if (b.dataset.act === 'speed') { g.speed = g.speed === 1 ? 2 : 1; b.textContent = `Speed: ${g.speed}×`; }
        else if (b.dataset.act === 'up' && g.sel && g.sel.lvl < 3 && g.gold >= upCost(g.sel)) {
          const cost = upCost(g.sel); g.gold -= cost; g.sel.spent += cost; g.sel.lvl++; g.sel.born = 0.3; panel();
          g.fx.burst(g.sel.x, g.sel.y, ['#F2B400', '#FFFFFF', TOWERS[g.sel.type].color], 18, { speed: 150, gravity: -40, shape: 'confetti', size: 5 });
          g.fx.text(g.sel.x, g.sel.y - 22, 'LEVEL ' + g.sel.lvl, '#F2B400', 13);
        } else if (b.dataset.act === 'sell' && g.sel) {
          g.gold += Math.round(g.sel.spent * 0.6); g.towers = g.towers.filter(t => t !== g.sel); g.sel = null; panel();
        } else if (b.dataset.act === 'close') { g.sel = null; panel(); }
      };
      intro();
      return () => { cancelAnimationFrame(raf); if (g) clearTimeout(g.flashT); g = null; };
    },
  });
})();
