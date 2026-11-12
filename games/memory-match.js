/* Memory Match: flip cards to find matching pairs (symbol ↔ element, country ↔ capital, ...). */
(function () {
  const A = Arcade;

  A.css('mm-css', `
    .mm-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(8px, 2vw, 14px); max-width: 560px; margin: 20px auto 0; }
    .mm-card { aspect-ratio: 1 / 1; max-width: 100%; perspective: 800px; border: 0; padding: 0; background: none; cursor: pointer; font: inherit; color: inherit; border-radius: 12px; }
    .mm-inner { position: relative; width: 100%; height: 100%; transition: transform .4s ease; transform-style: preserve-3d; }
    .mm-card.up .mm-inner { transform: rotateY(180deg); }
    .mm-face {
      position: absolute; inset: 0; border: 1px solid #ffffff22; border-radius: 14px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 2px; padding: 4px; text-align: center;
      backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 10px 22px #0007;
    }
    /* card backs: a glowing orbit pattern, like the planet on the home page */
    .mm-back {
      color: #17192b; font-weight: 700; font-size: clamp(22px, 6vw, 34px); overflow: hidden;
      background: radial-gradient(circle at 50% 50%, #cbf56a 0 18%, transparent 19%), radial-gradient(circle at 50% 50%, transparent 0 33%, #ffffff30 34% 35%, transparent 36%),
        radial-gradient(circle at 50% 50%, transparent 0 46%, #ffffff1c 47% 48%, transparent 49%), linear-gradient(145deg, #3a8f8a, #1d4a5c);
    }
    .mm-back::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, #ffffff30 45%, transparent 60%); transform: translateX(-100%); transition: transform .5s; }
    .mm-card:hover .mm-back::after { transform: translateX(100%); }
    .mm-front { background: linear-gradient(160deg, #f7f4ff, #d9d4f2); color: #1d1b3a; transform: rotateY(180deg); }
    .mm-front small { color: #5a5880 !important; }
    .mm-front b { font-weight: 700; font-size: clamp(12px, 3.3vw, 19px); line-height: 1.15; overflow-wrap: anywhere; }
    .mm-front b.short { font-size: clamp(22px, 6.5vw, 36px); }
    .mm-front small { font-size: clamp(9px, 2vw, 11px); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-soft); font-weight: 700; }
    .mm-card { position: relative; }
    .mm-card:hover:not(.up) .mm-inner { transform: translateY(-3px) rotate(-1deg); }
    .mm-card.done .mm-front { background: linear-gradient(160deg, #e6ffd8, #a7f57d); border-color: transparent; box-shadow: 0 0 22px #7cf07a77, 0 10px 22px #0007; }
    .mm-card.done .mm-inner { animation: mm-match .45s ease .35s; }
    .mm-card.miss .mm-front { background: linear-gradient(160deg, #ffe0e3, #ffb0b8); border-color: transparent; }
    .mm-card.miss .mm-inner { animation: mm-miss .35s ease .3s; }
    @keyframes mm-match { 0%, 100% { transform: rotateY(180deg) scale(1); } 50% { transform: rotateY(180deg) scale(1.12); } }
    @keyframes mm-miss { 0%, 100% { transform: rotateY(180deg) translateX(0); } 25% { transform: rotateY(180deg) translateX(-5px); } 75% { transform: rotateY(180deg) translateX(5px); } }
    .mm-stars { font-size: 40px; letter-spacing: 6px; color: var(--gold); line-height: 1; }
    .mm-stars .off { color: #ffffff22; }
  `);

  // Each pair: [face A, label A, face B, label B]
  const DECKS = {
    'Element Symbols': [
      ['H', 'Symbol', 'Hydrogen', 'Element'], ['O', 'Symbol', 'Oxygen', 'Element'],
      ['Fe', 'Symbol', 'Iron', 'Element'], ['Au', 'Symbol', 'Gold', 'Element'],
      ['Na', 'Symbol', 'Sodium', 'Element'], ['K', 'Symbol', 'Potassium', 'Element'],
      ['He', 'Symbol', 'Helium', 'Element'], ['Ag', 'Symbol', 'Silver', 'Element'],
      ['C', 'Symbol', 'Carbon', 'Element'], ['Cu', 'Symbol', 'Copper', 'Element'],
    ],
    'World Capitals': [
      ['France', 'Country', 'Paris', 'Capital'], ['Japan', 'Country', 'Tokyo', 'Capital'],
      ['Kenya', 'Country', 'Nairobi', 'Capital'], ['Brazil', 'Country', 'Brasília', 'Capital'],
      ['Canada', 'Country', 'Ottawa', 'Capital'], ['Egypt', 'Country', 'Cairo', 'Capital'],
      ['India', 'Country', 'New Delhi', 'Capital'], ['Australia', 'Country', 'Canberra', 'Capital'],
      ['Mexico', 'Country', 'Mexico City', 'Capital'], ['Peru', 'Country', 'Lima', 'Capital'],
    ],
    'Fractions & Decimals': [
      ['1/2', 'Fraction', '0.5', 'Decimal'], ['3/4', 'Fraction', '0.75', 'Decimal'],
      ['1/5', 'Fraction', '0.2', 'Decimal'], ['2/5', 'Fraction', '0.4', 'Decimal'],
      ['1/8', 'Fraction', '0.125', 'Decimal'], ['3/10', 'Fraction', '0.3', 'Decimal'],
      ['1/4', 'Fraction', '0.25', 'Decimal'], ['7/10', 'Fraction', '0.7', 'Decimal'],
      ['3/5', 'Fraction', '0.6', 'Decimal'], ['1/10', 'Fraction', '0.1', 'Decimal'],
    ],
    'Perfect Squares': [
      ['6²', 'Square', '36', 'Value'], ['7²', 'Square', '49', 'Value'],
      ['8²', 'Square', '64', 'Value'], ['9²', 'Square', '81', 'Value'],
      ['11²', 'Square', '121', 'Value'], ['12²', 'Square', '144', 'Value'],
      ['13²', 'Square', '169', 'Value'], ['15²', 'Square', '225', 'Value'],
      ['14²', 'Square', '196', 'Value'], ['20²', 'Square', '400', 'Value'],
    ],
  };
  const PAIRS = 8;
  const bestKey = d => 'mm-best-' + d.replace(/[^a-z]+/gi, '-').toLowerCase();

  function stars(moves) { return moves <= 12 ? 3 : moves <= 17 ? 2 : 1; }
  const fmtTime = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

  A.register({
    id: 'memory-match',
    title: 'Memory Match',
    color: 'memory',
    art: '<span class="mini-card" style="font-family:var(--font-body);font-weight:700;font-size:28px">Fe</span><span class="mini-card q">?</span><span class="mini-card" style="font-size:15px;font-family:var(--font-body);font-weight:700">Iron</span>',
    blurb: 'Flip cards two at a time and match each fact with its partner. Fewer moves earns more stars.',
    tags: ['Science', 'Geography', 'Math'],
    best() {
      const all = Object.keys(DECKS).map(d => A.store.get(bestKey(d), null)).filter(Boolean);
      return all.length ? Math.min(...all) + ' moves' : null;
    },
    mount(el) {
      let s = null, clock = null, flipTimer = null;

      function intro() {
        clearInterval(clock); s = null;
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Pick a deck</h2>
            <p>There are ${PAIRS} pairs hidden in the grid. Flip two cards per move. If they belong together, they stay face up.</p>
            <p>Clear the board in 12 moves or fewer for three stars.</p>
          </div>
          <div class="level-grid">${Object.keys(DECKS).map(d => {
            const b = A.store.get(bestKey(d), null);
            const ex = DECKS[d][0];
            return `<button class="btn level" data-deck="${d}">
              <b>${d}</b><span>${ex[0]} goes with ${ex[2]}</span>
              <small>Best: ${b ? b + ' moves' : 'not played yet'}</small>
            </button>`;
          }).join('')}
          </div>`;
      }

      function startGame(deck) {
        const pairs = A.shuffle(DECKS[deck]).slice(0, PAIRS);
        const cards = A.shuffle(pairs.flatMap((p, id) => [
          { id, face: p[0], label: p[1] }, { id, face: p[2], label: p[3] },
        ]));
        s = { deck, cards, open: [], matched: 0, moves: 0, started: 0, secs: 0, lock: false };
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Moves</small><b id="mm-moves">0</b></div>
              <div class="stat"><small>Pairs</small><b id="mm-pairs">0/${PAIRS}</b></div>
            </div>
            <div class="stats"><div class="stat"><small>Time</small><b id="mm-time">0:00</b></div></div>
          </div>
          <div class="mm-grid">${cards.map((c, i) => `
            <button class="mm-card" data-card="${i}" aria-label="Hidden card">
              <div class="mm-inner">
                <div class="mm-face mm-back">?</div>
                <div class="mm-face mm-front"><b class="${c.face.length <= 3 ? 'short' : ''}">${c.face}</b><small>${c.label}</small></div>
              </div>
            </button>`).join('')}
          </div>
          <div class="row" style="margin-top:22px"><button class="btn small" data-deck="${deck}">Restart</button></div>`;
      }

      function flip(i) {
        if (!s || s.lock) return;
        const c = s.cards[i];
        const btn = el.querySelector(`[data-card="${i}"]`);
        if (c.done || s.open.includes(i)) return;
        if (!s.started) {
          s.started = Date.now();
          clock = setInterval(() => {
            s.secs = Math.floor((Date.now() - s.started) / 1000);
            const t = el.querySelector('#mm-time'); if (t) t.textContent = fmtTime(s.secs);
          }, 250);
        }
        btn.classList.add('up');
        btn.setAttribute('aria-label', `${c.label}: ${c.face}`);
        s.open.push(i);
        if (s.open.length < 2) return;

        s.moves++;
        el.querySelector('#mm-moves').textContent = s.moves;
        const [a, b] = s.open;
        const ba = el.querySelector(`[data-card="${a}"]`), bb = el.querySelector(`[data-card="${b}"]`);
        if (s.cards[a].id === s.cards[b].id) {
          s.cards[a].done = s.cards[b].done = true;
          ba.classList.add('done'); bb.classList.add('done');
          setTimeout(() => { A.domBurst(ba, [A.color('good'), A.color('gold')], 8); A.domBurst(bb, [A.color('good'), A.color('gold')], 8); }, 380);
          s.open = [];
          s.matched++;
          el.querySelector('#mm-pairs').textContent = `${s.matched}/${PAIRS}`;
          if (s.matched === PAIRS) { clearInterval(clock); s.lock = true; flipTimer = setTimeout(finish, 700); }
        } else {
          s.lock = true;
          ba.classList.add('miss'); bb.classList.add('miss');
          flipTimer = setTimeout(() => {
            [ba, bb].forEach(x => { x.classList.remove('up', 'miss'); x.setAttribute('aria-label', 'Hidden card'); });
            s.open = []; s.lock = false;
          }, 950);
        }
      }

      function finish() {
        const prev = A.store.get(bestKey(s.deck), null);
        const isBest = prev === null || s.moves < prev;
        if (isBest) A.store.set(bestKey(s.deck), s.moves);
        const st = stars(s.moves);
        el.innerHTML = `
          <div class="result">
            <span class="label">${s.deck} · Board cleared</span>
            <span class="mm-stars" aria-label="${st} of 3 stars">${'★'.repeat(st)}<span class="off">${'★'.repeat(3 - st)}</span></span>
            <span class="big">${s.moves}</span>
            <span class="label">moves</span>
            ${isBest ? '<span class="newbest">New personal best!</span>' : `<span class="label">Best: ${prev} moves</span>`}
            <div class="result-stats"><div class="stat"><small>Time</small><b>${fmtTime(s.secs)}</b></div></div>
            <div class="row">
              <button class="btn primary" data-deck="${s.deck}">Play again</button>
              <button class="btn" data-act="decks">Change deck</button>
            </div>
          </div>`;
        s = null;
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.deck) { clearInterval(clock); clearTimeout(flipTimer); startGame(b.dataset.deck); }
        else if (b.dataset.act === 'decks') intro();
        else if (b.dataset.card !== undefined) flip(Number(b.dataset.card));
      };
      intro();
      return () => { clearInterval(clock); clearTimeout(flipTimer); };
    },
  });
})();
