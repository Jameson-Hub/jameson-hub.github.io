// BUG STRIKE — a vertical shooter on a 240x320 canvas.
// The jet fires on its own; you steer. Clear waves of bugs, beat the boss every 5th wave.

const W = 240, H = 320;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const text = (...args) => drawText(ctx, ...args);

const sfx = {
  shot: () => beep([[880, 0.03]], "square", 0.02),
  pop: () => beep([[300, 0.05], [160, 0.08]], "sawtooth", 0.05),
  hurt: () => beep([[200, 0.1], [90, 0.25]], "sawtooth"),
  power: () => beep([[523, 0.07], [784, 0.07], [1047, 0.18]]),
  boss: () => beep([[110, 0.2], [98, 0.2], [110, 0.2], [82, 0.4]], "triangle", 0.08),
  win: () => beep([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.35]]),
  over: () => beep([[392, 0.15], [330, 0.15], [262, 0.4]], "triangle"),
};
soundButton(document.getElementById("sound-btn"), () => canvas.focus());

// ---------- sprites ----------
const SPR = {
  jet: sprite(`
......k......
.....kWk.....
.....kWk.....
....kWYWk....
....kWYWk....
...kWWWWWk...
..kBWWWWWBk..
.kBBWWWWWBBk.
kBBkWWWWWkBBk
kBk.kWWWk.kBk
kk..kWkWk..kk
....kk.kk....`),
  drone: sprite(`
k.........k
Lk.......kL
.LkkGGGkkL.
..kGGGGGk..
.kGkWGWkGk.
.kGGGGGGGk.
..kGkGkGk..
..k.k.k.k..`),
  glitch: sprite(`
....k....
...kPk...
..kPWPk..
.kPPPPPk.
kPPWPWPPk
.kPPPPPk.
..kPPPk..
...kPk...
....k....`),
  malware: sprite(`
.....k.....
..k.kXk.k..
...kXXXk...
.kkXXXXXkk.
kXXXkXkXXXk
.kXXXXXXXk.
..kXkkkXk..
...kXXXk...
..k.kXk.k..
.....k.....`),
  boss: sprite(`
......kkkkkkkkkkkk......
....kkVVVVVVVVVVVVkk....
...kVVVVVVVVVVVVVVVVk...
..kVVVkkkVVVVVVkkkVVVk..
.kVVVkWWWkVVVVkWWWkVVVk.
.kVVVkWkWkVVVVkWkWkVVVk.
kVVVVVkkkVVVVVVkkkVVVVVk
kVVVVVVVVVVVVVVVVVVVVVVk
kVVVkVVVVVVVVVVVVVVkVVVk
kVVVVkkkkkkkkkkkkkkVVVVk
.kVVVkrrrrrrrrrrrrkVVVk.
..kVVVkkkkkkkkkkkkVVVk..
...kVVVVVVVVVVVVVVVVk...
..kVk.kVk.kVVk.kVk.kVk..
..kk..kk...kk...kk..kk..`),
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
  spread: sprite(`
..kkkk..
.kBBBBk.
kBWBBWBk
kBBWWBBk
kBBWWBBk
kBWBBWBk
.kBBBBk.
..kkkk..`),
  heart: sprite(`
.kk.kk.
kXXkXXk
kXWXXXk
kXXXXXk
.kXXXk.
..kXk..
...k...`),
  coin: sprite(`
..kkkk..
.kYYYYk.
kYYWYYYk
kYYWYYYk
kYYWYYYk
kYYYYYYk
.kYYYYk.
..kkkk..`),
};
const skyline = new Image();
skyline.src = "assets/sprites/skyline.svg";
const starLayers = [
  Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * H]),
  Array.from({ length: 20 }, () => [Math.random() * W, Math.random() * H]),
];

const ENEMY = {
  drone: { hp: 1, score: 10, speed: 34 },
  glitch: { hp: 1, score: 20, speed: 70 },
  malware: { hp: 3, score: 30, speed: 26 },
};

// ---------- state ----------
let state = "title"; // title | play | paused | over
let jet, shots, foes, enemyShots, drops, sparks, score, lives, wave, toSpawn, spawnTimer, boss, banner, t, overAt;
let rapid, spread, fireTimer, kills;
let best = store.get("jb-jet-best", 0);

function reset() {
  jet = { x: W / 2 - 6, y: H - 44, w: 13, h: 12, inv: 0 };
  shots = [];
  foes = [];
  enemyShots = [];
  drops = [];
  sparks = [];
  score = 0;
  lives = 3;
  wave = 0;
  boss = null;
  banner = null;
  t = 0;
  rapid = 0;
  spread = 0;
  fireTimer = 0;
  kills = 0;
  nextWave();
}
reset();

