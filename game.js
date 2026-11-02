// DEPLOY RUN — a tiny endless runner drawn on a 320x160 canvas.
// Jump over bugs and crashed servers, grab coins, coffee gives a shield.

const W = 320, H = 160, GROUND = 136;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const sfx = {
  jump: () => beep([[330, 0.05], [520, 0.08]]),
  coin: () => beep([[988, 0.06], [1319, 0.18]]),
  power: () => beep([[523, 0.08], [784, 0.08], [1047, 0.2]]),
  smash: () => beep([[200, 0.08], [120, 0.12]], "sawtooth"),
  over: () => beep([[392, 0.15], [330, 0.15], [262, 0.4]], "triangle"),
  deploy: () => beep([[659, 0.08], [880, 0.08], [1175, 0.2]]),
};
soundButton(document.getElementById("sound-btn"), () => canvas.focus());

// ---------- sprites ----------
const TOP = `
.....kkkkkk.....
....kCCCCCCk....
...kCCCWWCCCk...
...kCCCCCCCCCkk.
...kHHCCCCCCCCCk
...kHHSSSSSkkkk.
...kHSSSSESSk...
...kHSSSSSSSk...
....kSSMMMSk....
.....kSSSSk.....
...kkRRTTRRkk...
..kRRRRTTRRRRk..
.kSkRRRTTRRRkSk.
.kSkRRRTTRRRkSk.
.kSkRRRTTRRRkSk.
..kkRRRRRRRRkk..
...kJJJJJJJJk...`;
const SPR = {
  run1: sprite(TOP + `
...kJJJkkJJJk...
...kJJJk.kJJk...
...kJJk..kJJk...
..kWWWk..kWWWk..
..kkkkk..kkkkk..`),
  run2: sprite(TOP + `
..kJJJk..kJJJk..
.kJJJk....kJJk..
kWWWk......kJJk.
kkkk.......kWWWk
...........kkkkk`),
  bug: sprite(`
.....kkkk.....
...kkGGGGkk...
..kGGGGGGLLk..
.kGGGGGGGGLLk.
.kGGkkGGkkGGk.
kGGGkWGGkWGGGk
kGGGGGGGGGGGGk
kGGGGGkkGGGGGk
kDGGGGGGGGGGDk
.kkkkkkkkkkkk.`),
  server: sprite(`
kkkkkkkkkkkk
kggggggggggk
kgkkkkkkkkgk
kgkrrrrrrkgk
kgkrrWWrrkgk
kgkrrWWrrkgk
kgkrrWWrrkgk
kgkrrrrrrkgk
kgkrrWWrrkgk
kgkrrrrrrkgk
kgkkkkkkkkgk
kggggggggggk
kgYggggggYgk
kggggggggggk
kgYggggggYgk
kkkkkkkkkkkk`),
  coin: sprite(`
..kkkk..
.kYYYYk.
kYYWYYYk
kYYWYYYk
kYYWYYYk
kYYYYYYk
.kYYYYk.
..kkkk..`),
  coffee: sprite(`
..w..w...
...w..w..
.kkkkkk..
.kWWWWkkk
.kWbbWk.k
.kWbbWkkk
.kWWWWk..
..kWWk...
...kk....`),
};
const skyline = new Image();
skyline.src = "assets/sprites/skyline.svg";
const stars = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * (GROUND - 60), Math.random() < 0.3]);

// ---------- game state ----------
let state = "title"; // title | play | paused | over
let player, obstacles, pickups, particles, speed, dist, coins, shield, nextSpawn, nextCoin, nextCoffee, banner, milestone, overAt, frame;
let best = store.get("jb-run-best", 0);
const score = () => Math.floor(dist / 8) + coins * 10;

function reset() {
  player = { x: 36, y: GROUND - 22, vy: 0, w: 16, h: 22, onGround: true, holding: false };
  obstacles = [];
  pickups = [];
  particles = [];
  speed = 90;
  dist = 0;
  coins = 0;
  shield = 0;
  nextSpawn = 140;
  nextCoin = 220;
  nextCoffee = 1400;
  banner = null;
  milestone = 500;
  frame = 0;
}
reset();

// ---------- input ----------
function press() {
  if (state === "title" || (state === "over" && performance.now() - overAt > 500)) {
    reset();
    state = "play";
    if (unlock("gamer")) banner = { text: "ACHIEVEMENT: PLAYER ONE", t: 2 };
  }
  if (state === "paused") { state = "play"; return; }
  if (state === "play" && player.onGround) {
    player.vy = -235;
    player.onGround = false;
    player.holding = true;
    sfx.jump();
  }
}
function release() { player.holding = false; }
function togglePause() {
  if (state === "play") state = "paused";
  else if (state === "paused") state = "play";
}

