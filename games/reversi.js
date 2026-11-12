/* Reversi: place a disc to trap your opponent's discs in a line and flip them to your color. Most discs wins. */
(function () {
  const A = Arcade;
  const N = 8;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [5, -2, -1, -1, -1, -1, -2, 5],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100],
  ];

  A.css('rv-css', `
    .rv-board {
      display: grid; grid-template-columns: repeat(${N}, minmax(0, 1fr)); gap: 2px; padding: 12px;
      background: linear-gradient(145deg, #5a3a24, #2e1c10); border-radius: 20px; max-width: 500px; margin: 18px auto 0;
      box-shadow: 0 24px 50px #0008, inset 0 2px 0 #ffffff22, inset 0 -4px 0 #0005;
    }
    .rv-cell {
      aspect-ratio: 1 / 1; border: 0; padding: 0; border-radius: 3px; position: relative; cursor: default; display: grid; place-items: center;
      background: radial-gradient(ellipse at 50% 30%, #2f9a6e, #1b6a4a); box-shadow: inset 0 0 0 1px #0003, inset 0 1px 0 #ffffff1a;
    }
    .rv-cell:nth-child(${N * 2 + 3}), .rv-cell:nth-child(${N * 2 + 7}), .rv-cell:nth-child(${N * 6 + 3}), .rv-cell:nth-child(${N * 6 + 7}) { background: radial-gradient(circle at 0 0, #0006 0 3px, transparent 4px), radial-gradient(ellipse at 50% 30%, #2f9a6e, #1b6a4a); }
    .rv-cell.can { cursor: pointer; }
    .rv-cell.can::after { content: ""; width: 24%; aspect-ratio: 1; border-radius: 50%; background: var(--lime); opacity: .5; box-shadow: 0 0 10px var(--lime); transition: transform .15s, opacity .15s; }
    .rv-cell.can:hover::after { opacity: .95; transform: scale(1.5); }
    .rv-cell.can:hover::before { content: attr(data-n); position: absolute; top: -4px; right: -2px; z-index: 2; font: 700 11px var(--font-mono); color: #17192b; background: var(--lime); border-radius: 99px; padding: 1px 5px; pointer-events: none; }
    .rv-cell:focus-visible { outline: 3px solid var(--lime); outline-offset: -2px; }
    .rv-disc { width: 82%; aspect-ratio: 1; border-radius: 50%; box-shadow: 0 4px 6px #0007, inset 0 -3px 5px #0004; }
    .rv-disc.p1 { background: radial-gradient(circle at 35% 30%, #ffd6d7 0 9%, #ff6b70 32%, #b3263a 100%); }
    .rv-disc.p2 { background: radial-gradient(circle at 35% 30%, #fff6d0 0 9%, #ffd04a 32%, #c48a0a 100%); }
    .rv-disc.flip { animation: rv-flip .5s cubic-bezier(.3, .7, .4, 1) backwards; }
    .rv-disc.placed { animation: rv-place .35s cubic-bezier(.3, 1.6, .5, 1); }
    .rv-cell.last { box-shadow: inset 0 0 0 2px #ffffffaa, 0 0 14px #ffffff55; }
    @keyframes rv-flip { 0% { transform: perspective(200px) rotateY(0) translateY(0); } 50% { transform: perspective(200px) rotateY(90deg) translateY(-18%); filter: brightness(1.5); } 100% { transform: perspective(200px) rotateY(0); } }
    @keyframes rv-place { from { transform: scale(1.6) translateY(-30%); opacity: 0; } to { transform: none; opacity: 1; } }
  `);

  // ---------- rules ----------
  function start() {
    const b = Array.from({ length: N }, () => new Array(N).fill(null));
    b[3][3] = 1; b[4][4] = 1; b[3][4] = 0; b[4][3] = 0;
    return b;
  }
  function flipsFor(b, r, c, who) {
    if (b[r][c] !== null) return [];
    const out = [];
    for (const [dr, dc] of DIRS) {
      const run = [];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === 1 - who) { run.push([rr, cc]); rr += dr; cc += dc; }
      if (run.length && rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr][cc] === who) out.push(...run);
    }
    return out;
  }
  function validMoves(b, who) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const f = flipsFor(b, r, c, who);
      if (f.length) out.push({ r, c, flips: f });
    }
    return out;
  }
  function applyMove(b, m, who) { b[m.r][m.c] = who; for (const [r, c] of m.flips) b[r][c] = who; }
  const countOf = (b, who) => b.flat().filter(v => v === who).length;
  const copy = b => b.map(r => r.slice());

  // ---------- computer ----------
  function evaluate(b, me) {
    let score = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (b[r][c] === me) score += WEIGHTS[r][c]; else if (b[r][c] === 1 - me) score -= WEIGHTS[r][c];
    }
    return score + 4 * (validMoves(b, me).length - validMoves(b, 1 - me).length);
  }
  function negamax(b, depth, alpha, beta, who) {
    const mine = validMoves(b, who);
    if (depth === 0) return evaluate(b, who);
    if (!mine.length) {
      if (!validMoves(b, 1 - who).length) return (countOf(b, who) - countOf(b, 1 - who)) * 1000; // game over
      return -negamax(b, depth - 1, -beta, -alpha, 1 - who); // pass
    }
    let best = -Infinity;
    for (const m of mine) {
      const t = copy(b); applyMove(t, m, who);
      const val = -negamax(t, depth - 1, -beta, -alpha, 1 - who);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseMove(b, who, level) {
    const ms = validMoves(b, who);
    if (level === 'easy') {
      // mostly random, sometimes greedy for the most flips
      if (Math.random() < 0.6) return ms[Math.floor(Math.random() * ms.length)];
      return ms.reduce((a, m) => (m.flips.length > a.flips.length ? m : a));
    }
    if (level === 'medium') {
      let best = null, bv = -Infinity;
      for (const m of ms) { const v = WEIGHTS[m.r][m.c] + m.flips.length + Math.random() * 6; if (v > bv) { bv = v; best = m; } }
      return best;
    }
    // hard: corners first in move order helps pruning
    const ordered = ms.slice().sort((a, b2) => WEIGHTS[b2.r][b2.c] - WEIGHTS[a.r][a.c]);
    let best = ordered[0], bv = -Infinity;
    for (const m of ordered) {
      const t = copy(b); applyMove(t, m, who);
      const v = -negamax(t, 3, -Infinity, Infinity, 1 - who);
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  A.register({
    id: 'reversi',
    section: 'strategy',
    title: 'Reversi',
    color: 'memory',
    foot: '1 or 2 players',
    art: `<span style="display:grid;grid-template-columns:repeat(4,28px);gap:2px;padding:7px;background:linear-gradient(145deg,#5a3a24,#2e1c10);border-radius:10px;box-shadow:0 10px 24px #0006">
      ${['', 'p2', '', '', '', 'p1', 'p2', '', 'p2', 'p1', 'p1', '', '', '', 'p1', ''].map(v =>
        `<span style="width:28px;height:28px;border-radius:2px;background:radial-gradient(ellipse at 50% 30%,#2f9a6e,#1b6a4a);display:grid;place-items:center">${v
          ? `<span style="width:22px;height:22px;border-radius:50%;box-shadow:0 3px 4px #0007;background:${v === 'p1' ? 'radial-gradient(circle at 35% 30%,#ffd6d7 0 9%,#ff6b70 32%,#b3263a)' : 'radial-gradient(circle at 35% 30%,#fff6d0 0 9%,#ffd04a 32%,#c48a0a)'}"></span>` : ''}</span>`).join('')}
    </span>`,
    blurb: 'Trap your opponent’s discs between yours to flip them to your color. Corners are gold. Whoever owns the most discs at the end wins.',
    tags: ['Strategy', '1–2 players', 'Classic'],
    mount(el) {
      let mode = A.store.get('rv-mode', 'medium');
      let board, turn, over, last, flipped = [], aiTimer = null, note = '';
      let wins = [0, 0];
      const isAI = () => mode !== '2p';
      const names = () => (isAI() ? ['You', 'Computer'] : ['Red', 'Yellow']);

      function newGame() {
        clearTimeout(aiTimer);
        board = start(); turn = 0; over = false; last = null; flipped = []; note = '';
        draw();
      }

      function draw() {
        const n = names();
        const c0 = countOf(board, 0), c1 = countOf(board, 1);
        const humanTurn = !over && !(isAI() && turn === 1);
        const canMap = new Map(humanTurn ? validMoves(board, turn).map(m => [m.r * N + m.c, m]) : []);
        let status;
        if (over) {
          if (c0 === c1) status = `It’s a tie, ${c0} to ${c1}!`;
          else {
            const w = c0 > c1 ? 0 : 1;
            status = isAI() ? (w === 0 ? `You win, ${c0} to ${c1}!` : `The computer wins, ${c1} to ${c0}.`) : `${n[w]} wins, ${Math.max(c0, c1)} to ${Math.min(c0, c1)}!`;
          }
        } else if (isAI() && turn === 1) status = '<span class="l4-thinking">Computer is thinking…</span>';
        else status = `<span class="disc ${turn ? 'p2' : 'p1'}"></span> ${isAI() ? 'Your turn' : n[turn] + '’s turn'}`;

        el.innerHTML = `
          ${A.modePicker(mode)}
          <div class="l4-score">
            <div class="stat ${!over && turn === 0 ? 'turn' : ''}"><span class="disc p1"></span><span><small>${n[0]}</small><b>${c0}</b></span></div>
            <div class="stat"><span><small>Games won</small><b>${wins[0]}–${wins[1]}</b></span></div>
            <div class="stat ${!over && turn === 1 ? 'turn' : ''}"><span class="disc p2"></span><span><small>${n[1]}</small><b>${c1}</b></span></div>
          </div>
          <div class="l4-status" aria-live="polite">${status}</div>
          ${note ? `<p class="feedback" style="margin:4px 0 0">${note}</p>` : ''}
          <div class="rv-board">
            ${board.map((row, r) => row.map((v, c) => {
              const can = canMap.has(r * N + c);
              const isLast = last && last.r === r && last.c === c;
              const fi = flipped.findIndex(([fr, fc]) => fr === r && fc === c);
              const wasFlipped = fi !== -1;
              // flips ripple outward one after another
              const disc = v === null ? '' : `<span class="rv-disc ${v ? 'p2' : 'p1'} ${wasFlipped ? 'flip' : ''} ${isLast ? 'placed' : ''}" ${wasFlipped ? `style="animation-delay:${fi * 60}ms"` : ''}></span>`;
              return `<button class="rv-cell ${can ? 'can' : ''} ${isLast ? 'last' : ''}" data-cell="${r}-${c}" ${can ? `data-n="+${canMap.get(r * N + c).flips.length}"` : ''} ${can ? '' : 'tabindex="-1"'}
                aria-label="Row ${r + 1}, column ${c + 1}${v === null ? (can ? ', you can play here' : ', empty') : ', ' + n[v]}">${disc}</button>`;
            }).join('')).join('')}
          </div>
          <div class="row" style="margin-top:18px">
            ${over ? '<button class="btn primary" data-act="new">Play again</button>' : '<button class="btn small" data-act="new">Restart</button>'}
          </div>
          <p class="best" style="text-align:center;margin:12px 0 0">Light dots show where you can play. Your move must trap at least one of your opponent’s discs in a straight line.${isAI() ? ' You are Red and go first.' : ''}</p>`;
        if (over) el.querySelector('[data-act="new"]').focus();
      }

      function play(m) {
        applyMove(board, m, turn);
        last = { r: m.r, c: m.c }; flipped = m.flips; note = '';
        const next = 1 - turn;
        if (validMoves(board, next).length) turn = next;
        else if (validMoves(board, turn).length) note = `${names()[next] === 'You' ? 'You have' : names()[next] + ' has'} no moves, so ${names()[turn] === 'You' ? 'you go' : names()[turn] + ' goes'} again.`;
        else {
          over = true;
          const c0 = countOf(board, 0), c1 = countOf(board, 1);
          if (c0 !== c1) wins[c0 > c1 ? 0 : 1]++;
          if (c0 !== c1 && (!isAI() || c0 > c1)) setTimeout(() => A.confetti(), 500);
        }
        draw();
        maybeAI();
      }

      function maybeAI() {
        if (!isAI() || over || turn !== 1) return;
        const level = mode;
        aiTimer = setTimeout(() => {
          if (over || turn !== 1 || mode !== level) return;
          play(chooseMove(board, 1, level));
        }, 600);
      }

      el.onclick = e => {
        const cell = e.target.closest('[data-cell]');
        if (cell) {
          if (over || (isAI() && turn === 1)) return;
          const [r, c] = cell.dataset.cell.split('-').map(Number);
          const f = flipsFor(board, r, c, turn);
          if (f.length) play({ r, c, flips: f });
          return;
        }
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.mode && b.dataset.mode !== mode) {
          mode = b.dataset.mode; A.store.set('rv-mode', mode); wins = [0, 0]; newGame();
        } else if (b.dataset.act === 'new') newGame();
      };
      newGame();
      return () => clearTimeout(aiTimer);
    },
  });
})();
