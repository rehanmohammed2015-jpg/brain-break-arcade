/* Mole Rush: bonk moles in a sunset garden. Gold moles are worth more, helmet moles take two bonks,
   and skunks cost you time. Chain 10 bonks for Fever mode. */
(function () {
  const A = Arcade;
  const W = 400, H = 600, ROUND = 45;
  const BEST = 'mr-best';
  // hole centers, back row first (smaller, higher)
  const HOLES = [];
  [[262, 0.78], [382, 0.9], [506, 1]].forEach(([y, s], r) => [-1, 0, 1].forEach(c => HOLES.push({ x: 200 + c * (118 + r * 8), y, s })));
  const KEYS = '789456123';

  A.register({
    id: 'mole-rush',
    section: 'play',
    isNew: true,
    title: 'Mole Rush',
    color: 'words',
    artBg: 'linear-gradient(180deg, #ff9a6b 0%, #c4507a 45%, #2f6b3a 46%, #24542e 100%)',
    art: `<svg width="170" height="120" viewBox="0 0 170 120" aria-hidden="true">
      <ellipse cx="85" cy="100" rx="56" ry="15" fill="#3b2516"/><ellipse cx="85" cy="97" rx="46" ry="10" fill="#160c06"/>
      <path d="M52 97 Q52 40 85 38 Q118 40 118 97 Z" fill="#9a6a45"/><ellipse cx="85" cy="78" rx="20" ry="16" fill="#e0b48c"/>
      <circle cx="74" cy="62" r="5" fill="#160c06"/><circle cx="96" cy="62" r="5" fill="#160c06"/><circle cx="75.5" cy="60.5" r="1.6" fill="#fff"/><circle cx="97.5" cy="60.5" r="1.6" fill="#fff"/>
      <ellipse cx="85" cy="72" rx="6" ry="4.5" fill="#ff7a9a"/><path d="M80 82 h10 v7 h-10z" fill="#fff"/>
      <g transform="rotate(-30 128 30)"><rect x="118" y="2" width="44" height="26" rx="6" fill="#ffd878"/><rect x="136" y="26" width="8" height="46" rx="3" fill="#8a5a33"/></g>
      <text x="30" y="34" font-size="22" fill="#fff6c4">✦</text></svg>`,
    blurb: 'Bonk the moles before they duck. Gold moles are worth triple, helmet moles take two hits, and skunks steal your time. Chain 10 bonks to trigger Fever.',
    tags: ['Reflexes', '45 sec', 'Fever mode'],
    best() { const b = A.store.get(BEST, 0); return b ? b + ' pts' : null; },
    mount(el) {
      let raf = 0, g = null, last = 0, bg = null;
      const fx = A.particles();

      function intro() {
        el.innerHTML = `
          <div class="intro">
            <h2 class="h2">Bonk the moles, skip the skunks</h2>
            <p>You have 45 seconds. Brown moles are 10 points, gold moles are 30, and helmet moles need two bonks. Hitting a skunk costs 3 seconds and your combo.</p>
            <p>Every bonk in a row raises your combo. Reach 10 for Fever: everything turns gold for a few seconds. On a keyboard, the number pad (or 1–9) matches the holes.</p>
          </div>
          <div class="row" style="justify-content:flex-start;margin-top:22px">
            <button class="btn primary" data-act="go">Start bonking</button>
            <span class="best" style="align-self:center">High score: <b>${A.store.get(BEST, 0)}</b></span>
          </div>`;
      }

      // the garden background is drawn once and reused
      function makeBg() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        let gr = x.createLinearGradient(0, 0, 0, 230);
        gr.addColorStop(0, '#2b2a6b'); gr.addColorStop(0.45, '#c4507a'); gr.addColorStop(1, '#ffb36b');
        x.fillStyle = gr; x.fillRect(0, 0, W, 240);
        // sun
        const sg = x.createRadialGradient(290, 200, 0, 290, 200, 90);
        sg.addColorStop(0, '#fff3c4'); sg.addColorStop(0.3, '#ffd27a'); sg.addColorStop(1, 'rgba(255,190,110,0)');
        x.fillStyle = sg; x.fillRect(180, 100, 220, 160);
        x.fillStyle = '#ffe8a8'; x.beginPath(); x.arc(290, 205, 34, 0, Math.PI * 2); x.fill();
        // stars
        for (let i = 0; i < 40; i++) { x.globalAlpha = Math.random() * 0.7; x.fillStyle = '#fff'; x.fillRect(Math.random() * W, Math.random() * 90, 1.5, 1.5); }
        x.globalAlpha = 1;
        // hills
        const hill = (y, col, amp, f) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let px = 0; px <= W; px += 10) x.lineTo(px, y + Math.sin(px * f) * amp); x.lineTo(W, H); x.fill(); };
        hill(212, '#6b3f74', 14, 0.018); hill(226, '#3f5e45', 10, 0.03);
        // lawn with mowed stripes
        gr = x.createLinearGradient(0, 230, 0, H);
        gr.addColorStop(0, '#3f8a45'); gr.addColorStop(1, '#25602e');
        x.fillStyle = gr; x.fillRect(0, 234, W, H);
        for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; x.beginPath(); x.moveTo(i * 50 - 40, H); x.lineTo(i * 50 + 10, H); x.lineTo(200 + (i - 4) * 18 + 9, 234); x.lineTo(200 + (i - 4) * 18, 234); x.fill(); }
        // grass tufts
        for (let i = 0; i < 160; i++) {
          const gx = Math.random() * W, gy = 240 + Math.random() * (H - 240), s = 0.5 + gy / H;
          x.strokeStyle = Math.random() < 0.5 ? '#5fb85a' : '#2f7536'; x.lineWidth = 1.4 * s;
          x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 2 * s, gy - 6 * s); x.moveTo(gx, gy); x.lineTo(gx + 2.5 * s, gy - 7 * s); x.stroke();
        }
        // flowers
        for (let i = 0; i < 14; i++) {
          const fxp = Math.random() * W, fy = 250 + Math.random() * 330;
          x.fillStyle = ['#ffd878', '#ff9cc8', '#ffffff', '#b79cff'][i % 4];
          for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(fxp + Math.cos(k * 1.26) * 3, fy + Math.sin(k * 1.26) * 3, 2.2, 0, Math.PI * 2); x.fill(); }
          x.fillStyle = '#f5a623'; x.beginPath(); x.arc(fxp, fy, 1.6, 0, Math.PI * 2); x.fill();
        }
        // holes: dirt mound + dark hole
        for (const h of HOLES) {
          x.save(); x.translate(h.x, h.y); x.scale(h.s, h.s);
          x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(0, 10, 58, 18, 0, 0, Math.PI * 2); x.fill();
          const mg = x.createLinearGradient(0, -14, 0, 18); mg.addColorStop(0, '#8a5a36'); mg.addColorStop(1, '#4a2e1a');
          x.fillStyle = mg; x.beginPath(); x.ellipse(0, 4, 54, 17, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#140a04'; x.beginPath(); x.ellipse(0, 0, 42, 11, 0, 0, Math.PI * 2); x.fill();
          x.restore();
        }
        return c;
      }

      function start() {
        el.innerHTML = '';
        const { cv, ctx, toLogical } = A.makeCanvas(el, W, H);
        cv.setAttribute('aria-label', 'Mole Rush garden. Tap moles, or use number keys 1 to 9.');
        if (!bg) bg = makeBg();
        g = { ctx, cv, score: 0, combo: 0, bestCombo: 0, bonks: 0, left: ROUND, fever: 0, holes: HOLES.map(() => null), spawn: 0.5,
          hammer: null, flash: 0, over: false, t: 0 };
        cv.onpointerdown = e => { e.preventDefault(); const p = toLogical(e); hit(p.x, p.y); };
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }

      function spawnOne() {
        const free = g.holes.map((h, i) => (h ? -1 : i)).filter(i => i >= 0);
        if (!free.length) return;
        const i = free[A.rand(0, free.length - 1)];
        const prog = 1 - g.left / ROUND, r = Math.random();
        let type = 'mole';
        if (g.fever > 0) type = 'gold';
        else if (r < 0.1 + prog * 0.1) type = 'skunk';
        else if (r < 0.22 + prog * 0.1) type = 'gold';
        else if (r < 0.36 + prog * 0.12) type = 'helmet';
        const up = (type === 'gold' ? 0.75 : type === 'skunk' ? 1.5 : 1.25) - prog * 0.4;
        g.holes[i] = { type, hp: type === 'helmet' ? 2 : 1, t: 0, up: Math.max(0.5, up), state: 'rise', k: 0, hitT: 0, wob: Math.random() * 6 };
      }

      function holeAt(x, y) {
        let best = -1, bd = Infinity;
        HOLES.forEach((h, i) => {
          const dx = (x - h.x) / h.s, dy = (y - (h.y - 52 * h.s)) / h.s;
          const d = dx * dx / (62 * 62) + dy * dy / (76 * 76);
          if (d < 1 && d < bd) { bd = d; best = i; }
        });
        return best;
      }

      function hit(x, y, forced) {
        if (!g || g.over) return;
        const i = forced != null ? forced : holeAt(x, y);
        const h = i >= 0 ? HOLES[i] : null;
        g.hammer = { x: h ? h.x + 18 * h.s : x, y: h ? h.y - 60 * h.s : y, t: 0.18 };
        A.sound.play('swish');
        const m = i >= 0 ? g.holes[i] : null;
        if (!m || m.state === 'down' || m.state === 'bonked' || m.k < 0.35) {
          if (g.combo > 2) fx.text(h ? h.x : x, (h ? h.y - 70 * h.s : y), 'miss', '#ffffff', 14);
          g.combo = 0; return;
        }
        const top = h.y - 70 * h.s;
        if (m.type === 'skunk') {
          m.state = 'bonked'; m.hitT = 0;
          g.left = Math.max(0, g.left - 3); g.combo = 0; g.flash = 0.35;
          fx.burst(h.x, top, ['#b6ff6b', '#8fd14f', '#e9ffc4'], 18, { speed: 140, gravity: -40, life: 0.9, shape: 'dot', size: 8 });
          fx.text(h.x, top - 18, '−3 sec', '#ff6b7a', 20); fx.shake(7);
          return;
        }
        m.hp--;
        if (m.hp > 0) { // helmet pops off
          fx.burst(h.x, top - 8, ['#c9d3e6', '#8b97b3', '#ffffff'], 10, { speed: 200, size: 5 });
          A.sound.play('post'); m.helmetOff = 0.01; m.t = Math.min(m.t, m.up * 0.5);
          return;
        }
        m.state = 'bonked'; m.hitT = 0;
        g.combo++; g.bonks++; g.bestCombo = Math.max(g.bestCombo, g.combo);
        const mult = g.combo >= 20 ? 3 : g.combo >= 8 ? 2 : 1;
        const base = m.type === 'gold' ? 30 : m.type === 'helmet' ? 20 : 10;
        const pts = base * mult;
        g.score += pts;
        fx.burst(h.x, top, m.type === 'gold' ? ['#ffd878', '#fff6c4', '#ff9f43'] : ['#ffffff', '#ffd878', '#ff9cc8'], 14, { speed: 220, shape: 'confetti' });
        fx.ring(h.x, top, m.type === 'gold' ? '#ffd878' : '#ffffff', 44 * h.s);
        fx.text(h.x, top - 20, '+' + pts, m.type === 'gold' ? '#ffd878' : '#ffffff', mult > 1 ? 24 : 19);
        fx.shake(m.type === 'gold' ? 5 : 3, 0.15);
        if (g.combo === 10 || g.combo === 25) { g.fever = 4; fx.text(W / 2, 200, 'FEVER!', '#ffd878', 38); A.sound.play('roar'); }
      }

      function loop(now) {
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        if (!g) return;
        if (!g.over) update(dt);
        fx.update(dt);
        render();
        if (g.over && !g.shown) { g.shown = true; setTimeout(finish, 650); }
        raf = requestAnimationFrame(loop);
      }

      function update(dt) {
        g.t += dt;
        g.left = Math.max(0, g.left - dt);
        g.fever = Math.max(0, g.fever - dt);
        g.flash = Math.max(0, g.flash - dt);
        if (g.hammer) { g.hammer.t -= dt; if (g.hammer.t <= 0) g.hammer = null; }
        const prog = 1 - g.left / ROUND;
        g.spawn -= dt;
        if (g.spawn <= 0) {
          spawnOne(); if (prog > 0.5 && Math.random() < 0.35) spawnOne();
          g.spawn = (g.fever > 0 ? 0.3 : 0.72 - prog * 0.36) * (0.75 + Math.random() * 0.5);
        }
        g.holes.forEach((m, i) => {
          if (!m) return;
          m.t += dt;
          if (m.helmetOff) m.helmetOff += dt;
          if (m.state === 'rise') { m.k = Math.min(1, m.k + dt / 0.14); if (m.k >= 1) m.state = 'up'; }
          else if (m.state === 'up') { if (m.t > m.up) m.state = 'down'; }
          else if (m.state === 'down') {
            m.k -= dt / 0.16;
            if (m.k <= 0) { if (m.type !== 'skunk' && !m.wasHit) g.combo = 0; g.holes[i] = null; }
          } else if (m.state === 'bonked') {
            m.hitT += dt; m.wasHit = true;
            if (m.hitT > 0.28) { m.k -= dt / 0.12; if (m.k <= 0) g.holes[i] = null; }
          }
        });
        if (g.left <= 0) { g.over = true; A.sound.play('whistle'); }
      }

      function drawMole(ctx, h, m) {
        const s = h.s, k = Math.max(0, m.k);
        const ease = 1 - Math.pow(1 - k, 3);
        const bonk = m.state === 'bonked' ? Math.min(1, m.hitT / 0.08) : 0;
        const rise = 78 * ease;
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.scale(s, s);
        // clip to above the hole rim so the mole comes out of the ground
        ctx.beginPath(); ctx.rect(-70, -140, 140, 140); ctx.ellipse(0, 0, 42, 11, 0, 0, Math.PI, false); ctx.clip();
        const sq = m.state === 'bonked' ? 1 - 0.3 * bonk : 1 + Math.sin(m.t * 10 + m.wob) * 0.02;
        ctx.translate(0, 18 - rise);
        ctx.scale(1 + (1 - sq) * 0.8, sq);
        const gold = m.type === 'gold', skunk = m.type === 'skunk';
        const fur = gold ? '#f2b833' : skunk ? '#2b2b3a' : '#9a6a45';
        const fur2 = gold ? '#ffe28a' : skunk ? '#4a4a60' : '#b88259';
        // body
        let gr = ctx.createLinearGradient(-34, -60, 34, 10);
        gr.addColorStop(0, fur2); gr.addColorStop(1, fur);
        ctx.fillStyle = gr;
        // the body runs down into the hole, so the mole always looks rooted in the ground
        ctx.beginPath(); ctx.moveTo(-36, 100); ctx.lineTo(-35, 20); ctx.quadraticCurveTo(-36, -58, 0, -60); ctx.quadraticCurveTo(36, -58, 35, 20); ctx.lineTo(36, 100); ctx.closePath(); ctx.fill();
        if (skunk) { ctx.fillStyle = '#f4f4ff'; ctx.beginPath(); ctx.moveTo(-6, -60); ctx.quadraticCurveTo(0, -20, -4, 100); ctx.lineTo(6, 100); ctx.quadraticCurveTo(10, -20, 6, -60); ctx.fill(); }
        // muzzle
        ctx.fillStyle = gold ? '#fff1c0' : skunk ? '#e8e8f4' : '#e0b48c';
        ctx.beginPath(); ctx.ellipse(0, -18, 19, 15, 0, 0, Math.PI * 2); ctx.fill();
        // eyes
        const dazed = m.state === 'bonked';
        ctx.strokeStyle = '#160c06'; ctx.fillStyle = '#160c06'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const ex of [-12, 12]) {
          if (dazed) { ctx.beginPath(); ctx.moveTo(ex - 4, -38); ctx.lineTo(ex + 4, -32); ctx.moveTo(ex + 4, -38); ctx.lineTo(ex - 4, -32); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(ex, -35, 4.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.5, -36.5, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#160c06'; }
        }
        if (skunk && !dazed) { ctx.strokeStyle = '#160c06'; ctx.beginPath(); ctx.moveTo(-18, -44); ctx.lineTo(-7, -41); ctx.moveTo(18, -44); ctx.lineTo(7, -41); ctx.stroke(); }
        // nose + teeth
        ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(0, -24, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        if (!skunk) { ctx.fillStyle = '#fff'; ctx.fillRect(-5, -14, 4.5, 6); ctx.fillRect(0.5, -14, 4.5, 6); }
        // paws on the rim
        ctx.fillStyle = fur2;
        ctx.beginPath(); ctx.ellipse(-27, 56, 11, 7, 0.3, 0, Math.PI * 2); ctx.ellipse(27, 56, 11, 7, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5;
        for (const px of [-27, 27]) for (const d of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(px + d, 58); ctx.lineTo(px + d, 62); ctx.stroke(); }
        // helmet
        if (m.type === 'helmet' && m.hp > 1) {
          gr = ctx.createLinearGradient(-30, -80, 30, -40); gr.addColorStop(0, '#e8eef8'); gr.addColorStop(1, '#7d8aa8');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, -50, 33, 22, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(-36, -51, 72, 6);
          ctx.fillStyle = '#ffffff99'; ctx.beginPath(); ctx.ellipse(-12, -62, 8, 4, -0.5, 0, Math.PI * 2); ctx.fill();
        }
        if (gold) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + Math.sin(m.t * 12) * 0.15; ctx.drawImage(A.glow('#ffd878'), -60, -100, 120, 120); }
        ctx.restore();
        // flying helmet
        if (m.helmetOff && m.helmetOff < 0.6) {
          const t = m.helmetOff;
          ctx.save(); ctx.translate(h.x + t * 160 * s, h.y - (78 + 50) * s - (t * 260 - t * t * 600) * s); ctx.rotate(t * 9); ctx.scale(s, s);
          ctx.globalAlpha = 1 - t / 0.6; ctx.fillStyle = '#c9d3e6'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, Math.PI, 0); ctx.fill(); ctx.restore();
        }
        // dizzy stars
        if (dazed && m.type !== 'skunk') {
          ctx.fillStyle = '#ffd878'; ctx.font = `${16 * s}px sans-serif`; ctx.textAlign = 'center';
          for (let k2 = 0; k2 < 3; k2++) { const a = m.hitT * 9 + k2 * 2.1; ctx.fillText('✦', h.x + Math.cos(a) * 26 * s, h.y - (rise + 52) * s + Math.sin(a) * 7 * s); }
        }
      }

      function render() {
        const ctx = g.ctx;
        A.fxFrame(ctx, fx, () => {
          ctx.drawImage(bg, 0, 0, W, H);
          HOLES.forEach((h, i) => { const m = g.holes[i]; if (m) drawMole(ctx, h, m); });
          // hammer
          if (g.hammer) {
            const k = g.hammer.t / 0.18;
            ctx.save(); ctx.translate(g.hammer.x + 30, g.hammer.y + 10); ctx.rotate(-0.2 - k * 1.1);
            ctx.fillStyle = '#8a5a33'; ctx.fillRect(-4, -4, 8, 62);
            const hg = ctx.createLinearGradient(-26, -30, 26, 0); hg.addColorStop(0, '#ffe28a'); hg.addColorStop(1, '#e09a2a');
            ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-28, -26, 56, 30, 8) : ctx.rect(-28, -26, 56, 30); ctx.fill();
            ctx.fillStyle = '#ffffff55'; ctx.fillRect(-22, -22, 44, 5);
            ctx.restore();
          }
          fx.draw(ctx);
          // fever glow + skunk flash
          if (g.fever > 0) { ctx.fillStyle = `rgba(255,216,120,${0.08 + Math.sin(g.t * 14) * 0.05})`; ctx.fillRect(0, 0, W, H); }
          if (g.flash > 0) { ctx.fillStyle = `rgba(150,255,90,${g.flash})`; ctx.fillRect(0, 0, W, H); }
          // HUD
          ctx.fillStyle = 'rgba(12,14,34,.62)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(12, 12, W - 24, 58, 14) : ctx.rect(12, 12, W - 24, 58); ctx.fill();
          ctx.textAlign = 'left'; ctx.fillStyle = '#a5a4c2'; ctx.font = '500 10px "DM Mono", monospace';
          ctx.fillText('SCORE', 26, 32); ctx.fillText('COMBO', 150, 32); ctx.textAlign = 'right'; ctx.fillText('TIME', W - 26, 32);
          ctx.textAlign = 'left'; ctx.fillStyle = '#f7f4ff'; ctx.font = '700 24px "Space Grotesk", sans-serif';
          ctx.fillText(g.score, 26, 58);
          const mult = g.combo >= 20 ? 3 : g.combo >= 8 ? 2 : 1;
          ctx.fillStyle = mult > 1 ? '#ffd878' : '#f7f4ff'; ctx.fillText(g.combo + (mult > 1 ? `  ×${mult}` : ''), 150, 58);
          ctx.textAlign = 'right'; ctx.fillStyle = g.left < 8 ? '#ff6b7a' : '#cbf56a'; ctx.fillText(Math.ceil(g.left), W - 26, 58);
          // time bar
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(24, 76, W - 48, 5);
          ctx.fillStyle = g.fever > 0 ? '#ffd878' : g.left < 8 ? '#ff6b7a' : '#cbf56a'; ctx.fillRect(24, 76, (W - 48) * (g.left / ROUND), 5);
          if (g.fever > 0) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffd878'; ctx.font = '700 15px "Space Grotesk", sans-serif'; ctx.fillText(`FEVER ${g.fever.toFixed(1)}s`, W / 2, 104); }
          ctx.textAlign = 'start';
        }, true);
      }

      function finish() {
        cancelAnimationFrame(raf); raf = 0;
        const prev = A.store.get(BEST, 0), isBest = g.score > prev;
        if (isBest) A.store.set(BEST, g.score);
        el.innerHTML = `<div class="result">
          <div class="label">Time’s up!</div>
          <div class="big">${g.score}</div>
          <div class="label">points</div>
          ${isBest ? '<div class="newbest">New high score!</div>' : `<p class="best">High score: ${prev}</p>`}
          <div class="result-stats"><div class="stat"><small>Bonks</small><b>${g.bonks}</b></div><div class="stat"><small>Best combo</small><b>${g.bestCombo}</b></div></div>
          <div class="row"><button class="btn primary" data-act="go">Play again</button></div></div>`;
        g = null;
      }

      el.onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.act === 'go') start(); };
      const onKey = e => {
        if (!g || g.over) return;
        let i = KEYS.indexOf(e.key);
        if (i < 0) i = 'qweasdzxc'.indexOf(e.key.toLowerCase());
        if (i >= 0 && e.key.length === 1) { e.preventDefault(); hit(0, 0, i); }
      };
      document.addEventListener('keydown', onKey);
      intro();
      return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); g = null; };
    },
  });
})();
