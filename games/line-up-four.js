/* Line Up Four: pass-and-play or vs the computer. Drop discs into columns; first to line up four wins. */
(function () {
  const A = Arcade;
  const COLS = 7, ROWS = 6;
  const ORDER = [3, 2, 4, 1, 5, 0, 6]; // center-first search order
  const AI = {
    easy: { depth: 2, random: 0.35 },
    medium: { depth: 4, random: 0.08 },
    hard: { depth: 6, random: 0 },
  };

  A.css('l4-css', `
    .disc { width: 22px; height: 22px; border-radius: 50%; display: inline-block; flex: none; }
    .disc.p1, .l4-cell.p1 { background: radial-gradient(circle at 35% 30%, #ffd6d7 0 10%, #ff6b70 34%, #b3263a 100%); box-shadow: 0 0 14px #ff6b7088, inset 0 -3px 6px #0004; }
    .disc.p2, .l4-cell.p2 { background: radial-gradient(circle at 35% 30%, #fff6d0 0 10%, #ffd04a 34%, #c48a0a 100%); box-shadow: 0 0 14px #ffd04a88, inset 0 -3px 6px #0004; }
    .l4-status { display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; font-size: 20px; min-height: 36px; margin-top: 16px; text-align: center; }
    .l4-board {
      display: grid; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)); gap: clamp(4px, 1.4vw, 10px);
      padding: clamp(10px, 2vw, 16px); border-radius: 22px; max-width: 540px; margin: 34px auto 0; position: relative;
      background: radial-gradient(ellipse at 30% 0%, #6f8cff 0, transparent 60%), linear-gradient(160deg, #3d55c9, #23307e 70%, #1a2263);
      box-shadow: 0 24px 50px #0008, inset 0 2px 0 #ffffff33, inset 0 -6px 0 #0003;
    }
    .l4-board::after { content: ''; position: absolute; left: 6%; right: 6%; bottom: -14px; height: 14px; border-radius: 0 0 14px 14px; background: linear-gradient(#1a2263, #10164a); z-index: -1; }
    .l4-col { display: grid; grid-template-rows: repeat(${ROWS}, auto); gap: clamp(4px, 1.4vw, 10px); padding: 3px; border: 0; background: none; cursor: pointer; border-radius: 14px; position: relative; transition: background-color .15s; }
    .l4-col:hover, .l4-col:focus-visible { background: #ffffff14; }
    .l4-col:focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; }
    .l4-col:disabled { cursor: default; background: none; }
    .l4-col kbd { position: absolute; top: -28px; left: 50%; transform: translateX(-50%); font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); }
    .l4-cell { aspect-ratio: 1 / 1; border-radius: 50%; background: radial-gradient(circle at 50% 70%, #0d1030, #070920); box-shadow: inset 0 4px 8px #000a, 0 1px 0 #ffffff22; position: relative; }
    .l4-col:not(:disabled):hover .l4-cell.next::after { content: ''; position: absolute; inset: 8%; border-radius: 50%; background: var(--ghost); opacity: .35; box-shadow: 0 0 14px var(--ghost); }
    .l4-cell.drop { animation: l4-drop .42s cubic-bezier(.45, 0, .9, 1.25); }
    .l4-cell.win { animation: l4-win 1s ease-in-out infinite; z-index: 1; }
    @keyframes l4-win { 50% { transform: scale(1.12); box-shadow: 0 0 26px 6px #ffffffaa, inset 0 -3px 6px #0004; } }
    @keyframes l4-drop { 0% { transform: translateY(calc(var(--fall) * -114%)); } 75% { transform: translateY(0); } 88% { transform: translateY(-12%); } 100% { transform: none; } }
    .l4-score { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    .l4-score .stat { display: flex; align-items: center; gap: 10px; transition: box-shadow .2s, border-color .2s; }
    .l4-score .stat.turn { border-color: var(--lime); box-shadow: 0 0 0 1px var(--lime), 0 0 20px #cbf56a33; }
    .l4-thinking { animation: l4-blink 1s ease infinite; }
    @keyframes l4-blink { 50% { opacity: .45; } }
  `);

  // ---------- board helpers (board[r][c], r = 0 is the top row; values 0, 1 or null) ----------
  const lowestRow = (b, c) => { for (let r = ROWS - 1; r >= 0; r--) if (b[r][c] === null) return r; return -1; };
  const isFull = b => b[0].every(v => v !== null);

  function lineFrom(b, r, c, dr, dc, who) {
    const cells = [{ r, c }];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === who) {
        cells.push({ r: rr, c: cc }); rr += dr * s; cc += dc * s;
      }
    }
    return cells;
  }
  function winsAt(b, r, c, who) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) if (lineFrom(b, r, c, dr, dc, who).length >= 4) return true;
    return false;
  }

  // all 69 windows of four cells, precomputed
  const WINDOWS = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * 3, ec = c + dc * 3;
      if (er >= 0 && er < ROWS && ec >= 0 && ec < COLS) WINDOWS.push([0, 1, 2, 3].map(k => [r + dr * k, c + dc * k]));
    }
  }
  function evaluate(b, me) {
    const opp = 1 - me;
    let score = 0;
    for (let r = 0; r < ROWS; r++) { if (b[r][3] === me) score += 3; else if (b[r][3] === opp) score -= 3; }
    for (const w of WINDOWS) {
      let m = 0, o = 0;
      for (const [r, c] of w) { const v = b[r][c]; if (v === me) m++; else if (v === opp) o++; }
      if (m && o) continue;
      if (m === 3) score += 6; else if (m === 2) score += 2;
      if (o === 3) score -= 8; else if (o === 2) score -= 2;
    }
    return score;
  }
  // negamax with alpha-beta; returns score from the view of `who` (the player about to move)
  function negamax(b, depth, alpha, beta, who) {
    if (isFull(b)) return 0;
    if (depth === 0) return evaluate(b, who);
    let best = -Infinity;
    for (const c of ORDER) {
      const r = lowestRow(b, c);
      if (r < 0) continue;
      b[r][c] = who;
      const val = winsAt(b, r, c, who) ? 100000 + depth : -negamax(b, depth - 1, -beta, -alpha, 1 - who);
      b[r][c] = null;
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function chooseMove(board, who, level) {
    const b = board.map(row => row.slice());
    const cfg = AI[level];
    const valid = ORDER.filter(c => lowestRow(b, c) >= 0);
    if (Math.random() < cfg.random) return valid[A.rand(0, valid.length - 1)];
    let bestCol = valid[0], best = -Infinity;
    for (const c of valid) {
      const r = lowestRow(b, c);
      b[r][c] = who;
      const val = winsAt(b, r, c, who) ? 1e6 : -negamax(b, cfg.depth - 1, -Infinity, Infinity, 1 - who);
      b[r][c] = null;
      if (val > best) { best = val; bestCol = c; }
    }
    return bestCol;
  }

  A.register({
    id: 'line-up-four',
    section: 'strategy',
    title: 'Line Up Four',
    color: 'math',
    foot: '1 or 2 players',
    art: `<span style="display:grid;grid-template-columns:repeat(4,24px);gap:5px;padding:8px;background:linear-gradient(160deg,#3d55c9,#1a2263);border-radius:12px;box-shadow:0 10px 24px #0006">
      ${['', '', '', 'p2', '', '', 'p2', 'p1', '', 'p2', 'p1', 'p1', 'p2', 'p1', 'p1', 'p2'].map(c =>
        `<span style="width:24px;height:24px;border-radius:50%;background:${c === 'p1' ? 'radial-gradient(circle at 35% 30%,#ffd6d7 0 10%,#ff6b70 34%,#b3263a)' : c === 'p2' ? 'radial-gradient(circle at 35% 30%,#fff6d0 0 10%,#ffd04a 34%,#c48a0a)' : '#0b0e2a'};${c ? 'box-shadow:0 0 8px ' + (c === 'p1' ? '#ff6b70' : '#ffd04a') : 'box-shadow:inset 0 3px 5px #000'}"></span>`).join('')}
    </span>`,
    blurb: 'Take turns dropping discs into the grid. Get four in a row across, up and down, or diagonally. Play a friend or the computer.',
    tags: ['Strategy', '1–2 players', 'Turns'],
    mount(el) {
      let mode = A.store.get('l4-mode', '2p');
      let board, turn, starter = 0, over = false, busy = false, winCells = [], last = null, aiTimer = null;
      let score = [0, 0, 0]; // red, yellow, ties

      const isAI = () => mode !== '2p';
      const names = () => ['Red', isAI() ? 'Computer' : 'Yellow'];

      function newRound() {
        clearTimeout(aiTimer);
        board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
        turn = starter; over = false; winCells = []; last = null; busy = false;
        draw('turn');
        maybeAI();
      }

      function draw(mode2) {
        const n = names();
        const cls = ['p1', 'p2'][turn];
        const aiTurn = isAI() && turn === 1 && !over;
        let status;
        if (mode2 === 'win') status = `<span class="disc ${cls}"></span> ${turn === 1 && isAI() ? 'The computer wins this round.' : n[turn] + ' wins this round!'}`;
        else if (mode2 === 'draw') status = 'The board is full. It’s a tie!';
        else if (aiTurn) status = `<span class="disc p2"></span> <span class="l4-thinking">Computer is thinking…</span>`;
        else status = `<span class="disc ${cls}"></span> ${isAI() ? 'Your turn' : n[turn] + '’s turn'}`;
        el.innerHTML = `
          ${A.modePicker(mode)}
          <div class="l4-score">
            <div class="stat ${!over && turn === 0 ? 'turn' : ''}"><span class="disc p1"></span><span><small>${isAI() ? 'You' : 'Red'}</small><b>${score[0]}</b></span></div>
            <div class="stat"><span><small>Ties</small><b>${score[2]}</b></span></div>
            <div class="stat ${!over && turn === 1 ? 'turn' : ''}"><span class="disc p2"></span><span><small>${n[1]}</small><b>${score[1]}</b></span></div>
          </div>
          <div class="l4-status" aria-live="polite">${status}</div>
          <div class="l4-board">
            ${Array.from({ length: COLS }, (_, c) => `
              <button class="l4-col" data-col="${c}" ${over || aiTurn || board[0][c] !== null ? 'disabled' : ''} aria-label="Column ${c + 1}">
                <kbd>${c + 1}</kbd>
                ${Array.from({ length: ROWS }, (_, r) => {
                  const v = board[r][c];
                  const isLast = last && last.r === r && last.c === c;
                  const isWin = winCells.some(w => w.r === r && w.c === c);
                  const isNext = v === null && r === lowestRow(board, c);
                  return `<span class="l4-cell ${v === null ? '' : ['p1', 'p2'][v]} ${isLast ? 'drop' : ''} ${isWin ? 'win' : ''} ${isNext ? 'next' : ''}" style="--fall:${r + 1};--ghost:${turn ? '#ffd04a' : '#ff6b70'}"></span>`;
                }).join('')}
              </button>`).join('')}
          </div>
          <div class="row" style="margin-top:20px">
            ${over ? '<button class="btn primary" data-act="next">Next round</button>' : ''}
            <button class="btn small" data-act="reset">Reset scores</button>
          </div>
          <p class="best" style="text-align:center;margin:14px 0 0">Tap a column or press keys 1 to 7. The loser of each round goes first in the next.${isAI() ? ' You are Red.' : ''}</p>`;
        if (over) el.querySelector('[data-act="next"]').focus();
      }

      function place(c) {
        const r = lowestRow(board, c);
        if (r < 0) return false;
        board[r][c] = turn;
        last = { r, c };
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const cells = lineFrom(board, r, c, dr, dc, turn);
          if (cells.length >= 4) winCells.push(...cells);
        }
        if (winCells.length) {
          over = true; score[turn]++; starter = 1 - turn; draw('win');
          const colors = turn ? [A.color('gold'), '#FFFFFF'] : [A.color('p1'), '#FFFFFF'];
          setTimeout(() => el.querySelectorAll('.l4-cell.win').forEach(cell => A.domBurst(cell, colors, 8)), 380);
          if (!isAI() || turn === 0) setTimeout(() => A.confetti(), 300);
        } else if (isFull(board)) {
          over = true; score[2]++; starter = 1 - starter; draw('draw');
        } else {
          turn = 1 - turn; draw('turn'); maybeAI();
        }
        return true;
      }

      function humanPlay(c) {
        if (over || busy || c < 0 || c >= COLS) return;
        if (isAI() && turn === 1) return;
        if (place(c)) { busy = true; setTimeout(() => { busy = false; }, 250); }
      }

      function maybeAI() {
        if (!isAI() || over || turn !== 1) return;
        const level = mode;
        // wait a moment so the "thinking" status and the last drop are visible
        aiTimer = setTimeout(() => {
          if (over || turn !== 1 || mode !== level) return;
          place(chooseMove(board, 1, level));
        }, 550);
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.mode) {
          if (b.dataset.mode === mode) return;
          mode = b.dataset.mode; A.store.set('l4-mode', mode);
          score = [0, 0, 0]; starter = 0; newRound();
        } else if (b.dataset.col !== undefined) humanPlay(Number(b.dataset.col));
        else if (b.dataset.act === 'next') newRound();
        else if (b.dataset.act === 'reset') { score = [0, 0, 0]; starter = 0; newRound(); }
      };
      const onKey = e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key >= '1' && e.key <= String(COLS)) { e.preventDefault(); humanPlay(Number(e.key) - 1); }
      };
      document.addEventListener('keydown', onKey);
      newRound();
      return () => { clearTimeout(aiTimer); document.removeEventListener('keydown', onKey); };
    },
  });
})();