function nextWave() {
  wave++;
  if (wave % 5 === 0) {
    const n = wave / 5;
    boss = { x: W / 2 - 12, y: -24, w: 24, h: 15, hp: 40 + n * 20, max: 40 + n * 20, dir: 1, fire: 2, n };
    toSpawn = 0;
    banner = { text: "WARNING: MEMORY LEAK", t: 2.4, color: "#ef4f63" };
    sfx.boss();
  } else {
    toSpawn = 6 + wave * 2;
    banner = { text: `WAVE ${wave}`, t: 1.6, color: "#ffcd4a" };
  }
  spawnTimer = 1.2;
}

// ---------- input: keys steer, pointer drags the jet ----------
const keys = new Set();
let drag = null;
function start() {
  if (state === "title" || (state === "over" && performance.now() - overAt > 600)) {
    reset();
    state = "play";
    if (unlock("ace")) banner = { text: "ACHIEVEMENT: ACE PILOT", t: 2, color: "#38d46a" };
  } else if (state === "paused") state = "play";
}
function togglePause() {
  if (state === "play") state = "paused";
  else if (state === "paused") state = "play";
}
addEventListener("keydown", (e) => {
  if (e.target.matches("button, a")) return;
  const k = e.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
  if (k === " " || k === "enter") start();
  if (k === "p" || k === "escape") togglePause();
  keys.add(k);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
const toCanvas = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
};
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  if (state !== "play") { start(); return; }
  const p = toCanvas(e);
  drag = { dx: jet.x - p.x, dy: jet.y - p.y };
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || state !== "play") return;
  const p = toCanvas(e);
  jet.x = p.x + drag.dx;
  jet.y = p.y + drag.dy;
});
addEventListener("pointerup", () => (drag = null));
addEventListener("blur", () => state === "play" && (state = "paused"));

// ---------- update ----------
const hit = (a, b, pad = 1) =>
  a.x + pad < b.x + b.w - pad && a.x + a.w - pad > b.x + pad && a.y + pad < b.y + b.h - pad && a.y + a.h - pad > b.y + pad;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90;
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, color });
  }
}

function spawnFoe() {
  const roll = Math.random();
  const type = wave >= 3 && roll < 0.2 ? "malware" : wave >= 2 && roll < 0.5 ? "glitch" : "drone";
  const s = SPR[type];
  foes.push({
    type, x: 8 + Math.random() * (W - 16 - s.width), y: -s.height, w: s.width, h: s.height,
    hp: ENEMY[type].hp + Math.floor(wave / 6), t: Math.random() * 6, fire: 1 + Math.random() * 2, baseX: 0,
  });
  foes.at(-1).baseX = foes.at(-1).x;
}

function fire() {
  const cx = jet.x + 6;
  shots.push({ x: cx, y: jet.y - 4, w: 1, h: 5, vx: 0 });
  if (spread > 0) {
    shots.push({ x: cx - 3, y: jet.y, w: 1, h: 5, vx: -40 });
    shots.push({ x: cx + 3, y: jet.y, w: 1, h: 5, vx: 40 });
  }
  sfx.shot();
}

function aimAtJet(x, y, speed) {
  const dx = jet.x + 6 - x, dy = jet.y + 6 - y, d = Math.hypot(dx, dy) || 1;
  enemyShots.push({ x, y, w: 3, h: 3, vx: (dx / d) * speed, vy: (dy / d) * speed });
}

function damageJet() {
  if (jet.inv > 0) return;
  lives--;
  jet.inv = 2;
  sfx.hurt();
  burst(jet.x + 6, jet.y + 6, "#41a6f6", 14);
  if (lives <= 0) gameOver();
}

function kill(f) {
  f.dead = true;
  kills++;
  score += ENEMY[f.type].score;
  sfx.pop();
  burst(f.x + f.w / 2, f.y + f.h / 2, f.type === "drone" ? "#38d46a" : f.type === "glitch" ? "#9b5cff" : "#ff4f8b");
  const r = Math.random();
  const type = r < 0.04 ? "heart" : r < 0.1 ? "coffee" : r < 0.16 ? "spread" : r < 0.3 ? "coin" : null;
  if (type) drops.push({ type, x: f.x + f.w / 2 - 4, y: f.y, w: 8, h: 8 });
}

