/* Loop: a Brain Break original. A time-loop puzzle. Each time you loop, a ghost of your last run
   replays every step you took. Team up with your past selves to hold plates, open doors and escape. */
(function () {
  const A = Arcade;
  const VW = 360, VH = 480;
  const GHOST_COLORS = ['#B794F6', '#5CE1E6', '#FFD866'];
  const PLATE_COLORS = { a: '#FF6B9B', b: '#5CC0FF', c: '#7CFFB2' };
  const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };

  // # wall  . floor  S start  E exit  a/b/c plates  A/B/C doors (open while their plate is pressed)
  // 1 = a reverse door for plate a: open normally, shut while plate a is pressed
  const LEVELS = [
    { name: 'First Echo', ticks: 10, ghosts: 1,
      hint: 'Step on the pink plate, then press Loop. Next time around, your ghost holds the plate open for you.',
      map: ['#######', '#S..a.#', '#.....#', '###A###', '#.....#', '#..E..#', '#######'] },
    { name: 'Two Hands', ticks: 12, ghosts: 2,
      hint: 'Two doors, two plates, and only one of you. Or is there?',
      map: ['#########', '#a..S..b#', '#.......#', '####A####', '#.......#', '####B####', '#...E...#', '#########'] },
    { name: 'Behind the Door', ticks: 12, ghosts: 2,
      hint: 'The blue plate is locked away. A ghost can open the way for another ghost.',
      map: ['#########', '#S.a#...#', '#...B.E.#', '#A#######', '#..b....#', '#########'] },
    { name: 'Chain Reaction', ticks: 14, ghosts: 3,
      hint: 'Three doors in a row. Plan who stands where, and when.',
      map: ['###########', '#a...S...b#', '#.........#', '#####A#####', '#c........#', '#####B#####', '#.........#', '#####C#####', '#....E....#', '###########'] },
    { name: 'Perfect Timing', ticks: 14, ghosts: 1,
      hint: 'The slashed door shuts while the pink plate is pressed. Your ghost has to step off at just the right moment.',
      map: ['##########', '#S..a....#', '######A###', '#E.1.....#', '##########'] },
  ];

  A.css('loop-css', `
    .lp-timeline { display: flex; gap: 3px; margin-top: 12px; }
    .lp-timeline i { flex: 1; height: 10px; border-radius: 3px; background: var(--grid); transition: background-color .2s, transform .2s; }
    .lp-timeline i.past { background: var(--accent); }
    .lp-timeline i.now { background: var(--gold); transform: scaleY(1.6); }
    .lp-controls { display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(3, 44px); gap: 6px; justify-content: center; }
    .lp-controls button { padding: 0; font-size: 20px; }
    .lp-controls [data-mv="U"] { grid-column: 2; grid-row: 1; } .lp-controls [data-mv="L"] { grid-column: 1; grid-row: 2; }
    .lp-controls [data-mv="W"] { grid-column: 2; grid-row: 2; font-size: 13px; } .lp-controls [data-mv="R"] { grid-column: 3; grid-row: 2; }
    .lp-controls [data-mv="D"] { grid-column: 2; grid-row: 3; }
    .lp-pad { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; align-items: center; margin-top: 14px; }
    .lp-pad .stack { display: flex; flex-direction: column; gap: 8px; }
    .lp-levels { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 20px; }
    .lp-level { flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; text-align: left; }
    .lp-level b { font-family: var(--font-display); font-weight: 400; font-size: 17px; }
    .lp-level span { font-weight: 400; font-size: 13px; color: var(--ink-soft); }
    .lp-level.done { box-shadow: 3px 3px 0 var(--shadow), inset 0 0 0 3px var(--good); }
    .lp-hint { text-align: center; color: var(--ink-soft); max-width: 46ch; margin: 10px auto 0; min-height: 3em; }
    .loop-art { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }
    .loop-art .ring { position: absolute; width: 96px; height: 96px; border-radius: 50%; border: 3px dashed #B794F6; animation: loop-spin 8s linear infinite; }
    .loop-art .fig { position: absolute; width: 18px; height: 24px; border-radius: 7px; border: 2.5px solid #1A2238; }
    .loop-art .fig.p { background: #FFFFFF; animation: loop-walk 3s ease-in-out infinite; }
    .loop-art .fig.g1 { background: #B794F6; opacity: .65; animation: loop-walk 3s ease-in-out -1s infinite; }
    .loop-art .fig.g2 { background: #5CE1E6; opacity: .45; animation: loop-walk 3s ease-in-out -2s infinite; }
    @keyframes loop-spin { to { transform: rotate(360deg); } }
    @keyframes loop-walk { 0% { transform: translate(-40px, 10px); } 33% { transform: translate(0, -30px); } 66% { transform: translate(40px, 10px); } 100% { transform: translate(-40px, 10px); } }
  `);

  function parse(level) {
    const grid = level.map.map(r => r.split(''));
    let start = null;
    grid.forEach((row, y) => row.forEach((ch, x) => { if (ch === 'S') { start = { x, y }; row[x] = '.'; } }));
    return { grid, start, cols: grid[0].length, rows: grid.length };
  }

  A.register({
    id: 'loop',
    section: 'original',
    title: 'Loop',
    color: 'stack',
    featured: true,
    artBg: '#141032',
    art: `<span class="loop-art" aria-hidden="true"><span class="ring"></span><span class="fig g2"></span><span class="fig g1"></span><span class="fig p"></span></span>`,
    blurb: 'A time-loop puzzle. Every time you loop, a ghost of your last run replays your exact steps. Team up with your past selves to hold doors open and escape.',
    tags: ['Original', 'Puzzle', 'Time travel'],
    best() { const d = A.store.get('loop-done', []); return d.length ? `${d.length}/${LEVELS.length} solved` : null; },
    mount(el) {
      let raf = 0, g = null, ctx = null, cv = null;

      function menu() {
        cancelAnimationFrame(raf); g = null;
        const done = A.store.get('loop-done', []);
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">You are your own best teammate</h2>
            <p>Each loop gives you a few steps of time, shown in the bar at the top. Move with the arrow keys or W A S D (or the buttons), and press <b>Space</b> to wait a step.</p>
            <p>Press <b>Loop</b> (or Enter) to rewind time. The run you just made becomes a ghost that replays every step. Ghosts can stand on plates to hold doors open. Reach the glowing exit to solve the room.</p>
          </div>
          <div class="lp-levels">${LEVELS.map((L, i) => `
            <button class="btn lp-level ${done.includes(i) ? 'done' : ''}" data-level="${i}">
              <b>${i + 1}. ${L.name}</b><span>${L.ghosts} ghost${L.ghosts > 1 ? 's' : ''} · ${L.ticks} steps${done.includes(i) ? ' · solved' : ''}</span>
            </button>`).join('')}
          </div>`;
      }

      function start(li) {
        const L = LEVELS[li];
        const p = parse(L);
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Room</small><b>${li + 1}/${LEVELS.length}</b></div>
              <div class="stat"><small>Ghosts</small><b id="lp-ghosts">0/${L.ghosts}</b></div>
              <div class="stat"><small>Step</small><b id="lp-step">0/${L.ticks}</b></div>
            </div>
            <button class="btn small" data-act="menu">Rooms</button>
          </div>
          <div class="lp-timeline" id="lp-tl">${Array.from({ length: L.ticks }, () => '<i></i>').join('')}</div>`;
        ({ cv, ctx } = A.makeCanvas(el, VW, VH));
        cv.style.aspectRatio = `${VW} / ${VH}`;
        cv.style.width = 'min(100%, 440px, 58vh)';
        cv.style.background = '#0E0B26';
        el.insertAdjacentHTML('beforeend', `
          <p class="lp-hint" id="lp-hint">${L.hint}</p>
          <div class="lp-pad">
            <div class="lp-controls">
              <button class="btn" data-mv="U" aria-label="Up">↑</button>
              <button class="btn" data-mv="L" aria-label="Left">←</button>
              <button class="btn" data-mv="W" aria-label="Wait one step">wait</button>
              <button class="btn" data-mv="R" aria-label="Right">→</button>
              <button class="btn" data-mv="D" aria-label="Down">↓</button>
            </div>
            <div class="stack">
              <button class="btn primary" data-act="loop">⟲ Loop</button>
              <button class="btn small" data-act="retry">Retry this loop</button>
              <button class="btn small" data-act="undo">Remove last ghost</button>
            </div>
          </div>`);
        let sx = null, sy = null;
        cv.addEventListener('pointerdown', e => { e.preventDefault(); sx = e.clientX; sy = e.clientY; });
        cv.addEventListener('pointerup', e => {
          if (sx === null) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
          sx = null;
        });
        const cell = Math.floor(Math.min(VW / p.cols, (VH - 10) / p.rows));
        g = {
          li, L, ...p, cell, ox: Math.floor((VW - p.cols * cell) / 2), oy: Math.floor((VH - p.rows * cell) / 2),
          ghosts: [], record: [], tick: 0, won: false, busy: 0, rewind: 0, banner: L.name, bannerT: 1.8,
          doors: {}, last: performance.now(), time: 0, fx: A.particles(),
        };
        for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
          const ch = g.grid[y][x];
          if (/[ABC1]/.test(ch)) g.doors[x + ',' + y] = { open: isOpen(ch, x, y) ? 1 : 0 };
        }
        newLoop(false);
        raf = requestAnimationFrame(frame);
      }

      const entities = () => [...g.ghosts, g.player].filter(Boolean);
      const pressed = plate => entities().some(e => g.grid[e.y][e.x] === plate);
      function isOpen(ch, x, y) {
        const someoneThere = g.player && entities().some(e => e.x === x && e.y === y);
        if (someoneThere) return true; // doors never close on anyone
        if (ch === '1') return !pressed('a');
        return pressed(ch.toLowerCase());
      }
      function blocked(x, y) {
        const ch = g.grid[y] && g.grid[y][x];
        if (!ch || ch === '#') return true;
        if (/[ABC1]/.test(ch)) return !isOpen(ch, x, y);
        return false;
      }

      function newLoop(saveGhost) {
        if (saveGhost) {
          const path = g.record.concat(Array(g.L.ticks - g.record.length).fill('W'));
          g.ghosts.push({ path, x: g.start.x, y: g.start.y, rx: g.start.x, ry: g.start.y, color: GHOST_COLORS[g.ghosts.length], bump: 0, bdx: 0, bdy: 0 });
        }
        g.ghosts.forEach(gh => { gh.x = g.start.x; gh.y = g.start.y; });
        g.player = { x: g.start.x, y: g.start.y, rx: g.player ? g.player.rx : g.start.x, ry: g.player ? g.player.ry : g.start.y, bump: 0, bdx: 0, bdy: 0 };
        g.record = []; g.tick = 0; g.rewind = g.time > 0 ? 0.5 : 0;
        const sx = g.ox + (g.start.x + 0.5) * g.cell, sy = g.oy + (g.start.y + 0.5) * g.cell;
        if (saveGhost) {
          g.fx.burst(sx, sy, [g.ghosts[g.ghosts.length - 1].color, '#FFFFFF'], 24, { speed: 160, gravity: 0, size: 4 });
          g.fx.ring(sx, sy, g.ghosts[g.ghosts.length - 1].color, 60, 0.5);
        }
        hud();
      }

      function tryMove(e, a) {
        const [dx, dy] = DIRS[a];
        if (!dx && !dy) return;
        const nx = e.x + dx, ny = e.y + dy;
        if (blocked(nx, ny)) { e.bump = 0.18; e.bdx = dx; e.bdy = dy; return; }
        e.x = nx; e.y = ny;
      }

      function act(a) {
        if (!g || g.won || g.busy > 0 || g.tick >= g.L.ticks) return;
        g.tick++;
        // ghosts move first (oldest first), then you
        for (const gh of g.ghosts) tryMove(gh, gh.path[g.tick - 1] || 'W');
        const before = plateState();
        tryMove(g.player, a);
        g.record.push(a);
        const after = plateState();
        for (const k in after) if (after[k] && !before[k]) plateFx(k);
        hud();
        if (g.grid[g.player.y][g.player.x] === 'E') return win();
        if (g.tick >= g.L.ticks) {
          g.busy = 0.8;
          const canSave = g.ghosts.length < g.L.ghosts;
          g.banner = canSave ? 'Time’s up! Looping…' : 'Out of time. Try again'; g.bannerT = 1;
          setTimeout(() => { if (g && !g.won) { newLoop(canSave); } }, 750);
        }
      }

      function plateState() {
        const s = {};
        for (const k of ['a', 'b', 'c']) s[k] = pressed(k);
        return s;
      }
      function plateFx(k) {
        for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (g.grid[y][x] === k) {
          const px = g.ox + (x + 0.5) * g.cell, py = g.oy + (y + 0.5) * g.cell;
          g.fx.ring(px, py, PLATE_COLORS[k], g.cell * 0.9, 0.4);
          g.fx.burst(px, py, [PLATE_COLORS[k], '#FFFFFF'], 10, { speed: 100, gravity: 0, size: 3 });
        }
      }

      function hud() {
        el.querySelector('#lp-ghosts').textContent = `${g.ghosts.length}/${g.L.ghosts}`;
        el.querySelector('#lp-step').textContent = `${g.tick}/${g.L.ticks}`;
        el.querySelectorAll('#lp-tl i').forEach((n, i) => { n.className = i < g.tick - 1 ? 'past' : i === g.tick - 1 ? 'now' : ''; });
      }

      function win() {
        g.won = true;
        const done = A.store.get('loop-done', []);
        if (!done.includes(g.li)) A.store.set('loop-done', done.concat(g.li));
        const px = g.ox + (g.player.x + 0.5) * g.cell, py = g.oy + (g.player.y + 0.5) * g.cell;
        g.fx.burst(px, py, ['#7CFFB2', '#FFFFFF', '#B794F6', '#FFD866'], 50, { speed: 260, gravity: 0, size: 5, shape: 'confetti', life: 1 });
        g.banner = 'Room solved!'; g.bannerT = 99;
        A.confetti();
        const next = g.li + 1 < LEVELS.length;
        el.querySelector('#lp-hint').innerHTML = `Solved with ${g.ghosts.length} ghost${g.ghosts.length === 1 ? '' : 's'}. ${next
          ? '<button class="btn primary small" data-act="next">Next room →</button>'
          : 'That’s every room! More are on the way.'} <button class="btn small" data-act="menu">All rooms</button>`;
      }

      function frame(now) {
        if (!g) return;
        const dt = Math.min(0.033, (now - g.last) / 1000);
        g.last = now; g.time += dt;
        g.fx.update(dt);
        g.busy = Math.max(0, g.busy - dt);
        g.rewind = Math.max(0, g.rewind - dt);
        g.bannerT -= dt;
        const k = Math.min(1, dt * (g.rewind > 0 ? 7 : 16));
        for (const e of entities()) { e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; e.bump = Math.max(0, e.bump - dt); }
        for (const key in g.doors) {
          const [x, y] = key.split(',').map(Number);
          const target = isOpen(g.grid[y][x], x, y) ? 1 : 0;
          g.doors[key].open += (target - g.doors[key].open) * Math.min(1, dt * 12);
        }
        A.fxFrame(ctx, g.fx, draw);
        raf = requestAnimationFrame(frame);
      }

      function draw() {
        const { cell: C, ox, oy } = g, t = g.time;
        const bg = ctx.createLinearGradient(0, 0, 0, VH);
        bg.addColorStop(0, '#171340'); bg.addColorStop(1, '#0B0920');
        ctx.fillStyle = bg; ctx.fillRect(-20, -20, VW + 40, VH + 40);
        // floor and walls
        for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
          const ch = g.grid[y][x], px = ox + x * C, py = oy + y * C;
          if (ch === '#') {
            ctx.fillStyle = '#2B2560'; ctx.fillRect(px, py, C, C);
            ctx.fillStyle = '#3B3480'; ctx.fillRect(px, py, C, C - 6);
            ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(px, py, C, 3);
            continue;
          }
          ctx.fillStyle = (x + y) % 2 ? '#1E1A4A' : '#221D52'; ctx.fillRect(px, py, C, C);
          ctx.strokeStyle = 'rgba(183,148,246,.08)'; ctx.strokeRect(px + 0.5, py + 0.5, C - 1, C - 1);
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
          const ch = g.grid[y][x], cx = ox + (x + 0.5) * C, cy = oy + (y + 0.5) * C;
          if (ch === 'E') {
            for (let i = 0; i < 3; i++) {
              ctx.strokeStyle = `rgba(124,255,178,${0.8 - i * 0.2})`; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.arc(cx, cy, C * (0.18 + i * 0.1), t * (1.5 + i) + i * 2, t * (1.5 + i) + i * 2 + Math.PI * 1.3); ctx.stroke();
            }
            const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, C * 0.6);
            gr.addColorStop(0, 'rgba(124,255,178,.45)'); gr.addColorStop(1, 'rgba(124,255,178,0)');
            ctx.fillStyle = gr; ctx.fillRect(cx - C, cy - C, C * 2, C * 2);
          }
          if (/[abc]/.test(ch)) {
            const on = pressed(ch), col = PLATE_COLORS[ch];
            ctx.fillStyle = col; ctx.globalAlpha = on ? 0.9 : 0.35;
            ctx.beginPath(); ctx.arc(cx, cy, C * 0.32, 0, Math.PI * 2); ctx.fill();
            if (on) {
              const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, C * 0.8);
              gr.addColorStop(0, col + '88'); gr.addColorStop(1, col + '00');
              ctx.fillStyle = gr; ctx.fillRect(cx - C, cy - C, C * 2, C * 2);
            }
            ctx.globalAlpha = 1;
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // doors slide open into the walls beside them
        for (const key in g.doors) {
          const [x, y] = key.split(',').map(Number);
          const ch = g.grid[y][x], o = g.doors[key].open, px = ox + x * C, py = oy + y * C;
          const col = ch === '1' ? PLATE_COLORS.a : PLATE_COLORS[ch.toLowerCase()];
          const w = (C / 2) * (1 - o);
          ctx.fillStyle = col; ctx.globalAlpha = 0.9;
          ctx.fillRect(px, py + 3, w, C - 6); ctx.fillRect(px + C - w, py + 3, w, C - 6);
          ctx.globalAlpha = 1;
          if (o < 0.9) {
            ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(px + w - 1, py + 6); ctx.lineTo(px + w - 1, py + C - 6); ctx.moveTo(px + C - w + 1, py + 6); ctx.lineTo(px + C - w + 1, py + C - 6); ctx.stroke();
            if (ch === '1') { ctx.beginPath(); ctx.moveTo(px + 6, py + C - 6); ctx.lineTo(px + C - 6, py + 6); ctx.stroke(); }
          }
          ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + 0.5 * o; ctx.lineWidth = 1.5; ctx.strokeRect(px + 1.5, py + 1.5, C - 3, C - 3); ctx.globalAlpha = 1;
        }
        // where each ghost will step next
        ctx.setLineDash([3, 5]); ctx.lineWidth = 2;
        for (const gh of g.ghosts) {
          let x = gh.x, y = gh.y;
          ctx.strokeStyle = gh.color; ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(ox + (x + 0.5) * C, oy + (y + 0.5) * C);
          for (let i = g.tick; i < Math.min(g.L.ticks, g.tick + 5); i++) {
            const [dx, dy] = DIRS[gh.path[i]];
            if (g.grid[y + dy] && g.grid[y + dy][x + dx] !== '#') { x += dx; y += dy; }
            ctx.lineTo(ox + (x + 0.5) * C, oy + (y + 0.5) * C);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        // ghosts, then you
        const drawFig = (e, fill, alpha, label) => {
          const bob = Math.sin(t * 6 + (label || 0)) * 1.5;
          const b = e.bump > 0 ? Math.sin(e.bump / 0.18 * Math.PI) * C * 0.15 : 0;
          const cx = ox + (e.rx + 0.5) * C + e.bdx * b, cy = oy + (e.ry + 0.5) * C + e.bdy * b + bob;
          const w = C * 0.5, h = C * 0.62;
          ctx.globalAlpha = alpha;
          const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, C * 0.7);
          gr.addColorStop(0, fill + '66'); gr.addColorStop(1, fill + '00');
          ctx.fillStyle = gr; ctx.fillRect(cx - C, cy - C, C * 2, C * 2);
          ctx.fillStyle = fill; ctx.strokeStyle = '#0B0920'; ctx.lineWidth = 2.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, w * 0.45); else ctx.rect(cx - w / 2, cy - h / 2, w, h);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#0B0920';
          ctx.fillRect(cx - w * 0.22, cy - h * 0.12, w * 0.14, h * 0.18); ctx.fillRect(cx + w * 0.08, cy - h * 0.12, w * 0.14, h * 0.18);
          if (label) { ctx.font = `700 ${Math.round(C * 0.22)}px "Atkinson Hyperlegible", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + h * 0.32); ctx.textAlign = 'start'; }
          ctx.globalAlpha = 1;
        };
        g.ghosts.forEach((gh, i) => drawFig(gh, gh.color, 0.6, String(i + 1)));
        drawFig(g.player, '#FFFFFF', 1, '');
        // rewind effect when a new loop starts
        if (g.rewind > 0) {
          const k = g.rewind / 0.5;
          ctx.fillStyle = `rgba(183,148,246,${k * 0.25})`; ctx.fillRect(0, 0, VW, VH);
          ctx.strokeStyle = `rgba(255,255,255,${k * 0.25})`; ctx.lineWidth = 1;
          for (let y = (t * 400) % 12; y < VH; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
          ctx.font = '400 26px Bungee, "Arial Black", sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillText('⟲ LOOP ' + (g.ghosts.length + 1), VW / 2, VH / 2);
          ctx.textAlign = 'start';
        }
        if (g.bannerT > 0) {
          ctx.globalAlpha = Math.min(1, g.bannerT * 2);
          ctx.textAlign = 'center'; ctx.font = '400 20px Bungee, "Arial Black", sans-serif';
          ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = '#B794F6'; ctx.shadowBlur = 14;
          ctx.fillText(g.banner, VW / 2, Math.max(28, oy - 8));
          ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'start';
        }
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.level) return start(Number(b.dataset.level));
        if (b.dataset.act === 'menu') return menu();
        if (!g) return;
        if (b.dataset.mv) act(b.dataset.mv);
        else if (b.dataset.act === 'next') start(g.li + 1);
        else if (b.dataset.act === 'loop' && !g.won) {
          if (g.ghosts.length >= g.L.ghosts) { g.banner = 'No ghosts left. Remove one or retry'; g.bannerT = 1.6; return; }
          if (!g.record.length) { g.banner = 'Move first, then loop'; g.bannerT = 1.2; return; }
          newLoop(true);
        } else if (b.dataset.act === 'retry' && !g.won) newLoop(false);
        else if (b.dataset.act === 'undo' && !g.won && g.ghosts.length) { g.ghosts.pop(); newLoop(false); }
      };
      const KEYS = { ArrowUp: 'U', w: 'U', ArrowDown: 'D', s: 'D', ArrowLeft: 'L', a: 'L', ArrowRight: 'R', d: 'R', ' ': 'W' };
      const onKey = e => {
        if (!g || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (KEYS[k]) { e.preventDefault(); act(KEYS[k]); }
        else if (k === 'Enter' || k === 'l') { e.preventDefault(); el.querySelector('[data-act="loop"]')?.click(); }
        else if (k === 'r') el.querySelector('[data-act="retry"]')?.click();
        else if (k === 'Backspace' || k === 'u') { e.preventDefault(); el.querySelector('[data-act="undo"]')?.click(); }
      };
      document.addEventListener('keydown', onKey);
      menu();
      return () => { cancelAnimationFrame(raf); g = null; document.removeEventListener('keydown', onKey); };
    },
  });
})();
