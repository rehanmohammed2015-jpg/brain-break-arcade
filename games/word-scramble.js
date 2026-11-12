/* Word Scramble: unscramble school vocabulary words from their definitions. */
(function () {
  const A = Arcade;
  const WORDS_PER_GAME = 8;
  const WORD_POINTS = 100;
  const HINT_COST = 30;

  A.css('ws-css', `
    .ws-cat { display: inline-block; margin-bottom: 10px; }
    .ws-clue { font-size: clamp(18px, 3.6vw, 22px); max-width: 46ch; margin: 18px auto 26px; text-align: center; text-wrap: balance; }
    .ws-slots, .ws-tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .ws-slots { margin-bottom: 26px; position: relative; }
    .ws-slots.correct .ws-slot { animation: ws-wave .4s ease backwards; }
    .ws-slots.correct .ws-slot:nth-child(2) { animation-delay: .04s; } .ws-slots.correct .ws-slot:nth-child(3) { animation-delay: .08s; }
    .ws-slots.correct .ws-slot:nth-child(4) { animation-delay: .12s; } .ws-slots.correct .ws-slot:nth-child(5) { animation-delay: .16s; }
    .ws-slots.correct .ws-slot:nth-child(6) { animation-delay: .2s; } .ws-slots.correct .ws-slot:nth-child(7) { animation-delay: .24s; }
    .ws-slots.correct .ws-slot:nth-child(8) { animation-delay: .28s; } .ws-slots.correct .ws-slot:nth-child(9) { animation-delay: .32s; }
    .ws-slots.correct .ws-slot:nth-child(10) { animation-delay: .36s; }
    @keyframes ws-wave { 0%, 100% { transform: none; } 50% { transform: translateY(-10px); } }
    .ws-tile:hover { transform: translateY(-2px) rotate(-3deg); }
    .ws-slot, .ws-tile {
      width: clamp(30px, 8.2vw, 48px); height: clamp(40px, 10vw, 56px); padding: 0;
      font-family: var(--font-display); font-size: clamp(18px, 5vw, 28px); display: grid; place-items: center; cursor: pointer;
    }
    .ws-clue { padding: 18px 20px; border-radius: 18px; background: linear-gradient(180deg, #2a2350, #1c1a3c); border: 1px solid #ff9a6b44; box-shadow: 0 16px 40px #0006; }
    .ws-slot, .ws-tile { font-weight: 700; }
    .ws-slot { background: #ffffff0a; color: var(--ink); border: 1px dashed #ffffff33; border-radius: 10px; transition: background-color .15s, border-color .15s; }
    .ws-slot:not(:empty) { background: linear-gradient(160deg, #3a3470, #2a2558); border: 1px solid #ffffff2a; }
    .ws-slot.locked { color: #17192b; background: linear-gradient(160deg, #ffe39a, #ffc94a); border-color: transparent; cursor: default; box-shadow: 0 0 14px #ffd04a66; }
    .ws-slots.correct .ws-slot { color: #17192b; background: linear-gradient(160deg, #c9ffb0, #7cf07a); border-color: transparent; box-shadow: 0 0 18px #7cf07a88; }
    .ws-tile { border: 0; border-radius: 10px; color: #3a1a10; transition: transform .12s;
      background: linear-gradient(160deg, #ffd0b8, #ff9a6b); box-shadow: 0 5px 0 #b45a33, 0 10px 18px #0006; }
    .ws-tile:nth-child(3n+2) { background: linear-gradient(160deg, #ffe1ef, #ff9cc8); box-shadow: 0 5px 0 #b45283, 0 10px 18px #0006; color: #4a1530; }
    .ws-tile:nth-child(3n) { background: linear-gradient(160deg, #e9ffc4, #cbf56a); box-shadow: 0 5px 0 #86a83a, 0 10px 18px #0006; color: #2a3a10; }
    .ws-tile:active { transform: translateY(4px); box-shadow: 0 1px 0 #0006; }
    .ws-tile.used { visibility: hidden; }
    .ws-tools { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 26px; }
    .ws-progress { font-weight: 700; color: var(--ink-soft); }
  `);

  const BANK = {
    Science: [
      ['ECOSYSTEM', 'All the living things in an area plus their environment, working together.'],
      ['MOLECULE', 'Two or more atoms bonded together.'],
      ['GRAVITY', 'The force that pulls objects toward each other, like you toward Earth.'],
      ['FOSSIL', 'The preserved remains or traces of a living thing from long ago.'],
      ['NUCLEUS', 'The control center of a cell.'],
      ['VOLCANO', 'An opening in Earth’s crust where melted rock escapes.'],
      ['HABITAT', 'The natural home of a plant or animal.'],
      ['DENSITY', 'How much mass is packed into a certain volume.'],
      ['ORBIT', 'The curved path one object takes around another in space.'],
      ['ATMOSPHERE', 'The layer of gases that surrounds Earth.'],
    ],
    Math: [
      ['FRACTION', 'A number that names part of a whole, like 3/4.'],
      ['INTEGER', 'A whole number or its opposite, like −5, 0, or 12.'],
      ['VARIABLE', 'A letter that stands for an unknown number.'],
      ['EQUATION', 'A math sentence that says two expressions are equal.'],
      ['PERIMETER', 'The distance all the way around a shape.'],
      ['RATIO', 'A comparison of two amounts, like 3 to 2.'],
      ['DECIMAL', 'A number written with a point, like 0.75.'],
      ['PRIME', 'A number with exactly two factors: 1 and itself.'],
      ['VOLUME', 'The amount of space a 3D object takes up.'],
      ['ANGLE', 'The space between two rays that share an endpoint, measured in degrees.'],
    ],
    'Social Studies': [
      ['DEMOCRACY', 'A government where citizens hold the power and vote.'],
      ['CONTINENT', 'One of Earth’s seven large land masses.'],
      ['EMPIRE', 'Many lands and peoples ruled by one powerful leader or nation.'],
      ['PHARAOH', 'A ruler of ancient Egypt.'],
      ['LATITUDE', 'Map lines that measure distance north or south of the equator.'],
      ['COLONY', 'A territory settled and controlled by a faraway country.'],
      ['CULTURE', 'The shared beliefs, customs, and arts of a group of people.'],
      ['ECONOMY', 'How a region makes, trades, and uses goods and services.'],
      ['CITIZEN', 'A legal member of a country, with rights and duties.'],
      ['TRIBUTARY', 'A smaller river or stream that flows into a larger one.'],
    ],
    'Language Arts': [
      ['METAPHOR', 'A comparison that says one thing is another, like “Time is a thief.”'],
      ['ADJECTIVE', 'A word that describes a noun.'],
      ['NARRATOR', 'The voice telling the story.'],
      ['SYNONYM', 'A word that means the same as another word.'],
      ['SIMILE', 'A comparison that uses “like” or “as.”'],
      ['THEME', 'The central message or lesson of a story.'],
      ['CONFLICT', 'The struggle between opposing forces that drives a plot.'],
      ['ANTONYM', 'A word that means the opposite of another word.'],
      ['SETTING', 'When and where a story takes place.'],
      ['HYPERBOLE', 'Exaggeration for effect, like “I’ve told you a million times.”'],
    ],
  };
  const CATS = [...Object.keys(BANK), 'Mixed'];
  const bestKey = c => 'ws-best-' + c.replace(/\s+/g, '-').toLowerCase();

  function scramble(word) {
    let s;
    do { s = A.shuffle(word.split('')); } while (s.join('') === word);
    return s;
  }

  A.register({
    id: 'word-scramble',
    title: 'Word Scramble',
    color: 'words',
    art: '<span class="mini-tile">T</span><span class="mini-tile">R</span><span class="mini-tile">I</span><span class="mini-tile">O</span><span class="mini-tile">A</span>',
    blurb: 'Read the definition, then unscramble the letters to spell the vocabulary word.',
    tags: ['Vocabulary', '8 words', 'All subjects'],
    best() {
      const b = Math.max(...CATS.map(c => A.store.get(bestKey(c), 0)));
      return b > 0 ? b + ' pts' : null;
    },
    mount(el) {
      let s = null, busy = false, timer = null;

      function intro() {
        s = null;
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Pick a subject</h2>
            <p>Each round shows a definition and a pile of mixed-up letters. Tap the letters in order, or type them on your keyboard, to spell the word.</p>
            <p>Every word is worth ${WORD_POINTS} points. A hint fills in the next letter for ${HINT_COST} points.</p>
          </div>
          <div class="level-grid">${CATS.map(c => `
            <button class="btn level" data-cat="${c}">
              <b>${c}</b><span>${c === 'Mixed' ? 'Words from every subject' : BANK[c].length + ' words in the bank'}</span>
              <small>Best: ${A.store.get(bestKey(c), 0)} pts</small>
            </button>`).join('')}
          </div>`;
      }

      function startGame(cat) {
        const pool = cat === 'Mixed'
          ? Object.entries(BANK).flatMap(([c, list]) => list.map(w => [...w, c]))
          : BANK[cat].map(w => [...w, cat]);
        s = { cat, words: A.shuffle(pool).slice(0, WORDS_PER_GAME), i: 0, score: 0, solved: 0 };
        loadWord();
      }

      function loadWord() {
        const [word, clue, cat] = s.words[s.i];
        s.word = word; s.clue = clue; s.wcat = cat;
        s.tiles = scramble(word).map(ch => ({ ch, used: false }));
        s.slots = new Array(word.length).fill(null); // each holds a tile index
        s.hints = 0;
        busy = false;
        draw();
      }

      function draw() {
        el.innerHTML = `
          <div class="hud">
            <div class="stats">
              <div class="stat"><small>Score</small><b>${s.score}</b></div>
              <div class="stat"><small>Word</small><b>${s.i + 1}/${s.words.length}</b></div>
            </div>
          </div>
          <div style="text-align:center;margin-top:18px"><span class="chip ws-cat">${s.wcat}</span></div>
          <p class="ws-clue">${s.clue}</p>
          <div class="ws-slots" id="ws-slots">${s.slots.map((t, i) => `
            <button class="ws-slot${i < s.hints ? ' locked' : ''}" data-slot="${i}" aria-label="Letter ${i + 1}">${t === null ? '' : s.tiles[t].ch}</button>`).join('')}
          </div>
          <div class="ws-tiles">${s.tiles.map((t, i) => `
            <button class="ws-tile${t.used ? ' used' : ''}" data-tile="${i}" aria-label="${t.ch}">${t.ch}</button>`).join('')}
          </div>
          <div class="ws-tools">
            <button class="btn small" data-act="clear">Clear</button>
            <button class="btn small" data-act="shuffle">Shuffle</button>
            <button class="btn small" data-act="hint" ${s.hints >= s.word.length - 1 ? 'disabled' : ''}>Hint (−${HINT_COST})</button>
            <button class="btn small" data-act="skip">Skip word</button>
          </div>
          <div class="feedback" id="ws-fb" aria-live="polite"></div>`;
      }

      function place(tileIdx) {
        const t = s.tiles[tileIdx];
        if (!t || t.used) return;
        const slot = s.slots.indexOf(null);
        if (slot === -1) return;
        t.used = true; s.slots[slot] = tileIdx;
        draw();
        if (!s.slots.includes(null)) check();
      }

      function removeAt(slot) {
        if (slot < s.hints || s.slots[slot] === null) return;
        s.tiles[s.slots[slot]].used = false;
        // shift following letters left so the word stays contiguous
        s.slots.splice(slot, 1); s.slots.push(null);
        draw();
      }

      function clearFree() {
        for (let i = s.hints; i < s.slots.length; i++) {
          if (s.slots[i] !== null) { s.tiles[s.slots[i]].used = false; s.slots[i] = null; }
        }
      }

      function hint() {
        if (s.hints >= s.word.length - 1) return;
        s.hints++;
        clearFree();
        // re-lock the first `hints` letters with correct tiles
        for (let i = 0; i < s.hints; i++) {
          if (s.slots[i] !== null) { s.tiles[s.slots[i]].used = false; s.slots[i] = null; }
        }
        for (let i = 0; i < s.hints; i++) {
          const ti = s.tiles.findIndex(t => !t.used && t.ch === s.word[i]);
          s.tiles[ti].used = true; s.slots[i] = ti;
        }
        draw();
        if (!s.slots.includes(null)) check();
      }

      function check() {
        const guess = s.slots.map(t => s.tiles[t].ch).join('');
        const fb = el.querySelector('#ws-fb');
        const row = el.querySelector('#ws-slots');
        if (guess === s.word) {
          busy = true;
          const pts = Math.max(10, WORD_POINTS - s.hints * HINT_COST);
          s.score += pts; s.solved++;
          row.classList.add('correct', 'pop');
          A.domBurst(row, [A.color('good'), A.color('gold'), A.color('words')], 16);
          fb.className = 'feedback good';
          fb.textContent = `Correct! +${pts}`;
          timer = setTimeout(advance, 1000);
        } else {
          row.classList.add('shake');
          fb.className = 'feedback bad';
          fb.textContent = 'Not quite. Tap a letter in the word to send it back.';
        }
      }

      function skip() {
        busy = true;
        el.querySelector('#ws-slots').innerHTML = s.word.split('').map(ch => `<span class="ws-slot locked">${ch}</span>`).join('');
        const fb = el.querySelector('#ws-fb');
        fb.className = 'feedback bad';
        fb.textContent = `The word was ${s.word}.`;
        timer = setTimeout(advance, 1600);
      }

      function advance() {
        s.i++;
        if (s.i < s.words.length) loadWord(); else finish();
      }

      function finish() {
        const prev = A.store.get(bestKey(s.cat), 0);
        const isBest = s.score > prev;
        if (isBest) A.store.set(bestKey(s.cat), s.score);
        el.innerHTML = `
          <div class="result">
            <span class="label">${s.cat} · Final score</span>
            <span class="big">${s.score}</span>
            ${isBest ? '<span class="newbest">New personal best!</span>' : `<span class="label">Best: ${prev} pts</span>`}
            <div class="result-stats">
              <div class="stat"><small>Solved</small><b>${s.solved}/${s.words.length}</b></div>
            </div>
            <div class="row">
              <button class="btn primary" data-cat="${s.cat}">Play again</button>
              <button class="btn" data-act="subjects">Change subject</button>
            </div>
          </div>`;
        s = null;
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.cat) return startGame(b.dataset.cat);
        if (b.dataset.act === 'subjects') return intro();
        if (!s || busy) return;
        if (b.dataset.tile !== undefined) place(Number(b.dataset.tile));
        else if (b.dataset.slot !== undefined) removeAt(Number(b.dataset.slot));
        else if (b.dataset.act === 'clear') { clearFree(); draw(); }
        else if (b.dataset.act === 'shuffle') {
          // shuffle only the unused tiles' positions
          const order = A.shuffle(s.tiles.map((_, i) => i));
          const map = {}; order.forEach((oldI, newI) => { map[oldI] = newI; });
          const nt = []; order.forEach((oldI, newI) => { nt[newI] = s.tiles[oldI]; });
          s.tiles = nt; s.slots = s.slots.map(t => (t === null ? null : map[t]));
          draw();
        }
        else if (b.dataset.act === 'hint') hint();
        else if (b.dataset.act === 'skip') skip();
      };

      const onKey = e => {
        if (!s || busy || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Backspace') {
          e.preventDefault();
          for (let i = s.slots.length - 1; i >= s.hints; i--) if (s.slots[i] !== null) { removeAt(i); break; }
        } else if (/^[a-z]$/i.test(e.key)) {
          const ti = s.tiles.findIndex(t => !t.used && t.ch === e.key.toUpperCase());
          if (ti !== -1) place(ti);
        }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
    },
  });
})();