addEventListener("keydown", (e) => {
  if (e.target.matches("button, a")) return;
  if ([" ", "ArrowUp", "w", "W"].includes(e.key)) { e.preventDefault(); if (!e.repeat) press(); }
  if (["p", "P", "Escape"].includes(e.key)) togglePause();
});
addEventListener("keyup", (e) => { if ([" ", "ArrowUp", "w", "W"].includes(e.key)) release(); });
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); canvas.focus(); press(); });
addEventListener("pointerup", release);
addEventListener("blur", () => state === "play" && (state = "paused"));

// ---------- update ----------
const hit = (a, b, pad = 3) =>
  a.x + pad < b.x + b.w - pad && a.x + a.w - pad > b.x + pad && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y + pad;

function spawnObstacle() {
  const roll = Math.random();
  const make = (type, offset = 0) => {
    const s = SPR[type];
    obstacles.push({ type, x: W + offset, y: GROUND - s.height, w: s.width, h: s.height });
  };
  if (speed > 140 && roll < 0.25) { make("bug"); make("bug", 16); }
  else if (roll < 0.55) make("bug");
  else make("server");
  const gap = 130 + Math.random() * 120;
  nextSpawn = dist + gap * (speed / 110);
}
function spawnCoins() {
  const n = 3 + Math.floor(Math.random() * 3);
  const high = Math.random() < 0.5;
  for (let i = 0; i < n; i++) {
    const arc = high ? Math.sin((i / (n - 1)) * Math.PI) * 26 : 0;
    pickups.push({ type: "coin", x: W + i * 14, y: GROUND - 30 - arc - (high ? 12 : 0), w: 8, h: 8 });
  }
  nextCoin = dist + 260 + Math.random() * 320;
}
function burst(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120, life: 0.5, color });
  }
}

