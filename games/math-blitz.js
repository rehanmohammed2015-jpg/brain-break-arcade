/* Math Blitz: 60-second multiple-choice math sprint, three grade levels. */
(function () {
  const A = Arcade;
  const R = A.rand;
  const ROUND_MS = 60000;
  const WRONG_PENALTY_MS = 2000;

  A.css('mb-css', `
    .mb-card { position: relative; max-width: 560px; margin: 22px auto 16px; padding: 26px 16px 18px; border-radius: 22px; text-align: center; overflow: hidden;
      background: radial-gradient(ellipse at 50% 0%, #3a4aa0 0, transparent 70%), linear-gradient(180deg, #232758, #161838); border: 1px solid #86a9ff44; box-shadow: 0 20px 50px #0007; }
    .mb-card.fire { border-color: #ff9f43aa; box-shadow: 0 20px 50px #0007, 0 0 40px #ff9f4344; }
    .mb-card.fire::before { content: ''; position: absolute; inset: auto 0 0 0; height: 60%; background: linear-gradient(transparent, #ff6b3a33); animation: mb-flicker .5s ease-in-out infinite alternate; pointer-events: none; }
    @keyframes mb-flicker { to { opacity: .5; } }
    .mb-q { font-size: clamp(40px, 10vw, 72px); font-weight: 700; letter-spacing: -.04em; line-height: 1.1; overflow-wrap: anywhere; position: relative; text-shadow: 0 6px 30px #86a9ff66; }
    .mb-ask { color: var(--ink-soft); font-weight: 600; min-height: 22px; margin-top: 6px; position: relative; }
    .mb-heat { display: flex; align-items: center; gap: 10px; justify-content: center; margin-top: 10px; font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); position: relative; }
    .mb-heat .bar { width: 160px; height: 8px; border-radius: 99px; background: #ffffff14; overflow: hidden; }
    .mb-heat .bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #ffd04a, #ff6b3a); transition: width .25s ease; }
    .mb-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 560px; margin: 0 auto; }
    .mb-opt { font-weight: 700; font-size: clamp(24px, 6vw, 34px); padding: 20px 10px; position: relative; font-variant-numeric: tabular-nums; border: 0; color: #15172b;
      background: linear-gradient(160deg, color-mix(in srgb, var(--t) 85%, #fff), var(--t)); box-shadow: 0 6px 0 color-mix(in srgb, var(--t) 55%, #000), 0 12px 24px #0006; }
    .mb-opt:hover { background: linear-gradient(160deg, color-mix(in srgb, var(--t) 70%, #fff), var(--t)); }
    .mb-opt:active { transform: translateY(4px); box-shadow: 0 2px 0 color-mix(in srgb, var(--t) 55%, #000); }
    .mb-opt:nth-child(1) { --t: #ff77b7; } .mb-opt:nth-child(2) { --t: #78e5dc; } .mb-opt:nth-child(3) { --t: #cbf56a; } .mb-opt:nth-child(4) { --t: #b79cff; }
    .mb-opt kbd { position: absolute; top: 6px; left: 10px; font-family: var(--font-mono); font-size: 11px; color: #15172b99; }
    .mb-opt.right { --t: #7cf07a; box-shadow: 0 6px 0 #2f8a3e, 0 0 30px #7cf07a99; }
    .mb-opt.wrong { --t: #ff6b7a; filter: saturate(1.2); }
    .mb-q { animation: mb-in .25s cubic-bezier(.3, 1.5, .5, 1); }
    @keyframes mb-in { from { transform: scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }
  `);

  // Show a number; wrap negatives in parentheses when used as a second operand.
  const show = n => (n < 0 ? '−' + -n : String(n));
  const paren = n => (n < 0 ? '(' + show(n) + ')' : String(n));
  const nz = (min, max) => { let n = 0; while (n === 0) n = R(min, max); return n; };

  const LEVELS = [
    { g: 6, desc: 'Whole numbers: + − × ÷', gens: [
      () => { const a = R(12, 99), b = R(12, 99); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = R(30, 140), b = R(5, a - 1); return { q: `${a} − ${b}`, a: a - b }; },
      () => { const a = R(2, 12), b = R(2, 12); return { q: `${a} × ${b}`, a: a * b }; },
      () => { const b = R(2, 12), c = R(2, 12); return { q: `${b * c} ÷ ${b}`, a: c }; },
    ]},
    { g: 7, desc: 'Integers and order of operations', gens: [
      () => { const a = R(-20, 20), b = nz(-20, 20); return { q: `${show(a)} + ${paren(b)}`, a: a + b }; },
      () => { const a = R(-20, 20), b = nz(-20, 20); return { q: `${show(a)} − ${paren(b)}`, a: a - b }; },
      () => { const a = nz(-12, 12), b = nz(-9, 9); return { q: `${show(a)} × ${paren(b)}`, a: a * b }; },
      () => { const b = nz(-9, 9), c = nz(-9, 9); return { q: `${show(b * c)} ÷ ${paren(b)}`, a: c }; },
      () => { const a = R(2, 12), b = R(2, 9), c = R(2, 6); return { q: `${a} + ${b} × ${c}`, a: a + b * c }; },
    ]},
    { g: 8, desc: 'Powers, roots, equations, percents', gens: [
      () => { const b = R(2, 15); return { q: `${b}²`, a: b * b }; },
      () => { const b = R(2, 5); return { q: `${b}³`, a: b ** 3 }; },
      () => { const b = R(2, 15); return { q: `√${b * b}`, a: b }; },
      () => { const x = nz(-9, 12), m = R(2, 9), c = R(1, 20); return { q: `${m}x + ${c} = ${show(m * x + c)}`, a: x, ask: 'Solve for x' }; },
      () => { const p = [10, 20, 25, 50, 75][R(0, 4)], b = [20, 40, 60, 80, 120, 200][R(0, 5)]; return { q: `${p}% of ${b}`, a: p * b / 100 }; },
    ]},
  ];

  function makeOptions(answer, grade) {
    const set = new Set([answer]);
    if (grade >= 7 && answer !== 0 && Math.random() < 0.6) set.add(-answer);
    const deltas = A.shuffle([1, -1, 2, -2, 10, -10, 3, -3, 4, 5, -5]);
    for (const d of deltas) {
      if (set.size >= 4) break;
      const v = answer + d;
      if (grade === 6 && v < 0) continue;
      set.add(v);
    }
    return A.shuffle([...set].slice(0, 4));
  }

  const bestKey = g => 'mb-best-' + g;

  A.register({
    id: 'math-blitz',
    title: 'Math Blitz',
    color: 'math',
    art: `<span style="display:flex;flex-direction:column;align-items:center;gap:8px"><span style="font-size:40px;letter-spacing:-.04em;text-shadow:0 6px 24px #86a9ff">7 × 8 = <span style="color:#cbf56a">?</span></span>
      <span style="display:grid;grid-template-columns:repeat(4,30px);gap:5px">${['#ff77b7', '#78e5dc', '#cbf56a', '#b79cff'].map(c => `<i style="height:14px;border-radius:5px;background:${c};box-shadow:0 3px 0 #0005"></i>`).join('')}</span></span>`,
    blurb: 'Answer as many problems as you can in 60 seconds. Build a streak for bonus points.',
    tags: ['Math', '60 sec', 'Grades 6–8'],
    best() {
      const b = Math.max(...LEVELS.map(l => A.store.get(bestKey(l.g), 0)));
      return b > 0 ? b + ' pts' : null;
    },
    mount(el) {
      let tick = null, s = null, locked = false;

      function intro() {
        clearInterval(tick); s = null;
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Pick your level</h2>
            <p>Tap the right answer or press keys 1 to 4. Each correct answer is worth 10 points. Three in a row earns +5 on every answer after that, and six in a row puts you on fire for +10. Every 5 in a row adds a second to the clock.</p>
            <p>A wrong answer takes 2 seconds off the clock.</p>
          </div>
          <div class="level-grid">${LEVELS.map(l => `
            <button class="btn level" data-grade="${l.g}">
              <b>Grade ${l.g}</b><span>${l.desc}</span>
              <small>Best: ${A.store.get(bestKey(l.g), 0)} pts</small>
            </button>`).join('')}
          </div>`;
      }

      function startRound(grade) {
        const level = LEVELS.find(l => l.g === grade);
        s = { level, score: 0, streak: 0, right: 0, tries: 0, endAt: Date.now() + ROUND_MS, prob: null };
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b id="mb-score">0</b></div>
              <div class="stat"><small>Streak</small><b id="mb-streak">0</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Time</small><b id="mb-time">60</b></div></div>
          </div>
          <div class="timerbar" id="mb-bar"><i></i></div>
          <div class="mb-card" id="mb-card">
            <div class="mb-q" id="mb-q" aria-live="polite"></div>
            <div class="mb-ask" id="mb-ask"></div>
            <div class="mb-heat"><span id="mb-heat-label">Streak</span><span class="bar"><i id="mb-heat" style="width:0"></i></span></div>
          </div>
          <div class="mb-opts" id="mb-opts"></div>
          <div class="feedback" id="mb-fb" aria-live="polite"></div>`;
        next();
        tick = setInterval(updateClock, 100);
        updateClock();
      }

      function next() {
        const gens = s.level.gens;
        let p;
        do { p = gens[R(0, gens.length - 1)](); } while (s.prob && p.q === s.prob.q);
        p.opts = makeOptions(p.a, s.level.g);
        s.prob = p;
        locked = false;
        const qEl = el.querySelector('#mb-q');
        qEl.textContent = p.q;
        qEl.style.animation = 'none'; void qEl.offsetWidth; qEl.style.animation = ''; // replay the pop-in for each question
        el.querySelector('#mb-ask').textContent = p.ask || '';
        el.querySelector('#mb-opts').innerHTML = p.opts.map((o, i) =>
          `<button class="btn mb-opt" data-i="${i}"><kbd>${i + 1}</kbd>${show(o)}</button>`).join('');
      }

      function choose(i) {
        if (!s || locked) return;
        const p = s.prob;
        const btns = el.querySelectorAll('.mb-opt');
        if (!btns[i]) return;
        locked = true;
        s.tries++;
        const fb = el.querySelector('#mb-fb');
        if (p.opts[i] === p.a) {
          s.right++; s.streak++;
          // streak bonus grows: +5 from 3 in a row, +10 once you're on fire (6+); every 5 in a row adds a second
          const bonus = s.streak >= 6 ? 10 : s.streak >= 3 ? 5 : 0;
          s.score += 10 + bonus;
          const timeBonus = s.streak % 5 === 0;
          if (timeBonus) s.endAt += 1000;
          btns[i].classList.add('right', 'pop');
          A.domBurst(btns[i], ['#7cf07a', '#ffd04a', '#FFFFFF'], s.streak >= 3 ? 14 : 8);
          fb.className = 'feedback good';
          fb.textContent = (s.streak >= 6 ? `On fire! ${s.streak} in a row! +${10 + bonus}` : bonus ? `Streak ${s.streak}! +${10 + bonus}` : '+10') + (timeBonus ? '  ·  +1 second' : '');
        } else {
          s.streak = 0;
          s.endAt -= WRONG_PENALTY_MS;
          btns[i].classList.add('wrong', 'shake');
          const ri = p.opts.indexOf(p.a);
          btns[ri].classList.add('right');
          fb.className = 'feedback bad';
          fb.textContent = `It was ${show(p.a)}. −2 seconds`;
        }
        el.querySelector('#mb-score').textContent = s.score;
        el.querySelector('#mb-streak').textContent = s.streak;
        s.best = Math.max(s.best || 0, s.streak);
        el.querySelector('#mb-heat').style.width = Math.min(100, s.streak / 6 * 100) + '%';
        el.querySelector('#mb-heat-label').textContent = s.streak >= 6 ? '🔥 On fire' : s.streak >= 3 ? 'Streak bonus' : 'Streak';
        el.querySelector('#mb-card').classList.toggle('fire', s.streak >= 6);
        setTimeout(() => { if (s && Date.now() < s.endAt) next(); }, p.opts[i] === p.a ? 350 : 900);
      }

      function updateClock() {
        if (!s) return;
        const left = Math.max(0, s.endAt - Date.now());
        el.querySelector('#mb-time').textContent = Math.ceil(left / 1000);
        const bar = el.querySelector('#mb-bar');
        bar.firstElementChild.style.width = (left / ROUND_MS * 100) + '%';
        bar.classList.toggle('low', left < 10000);
        if (left <= 0) finish();
      }

      function finish() {
        clearInterval(tick);
        const g = s.level.g;
        const prev = A.store.get(bestKey(g), 0);
        const isBest = s.score > prev;
        if (isBest) A.store.set(bestKey(g), s.score);
        const acc = s.tries ? Math.round(s.right / s.tries * 100) : 0;
        el.innerHTML = `
          <div class="result">
            <span class="label">Grade ${g} · Final score</span>
            <span class="big">${s.score}</span>
            ${isBest ? '<span class="newbest">New personal best!</span>' : `<span class="label">Best: ${prev} pts</span>`}
            <div class="result-stats">
              <div class="stat"><small>Correct</small><b>${s.right}/${s.tries}</b></div>
              <div class="stat"><small>Accuracy</small><b>${acc}%</b></div>
              <div class="stat"><small>Best streak</small><b>${s.best || 0}</b></div>
            </div>
            <div class="row">
              <button class="btn primary" data-grade="${g}">Play again</button>
              <button class="btn" data-act="levels">Change level</button>
            </div>
          </div>`;
        s = null;
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.grade) startRound(Number(b.dataset.grade));
        else if (b.dataset.act === 'levels') intro();
        else if (b.dataset.i !== undefined) choose(Number(b.dataset.i));
      };
      const onKey = e => {
        if (s && e.key >= '1' && e.key <= '4') { e.preventDefault(); choose(Number(e.key) - 1); }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { clearInterval(tick); document.removeEventListener('keydown', onKey); };
    },
  });
})();