function update(dt) {
  t += dt;
  // steering
  const sp = 120;
  if (keys.has("arrowleft") || keys.has("a")) jet.x -= sp * dt;
  if (keys.has("arrowright") || keys.has("d")) jet.x += sp * dt;
  if (keys.has("arrowup") || keys.has("w")) jet.y -= sp * dt;
  if (keys.has("arrowdown") || keys.has("s")) jet.y += sp * dt;
  jet.x = clamp(jet.x, 2, W - jet.w - 2);
  jet.y = clamp(jet.y, 40, H - jet.h - 6);
  if (jet.inv > 0) jet.inv -= dt;
  if (rapid > 0) rapid -= dt;
  if (spread > 0) spread -= dt;

  // auto-fire
  fireTimer -= dt;
  if (fireTimer <= 0) { fire(); fireTimer = rapid > 0 ? 0.08 : 0.18; }
  for (const s of shots) { s.y -= 260 * dt; s.x += s.vx * dt; }
  shots = shots.filter((s) => s.y > -6 && !s.dead);

  // spawning
  if (toSpawn > 0 && (spawnTimer -= dt) <= 0) {
    spawnFoe();
    toSpawn--;
    spawnTimer = Math.max(0.25, 0.9 - wave * 0.05);
  }

  // enemies
  for (const f of foes) {
    f.t += dt;
    const base = ENEMY[f.type].speed + wave * 2;
    f.y += base * dt;
    if (f.type === "drone") f.x = f.baseX + Math.sin(f.t * 2) * 14;
    if (f.type === "glitch") f.x += Math.sign(Math.sin(f.t * 3)) * 60 * dt;
    f.x = clamp(f.x, 0, W - f.w);
    if (f.type === "malware" && (f.fire -= dt) <= 0 && f.y > 0) { aimAtJet(f.x + f.w / 2, f.y + f.h, 70 + wave * 3); f.fire = 1.8; }
    if (f.y > H) f.dead = true;
    if (hit(f, jet, 2)) { damageJet(); kill(f); }
  }

  // boss
  if (boss) {
    boss.y = Math.min(36, boss.y + 30 * dt);
    boss.x += boss.dir * (30 + boss.n * 8) * dt;
    if (boss.x < 4 || boss.x > W - boss.w - 4) boss.dir *= -1;
    if (boss.y >= 36 && (boss.fire -= dt) <= 0) {
      const cx = boss.x + 12, cy = boss.y + 14;
      const spreadN = boss.n === 1 ? 1 : 2;
      for (let i = -spreadN; i <= spreadN; i++) enemyShots.push({ x: cx, y: cy, w: 3, h: 3, vx: i * 28, vy: 80 });
      aimAtJet(cx, cy, 100);
      boss.fire = Math.max(0.8, 2 - boss.n * 0.25);
    }
    if (hit(boss, jet, 2)) damageJet();
  }

  // bullets vs targets
  for (const s of shots) {
    for (const f of foes) {
      if (f.dead || !hit(s, f, 0)) continue;
      s.dead = true;
      if (--f.hp <= 0) kill(f);
      else burst(s.x, s.y, "#f4f4f4", 3);
      break;
    }
    if (boss && !s.dead && hit(s, boss, 0)) {
      s.dead = true;
      boss.hp--;
      burst(s.x, s.y, "#c04ad8", 2);
      if (boss.hp <= 0) bossDown();
    }
  }
  for (const b of enemyShots) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (hit(b, jet, 0)) { b.dead = true; damageJet(); }
  }
  enemyShots = enemyShots.filter((b) => !b.dead && b.y < H + 4 && b.y > -4 && b.x > -4 && b.x < W + 4);

  if (state !== "play") return; // jet went down this frame

  // pickups
  for (const d of drops) {
    d.y += 40 * dt;
    if (!hit(d, jet, -2)) continue;
    d.dead = true;
    sfx.power();
    if (d.type === "coin") score += 50;
    if (d.type === "coffee") { rapid = 8; banner = { text: "CAFFEINATED! RAPID FIRE", t: 1.4, color: "#ffcd4a" }; }
    if (d.type === "spread") { spread = 10; banner = { text: "SPREAD SHOT", t: 1.4, color: "#41a6f6" }; }
    if (d.type === "heart") { lives = Math.min(3, lives + 1); banner = { text: "+1 LIFE", t: 1.2, color: "#ff4f8b" }; }
  }
  drops = drops.filter((d) => !d.dead && d.y < H);
  foes = foes.filter((f) => !f.dead);

  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  sparks = sparks.filter((p) => p.life > 0);

  if (banner && (banner.t -= dt) <= 0) banner = null;
  if (state === "play" && !boss && toSpawn === 0 && foes.length === 0) nextWave();
}

function bossDown() {
  score += 500 * boss.n;
  for (let i = 0; i < 4; i++) burst(boss.x + Math.random() * 24, boss.y + Math.random() * 15, i % 2 ? "#c04ad8" : "#ffcd4a", 16);
  drops.push({ type: "heart", x: boss.x + 8, y: boss.y + 8, w: 8, h: 8 });
  banner = { text: "LEAK PATCHED! +" + 500 * boss.n, t: 2, color: "#38d46a" };
  if (unlock("patched")) banner = { text: "ACHIEVEMENT: LEAK PATCHED", t: 2.4, color: "#38d46a" };
  boss = null;
  enemyShots = [];
  sfx.win();
}