function update(dt) {
  frame += dt;
  speed = Math.min(220, speed + dt * 2.2);
  const dx = speed * dt;
  dist += dx;

  // player physics: release early for a short hop
  const gravity = player.vy < 0 && !player.holding ? 1400 : 700;
  player.vy += gravity * dt;
  player.y += player.vy * dt;
  if (player.y >= GROUND - player.h) {
    player.y = GROUND - player.h;
    player.vy = 0;
    player.onGround = true;
  }
  if (shield > 0) shield -= dt;

  if (dist >= nextSpawn) spawnObstacle();
  if (dist >= nextCoin) spawnCoins();
  if (dist >= nextCoffee) {
    pickups.push({ type: "coffee", x: W, y: GROUND - 56, w: 9, h: 9 });
    nextCoffee = dist + 1800 + Math.random() * 1200;
  }

  for (const o of obstacles) o.x -= dx;
  for (const p of pickups) p.x -= dx;
  obstacles = obstacles.filter((o) => o.x + o.w > -10 && !o.dead);
  pickups = pickups.filter((p) => p.x + p.w > -10 && !p.dead);

  for (const p of pickups) {
    if (!hit(player, p, 0)) continue;
    p.dead = true;
    if (p.type === "coin") { coins++; sfx.coin(); burst(p.x + 4, p.y + 4, "#ffcd4a", 5); }
    else { shield = 6; sfx.power(); banner = { text: "CAFFEINATED! SHIELD ON", t: 1.6 }; }
  }
  for (const o of obstacles) {
    if (!hit(player, o)) continue;
    if (shield > 0) {
      o.dead = true;
      dist += 40;
      sfx.smash();
      burst(o.x + o.w / 2, o.y + o.h / 2, o.type === "bug" ? "#38d46a" : "#ef4f63", 12);
    } else {
      gameOver();
      return;
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }
  particles = particles.filter((p) => p.life > 0);

  if (score() >= milestone) {
    banner = { text: `v1.${milestone / 500} DEPLOYED!`, t: 1.6 };
    milestone += 500;
    sfx.deploy();
  }
  if (score() >= 1000 && unlock("shipper")) banner = { text: "ACHIEVEMENT: SHIP IT", t: 2 };
  if (banner && (banner.t -= dt) <= 0) banner = null;
}

function gameOver() {
  state = "over";
  overAt = performance.now();
  sfx.over();
  burst(player.x + 8, player.y + 10, "#ef4f63", 16);
  if (score() > best) { best = score(); store.set("jb-run-best", best); }
  renderBest();
}

// ---------- draw ----------
const text = (...args) => drawText(ctx, ...args);

function draw() {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#12122a");
  g.addColorStop(1, "#1a1c3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, twinkle] of stars) {
    if (twinkle && Math.floor(frame * 2 + x) % 3 === 0) continue;
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(Math.floor((x - dist * 0.02 + W * 10) % W), Math.floor(y), 1, 1);
  }
  // parallax city
  if (skyline.complete) {
    const off = Math.floor((dist * 0.25) % 320);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(skyline, -off, GROUND - 64);
    ctx.drawImage(skyline, 320 - off, GROUND - 64);
    ctx.globalAlpha = 1;
  }
  // ground: grass strip + dirt, scrolling checker
  const goff = Math.floor(dist % 16);
  for (let x = -goff; x < W; x += 16) {
    ctx.fillStyle = "#38b764";
    ctx.fillRect(x, GROUND, 8, 4);
    ctx.fillStyle = "#257953";
    ctx.fillRect(x + 8, GROUND, 8, 4);
  }
  ctx.fillStyle = "#5a3a1e";
  ctx.fillRect(0, GROUND + 4, W, H - GROUND - 4);
  ctx.fillStyle = "#4a2f17";
  for (let x = -goff; x < W; x += 16) ctx.fillRect(x + 3, GROUND + 10, 2, 2);

  for (const p of pickups) {
    const bob = Math.round(Math.sin(frame * 6 + p.x * 0.1) * 1.5);
    ctx.drawImage(SPR[p.type], Math.round(p.x), Math.round(p.y) + bob);
  }
  for (const o of obstacles) {
    const squish = o.type === "bug" && Math.floor(frame * 6) % 2 ? 1 : 0;
    ctx.drawImage(SPR[o.type], Math.round(o.x), Math.round(o.y) + squish);
  }

  // player
  if (state !== "over" || Math.floor(frame * 8) % 2) {
    const img = !player.onGround || (state === "play" && Math.floor(frame * 10) % 2) ? SPR.run2 : SPR.run1;
    if (shield > 0) {
      ctx.fillStyle = Math.floor(frame * 10) % 2 ? "#41a6f6" : "#ffcd4a";
      ctx.globalAlpha = shield < 1.5 && Math.floor(frame * 12) % 2 ? 0.2 : 0.45;
      ctx.fillRect(Math.round(player.x) - 3, Math.round(player.y) - 3, player.w + 6, player.h + 6);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, Math.round(player.x), Math.round(player.y));
  }
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }

  // HUD
  text(`SCORE ${pad(score())}`, 6, 6);
  text(`HI ${pad(best)}`, W - 6, 6, "#ffcd4a", 8, "right");
  ctx.drawImage(SPR.coin, 6, 18);
  text(`x${pad(coins, 2)}`, 16, 18, "#ffcd4a");
  if (banner) text(banner.text, W / 2, 34, "#38d46a", 8, "center");

  if (state === "title") {
    shade();
    text("DEPLOY RUN", W / 2, 42, "#ffcd4a", 16, "center");
    text("Jump the bugs. Ship the build.", W / 2, 68, "#9aa0c8", 8, "center");
    if (Math.floor(frame * 2) % 2 === 0) text("PRESS SPACE OR TAP", W / 2, 92, "#e8e8f4", 8, "center");
  } else if (state === "paused") {
    shade();
    text("PAUSED", W / 2, 60, "#ffcd4a", 16, "center");
    text("SPACE / TAP TO RESUME", W / 2, 88, "#e8e8f4", 8, "center");
  } else if (state === "over") {
    shade();
    text("BUILD FAILED", W / 2, 40, "#ef4f63", 16, "center");
    text(`SCORE ${pad(score())}   COINS ${coins}`, W / 2, 66, "#e8e8f4", 8, "center");
    if (score() > 0 && score() >= best) text("NEW HIGH SCORE!", W / 2, 80, "#ffcd4a", 8, "center");
    if (Math.floor(frame * 2) % 2 === 0) text("SPACE / TAP TO RETRY", W / 2, 100, "#e8e8f4", 8, "center");
  }
}
function shade() {
  ctx.fillStyle = "#05061299";
  ctx.fillRect(0, 0, W, H);
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "play") update(dt);
  else frame += dt;
  draw();
  requestAnimationFrame(loop);
}

const bestEl = document.getElementById("best");
function renderBest() { bestEl.textContent = pad(best); }
renderBest();

document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(loop));
