/* Dots & Boxes: take turns drawing lines. Close a box to claim it and go again. Most boxes wins. */
(function () {
  const A = Arcade;
  const N = 5;               // boxes per side (6 x 6 dots)
  const PAD = 26, GAP = 64, SIZE = PAD * 2 + GAP * N;

  A.css('db-css', `
    .db-svg { display: block; width: min(100%, 480px); height: auto; margin: 18px auto 0; touch-action: manipulation; user-select: none; overflow: visible;
      background: radial-gradient(ellipse at 50% 0%, #2c2f62, #15173a 75%); border-radius: 22px; border: 1px solid var(--line-strong); box-shadow: 0 24px 50px #0007; }
    .db-ghost { stroke: #ffffff1c; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 2 9; transition: stroke .12s; }
    .db-line { cursor: pointer; }
    .db-line:hover .db-ghost, .db-line:focus-visible .db-ghost { stroke: #ffffff88; stroke-dasharray: none; }
    .db-line:focus-visible { outline: none; }
    .db-line.locked { cursor: default; }
    .db-line.locked:hover .db-ghost { stroke: #ffffff1c; stroke-dasharray: 2 9; }
    .db-hit { stroke: transparent; stroke-width: 24; }
    .db-drawn { stroke-width: 7; stroke-linecap: round; }
    .db-drawn.p1 { stroke: #ff6b70; filter: drop-shadow(0 0 5px #ff6b70); } .db-drawn.p2 { stroke: #ffd04a; filter: drop-shadow(0 0 5px #ffd04a); }
    .db-drawn.last { stroke-width: 9; stroke-dasharray: 64; animation: db-draw .25s ease-out; }
    @keyframes db-draw { from { stroke-dashoffset: 64; } to { stroke-dashoffset: 0; } }
    .db-box.new + .db-mark { animation: pop .4s ease .1s backwards; transform-box: fill-box; transform-origin: center; }
    .db-box.p1 { fill: #ff6b70; } .db-box.p2 { fill: #ffd04a; }
    .db-box { opacity: .3; }
    .db-box.new { animation: db-claim .6s ease; transform-box: fill-box; transform-origin: center; }
    @keyframes db-claim { 0% { opacity: .9; transform: scale(.4); } 60% { opacity: .65; transform: scale(1.08); } 100% { opacity: .3; transform: none; } }
    .db-dot { fill: #f7f4ff; filter: drop-shadow(0 0 4px #ffffff88); }
    .db-mark { font-family: var(--font-display); font-weight: 700; font-size: 22px; fill: #f7f4ff; text-anchor: middle; dominant-baseline: central; }
  `);

  // ---------- game state helpers ----------
  function fresh() {
    return {
      h: Array.from({ length: N + 1 }, () => new Array(N).fill(-1)), // horizontal lines: who drew it (-1 none)
      v: Array.from({ length: N }, () => new Array(N + 1).fill(-1)), // vertical lines
      box: Array.from({ length: N }, () => new Array(N).fill(-1)),
    };
  }
  const clone = s => ({ h: s.h.map(r => r.slice()), v: s.v.map(r => r.slice()), box: s.box.map(r => r.slice()) });
  const sides = (s, r, c) => (s.h[r][c] >= 0) + (s.h[r + 1][c] >= 0) + (s.v[r][c] >= 0) + (s.v[r][c + 1] >= 0);
  function touched(m) {
    const out = [];
    if (m.t === 'h') { if (m.r > 0) out.push([m.r - 1, m.c]); if (m.r < N) out.push([m.r, m.c]); }
    else { if (m.c > 0) out.push([m.r, m.c - 1]); if (m.c < N) out.push([m.r, m.c]); }
    return out;
  }
  function moves(s) {
    const out = [];
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) if (s.h[r][c] < 0) out.push({ t: 'h', r, c });
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) if (s.v[r][c] < 0) out.push({ t: 'v', r, c });
    return out;
  }
  // draws the line; returns the boxes it completed
  function apply(s, m, who) {
    (m.t === 'h' ? s.h : s.v)[m.r][m.c] = who;
    const done = [];
    for (const [r, c] of touched(m)) if (sides(s, r, c) === 4 && s.box[r][c] < 0) { s.box[r][c] = who; done.push([r, c]); }
    return done;
  }
  const completes = (s, m) => touched(m).some(([r, c]) => sides(s, r, c) === 3);
  const givesAway = (s, m) => touched(m).some(([r, c]) => sides(s, r, c) === 2);
  // how many boxes the opponent can grab in a row after move m
  function sacrifice(s, m, who) {
    const t = clone(s);
    apply(t, m, who);
    let count = 0, guard = 0;
    for (;;) {
      const take = moves(t).find(x => completes(t, x));
      if (!take || guard++ > 60) break;
      count += apply(t, take, 1 - who).length;
    }
    return count;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function aiMove(s, who, level) {
    const all = moves(s);
    const take = all.filter(m => completes(s, m));
    const safe = all.filter(m => !completes(s, m) && !givesAway(s, m));
    if (level === 'easy') {
      if (take.length && Math.random() < 0.6) return pick(take);
      if (safe.length && Math.random() < 0.5) return pick(safe);
      return pick(all);
    }
    if (take.length) return pick(take);
    if (safe.length) return pick(safe);
    if (level === 'medium') return pick(all);
    // hard: give away the smallest chain possible
    let best = null, bestN = Infinity;
    for (const m of all) { const n = sacrifice(s, m, who); if (n < bestN) { bestN = n; best = m; } }
    return best;
  }

  A.register({
    id: 'dots-boxes',
    section: 'strategy',
    title: 'Dots & Boxes',
    color: 'dash',
    foot: '1 or 2 players',
    art: `<svg width="150" height="104" viewBox="0 0 150 104" aria-hidden="true">
      <rect x="22" y="14" width="40" height="40" fill="#ffd04a" opacity=".35"/>
      <rect x="62" y="54" width="40" height="40" fill="#ff6b70" opacity=".35"/>
      <path d="M22 14 h40 v40 h-40 z" fill="none" stroke="#ffd04a" stroke-width="5" stroke-linecap="round" style="filter:drop-shadow(0 0 4px #ffd04a)"/>
      <path d="M62 54 h40 v40 h-40 M102 14 v40 M102 14 h40" fill="none" stroke="#ff6b70" stroke-width="5" stroke-linecap="round" style="filter:drop-shadow(0 0 4px #ff6b70)"/>
      ${[22, 62, 102, 142].map(x => [14, 54, 94].map(y => `<circle cx="${x}" cy="${y}" r="5" fill="#f7f4ff"/>`).join('')).join('')}
    </svg>`,
    blurb: 'Take turns drawing lines between dots. Close a box to claim it and go again. Careful: the third side hands your opponent a box.',
    tags: ['Strategy', '1–2 players', 'Classic'],
    mount(el) {
      let mode = A.store.get('db-mode', '2p');
      let s, turn, over, last, fresh2 = [], aiTimer = null, starter = 0;
      let wins = [0, 0];

      const isAI = () => mode !== '2p';
      const names = () => (isAI() ? ['You', 'Computer'] : ['Red', 'Yellow']);
      const count = who => s.box.flat().filter(b => b === who).length;

      function newGame() {
        clearTimeout(aiTimer);
        s = fresh(); turn = starter; over = false; last = null; fresh2 = [];
        draw();
        maybeAI();
      }

      function lineEl(t, r, c) {
        const x1 = PAD + c * GAP, y1 = PAD + r * GAP;
        const x2 = t === 'h' ? x1 + GAP : x1, y2 = t === 'h' ? y1 : y1 + GAP;
        const who = (t === 'h' ? s.h : s.v)[r][c];
        if (who >= 0) {
          const isLast = last && last.t === t && last.r === r && last.c === c;
          return `<line class="db-drawn ${who ? 'p2' : 'p1'} ${isLast ? 'last' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }
        const locked = over || (isAI() && turn === 1);
        return `<g class="db-line ${locked ? 'locked' : ''}" data-m="${t}-${r}-${c}" tabindex="${locked ? -1 : 0}" role="button" aria-label="${t === 'h' ? 'Horizontal' : 'Vertical'} line, row ${r + 1}, column ${c + 1}">
          <line class="db-ghost" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
          <line class="db-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
        </g>`;
      }

      function draw() {
        const n = names();
        const c0 = count(0), c1 = count(1);
        let status;
        if (over) {
          const w = c0 > c1 ? 0 : 1;
          status = isAI() ? (w === 0 ? `You win, ${c0} to ${c1}!` : `The computer wins, ${c1} to ${c0}.`) : `${n[w]} wins, ${Math.max(c0, c1)} to ${Math.min(c0, c1)}!`;
        } else if (isAI() && turn === 1) status = '<span class="l4-thinking">Computer is thinking…</span>';
        else status = isAI() ? 'Your turn' : `${n[turn]}’s turn`;
        let svg = `<svg class="db-svg" viewBox="0 0 ${SIZE} ${SIZE}" role="group" aria-label="Dots and boxes board">`;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const b = s.box[r][c];
          if (b >= 0) {
            const isNew = fresh2.some(([fr, fc]) => fr === r && fc === c);
            svg += `<rect class="db-box ${b ? 'p2' : 'p1'} ${isNew ? 'new' : ''}" x="${PAD + c * GAP + 5}" y="${PAD + r * GAP + 5}" width="${GAP - 10}" height="${GAP - 10}" rx="6"/>`;
            svg += `<text class="db-mark" x="${PAD + c * GAP + GAP / 2}" y="${PAD + r * GAP + GAP / 2}">${isAI() ? (b ? 'C' : 'Y') : (b ? 'Y' : 'R')}</text>`;
          }
        }
        for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) svg += lineEl('h', r, c);
        for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) svg += lineEl('v', r, c);
        for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) svg += `<circle class="db-dot" cx="${PAD + c * GAP}" cy="${PAD + r * GAP}" r="6"/>`;
        svg += '</svg>';

        el.innerHTML = `
          ${A.modePicker(mode)}
          <div class="l4-score">
            <div class="stat ${!over && turn === 0 ? 'turn' : ''}"><span class="disc p1"></span><span><small>${n[0]}</small><b>${c0}</b></span></div>
            <div class="stat"><span><small>Games won</small><b>${wins[0]}–${wins[1]}</b></span></div>
            <div class="stat ${!over && turn === 1 ? 'turn' : ''}"><span class="disc p2"></span><span><small>${n[1]}</small><b>${c1}</b></span></div>
          </div>
          <div class="l4-status" aria-live="polite">${status}</div>
          ${svg}
          <div class="row" style="margin-top:18px">
            ${over ? '<button class="btn primary" data-act="new">Play again</button>' : '<button class="btn small" data-act="new">Restart</button>'}
          </div>
          <p class="best" style="text-align:center;margin:12px 0 0">Tap between two dots to draw a line. Finish a box and you go again. ${N * N} boxes in all.</p>`;
        if (over) el.querySelector('[data-act="new"]').focus();
      }

      function play(m) {
        const done = apply(s, m, turn);
        last = m; fresh2 = done;
        if (moves(s).length === 0) {
          over = true;
          const w = count(0) > count(1) ? 0 : 1;
          wins[w]++; starter = 1 - starter;
          if (!isAI() || w === 0) setTimeout(() => A.confetti(), 250);
        } else if (!done.length) turn = 1 - turn;
        draw();
        maybeAI();
      }

      function maybeAI() {
        if (!isAI() || over || turn !== 1) return;
        const level = mode;
        aiTimer = setTimeout(() => {
          if (over || turn !== 1 || mode !== level) return;
          play(aiMove(s, 1, level));
        }, 480);
      }

      function humanMove(key) {
        if (over || (isAI() && turn === 1)) return;
        const [t, r, c] = key.split('-');
        const m = { t, r: +r, c: +c };
        if ((t === 'h' ? s.h : s.v)[m.r][m.c] >= 0) return;
        play(m);
      }

      el.onclick = e => {
        const ln = e.target.closest('[data-m]');
        if (ln) return humanMove(ln.dataset.m);
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.mode && b.dataset.mode !== mode) {
          mode = b.dataset.mode; A.store.set('db-mode', mode); wins = [0, 0]; starter = 0; newGame();
        } else if (b.dataset.act === 'new') newGame();
      };
      el.onkeydown = e => {
        const ln = e.target.closest && e.target.closest('[data-m]');
        if (ln && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); humanMove(ln.dataset.m); }
      };
      newGame();
      return () => clearTimeout(aiTimer);
    },
  });
})();
