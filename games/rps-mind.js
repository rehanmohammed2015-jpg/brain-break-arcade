/* Rock Paper Scissors: Mind Reader. The computer studies your habits and tries to predict your next throw.
   Or play a friend: both pick in secret (keys A S D and J K L), then the hands are revealed together. */
(function () {
  const A = Arcade;
  const MOVES = ['rock', 'paper', 'scissors'];
  const HAND = { rock: '✊', paper: '✋', scissors: '✌️' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
  const TARGET = 5;
  const WINS = 'rps-wins';

  A.css('rps-css', `
    .rps-arena { position: relative; margin: 18px auto 0; width: min(100%, 640px); border-radius: 22px; overflow: hidden; padding: 18px 16px 20px;
      background: radial-gradient(ellipse at 50% 0%, #3a2f6e 0, transparent 60%), linear-gradient(180deg, #1d1f42, #14152e); border: 1px solid var(--line-strong); box-shadow: 0 20px 50px #0007; }
    .rps-arena::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: linear-gradient(transparent, #ffffff26, transparent); }
    .rps-sides { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
    .rps-side { text-align: center; }
    .rps-side small { font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }
    .rps-pips { display: flex; justify-content: center; gap: 5px; margin: 6px 0 4px; }
    .rps-pips i { width: 12px; height: 12px; border-radius: 50%; background: #ffffff14; border: 1px solid #ffffff22; transition: background-color .3s, box-shadow .3s; }
    .rps-pips i.on { background: var(--who); border-color: transparent; box-shadow: 0 0 10px var(--who); }
    .rps-hand { font-size: clamp(64px, 16vw, 110px); line-height: 1.1; display: inline-block; filter: drop-shadow(0 12px 18px #0008); user-select: none; }
    .rps-side.left .rps-hand { transform: scaleX(-1) rotate(-12deg); }
    .rps-side.right .rps-hand { transform: rotate(-12deg); }
    .rps-arena.pumping .rps-side.left .rps-hand { animation: rps-pump-l .36s ease-in-out 3; }
    .rps-arena.pumping .rps-side.right .rps-hand { animation: rps-pump-r .36s ease-in-out 3; }
    @keyframes rps-pump-l { 50% { transform: scaleX(-1) rotate(-12deg) translateY(-26px) rotate(-14deg); } }
    @keyframes rps-pump-r { 50% { transform: rotate(-12deg) translateY(-26px) rotate(14deg); } }
    .rps-arena.reveal .rps-hand { animation: pop .35s ease; }
    .rps-side.won .rps-hand { filter: drop-shadow(0 0 22px var(--who)) drop-shadow(0 12px 18px #0008); }
    .rps-side.lost .rps-hand { opacity: .45; }
    .rps-vs { font-family: var(--font-mono); font-weight: 500; font-size: 13px; color: var(--ink-soft); }
    .rps-call { text-align: center; font-weight: 700; font-size: clamp(20px, 4.5vw, 28px); letter-spacing: -.02em; min-height: 40px; margin-top: 8px; }
    .rps-call.go { color: var(--lime); }
    .rps-picks { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
    .rps-picks.solo { grid-template-columns: 1fr; }
    .rps-pad { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .rps-btn { width: 84px; height: 84px; border-radius: 20px; border: 1px solid var(--line-strong); background: linear-gradient(145deg, #2a2d57, #1f2144); font-size: 38px;
      cursor: pointer; display: grid; place-items: center; position: relative; transition: transform .15s, box-shadow .15s; }
    .rps-btn:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 0 0 1px var(--who), 0 10px 26px #0006; }
    .rps-btn:disabled { cursor: default; opacity: .5; }
    .rps-btn kbd { position: absolute; bottom: 4px; right: 7px; font: 500 10px var(--font-mono); color: var(--ink-soft); }
    .rps-btn.locked { opacity: 1; background: color-mix(in srgb, var(--who) 30%, #1f2144); }
    .rps-pad-label { text-align: center; font-family: var(--font-mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--who); margin-bottom: 8px; }
    .rps-mind { margin: 18px auto 0; width: min(100%, 640px); display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: center; font-size: 14px; }
    .rps-meter { height: 10px; border-radius: 99px; background: #ffffff12; overflow: hidden; }
    .rps-meter i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--lime), #ffd878 50%, #ff6b7a); transition: width .5s ease; }
    .rps-tip { grid-column: 1 / -1; color: var(--ink-soft); font-size: 13px; }
  `);

  // ---------- the mind reader: several pattern detectors compete; the best recent one is trusted ----------
  function makeBrain() {
    const hist = []; // {me, them, res} me = player's move, res = 'w' | 'l' | 't' from player's view
    const models = {
      freq: () => { const c = { rock: 0, paper: 0, scissors: 0 }; hist.slice(-12).forEach(h => c[h.me]++); return maxKey(c); },
      after1: () => {
        if (hist.length < 2) return null;
        const last = hist[hist.length - 1].me, c = { rock: 0, paper: 0, scissors: 0 };
        for (let i = 1; i < hist.length; i++) if (hist[i - 1].me === last) c[hist[i].me]++;
        return maxKey(c, true);
      },
      after2: () => {
        if (hist.length < 3) return null;
        const a = hist[hist.length - 2].me, b = hist[hist.length - 1].me, c = { rock: 0, paper: 0, scissors: 0 };
        for (let i = 2; i < hist.length; i++) if (hist[i - 2].me === a && hist[i - 1].me === b) c[hist[i].me]++;
        return maxKey(c, true);
      },
      // people often repeat after a win and switch after a loss
      mood: () => {
        if (hist.length < 2) return null;
        const last = hist[hist.length - 1], c = { rock: 0, paper: 0, scissors: 0 };
        for (let i = 1; i < hist.length; i++) if (hist[i - 1].res === last.res) {
          // what did they do relative to their previous move: same, up (to what beats it), down
          const rel = relOf(hist[i - 1].me, hist[i].me);
          c[applyRel(last.me, rel)]++;
        }
        return maxKey(c, true);
      },
      // counter the computer's last move (a common habit)
      beatLast: () => (hist.length ? COUNTER[hist[hist.length - 1].them] : null),
    };
    const score = { freq: 0, after1: 0, after2: 0, mood: 0, beatLast: 0 };
    let lastPreds = {};
    function maxKey(c, needData) {
      let best = null, n = -1, total = 0;
      for (const k of MOVES) { total += c[k]; if (c[k] > n) { n = c[k]; best = k; } }
      return needData && total === 0 ? null : best;
    }
    return {
      // returns { move, predicted } for the computer's throw
      think(level) {
        lastPreds = {};
        for (const k in models) lastPreds[k] = models[k]();
        if (level === 'easy' || hist.length < 2) return { move: MOVES[A.rand(0, 2)], predicted: null };
        let pick;
        if (level === 'medium') pick = lastPreds.after1 || lastPreds.freq;
        else {
          let bestK = null, bestS = -Infinity;
          for (const k in models) if (lastPreds[k] && score[k] > bestS) { bestS = score[k]; bestK = k; }
          pick = lastPreds[bestK];
        }
        // medium sometimes just guesses, so it can be beaten
        if (!pick || (level === 'medium' && Math.random() < 0.35)) return { move: MOVES[A.rand(0, 2)], predicted: null };
        return { move: COUNTER[pick], predicted: pick };
      },
      learn(me, them, res) {
        for (const k in lastPreds) if (lastPreds[k]) score[k] = score[k] * 0.8 + (lastPreds[k] === me ? 1 : -0.4);
        hist.push({ me, them, res });
      },
      habit() {
        // the strongest habit, put into words for the tip
        if (hist.length < 4) return null;
        const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
        if (score[best] < 1) return null;
        return {
          freq: 'You throw one move a lot. Mix it up!',
          after1: 'Your next throw depends on your last one. The computer noticed.',
          after2: 'You fall into little patterns of two throws.',
          mood: 'You change your throw depending on whether you just won or lost.',
          beatLast: 'You keep throwing what beats the computer’s last move.',
        }[best];
      },
    };
  }
  function relOf(a, b) { return a === b ? 0 : COUNTER[a] === b ? 1 : 2; }
  function applyRel(a, r) { return r === 0 ? a : r === 1 ? COUNTER[a] : BEATS[a]; }
  function outcome(a, b) { return a === b ? 't' : BEATS[a] === b ? 'w' : 'l'; }

  A.register({
    id: 'rps-mind',
    section: 'strategy',
    isNew: true,
    title: 'Rock Paper Mind Reader',
    color: 'stack',
    foot: '1 or 2 players',
    art: `<span style="display:flex;align-items:center;gap:6px;font-size:54px"><span style="transform:scaleX(-1) rotate(-14deg)">✊</span><span style="font-size:22px;font-family:var(--font-mono);color:#e7ddff">vs</span><span style="transform:rotate(-14deg)">✌️</span></span>`,
    blurb: 'The computer studies your habits and tries to predict your next throw. Stay unpredictable to beat it, or play a friend with secret picks.',
    tags: ['Mind game', '1–2 players', 'Learns you'],
    best() { const w = A.store.get(WINS, 0); return w ? w + ' matches won' : null; },
    mount(el) {
      let mode = A.store.get('rps-mode', 'hard');
      let brain, sc, picks, busy, over, round, read, history, timers = [];
      const isAI = () => mode !== '2p';
      const names = () => (isAI() ? ['You', 'Computer'] : ['Player 1', 'Player 2']);
      const WHO = ['#78e5dc', '#ff77b7'];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));

      function newMatch() {
        timers.forEach(clearTimeout); timers = [];
        brain = makeBrain(); sc = [0, 0]; picks = [null, null]; busy = false; over = false; round = 0; read = 0; history = [];
        draw('Pick your throw', ['✊', '✊']);
      }

      function pad(p, keys) {
        const lock = busy || over || picks[p] != null;
        return `<div style="--who:${WHO[p]}">
          ${isAI() ? '' : `<div class="rps-pad-label">${names()[p]} · ${picks[p] ? 'locked in 🔒' : 'pick in secret'}</div>`}
          <div class="rps-pad">${MOVES.map((m, i) =>
            `<button class="rps-btn ${picks[p] && !isAI() ? 'locked' : ''}" data-p="${p}" data-m="${m}" ${lock ? 'disabled' : ''} aria-label="${names()[p]}: ${m}">${!isAI() && picks[p] ? '❔' : HAND[m]}<kbd>${keys[i]}</kbd></button>`).join('')}</div></div>`;
      }

      function draw(call, hands, cls = '', res = null) {
        const n = names();
        const pct = round ? Math.round(read / round * 100) : 0;
        const tip = isAI() && round >= 4 ? (brain.habit() || 'No clear pattern yet. Nice and random!') : '';
        el.innerHTML = `
          ${A.modePicker(mode)}
          <div class="rps-arena ${cls}" id="rps-arena">
            <div class="rps-sides">
              <div class="rps-side left ${res === 'w' ? 'won' : res === 'l' ? 'lost' : ''}" style="--who:${WHO[0]}">
                <small>${n[0]}</small><div class="rps-pips">${pips(sc[0])}</div><span class="rps-hand">${hands[0]}</span></div>
              <span class="rps-vs">vs</span>
              <div class="rps-side right ${res === 'l' ? 'won' : res === 'w' ? 'lost' : ''}" style="--who:${WHO[1]}">
                <small>${n[1]}</small><div class="rps-pips">${pips(sc[1])}</div><span class="rps-hand">${hands[1]}</span></div>
            </div>
            <div class="rps-call ${/SHOOT/.test(call) ? 'go' : ''}" aria-live="polite">${call}</div>
          </div>
          ${over ? `<div class="row" style="margin-top:18px"><button class="btn primary" data-act="new">Rematch</button></div>` :
            `<div class="rps-picks ${isAI() ? 'solo' : ''}">${pad(0, isAI() ? ['1', '2', '3'] : ['A', 'S', 'D'])}${isAI() ? '' : pad(1, ['J', 'K', 'L'])}</div>`}
          ${isAI() ? `<div class="rps-mind">
            <span>Mind read</span><div class="rps-meter" title="How often the computer guessed your throw"><i style="width:${pct}%"></i></div>
            <span class="rps-tip">${round ? `The computer guessed your throw ${read} of ${round} times (${pct}%). About 33% is pure luck.` : `First to ${TARGET} wins. The computer starts out guessing, then learns.`} ${tip}</span>
          </div>` : `<p class="best" style="text-align:center;margin-top:14px">First to ${TARGET}. Both players pick, then the hands are revealed together. Player 1 uses A S D, Player 2 uses J K L, or tap.</p>`}`;
        if (over) el.querySelector('[data-act="new"]').focus();
      }
      const pips = k => Array.from({ length: TARGET }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('');

      function choose(p, m) {
        if (busy || over || picks[p] != null) return;
        if (isAI() && p !== 0) return;
        picks[p] = m;
        A.sound.play('click');
        if (isAI()) {
          const t = brain.think(mode);
          picks[1] = t.move; picks.pred = t.predicted;
        }
        if (picks[0] && picks[1]) shoot();
        else draw(`${names()[p]} is locked in. ${names()[1 - p]}, your pick!`, ['✊', '✊']);
      }

      function shoot() {
        busy = true;
        const words = ['Rock…', 'Paper…', 'Scissors…'];
        draw(words[0], ['✊', '✊'], 'pumping');
        A.sound.play('blip');
        later(() => { setCall(words[1]); A.sound.play('blip'); }, 360);
        later(() => { setCall(words[2]); A.sound.play('blip'); }, 720);
        later(reveal, 1090);
      }
      function setCall(t) { const c = el.querySelector('.rps-call'); if (c) c.textContent = t; }

      function reveal() {
        const [a, b] = picks, res = outcome(a, b), n = names();
        round++;
        if (isAI() && picks.pred === a) read++;
        if (isAI()) brain.learn(a, b, res);
        if (res === 'w') sc[0]++; else if (res === 'l') sc[1]++;
        history.push(res);
        let call = res === 't' ? 'SHOOT! It’s a tie.' : `SHOOT! ${res === 'w' ? n[0] : n[1]} ${res === 'w' && isAI() ? 'win' : 'wins'} the round.`;
        if (sc[0] >= TARGET || sc[1] >= TARGET) {
          over = true;
          const p1 = sc[0] >= TARGET;
          call = isAI() ? (p1 ? 'You beat the mind reader! 🧠✨' : 'The mind reader wins. Be less predictable!') : `${p1 ? n[0] : n[1]} wins the match! 🏆`;
          if (p1 || !isAI()) { setTimeout(() => A.confetti(), 300); if (isAI()) A.store.set(WINS, A.store.get(WINS, 0) + 1); }
          else A.sound.play('lose');
        } else A.sound.play(res === 't' ? 'thud' : res === 'w' ? 'coin' : 'swish');
        draw(call, [HAND[a], HAND[b]], 'reveal', res);
        const winSide = res === 'w' ? '.rps-side.left' : res === 'l' ? '.rps-side.right' : null;
        if (winSide) A.domBurst(el.querySelector(winSide), [res === 'w' ? WHO[0] : WHO[1], '#ffffff', '#ffd878'], 10);
        picks = [null, null];
        if (!over) later(() => { busy = false; draw('Pick your throw', [HAND[a], HAND[b]], '', res); }, 1300);
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.m) choose(+b.dataset.p, b.dataset.m);
        else if (b.dataset.mode && b.dataset.mode !== mode) { mode = b.dataset.mode; A.store.set('rps-mode', mode); newMatch(); }
        else if (b.dataset.act === 'new') newMatch();
      };
      const onKey = e => {
        if (e.repeat) return;
        const k = e.key.toLowerCase();
        if (isAI()) { const i = '123'.indexOf(k); if (i >= 0 && k) choose(0, MOVES[i]); return; }
        let i = 'asd'.indexOf(k); if (i >= 0 && k) return choose(0, MOVES[i]);
        i = 'jkl'.indexOf(k); if (i >= 0 && k) choose(1, MOVES[i]);
      };
      document.addEventListener('keydown', onKey);
      newMatch();
      return () => { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
    },
  });
})();
