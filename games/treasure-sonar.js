/* Treasure Sonar: a deduction game. Each ping shows how many steps away the nearest hidden treasure is,
   and lights up the ring of squares at exactly that distance. Find every treasure before your pings run out. */
(function () {
  const A = Arcade;
  const LEVELS = {
    easy: { n: 7, gems: 3, pings: 16, label: 'Easy', note: '7 × 7 reef, 3 treasures, 16 pings' },
    medium: { n: 8, gems: 3, pings: 13, label: 'Medium', note: '8 × 8 reef, 3 treasures, 13 pings' },
    hard: { n: 9, gems: 4, pings: 15, label: 'Hard', note: '9 × 9 reef, 4 treasures, 15 pings' },
  };
  const BEST = lv => 'ts-best-' + lv;
  const HEAT = ['#ff5a6e', '#ff7a59', '#ff9f43', '#ffc94a', '#e4ef5c', '#a7f57d', '#6fe0c6', '#6fc6ff', '#86a9ff', '#9d8cff'];

  A.css('ts-css', `
    .ts-hud { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .ts-pings { display: flex; gap: 4px; flex-wrap: wrap; max-width: 260px; }
    .ts-pings i { width: 10px; height: 18px; border-radius: 4px; background: var(--memory); box-shadow: 0 0 8px #78e5dc77; transition: background-color .3s, box-shadow .3s; }
    .ts-pings i.used { background: #ffffff14; box-shadow: none; }
    .ts-sea { position: relative; width: min(100%, 520px); margin: 16px auto 0; padding: 10px; border-radius: 22px; overflow: hidden;
      background: radial-gradient(ellipse at 30% 20%, #1f6c8a 0, transparent 55%), radial-gradient(ellipse at 80% 90%, #134d6e 0, transparent 50%), linear-gradient(160deg, #0f3a5a, #0a2340);
      border: 1px solid #78e5dc44; box-shadow: 0 20px 50px #0007, inset 0 0 60px #04122688; }
    .ts-sea::before { content: ''; position: absolute; inset: -50%; pointer-events: none; opacity: .25;
      background: repeating-radial-gradient(circle at 50% 50%, transparent 0 22px, #8fe8ff22 23px 24px); animation: ts-swell 14s linear infinite; }
    @keyframes ts-swell { to { transform: translate(24px, 24px); } }
    .ts-grid { position: relative; display: grid; gap: 4px; }
    .ts-cell { aspect-ratio: 1; border-radius: 9px; border: 1px solid #a5f0ff22; cursor: pointer; padding: 0; position: relative;
      background: linear-gradient(150deg, #1d5a7c, #164766); color: #fff; font-weight: 700; font-size: clamp(13px, 3.4vw, 20px);
      display: grid; place-items: center; transition: transform .12s, background-color .2s, box-shadow .2s; }
    .ts-cell:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 0 0 1px #a5f0ff88, 0 6px 14px #0006; }
    .ts-cell:focus-visible { outline: 3px solid var(--lime); outline-offset: 1px; z-index: 2; }
    .ts-cell:disabled { cursor: default; }
    .ts-cell.dug { background: linear-gradient(150deg, #e7cf98, #c9a86a); color: #1d1a10; border-color: transparent; box-shadow: inset 0 -3px 0 #0002; }
    .ts-cell.dug:not(.zero) { background: linear-gradient(150deg, color-mix(in srgb, var(--h) 62%, #fff3d2), color-mix(in srgb, var(--h) 78%, #8a6a3a)); box-shadow: 0 0 14px color-mix(in srgb, var(--h) 45%, transparent), inset 0 -3px 0 #0002; }
    .ts-cell.dug b { color: #17140c; }
    .ts-cell.dug.zero b { color: #6b5a33; font-size: .8em; }
    .ts-cell.ring { box-shadow: inset 0 0 0 2px var(--h), 0 0 12px color-mix(in srgb, var(--h) 60%, transparent); }
    .ts-cell.ring:not(.dug) { background: linear-gradient(150deg, color-mix(in srgb, var(--h) 30%, #1d5a7c), #164766); }
    .ts-cell.gem { background: radial-gradient(circle, #fff6c4 0, #ffd878 45%, #c9932e 100%); box-shadow: 0 0 18px #ffd878aa; animation: pop .45s ease; }
    .ts-cell.gem span { font-size: 1.3em; filter: drop-shadow(0 2px 2px #0006); }
    .ts-cell.missed { background: radial-gradient(circle, #ffd87866 0, #164766 70%); }
    .ts-cell.new::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid #c8f6ff; animation: ts-ping .7s ease-out forwards; pointer-events: none; }
    @keyframes ts-ping { from { transform: scale(.3); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
    .ts-key { display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft); }
    .ts-key span { height: 8px; width: 140px; border-radius: 99px; background: linear-gradient(90deg, ${HEAT.join(',')}); }
    .ts-msg { text-align: center; font-weight: 700; min-height: 26px; margin-top: 12px; }
  `);

  A.register({
    id: 'treasure-sonar',
    section: 'strategy',
    isNew: true,
    title: 'Treasure Sonar',
    color: 'memory',
    artBg: 'radial-gradient(ellipse at 30% 25%, #2a86a6 0, transparent 55%), linear-gradient(150deg, #154a6c, #0b2a47)',
    art: `<span style="display:grid;grid-template-columns:repeat(4,30px);gap:5px">${['3', '', '2', '', '', '💎', '1', '', '4', '', '', '2'].map((t, i) =>
      `<span style="height:30px;border-radius:7px;display:grid;place-items:center;font:700 15px var(--font-display);${t === '💎' ? 'background:radial-gradient(circle,#fff6c4,#ffd878 50%,#c9932e);box-shadow:0 0 14px #ffd878' : t ? 'background:#e7cf98;color:' + HEAT[+t * 2] : 'background:#1d5a7c;border:1px solid #a5f0ff33'}">${t}</span>`).join('')}</span>`,
    blurb: 'Treasure is hidden on the reef. Each sonar ping tells you how many steps away the nearest one is. Use the clues to find them all before your pings run out.',
    tags: ['Deduction', 'Puzzle', '3 levels'],
    best() { const b = ['hard', 'medium', 'easy'].map(l => [l, A.store.get(BEST(l), null)]).find(x => x[1] != null); return b ? `${b[1]} pings left (${LEVELS[b[0]].label})` : null; },
    mount(el) {
      let lv = A.store.get('ts-level', 'easy'), cfg, gems, found, dug, left, over, latest, msg;

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Find the sunken treasure</h2>
            <p>Tap a square to send a sonar ping. If treasure is there, you dig it up. If not, the number tells you how many steps away the nearest treasure is (counting across and down, not diagonally).</p>
            <p>The squares at exactly that distance light up, so you can see where it could be. Numbers update each time you find a treasure. Treasures you find first leave more pings for the rest.</p>
          </div>
          ${A.modePicker(lv, true)}
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start diving</button>
            <span class="best" style="align-self:center">${LEVELS[lv].note}</span>
          </div>`;
      }

      function start() {
        cfg = LEVELS[lv];
        const all = A.shuffle(Array.from({ length: cfg.n * cfg.n }, (_, i) => i));
        gems = [];
        // keep treasures from touching each other so clues stay readable
        for (const i of all) {
          if (gems.length >= cfg.gems) break;
          if (gems.every(g => dist(g, i) >= 3)) gems.push(i);
        }
        found = new Set(); dug = new Map(); left = cfg.pings; over = false; latest = -1;
        msg = 'Tap anywhere to send your first ping.';
        draw();
      }
      const rc = i => [Math.floor(i / cfg.n), i % cfg.n];
      function dist(a, b) { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2); }
      function nearest(i) {
        let d = Infinity;
        for (const g of gems) if (!found.has(g)) d = Math.min(d, dist(g, i));
        return d;
      }

      function draw() {
        const n = cfg.n;
        const ringD = latest >= 0 && !gems.includes(latest) && !over ? nearest(latest) : -1;
        let cells = '';
        for (let i = 0; i < n * n; i++) {
          const isGem = found.has(i), wasDug = dug.has(i);
          let cls = '', inner = '', style = '';
          if (isGem) { cls = 'gem'; inner = '<span>💎</span>'; }
          else if (over && gems.includes(i)) { cls = 'missed'; inner = '<span style="opacity:.8">💎</span>'; }
          else if (wasDug) {
            const d = nearest(i);
            const h = d === Infinity ? '#6b5a33' : HEAT[Math.min(HEAT.length - 1, d - 1)];
            cls = 'dug' + (d === Infinity ? ' zero' : ''); style = `--h:${h}`; inner = `<b>${d === Infinity ? '·' : d}</b>`;
          }
          if (ringD > 0 && !wasDug && !isGem && dist(i, latest) === ringD) { cls += ' ring'; style = `--h:${HEAT[Math.min(HEAT.length - 1, ringD - 1)]}`; }
          if (i === latest) cls += ' new';
          const [r, c] = rc(i);
          cells += `<button class="ts-cell ${cls}" data-i="${i}" style="${style}" ${over || isGem || wasDug ? 'disabled' : ''}
            aria-label="Row ${r + 1}, column ${c + 1}${isGem ? ', treasure' : wasDug ? ', nearest treasure ' + nearest(i) + ' steps' : ''}">${inner}</button>`;
        }
        el.innerHTML = `
          <div class="ts-hud">
            <div class="stats">
              <div class="stat"><small>Treasure</small><b>${found.size} / ${cfg.gems}</b></div>
              <div class="stat"><small>Pings left</small><b>${left}</b></div>
            </div>
            <div class="ts-pings" aria-hidden="true">${Array.from({ length: cfg.pings }, (_, i) => `<i class="${i >= left ? 'used' : ''}"></i>`).join('')}</div>
          </div>
          <div class="ts-msg" aria-live="polite">${msg}</div>
          <div class="ts-sea"><div class="ts-grid" style="grid-template-columns:repeat(${n},1fr)">${cells}</div></div>
          <div class="ts-key" aria-hidden="true">near <span></span> far</div>
          <div class="row" style="margin-top:16px">${over ? '' : '<button class="btn small" data-act="quit">Change level</button>'}</div>
          ${over ? resultHtml() : ''}`;
        if (latest >= 0 && !over) { const b = el.querySelector(`[data-i="${latest}"]`); if (b) b.focus({ preventScroll: true }); }
      }

      function resultHtml() {
        const won = found.size === cfg.gems;
        if (!won) return `<div class="result"><div class="label">Out of pings</div><div class="big">${found.size}</div><div class="label">of ${cfg.gems} treasures found</div>
          <p class="best">The glowing gems show where the rest were hiding.</p>
          <div class="row"><button class="btn primary" data-act="go">Dive again</button><button class="btn" data-act="quit">Change level</button></div></div>`;
        const prev = A.store.get(BEST(lv), null), isBest = prev == null || left > prev;
        if (isBest) A.store.set(BEST(lv), left);
        return `<div class="result"><div class="label">All treasure found with</div><div class="big">${left}</div><div class="label">pings to spare</div>
          ${isBest ? '<div class="newbest">New best!</div>' : `<p class="best">Best on ${cfg.label}: ${prev} pings left</p>`}
          <div class="row"><button class="btn primary" data-act="go">Dive again</button><button class="btn" data-act="quit">Change level</button></div></div>`;
      }

      function ping(i) {
        if (over || found.has(i) || dug.has(i) || left <= 0) return;
        left--; latest = i;
        if (gems.includes(i)) {
          found.add(i); A.sound.play('coin');
          msg = found.size === cfg.gems ? 'You found every treasure!' : `Treasure! ${cfg.gems - found.size} to go. The numbers now point to the rest.`;
        } else {
          dug.set(i, true); A.sound.play('blip');
          const d = nearest(i);
          msg = d === 1 ? 'Very close! The treasure is right next to this square.' : `Nearest treasure: ${d} steps away. Look along the glowing ring.`;
        }
        if (found.size === cfg.gems) over = true;
        else if (left === 0) { over = true; msg = 'Out of pings!'; A.sound.play('lose'); }
        draw();
        if (found.has(i)) A.domBurst(el.querySelector(`[data-i="${i}"]`), ['#ffd878', '#fff6c4', '#78e5dc'], 12);
      }

      el.onclick = e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.i != null) ping(+b.dataset.i);
        else if (b.dataset.mode) { lv = b.dataset.mode; A.store.set('ts-level', lv); intro(); }
        else if (b.dataset.act === 'go') start();
        else if (b.dataset.act === 'quit') intro();
      };
      // arrow keys move between squares
      el.onkeydown = e => {
        const b = e.target.closest && e.target.closest('.ts-cell');
        if (!b || !/^Arrow/.test(e.key)) return;
        e.preventDefault();
        const n = cfg.n; let i = +b.dataset.i;
        for (let k = 0; k < n * n; k++) {
          i = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowDown' ? i + n : i - n;
          if (i < 0 || i >= n * n) return;
          const t = el.querySelector(`[data-i="${i}"]`);
          if (t && !t.disabled) { t.focus(); return; }
        }
      };
      intro();
    },
  });
})();
