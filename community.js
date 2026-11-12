/* Community games for the GitHub Pages version of the arcade.
   Student games live in community/games/<game-id>/ and are added through pull requests the teacher approves.
   The build step writes community/games.json, the list this file reads. Each game plays inside a sandboxed
   frame with no access to the arcade page, so a game can never change the arcade or read its saved scores. */
(function () {
  const A = window.Arcade;
  const ICONS = ['🚀', '⚽', '🏀', '🧩', '🐉', '👾', '🏎️', '🎯', '🌋', '🐸', '🛸', '🏰', '🎸', '🧠', '⭐', '🍕'];
  const COLORS = ['dash', 'pop', 'math', 'memory', 'words', 'stack', 'gold', 'p1'];
  const CATS = { arcade: 'Arcade', sports: 'Sports', strategy: 'Strategy', brain: 'Brain' };
  const ID = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
  const USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n) => String(s || '').trim().slice(0, n);

  // On https://<owner>.github.io/<repo>/ the repository is https://github.com/<owner>/<repo>
  const REPO = (() => {
    const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
    if (!m) return null;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return 'https://github.com/' + m[1] + '/' + (seg || m[1] + '.github.io');
  })();

  function clean(g) {
    if (!g || !ID.test(String(g.id))) return null;
    return {
      id: g.id, title: clip(g.title, 40) || 'Untitled game', description: clip(g.description, 200),
      author: USER.test(String(g.author)) ? g.author : 'a student', category: CATS[g.category] ? g.category : 'arcade',
      icon: ICONS.includes(g.icon) ? g.icon : '🎮', color: COLORS.includes(g.color) ? g.color : 'pop', added: clip(g.added, 10),
    };
  }

  A.css('community-css', `
    .cg-panel { background: linear-gradient(145deg, #202343, #191b36); border: 1px solid var(--line); border-radius: 18px; padding: clamp(16px, 3vw, 24px); }
    .cg-panel h3 { margin: 0 0 8px; font-size: 20px; letter-spacing: -.03em; }
    .cg-panel p { margin: 0 0 10px; color: var(--ink-soft); max-width: 66ch; }
    .cg-steps { margin: 6px 0 0; padding-left: 22px; color: var(--ink-soft); line-height: 1.85; }
    .cg-steps b { color: var(--ink); }
    .cg-frame { width: 100%; aspect-ratio: 4 / 3; max-height: 74vh; border: 1px solid var(--line-strong); border-radius: 16px; background: #0b0d22; display: block; }
    .cg-wrap { display: flex; flex-direction: column; gap: 18px; }
  `);

  let list = null, failed = false, current = null;
  fetch('community/games.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : { games: [] }))
    .then(data => { list = (Array.isArray(data.games) ? data.games : []).map(clean).filter(Boolean); })
    .catch(() => { list = []; failed = true; })
    .then(() => { if (current) render(); });

  function slotHtml() {
    const cards = list.map((g, i) => `
      <a class="gcard" href="#play-${g.id}" style="--accent:var(--${g.color});--i:${i}">
        <div class="gcard-art" aria-hidden="true"><span style="font-size:64px">${g.icon}</span></div>
        <div class="gcard-body">
          <div class="card-meta"><span class="pill">Community · ${CATS[g.category]}</span><span class="time">by @${esc(g.author)}</span></div>
          <h2>${esc(g.title)}</h2>
          <p>${esc(g.description)}</p>
          <div class="play-row"><span class="best">${g.added ? 'Added ' + esc(g.added) : 'Made by a student'}</span><b class="play-arrow" aria-hidden="true">↗</b></div>
        </div>
      </a>`).join('');
    return `
      <div class="section-head"><div><p class="eyebrow">Made by players</p><h2>Community Games</h2></div>
        <p>Games made by students and checked by a teacher before they go live. <a href="#creators" style="color:var(--lime)">Make your own →</a></p></div>
      ${list.length ? `<div class="hub-grid">${cards}</div>` : `<div class="cg-panel"><h3>No community games yet</h3><p>Be the first! Build a game and send it in.</p><a class="btn lime small" href="#creators">How to publish a game</a></div>`}`;
  }

  function playHtml(id) {
    const g = list && list.find(x => x.id === id);
    if (!g) return `<div class="game-page"><div class="game-top"><a class="btn small" href="#">&larr; All games</a></div>
      <div class="cg-panel">${list ? '<h3>That game isn’t here</h3><p>It may have been removed, or the link is wrong.</p>' : '<p>Loading…</p>'}</div></div>`;
    return `
      <div class="game-page" style="--accent:var(--${g.color})">
        <div class="game-top">
          <a class="btn small" href="#">&larr; All games</a>
          <div><p class="eyebrow">Community · ${CATS[g.category]} · by @${esc(g.author)}</p><h2 class="game-title">${esc(g.title)}</h2></div>
        </div>
        <section class="stage">
          <p style="margin:0 0 14px;color:var(--ink-soft)">${esc(g.description)}</p>
          <iframe class="cg-frame" title="${esc(g.title)}" src="community/games/${g.id}/index.html" sandbox="allow-scripts allow-pointer-lock" referrerpolicy="no-referrer"></iframe>
          <div class="row" style="justify-content:flex-start;margin-top:14px">
            ${REPO ? `<a class="btn" href="${esc(REPO)}/tree/main/community/games/${g.id}" target="_blank" rel="noopener noreferrer">See how it was made</a>` : ''}
            <a class="btn" href="#creators">Make your own game</a>
          </div>
          <p class="best" style="margin-top:12px">Click the game first so it can hear your keyboard.</p>
        </section>
      </div>`;
  }

  function creatorsHtml() {
    const guide = REPO ? `${REPO}/blob/main/CONTRIBUTING.md` : null;
    const starter = REPO ? `${REPO}/tree/main/community/starter` : null;
    return `
      <div class="game-page">
        <div class="game-top"><a class="btn small" href="#">&larr; All games</a>
          <div><p class="eyebrow">Community</p><h2 class="game-title">Make a game for the arcade</h2></div></div>
        <div class="cg-wrap">
          <div class="cg-panel">
            <h3>How it works</h3>
            <ol class="cg-steps">
              <li>Get a free <b>GitHub</b> account (you need to be 13 or older; if you’re younger, ask your teacher to send your game in for you). Pick a username that isn’t your real name.</li>
              <li>Open the arcade’s page on GitHub and press <b>Fork</b> to get your own copy.</li>
              <li>Copy the <b>starter</b> folder into <b>community/games/</b> and rename it, like <b>community/games/space-dodge</b>.</li>
              <li>Build your game in <b>index.html</b>, and fill in <b>game.json</b> with its name, a short description, and your GitHub username.</li>
              <li>Open a <b>pull request</b>. A robot checks your game in about a minute and tells you if anything needs fixing.</li>
              <li>Your teacher plays it and reads the code. When they approve it, it shows up here!</li>
            </ol>
            <div class="row" style="justify-content:flex-start;margin-top:14px">
              ${guide ? `<a class="btn lime" href="${esc(guide)}" target="_blank" rel="noopener noreferrer">Read the full guide</a>` : '<span class="best">The full guide is in CONTRIBUTING.md in the arcade’s repository.</span>'}
              ${starter ? `<a class="btn" href="${esc(starter)}" target="_blank" rel="noopener noreferrer">See the starter game</a>` : ''}
            </div>
          </div>
          <div class="cg-panel">
            <h3>Creator rules</h3>
            <ul class="cg-steps">
              <li>You made the game yourself, or you have permission for everything in it.</li>
              <li>No real names, photos, addresses, schools or other personal info.</li>
              <li>Nothing scary, violent or mean that wouldn’t be OK at school.</li>
              <li>No chat, no ads, no links to other websites, and no asking players for information.</li>
              <li>Everything your game needs goes in its own folder (no loading things from other websites).</li>
            </ul>
          </div>
        </div>
      </div>`;
  }

  function render() {
    if (!current || !current.el.isConnected) { current = null; return; }
    if (current.kind === 'slot') {
      const el = current.el;
      const fb = document.querySelector('[data-filter="community"]');
      if (!list) { el.innerHTML = ''; return; }
      if (fb) fb.hidden = failed;
      el.innerHTML = failed ? '' : slotHtml();
      if (A.applyFilter) A.applyFilter();
    } else if (current.kind === 'play') current.el.innerHTML = playHtml(current.id);
    else current.el.innerHTML = creatorsHtml();
  }

  window.Community = {
    handles: id => id === 'creators' || id.startsWith('play-'),
    route(id, el) {
      if (id === 'creators') { current = { kind: 'creators', el }; render(); return 'Make a game'; }
      current = { kind: 'play', el, id: id.slice(5) }; render();
      const g = list && list.find(x => x.id === current.id);
      return g ? g.title : 'Community game';
    },
    slot(el) { current = { kind: 'slot', el }; render(); },
    leave() { current = null; },
  };
})();
