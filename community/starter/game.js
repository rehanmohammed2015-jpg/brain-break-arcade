// STAR CATCHER — a starter game. Change anything you like!
// Move with the arrow keys (or drag with your finger). Catch the stars, dodge the red rocks.
// Ideas to try: make the player faster, add a timer, add a second kind of star, change the colors.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let player = { x: W / 2, y: H - 40, size: 24, speed: 4 };
let stars = [], rocks = [], score = 0, lives = 3, frame = 0, gameOver = false;
const keys = {};

addEventListener('keydown', e => { keys[e.key] = true; if (gameOver && e.key === ' ') restart(); });
addEventListener('keyup', e => { keys[e.key] = false; });
canvas.addEventListener('pointermove', e => {
  if (e.buttons || e.pointerType !== 'mouse') {
    const r = canvas.getBoundingClientRect();
    player.x = (e.clientX - r.left) / r.width * W;
  }
});
canvas.addEventListener('pointerdown', () => { if (gameOver) restart(); });

function restart() { stars = []; rocks = []; score = 0; lives = 3; gameOver = false; }

function update() {
  if (gameOver) return;
  frame++;
  if (keys.ArrowLeft) player.x -= player.speed;
  if (keys.ArrowRight) player.x += player.speed;
  player.x = Math.max(player.size / 2, Math.min(W - player.size / 2, player.x));

  // new things fall from the top
  if (frame % 40 === 0) stars.push({ x: Math.random() * W, y: -10, speed: 2 + Math.random() * 2 });
  if (frame % 70 === 0) rocks.push({ x: Math.random() * W, y: -10, speed: 2.5 + score / 20 });

  for (const s of stars) s.y += s.speed;
  for (const r of rocks) r.y += r.speed;

  // catching and crashing
  const near = (a, dist) => Math.abs(a.x - player.x) < dist && Math.abs(a.y - player.y) < dist;
  stars = stars.filter(s => { if (near(s, 22)) { score++; return false; } return s.y < H + 20; });
  rocks = rocks.filter(r => { if (near(r, 22)) { lives--; return false; } return r.y < H + 20; });
  if (lives <= 0) gameOver = true;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffd878';
  for (const s of stars) { ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff6b7a';
  for (const r of rocks) ctx.fillRect(r.x - 10, r.y - 10, 20, 20);
  ctx.fillStyle = '#cbf56a';
  ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);

  ctx.fillStyle = '#f7f4ff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Stars: ' + score + '   Lives: ' + lives, 12, 26);
  if (gameOver) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('Game over! ' + score + ' stars', W / 2, H / 2);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Press Space or tap to play again', W / 2, H / 2 + 30);
    ctx.textAlign = 'left';
  }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