function gameOver() {
  state = "over";
  overAt = performance.now();
  sfx.over();
  if (score > best) { best = score; store.set("jb-jet-best", best); }
  renderBest();
}

// ---------- draw ----------
function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0c22");
  g.addColorStop(1, "#1a1c3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  starLayers.forEach((layer, i) => {
    ctx.fillStyle = i ? "#f4f4f4" : "#6d72a8";
    const speed = i ? 40 : 15;
    for (const [x, y] of layer) ctx.fillRect(Math.floor(x), Math.floor((y + t * speed) % H), 1, i ? 2 : 1);
  });
  if (skyline.complete) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(skyline, 0, H - 64);
    ctx.globalAlpha = 1;
  }

  for (const d of drops) ctx.drawImage(SPR[d.type], Math.round(d.x), Math.round(d.y + Math.sin(t * 6) * 1.5));
  for (const f of foes) ctx.drawImage(SPR[f.type], Math.round(f.x), Math.round(f.y));
  if (boss) {
    const shake = boss.hp < boss.max * 0.3 && Math.floor(t * 20) % 2 ? 1 : 0;
    ctx.drawImage(SPR.boss, Math.round(boss.x) + shake, Math.round(boss.y));
    ctx.fillStyle = "#000";
    ctx.fillRect(40, 26, W - 80, 5);
    ctx.fillStyle = "#c04ad8";
    ctx.fillRect(41, 27, Math.max(0, (W - 82) * (boss.hp / boss.max)), 3);
  }

  ctx.fillStyle = "#ffcd4a";
  for (const s of shots) ctx.fillRect(Math.round(s.x), Math.round(s.y), s.w, s.h);
  for (const b of enemyShots) {
    ctx.fillStyle = Math.floor(t * 12) % 2 ? "#ff4f8b" : "#f4f4f4";
    ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 3);
  }

  if (state !== "over" && (jet.inv <= 0 || Math.floor(t * 14) % 2)) {
    const fl = Math.floor(t * 20) % 2;
    ctx.fillStyle = "#f28c3a";
    ctx.fillRect(Math.round(jet.x) + 5, Math.round(jet.y) + 12, 3, 2 + fl * 2);
    ctx.fillStyle = "#ffcd4a";
    ctx.fillRect(Math.round(jet.x) + 6, Math.round(jet.y) + 12, 1, 2 + fl);
    ctx.drawImage(SPR.jet, Math.round(jet.x), Math.round(jet.y));
  }
  for (const p of sparks) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }

  // HUD
  text(pad(score, 6), 6, 6);
  text(`HI ${pad(best, 6)}`, W - 6, 6, "#ffcd4a", 8, "right");
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < lives ? 1 : 0.25;
    ctx.drawImage(SPR.heart, 6 + i * 10, 17);
  }
  ctx.globalAlpha = 1;
  text(`W${wave}`, W - 6, 17, "#9aa0c8", 8, "right");
  if (rapid > 0) ctx.drawImage(SPR.coffee, 40, 16);
  if (spread > 0) ctx.drawImage(SPR.spread, 52, 17);
  if (banner && state === "play") text(banner.text, W / 2, 120, banner.color, 8, "center");

  if (state === "title") {
    shade();
    text("BUG STRIKE", W / 2, 96, "#ffcd4a", 16, "center");
    text("Patch the sky.", W / 2, 124, "#9aa0c8", 8, "center");
    ctx.drawImage(SPR.drone, 70, 160);
    ctx.drawImage(SPR.glitch, 116, 160);
    ctx.drawImage(SPR.malware, 160, 159);
    if (Math.floor(t * 2) % 2 === 0) text("TAP OR PRESS SPACE", W / 2, 200, "#e8e8f4", 8, "center");
  } else if (state === "paused") {
    shade();
    text("PAUSED", W / 2, 140, "#ffcd4a", 16, "center");
    text("TAP / SPACE TO RESUME", W / 2, 168, "#e8e8f4", 8, "center");
  } else if (state === "over") {
    shade();
    text("SYSTEM DOWN", W / 2, 110, "#ef4f63", 16, "center");
    text(`SCORE ${score}`, W / 2, 140, "#e8e8f4", 8, "center");
    text(`WAVE ${wave} - ${kills} BUGS`, W / 2, 154, "#9aa0c8", 8, "center");
    if (score > 0 && score >= best) text("NEW HIGH SCORE!", W / 2, 172, "#ffcd4a", 8, "center");
    if (Math.floor(t * 2) % 2 === 0) text("TAP / SPACE TO RETRY", W / 2, 196, "#e8e8f4", 8, "center");
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
  else t += dt;
  draw();
  requestAnimationFrame(loop);
}
const bestEl = document.getElementById("best");
function renderBest() { bestEl.textContent = pad(best, 6); }
renderBest();
document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(loop));
