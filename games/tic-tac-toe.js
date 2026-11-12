/* Tic-Tac-Toe with a twist: "Vanish" mode keeps only your 3 newest marks, so there are no draws.
   Play a friend on the same screen, or a computer that searches every move ahead. */
(function () {
  const A = Arcade;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const WINS = 'ttt-wins';

  A.css('ttt-css', `
    .ttt-top { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; justify-content: space-between; }
    .ttt-variant { display: flex; gap: 6px; flex-wrap: wrap; }
    .ttt-score { display: flex; justify-content: center; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .ttt-score .stat { display: flex; align-items: center; gap: 10px; transition: border-color .2s, box-shadow .2s; }
    .ttt-score .stat.turn { border-color: var(--who); box-shadow: 0 0 0 1px var(--who), 0 0 22px color-mix(in srgb, var(--who) 35%, transparent); }
    .ttt-score .mk { font-size: 24px; font-weight: 700; color: var(--who); width: 22px; text-align: center; }
    .ttt-status { text-align: center; font-weight: 700; font-size: 18px; margin-top: 14px; min-height: 28px; }
    .ttt-wrap { position: relative; width: min(100%, 380px); margin: 14px auto 0; }
    .ttt-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 12px; border-radius: 22px;
      background: radial-gradient(ellipse at 50% 30%, #2b2f5c, #15172f 75%); border: 1px solid var(--line-strong); box-shadow: 0 20px 50px #0007, inset 0 0 40px #78e5dc0d; }
    .ttt-cell { aspect-ratio: 1; border: 1px solid #ffffff14; border-radius: 16px; background: linear-gradient(145deg, #262a50, #1c1f3d); cursor: pointer; padding: 14%;
      display: grid; place-items: center; transition: transform .12s, background-color .15s, box-shadow .15s; position: relative; }
    .ttt-cell:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 0 0 1px var(--hover, #ffffff33), 0 8px 20px #0005; }
    .ttt-cell:disabled { cursor: default; }
    .ttt-cell:focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; }
    .ttt-cell svg { width: 100%; height: 100%; overflow: visible; }
    .ttt-cell .x, .ttt-cell .o { fill: none; stroke-width: 11; stroke-linecap: round; }
    .ttt-cell .x { stroke: #78e5dc; filter: drop-shadow(0 0 8px #78e5dc88); }
    .ttt-cell .o { stroke: #ff77b7; filter: drop-shadow(0 0 8px #ff77b788); }
    .ttt-cell.new .x, .ttt-cell.new .o { stroke-dasharray: 260; animation: ttt-draw .35s ease-out backwards; }
    .ttt-cell.new .x:nth-child(2) { animation-delay: .12s; }
    @keyframes ttt-draw { from { stroke-dashoffset: 260; } to { stroke-dashoffset: 0; } }
    .ttt-cell.fading svg { opacity: .32; animation: ttt-blink 1.1s ease-in-out infinite; }
    .ttt-cell.fading::after { content: 'next to vanish'; position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-family: var(--font-mono); font-size: 9px; letter-spacing: .5px; text-transform: uppercase; color: var(--ink-soft); }
    @keyframes ttt-blink { 50% { opacity: .14; } }
    .ttt-cell.poof::before { content: ''; position: absolute; inset: 18%; border-radius: 50%; border: 3px solid #ffffff88; animation: ttt-poof .45s ease-out forwards; }
    @keyframes ttt-poof { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
    .ttt-cell.win { background: linear-gradient(145deg, #2f3a5a, #253052); }
    .ttt-line { position: absolute; inset: 12px; pointer-events: none; overflow: visible; }
    .ttt-line line { stroke: #f7f4ff; stroke-width: 7; stroke-linecap: round; filter: drop-shadow(0 0 10px #fff); stroke-dasharray: 400; animation: ttt-draw2 .4s ease-out .1s backwards; }
    @keyframes ttt-draw2 { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
    .ttt-think { display: inline-flex; gap: 4px; margin-left: 6px; vertical-align: middle; }
    .ttt-think i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: bob .7s ease-in-out infinite; }
    .ttt-think i:nth-child(2) { animation-delay: .12s; } .ttt-think i:nth-child(3) { animation-delay: .24s; }
  `);

  const xSvg = '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="x" d="M18 18 L82 82"/><path class="x" d="M82 18 L18 82"/></svg>';
  const oSvg = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="o" cx="50" cy="50" r="34"/></svg>';

  function winLine(c) {
    for (const l of LINES) if (c[l[0]] != null && c[l[0]] === c[l[1]] && c[l[1]] === c[l[2]]) return l;
    return null;
  }
  // place a mark; in Vanish mode the player's oldest mark disappears once they have 4
  function apply(st, i, p, vanish) {
    const c = st.c.slice(), q = [st.q[0].slice(), st.q[1].slice()];
    c[i] = p; q[p].push(i);
    let gone = -1;
    if (vanish && q[p].length > 3) { gone = q[p].shift(); c[gone] = null; }
    return { c, q, gone };
  }
  // negamax search: positive = good for player p
  function search(st, p, depth, vanish, memo) {
    if (depth === 0) return 0;
    const key = st.c.map(v => (v == null ? '-' : v)).join('') + st.q[0].join('') + '|' + st.q[1].join('') + p + depth;
    if (memo.has(key)) return memo.get(key);
    let best = -Infinity, any = false;
    for (let i = 0; i < 9; i++) {
      if (st.c[i] != null) continue;
      any = true;
      const ns = apply(st, i, p, vanish);
      const w = winLine(ns.c);
      const sc = w ? 100 + depth : -search(ns, 1 - p, depth - 1, vanish, memo);
      if (sc > best) best = sc;
    }
    if (!any) best = 0;
    memo.set(key, best);
    return best;
  }
  function aiMove(st, p, vanish, level) {
    const empty = []; for (let i = 0; i < 9; i++) if (st.c[i] == null) empty.push(i);
    if (empty.length === 9) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)]; // any corner or the center is a fine opener
    const memo = new Map(), depth = vanish ? 8 : 9;
    const scored = empty.map(i => {
      const ns = apply(st, i, p, vanish);
      return { i, s: winLine(ns.c) ? 1000 : -search(ns, 1 - p, depth - 1, vanish, memo) };
    });
    const top = Math.max(...scored.map(m => m.s));
    const bestMoves = scored.filter(m => m.s === top);
    const sharp = level === 'hard' ? 1 : level === 'medium' ? 0.72 : 0.3;
    // even easy grabs an instant win most of the time
    const instant = scored.filter(m => m.s === 1000);
    if (instant.length && (level !== 'easy' || Math.random() < 0.7)) return instant[0].i;
    if (Math.random() < sharp) return bestMoves[Math.floor(Math.random() * bestMoves.length)].i;
    return empty[Math.floor(Math.random() * empty.length)];
  }

  A.register({
    id: 'tic-tac-toe',
    section: 'strategy',
    isNew: true,
    title: 'Tic-Tac-Toe Vanish',
    color: 'memory',
    foot: '1 or 2 players',
    art: `<svg width="150" height="110" viewBox="0 0 150 110" aria-hidden="true" style="overflow:visible">
      <g stroke="#ffffff55" stroke-width="4" stroke-linecap="round"><path d="M57 10v90M93 10v90M22 43h106M22 77h106"/></g>
      <g fill="none" stroke-width="8" stroke-linecap="round">
        <path d="M30 18l18 18M48 18l-18 18" stroke="#78e5dc" style="filter:drop-shadow(0 0 6px #78e5dc)"/>
        <circle cx="75" cy="60" r="11" stroke="#ff77b7" style="filter:drop-shadow(0 0 6px #ff77b7)"/>
        <path d="M102 84l18 18M120 84l-18 18" stroke="#78e5dc" style="filter:drop-shadow(0 0 6px #78e5dc)"/>
        <circle cx="111" cy="27" r="11" stroke="#ff77b7" opacity=".3"/>
      </g></svg>`,
    blurb: 'Classic three in a row, plus Vanish mode: you only keep your 3 newest marks, so the board never fills up. Can you beat a computer that thinks every move ahead?',
    tags: ['Strategy', '1–2 players', 'Twist mode'],
    best() { const w = A.store.get(WINS, 0); return w ? w + ' wins vs computer' : null; },
    mount(el) {
      let mode = A.store.get('ttt-mode', 'medium');
      let vanish = A.store.get('ttt-vanish', true);
      let st, turn, over, lastMove = -1, poof = -1, line = null, starter = 0, aiTimer = null, moves = 0;
      let wins = [0, 0, 0]; // p1, p2, draws
      const isAI = () => mode !== '2p';
      const names = () => (isAI() ? ['You', 'Computer'] : ['Player X', 'Player O']);
      const WHO = ['#78e5dc', '#ff77b7'];

      function newGame() {
        clearTimeout(aiTimer);
        st = { c: new Array(9).fill(null), q: [[], []] };
        turn = starter; over = false; lastMove = -1; poof = -1; line = null; moves = 0;
        draw(); maybeAI();
      }

      function draw() {
        const n = names();
        // which mark vanishes next (for the player about to move)
        const fading = vanish && !over && st.q[turn].length === 3 ? st.q[turn][0] : -1;
        let status;
        if (over) {
          if (line) { const w = st.c[line[0]]; status = isAI() ? (w === 0 ? 'You win! 🎉' : 'The computer wins this one.') : `${n[w]} wins! 🎉`; }
          else status = 'It’s a draw. Try Vanish mode, it never draws!';
        } else if (isAI() && turn === 1) status = `Computer is thinking<span class="ttt-think"><i></i><i></i><i></i></span>`;
        else status = isAI() ? 'Your move' : `${n[turn]}’s move`;
        const cells = st.c.map((v, i) => {
          const cls = [i === lastMove ? 'new' : '', i === fading ? 'fading' : '', i === poof ? 'poof' : '', line && line.includes(i) ? 'win' : ''].join(' ');
          const lock = over || v != null || (isAI() && turn === 1);
          return `<button class="ttt-cell ${cls}" data-cell="${i}" ${lock ? 'disabled' : ''} style="--hover:${WHO[turn]}"
            aria-label="Square ${i + 1}${v == null ? ', empty' : v === 0 ? ', X' : ', O'}${i === fading ? ', vanishes next' : ''}">${v === 0 ? xSvg : v === 1 ? oSvg : ''}</button>`;
        }).join('');
        let lineSvg = '';
        if (line) {
          const pos = k => [(k % 3) * 33.33 + 16.67, Math.floor(k / 3) * 33.33 + 16.67];
          const [x1, y1] = pos(line[0]), [x2, y2] = pos(line[2]);
          lineSvg = `<svg class="ttt-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke"/></svg>`;
        }
        el.innerHTML = `
          <div class="ttt-top">
            <div class="ttt-variant mode-pick" role="radiogroup" aria-label="Rules" style="margin-top:0">
              <button class="mode-opt" role="radio" aria-checked="${!vanish}" data-variant="classic">Classic</button>
              <button class="mode-opt" role="radio" aria-checked="${vanish}" data-variant="vanish">Vanish (3 marks max)</button>
            </div>
          </div>
          ${A.modePicker(mode)}
          <div class="ttt-score">
            <div class="stat ${!over && turn === 0 ? 'turn' : ''}" style="--who:${WHO[0]}"><span class="mk">✕</span><span><small>${n[0]}</small><b>${wins[0]}</b></span></div>
            <div class="stat"><span><small>Draws</small><b>${wins[2]}</b></span></div>
            <div class="stat ${!over && turn === 1 ? 'turn' : ''}" style="--who:${WHO[1]}"><span class="mk">○</span><span><small>${n[1]}</small><b>${wins[1]}</b></span></div>
          </div>
          <div class="ttt-status" aria-live="polite">${status}</div>
          <div class="ttt-wrap"><div class="ttt-board" role="group" aria-label="Tic-tac-toe board">${cells}</div>${lineSvg}</div>
          <div class="row" style="margin-top:18px">
            ${over ? '<button class="btn primary" data-act="new">Play again</button>' : '<button class="btn small" data-act="new">Restart</button>'}
          </div>
          <p class="best" style="text-align:center;margin:12px auto 0;max-width:52ch">${vanish
            ? 'Vanish rules: when you place a 4th mark, your oldest one disappears. The blinking mark is the next to go. Keys 1–9 work too.'
            : 'Get three in a row across, down or corner to corner. Keys 1–9 work too.'}</p>`;
        if (over) { const b = el.querySelector('[data-act="new"]'); if (b) b.focus(); }
      }

      function play(i) {
        const ns = apply(st, i, turn, vanish);
        st = { c: ns.c, q: ns.q };
        lastMove = i; poof = ns.gone; moves++;
        A.sound.play(turn === 0 ? 'blip' : 'pop');
        line = winLine(st.c);
        if (line) {
          over = true; const w = st.c[line[0]];
          wins[w]++; starter = 1 - starter;
          if (!isAI() || w === 0) {
            setTimeout(() => A.confetti(), 300);
            if (isAI()) A.store.set(WINS, A.store.get(WINS, 0) + 1);
          } else A.sound.play('lose');
        } else if (st.c.every(v => v != null) || moves >= 60) {
          over = true; wins[2]++; starter = 1 - starter; A.sound.play('thud');
        } else turn = 1 - turn;
        draw();
        if (line) { const b = el.querySelector('.ttt-board'); if (b) A.domBurst(b, [WHO[st.c[line[0]]], '#ffffff', '#ffd878'], 14); }
        maybeAI();
      }

      function maybeAI() {
        if (!isAI() || over || turn !== 1) return;
        const level = mode;
        aiTimer = setTimeout(() => {
          if (over || turn !== 1 || mode !== level) return;
          play(aiMove(st, 1, vanish, level));
        }, 520);
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.cell != null) {
          const i = +b.dataset.cell;
          if (over || st.c[i] != null || (isAI() && turn === 1)) return;
          play(i);
        } else if (b.dataset.variant) {
          const v = b.dataset.variant === 'vanish';
          if (v !== vanish) { vanish = v; A.store.set('ttt-vanish', v); wins = [0, 0, 0]; starter = 0; newGame(); }
        } else if (b.dataset.mode && b.dataset.mode !== mode) {
          mode = b.dataset.mode; A.store.set('ttt-mode', mode); wins = [0, 0, 0]; starter = 0; newGame();
        } else if (b.dataset.act === 'new') newGame();
      };
      const onKey = e => {
        if (!/^[1-9]$/.test(e.key) || over || (isAI() && turn === 1)) return;
        // keypad layout: 7 8 9 on top
        const i = '789456123'.indexOf(e.key);
        if (st.c[i] == null) play(i);
      };
      document.addEventListener('keydown', onKey);
      newGame();
      return () => { clearTimeout(aiTimer); document.removeEventListener('keydown', onKey); };
    },
  });
})();
