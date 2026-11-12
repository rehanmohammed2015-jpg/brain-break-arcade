/* Reaction Duel: wait for GO, then hit your button first. Jump early and you give away the point.
   Play a friend on one screen, or the computer. */
(function () {
  const A = Arcade;
  const TARGET = 5;
  // computer reaction time (ms, mean ± spread) and chance of falling for the fake-out
  const AI = {
    easy: { rt: 520, spread: 120, fooled: 0.35 },
    medium: { rt: 360, spread: 70, fooled: 0.15 },
    hard: { rt: 255, spread: 45, fooled: 0.05 },
  };

  A.css('rd-css', `
    .rd-arena { display: grid; grid-template-columns: 1fr minmax(0, 1.15fr) 1fr; gap: 14px; align-items: stretch; margin-top: 18px; }
    /* each side is a big domed arcade button sitting in a dark console */
    .rd-pad {
      min-height: 280px; border: 1px solid var(--line-strong); border-radius: 22px; position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px;
      cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; font: inherit; color: var(--ink);
      background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 65%), linear-gradient(180deg, #23264a, #15172f);
      box-shadow: 0 18px 40px #0007, inset 0 1px 0 #ffffff1a;
    }
    .rd-pad::before { content: ''; width: clamp(92px, 16vw, 128px); aspect-ratio: 1; border-radius: 50%; order: 2;
      background: radial-gradient(circle at 38% 30%, #ffffffcc 0 6%, var(--c) 34%, color-mix(in srgb, var(--c) 55%, #000) 100%);
      box-shadow: 0 10px 0 color-mix(in srgb, var(--c) 45%, #000), 0 14px 22px #000a, 0 0 34px color-mix(in srgb, var(--c) 45%, transparent);
      transition: transform .06s, box-shadow .06s; }
    .rd-pad:active::before, .rd-pad.hit::before { transform: translateY(8px); box-shadow: 0 2px 0 color-mix(in srgb, var(--c) 45%, #000), 0 4px 10px #000a, 0 0 50px var(--c); }
    .rd-pad.p1 { --c: #ff6b70; }
    .rd-pad.p2 { --c: #ffd04a; }
    .rd-pad.cpu { cursor: default; }
    .rd-pad .who { font-family: var(--font-mono); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--c); order: 0; }
    .rd-pad .pts { font-size: clamp(40px, 8vw, 60px); font-weight: 700; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; order: 1; }
    .rd-pad .rd-pips { order: 3; margin-top: 8px; color: var(--c); }
    .rd-pad .hint { font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); order: 4; }
    .rd-pad.won { animation: pop .4s ease; box-shadow: 0 0 0 1px var(--c), 0 0 40px color-mix(in srgb, var(--c) 40%, transparent); }
    .rd-signal.go { animation: rd-flash .35s ease; }
    .rd-signal.decoy { animation: shake .3s ease; }
    @keyframes rd-flash { 0% { transform: scale(.9); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
    .rd-pad.foul { animation: shake .3s ease; }
    /* the middle is a three-lamp signal light */
    .rd-signal {
      border: 1px solid var(--line-strong); border-radius: 22px; background: linear-gradient(180deg, #1a1c38, #0f1026); color: var(--ink);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 18px;
      box-shadow: inset 0 0 40px #0008; transition: background-color .15s;
    }
    .rd-lamps { display: flex; gap: 12px; }
    .rd-lamps i { width: 30px; height: 30px; border-radius: 50%; background: #2a2c48; box-shadow: inset 0 3px 6px #0008; transition: background-color .1s, box-shadow .1s; }
    .rd-signal:not(.go):not(.decoy) .rd-lamps i:nth-child(1) { background: #ff4d5e; box-shadow: 0 0 18px #ff4d5e, inset 0 -3px 6px #0004; }
    .rd-signal.decoy .rd-lamps i:nth-child(2) { background: #ff9f43; box-shadow: 0 0 22px #ff9f43, inset 0 -3px 6px #0004; }
    .rd-signal.go .rd-lamps i:nth-child(3) { background: #7cf07a; box-shadow: 0 0 30px #7cf07a, inset 0 -3px 6px #0004; }
    .rd-signal .big-word { font-size: clamp(28px, 6vw, 46px); font-weight: 700; letter-spacing: -.04em; line-height: 1.05; }
    .rd-signal .sub { color: var(--ink-soft); font-weight: 600; max-width: 26ch; }
    .rd-signal.go { background: radial-gradient(ellipse at 50% 40%, #2f8a3e, #11331a); }
    .rd-signal.go .big-word { color: #c9ffb0; text-shadow: 0 0 24px #7cf07a; }
    .rd-signal.go .sub, .rd-signal.decoy .sub { color: inherit; }
    .rd-signal.decoy { background: radial-gradient(ellipse at 50% 40%, #8a4a1a, #2a160a); }
    .rd-pips { display: flex; gap: 6px; justify-content: center; }
    .rd-pips i { width: 12px; height: 12px; border-radius: 50%; border: 1px solid currentColor; opacity: .9; }
    .rd-pips i.on { background: currentColor; box-shadow: 0 0 8px currentColor; }
    @media (max-width: 640px) {
      .rd-arena { grid-template-columns: 1fr; }
      .rd-pad { min-height: 150px; }
      .rd-arena.two .rd-pad.p2 { order: -1; transform: rotate(180deg); }   /* faces the player across the table */
      .rd-arena.two .rd-pad.p2:active { transform: rotate(180deg) translate(-3px, -3px); }
      .rd-arena.solo .rd-pad.p2 { order: -1; min-height: 110px; }
      .rd-pad.p1 { order: 1; }
      .rd-signal { min-height: 130px; }
    }
  `);

  A.register({
    id: 'reaction-duel',
    section: 'play',
    title: 'Reaction Duel',
    color: 'p1',
    foot: '1 or 2 players',
    art: `<span style="display:flex;gap:14px;align-items:center">
      <span style="width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#fff 0 6%,#ff6b70 34%,#8a1f2a);box-shadow:0 7px 0 #6a1620,0 0 22px #ff6b7088"></span>
      <span style="display:flex;flex-direction:column;gap:5px;padding:7px;border-radius:10px;background:#0f1026"><i style="width:16px;height:16px;border-radius:50%;background:#2a2c48"></i><i style="width:16px;height:16px;border-radius:50%;background:#2a2c48"></i><i style="width:16px;height:16px;border-radius:50%;background:#7cf07a;box-shadow:0 0 12px #7cf07a"></i></span>
      <span style="width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#fff 0 6%,#ffd04a 34%,#8a6206);box-shadow:0 7px 0 #6a4a04,0 0 22px #ffd04a88"></span>
    </span>`,
    blurb: 'Wait for the signal to turn green, then smash your button first. Go too early and you give away the point. Play a friend or the computer.',
    tags: ['Reflexes', '1–2 players', 'First to 5'],
    mount(el) {
      let mode = A.store.get('rd-mode', '2p');
      let state = 'idle', score = [0, 0], timers = [], goAt = 0, round = 0, lastTimes = [null, null];

      const isAI = () => mode !== '2p';
      const P = () => [
        { name: isAI() ? 'You' : 'Red', cls: 'p1', keyLabel: isAI() ? 'A, L or Space' : 'A' },
        { name: isAI() ? 'Computer' : 'Yellow', cls: 'p2', keyLabel: 'L' },
      ];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));
      const clearAll = () => { timers.forEach(clearTimeout); timers = []; };

      function render(signalCls, word, sub) {
        const showStart = state === 'over' || state === 'idle';
        el.innerHTML = `
          ${showStart ? A.modePicker(mode) : ''}
          <div class="rd-arena ${isAI() ? 'solo' : 'two'}">
            ${pad(0)}
            <div class="rd-signal ${signalCls || ''}" aria-live="assertive">
              <span class="rd-lamps" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="big-word">${word}</span>
              <span class="sub">${sub || ''}</span>
              ${showStart ? `<button class="btn primary" data-act="start">${state === 'over' ? 'Rematch' : 'Start duel'}</button>` : ''}
            </div>
            ${pad(1)}
          </div>
          <p class="best" style="text-align:center;margin:16px 0 0">First to ${TARGET} points wins. ${isAI()
            ? 'Tap your red button, or press A, L or Space.'
            : 'On a phone or tablet, put it flat between you. On a keyboard, Red presses A and Yellow presses L.'}</p>`;
      }
      function pad(i) {
        const p = P()[i];
        const cpu = isAI() && i === 1;
        return `<button class="rd-pad ${p.cls} ${cpu ? 'cpu' : ''}" data-pad="${i}" ${cpu ? 'tabindex="-1"' : ''} aria-label="${p.name} button">
          <span class="who">${p.name}</span>
          <span class="pts">${score[i]}</span>
          <span class="rd-pips">${Array.from({ length: TARGET }, (_, k) => `<i class="${k < score[i] ? 'on' : ''}"></i>`).join('')}</span>
          <span class="hint">${lastTimes[i] ? lastTimes[i] + ' ms' : cpu ? mode[0].toUpperCase() + mode.slice(1) : 'Key: ' + p.keyLabel}</span>
        </button>`;
      }
      function signal(cls, word, sub) {
        const s = el.querySelector('.rd-signal');
        s.className = 'rd-signal ' + (cls || '');
        s.querySelector('.big-word').textContent = word;
        s.querySelector('.sub').textContent = sub || '';
      }

      function startMatch() {
        score = [0, 0]; round = 0; lastTimes = [null, null];
        nextRound();
      }

      function nextRound() {
        clearAll();
        round++;
        state = 'ready';
        render('', 'Get ready…', 'Wait for green. Don’t jump early!');
        const wait = 1600 + Math.random() * 2800;
        const ai = isAI() ? AI[mode] : null;
        // from round 3 on, a fake-out flash can appear before GO
        if (round >= 3 && Math.random() < 0.45) {
          const at = 600 + Math.random() * (wait - 900);
          later(() => {
            if (state !== 'ready') return;
            state = 'decoy'; signal('decoy', 'NOT YET!', 'That’s a trick. Keep waiting.');
            if (ai && Math.random() < ai.fooled) later(() => press(1, true), 180 + Math.random() * 200);
          }, at);
          later(() => { if (state !== 'decoy') return; state = 'ready'; signal('', 'Get ready…', 'Wait for green.'); }, at + 650);
        }
        later(() => {
          if (state !== 'ready' && state !== 'decoy') return;
          state = 'go'; goAt = performance.now();
          signal('go', 'GO!', 'Hit your button!');
          if (ai) {
            const rt = Math.max(160, ai.rt + (Math.random() * 2 - 1) * ai.spread);
            later(() => press(1, true), rt);
          }
        }, wait + (round >= 3 ? 400 : 0));
      }

      function press(i, fromAI) {
        if (isAI() && i === 1 && !fromAI) return; // nobody can press the computer's button
        if (state === 'ready' || state === 'decoy') {
          clearAll();
          const other = 1 - i;
          score[other]++;
          lastTimes = [null, null];
          const n = P();
          endRound(other, `${n[i].name === 'You' ? 'You' : n[i].name} jumped early!`, `Point to ${n[other].name === 'You' ? 'you' : n[other].name}.`, i);
        } else if (state === 'go') {
          clearAll();
          const ms = Math.round(performance.now() - goAt);
          score[i]++;
          lastTimes = [null, null]; lastTimes[i] = ms;
          const n = P();
          endRound(i, n[i].name === 'You' ? 'You win the point!' : `${n[i].name} wins!`, `${ms} milliseconds`, null);
        }
      }

      function endRound(winner, word, sub, fouler) {
        const done = score[winner] >= TARGET;
        state = done ? 'over' : 'between';
        const n = P();
        if (done) render('', n[winner].name === 'You' ? 'You win the duel!' : `${n[winner].name} wins the duel!`, `${score[0]} to ${score[1]}`);
        else render('', word, sub);
        const wp = el.querySelector(`[data-pad="${winner}"]`);
        wp.classList.add('won');
        A.domBurst(wp, ['#FFFFFF', A.color('gold'), A.color('good')], 14);
        if (done && (!isAI() || winner === 0)) A.confetti();
        if (fouler !== null) el.querySelector(`[data-pad="${fouler}"]`).classList.add('foul');
        if (!done) later(nextRound, 1700);
      }

      el.onpointerdown = e => {
        const p = e.target.closest('[data-pad]');
        if (p) { e.preventDefault(); press(Number(p.dataset.pad), false); }
      };
      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.act === 'start') startMatch();
        else if (b.dataset.mode && b.dataset.mode !== mode) {
          mode = b.dataset.mode; A.store.set('rd-mode', mode);
          state = 'idle'; score = [0, 0]; lastTimes = [null, null];
          render('', 'Reaction Duel', isAI() ? 'Beat the computer to the button.' : 'When the middle turns green, hit your button first.');
        }
      };
      const onKey = e => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (state === 'idle' || state === 'over') return; // let Space/Enter work on focused buttons
        let i = -1;
        if (isAI()) { if (k === 'a' || k === 'l' || k === ' ') i = 0; }
        else if (k === 'a') i = 0; else if (k === 'l') i = 1;
        if (i !== -1) { e.preventDefault(); press(i, false); }
      };
      document.addEventListener('keydown', onKey);
      render('', 'Reaction Duel', isAI() ? 'Beat the computer to the button.' : 'When the middle turns green, hit your button first.');
      return () => { clearAll(); document.removeEventListener('keydown', onKey); };
    },
  });
})();
