// HOTFIX — a grid maze game on a 240x192 canvas.
// Drop patches that blast in a cross, clear legacy code, squash every bug.
// Twist: bugs replicate on a timer, so a slow level gets harder.

const COLS = 15, ROWS = 11, T = 16, TOP = 16;
const W = COLS * T, H = ROWS * T + TOP;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const text = (...args) => drawText(ctx, ...args);

const sfx = {
  drop: () => beep([[220, 0.05]], "square", 0.05),
  boom: () => beep([[140, 0.08], [90, 0.12], [60, 0.2]], "sawtooth", 0.07),
  squash: () => beep([[600, 0.04], [900, 0.08]]),
  power: () => beep([[523, 0.07], [784, 0.07], [1047, 0.18]]),
  hurt: () => beep([[200, 0.1], [90, 0.25]], "sawtooth"),
  clone: () => beep([[300, 0.06], [330, 0.06], [300, 0.06]], "triangle", 0.05),
  clear: () => beep([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.35]]),
  over: () => beep([[392, 0.15], [330, 0.15], [262, 0.4]], "triangle"),
};
soundButton(document.getElementById("sound-btn"), () => canvas.focus());

// ---------- sprites ----------
const HEAD = `
...kkkkkk...
..kCCCCCCk..
..kCCWCCCCkk
..kHSSSSkkk.
..kHSESSk...
...kSMMSk...
..kkRTTRkk..
.kSRRTTRRSk.
.kSRRTTRRSk.
..kRRRRRRk..
..kJJJJJJk..`;
const SPR = {
  p1: sprite(HEAD + `
..kJJkkJJk..
..kWWk.kWWk.
..kkkk.kkkk.`),
  p2: sprite(HEAD + `
.kJJk..kJJk.
kWWk....kWWk
kkkk....kkkk`),
  bug: sprite(`
....kkkk....
..kkGGGGkk..
.kGGGGGGLLk.
kGGkkGGkkGLk
kGGkWGGkWGGk
kGGGGGGGGGGk
kGGGGkkGGGGk
kDGGGGGGGGDk
.kkkkkkkkkk.`),
  crate: sprite(`
kkkkkkkkkkkkkkkk
kggggggggggggggk
kgwwwwwwwwwwwwgk
kgwkkwwwwwwkkwgk
kgwkwwwwwwwwkwgk
kgwkwwgggwwwkwgk
kgwkwwwwwwwwkwgk
kgkwwwgggggwwkgk
kgwkwwwwwwwwkwgk
kgwkwwgggwwwkwgk
kgwkwwwwwwwwkwgk
kgwkkwwwwwwkkwgk
kgwwwwwwwwwwwwgk
kggggggggggggggk
kkgggggggggggggk
kkkkkkkkkkkkkkkk`),
  patch: sprite(`
.......Y....
......kY....
.....kk.....
...kkkkkk...
..kBBBBBBk..
.kBBWBBBBBk.
.kBWBBYYBBk.
.kBBBYkkYBk.
.kBBBYkkYBk.
.kBBBBYYBBk.
..kBBBBBBk..
...kkkkkk...`),
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
  range: sprite(`
...kk...
..kYYk..
.kYOOYk.
kYOWWOYk
kYOWWOYk
.kYOOYk.
..kYYk..
...kk...`),
  extra: sprite(`
....Yk..
...kk...
.kkkkkk.
kBBBBBBk
kBWBBBBk
kBBBYYBk
kBBBYYBk
.kkkkkk.`),
  heart: sprite(`
.kk.kk.
kXXkXXk
kXWXXXk
kXXXXXk
.kXXXk.
..kXk..
...k...`),
};

// ---------- state ----------
const FLOOR = 0, WALL = 1, CRATE = 2;
let state = "title"; // title | play | paused | clear | over
let grid, player, bugs, patches, flames, items, sparks, score, lives, level, cloneTimer, banner, t, overAt, clearAt;
let speed, range, maxPatches;
let best = store.get("jb-hotfix-best", 0);

const cell = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : grid[y][x]);
const patchAt = (x, y) => patches.find((p) => p.x === x && p.y === y);
const flameAt = (x, y) => flames.some((f) => f.cells.some((c) => c.x === x && c.y === y));
const open = (x, y) => cell(x, y) === FLOOR && !patchAt(x, y);

function buildLevel() {
  grid = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) =>
      x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0) ? WALL : FLOOR
    )
  );
  const density = Math.min(0.55, 0.4 + level * 0.02);
  const safe = (x, y) => x + y <= 3;
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++)
      if (grid[y][x] === FLOOR && !safe(x, y) && Math.random() < density) grid[y][x] = CRATE;

  const spots = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++) if (grid[y][x] === FLOOR && x + y >= 8) spots.push([x, y]);
  bugs = [];
  const n = Math.min(3 + level, 9);
  for (let i = 0; i < n && spots.length; i++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    bugs.push(mover(x, y, Math.min(3.4, 1.8 + level * 0.15)));
  }
  patches = [];
  flames = [];
  items = [];
  sparks = [];
  cloneTimer = cloneEvery();
  spawnPlayer();
}
const cloneEvery = () => Math.max(7, 15 - level);
const mover = (x, y, spd) => ({ cx: x, cy: y, x: x * T, y: y * T, tx: x, ty: y, moving: false, dir: [0, 0], speed: spd });
function spawnPlayer() {
  player = { ...mover(1, 1, speed), inv: 2, face: 1 };
}

function reset() {
  score = 0;
  lives = 3;
  level = 1;
  speed = 4;
  range = 2;
  maxPatches = 1;
  t = 0;
  banner = { text: "LEVEL 1", t: 1.6, color: "#ffcd4a" };
  buildLevel();
}
reset();

// ---------- input ----------
const held = []; // most recent direction last
const DIRS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
function press(name) { if (!held.includes(name)) held.push(name); }
function release(name) { const i = held.indexOf(name); if (i >= 0) held.splice(i, 1); }
const heldDir = () => {
  for (let i = held.length - 1; i >= 0; i--) if (DIRS[held[i]]) return DIRS[held[i]];
  return null;
};

function start() {
  if (state === "title" || (state === "over" && performance.now() - overAt > 600)) {
    reset();
    state = "play";
    if (unlock("hotfixer")) banner = { text: "ACHIEVEMENT: HOTFIXER", t: 2, color: "#38d46a" };
    return true;
  }
  if (state === "paused") { state = "play"; return true; }
  return false;
}
function action() {
  if (start()) return;
  if (state !== "play") return;
  const x = Math.round(player.x / T), y = Math.round(player.y / T);
  if (patchAt(x, y) || patches.length >= maxPatches || cell(x, y) !== FLOOR) return;
  patches.push({ x, y, t: 2.2, r: range });
  sfx.drop();
}
function togglePause() {
  if (state === "play") state = "paused";
  else if (state === "paused") state = "play";
}

addEventListener("keydown", (e) => {
  if (e.target.matches("button, a")) return;
  const k = e.key.toLowerCase();
  if (DIRS[k] || k === " ") e.preventDefault();
  if (DIRS[k]) press(k);
  if ((k === " " || k === "x" || k === "enter") && !e.repeat) action();
  if (k === "p" || k === "escape") togglePause();
});
addEventListener("keyup", (e) => release(e.key.toLowerCase()));
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); canvas.focus(); if (state !== "play") start(); });
addEventListener("blur", () => { held.length = 0; if (state === "play") state = "paused"; });

// On-screen pad for touch screens
document.querySelectorAll("[data-dir]").forEach((b) => {
  const name = b.dataset.dir;
  const down = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); if (state !== "play") start(); press(name); };
  const up = () => release(name);
  b.addEventListener("pointerdown", down);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("lostpointercapture", up);
});
document.getElementById("patch-btn")?.addEventListener("pointerdown", (e) => { e.preventDefault(); action(); });

// ---------- movement on the grid ----------
// Movers travel tile to tile; `canEnter` decides which tiles are allowed.
function step(m, dt, want, canEnter) {
  let budget = m.speed * T * dt;
  while (budget > 0) {
    if (!m.moving) {
      if (!want) return;
      const [dx, dy] = want;
      if (!canEnter(m.cx + dx, m.cy + dy)) return;
      m.tx = m.cx + dx;
      m.ty = m.cy + dy;
      m.dir = want;
      m.moving = true;
    } else if (want && want[0] === -m.dir[0] && want[1] === -m.dir[1]) {
      // turning back mid-step
      [m.tx, m.cx] = [m.cx, m.tx];
      [m.ty, m.cy] = [m.cy, m.ty];
      m.dir = want;
    }
    const gx = m.tx * T, gy = m.ty * T;
    const dist = Math.abs(gx - m.x) + Math.abs(gy - m.y);
    const move = Math.min(dist, budget);
    m.x += Math.sign(gx - m.x) * move;
    m.y += Math.sign(gy - m.y) * move;
    budget -= move;
    if (move === dist) {
      m.cx = m.tx;
      m.cy = m.ty;
      m.moving = false;
      // the player keeps going while a key is held; bugs stop and re-decide
      want = m === player ? heldDir() : null;
    }
  }
}

function bugChoice(b) {
  const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(b.cx + dx, b.cy + dy) && !flameAt(b.cx + dx, b.cy + dy));
  if (!options.length) return null;
  const ahead = options.find(([dx, dy]) => dx === b.dir[0] && dy === b.dir[1]);
  if (ahead && Math.random() < 0.7) return ahead;
  return options[Math.floor(Math.random() * options.length)];
}

// ---------- update ----------
function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 80;
    sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.3, color });
  }
}

function explode(p) {
  patches = patches.filter((q) => q !== p);
  const cells = [{ x: p.x, y: p.y }];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= p.r; i++) {
      const x = p.x + dx * i, y = p.y + dy * i, c = cell(x, y);
      if (c === WALL) break;
      cells.push({ x, y, end: i === p.r, dx, dy });
      if (c === CRATE) {
        grid[y][x] = FLOOR;
        score += 10;
        burst(x * T + 8, y * T + TOP + 8, "#9aa0c8", 6);
        const r = Math.random();
        const type = r < 0.1 ? "range" : r < 0.18 ? "extra" : r < 0.25 ? "coffee" : r < 0.27 ? "heart" : null;
        if (type) items.push({ type, x, y });
        break;
      }
      const other = patchAt(x, y);
      if (other) other.t = 0; // chain reaction
    }
  }
  flames.push({ cells, t: 0.45 });
  sfx.boom();
}

function hurt() {
  if (player.inv > 0) return;
  lives--;
  sfx.hurt();
  burst(player.x + 8, player.y + TOP + 8, "#41a6f6", 16);
  if (lives <= 0) return gameOver();
  spawnPlayer();
}

function update(dt) {
  t += dt;
  if (player.inv > 0) player.inv -= dt;

  const want = heldDir();
  if (want && want[0]) player.face = want[0];
  // the player may walk off a patch they're standing on, but not onto one
  step(player, dt, want, (x, y) => cell(x, y) === FLOOR && !patchAt(x, y));

  for (const b of bugs) {
    if (!b.moving) b.next = bugChoice(b);
    step(b, dt, b.next, (x, y) => open(x, y));
  }

  for (const p of patches) if ((p.t -= dt) <= 0) { explode(p); break; }
  for (const f of flames) f.t -= dt;
  flames = flames.filter((f) => f.t > 0);

  // flames squash bugs and hurt the player
  const tileOf = (m) => ({ x: Math.round(m.x / T), y: Math.round(m.y / T) });
  bugs = bugs.filter((b) => {
    const c = tileOf(b);
    if (!flameAt(c.x, c.y)) return true;
    score += 100;
    sfx.squash();
    burst(b.x + 8, b.y + TOP + 8, "#38d46a", 12);
    return false;
  });
  const pc = tileOf(player);
  if (flameAt(pc.x, pc.y)) hurt();
  if (state !== "play") return;
  if (bugs.some((b) => Math.abs(b.x - player.x) < 11 && Math.abs(b.y - player.y) < 11)) hurt();
  if (state !== "play") return;

  // power-ups
  items = items.filter((it) => {
    if (it.x !== pc.x || it.y !== pc.y) return true;
    sfx.power();
    if (it.type === "range") { range = Math.min(6, range + 1); banner = { text: "BLAST RANGE +1", t: 1.2, color: "#f28c3a" }; }
    if (it.type === "extra") { maxPatches = Math.min(5, maxPatches + 1); banner = { text: "EXTRA PATCH", t: 1.2, color: "#41a6f6" }; }
    if (it.type === "coffee") { speed = Math.min(6.5, speed + 0.6); player.speed = speed; banner = { text: "CAFFEINATED! SPEED UP", t: 1.2, color: "#ffcd4a" }; }
    if (it.type === "heart") { lives = Math.min(3, lives + 1); banner = { text: "+1 LIFE", t: 1.2, color: "#ff4f8b" }; }
    return false;
  });

  // the twist: bugs copy themselves
  if (bugs.length && (cloneTimer -= dt) <= 0) {
    cloneTimer = cloneEvery();
    if (bugs.length < 12) {
      const src = bugs[Math.floor(Math.random() * bugs.length)];
      bugs.push({ ...mover(src.cx, src.cy, src.speed) });
      burst(src.x + 8, src.y + TOP + 8, "#a8f0b8", 8);
      banner = { text: "A BUG REPLICATED!", t: 1.4, color: "#ef4f63" };
      sfx.clone();
    }
  }

  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  sparks = sparks.filter((s) => s.life > 0);
  if (banner && (banner.t -= dt) <= 0) banner = null;

  if (!bugs.length) {
    state = "clear";
    clearAt = t;
    score += 500 * level;
    sfx.clear();
    if (level >= 3 && unlock("bugfree")) banner = { text: "ACHIEVEMENT: BUG FREE", t: 2.4, color: "#38d46a" };
  }
}

function nextLevel() {
  level++;
  banner = { text: `LEVEL ${level}`, t: 1.6, color: "#ffcd4a" };
  buildLevel();
  state = "play";
}

function gameOver() {
  state = "over";
  overAt = performance.now();
  sfx.over();
  if (score > best) { best = score; store.set("jb-hotfix-best", best); }
  renderBest();
}

// ---------- draw ----------
function drawWall(x, y) {
  ctx.fillStyle = "#14101f";
  ctx.fillRect(x, y, T, T);
  ctx.fillStyle = "#333c6e";
  ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
  ctx.fillStyle = "#262b52";
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 3 + i * 4, T - 6, 2);
  const on = Math.floor(t * 2 + x * 0.3 + y * 0.7) % 3;
  ctx.fillStyle = on ? "#38d46a" : "#ef4f63";
  ctx.fillRect(x + T - 4, y + 3, 1, 1);
}

function draw() {
  ctx.fillStyle = "#0b0c22";
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const px = x * T, py = y * T + TOP, c = grid[y][x];
      if (c === WALL) { drawWall(px, py); continue; }
      ctx.fillStyle = (x + y) % 2 ? "#1a1c3a" : "#1d2042";
      ctx.fillRect(px, py, T, T);
      if (c === CRATE) ctx.drawImage(SPR.crate, px, py);
    }

  for (const it of items) {
    const s = SPR[it.type];
    const bob = Math.round(Math.sin(t * 6) * 1);
    ctx.drawImage(s, it.x * T + ((T - s.width) >> 1), it.y * T + TOP + ((T - s.height) >> 1) + bob);
  }
  for (const p of patches) {
    const pulse = p.t < 0.8 ? Math.floor(t * 16) % 2 : Math.floor(t * 4) % 2;
    ctx.drawImage(SPR.patch, p.x * T + 2, p.y * T + TOP + 2 - pulse);
  }
  for (const f of flames) {
    const fade = f.t / 0.45;
    for (const c of f.cells) {
      const px = c.x * T, py = c.y * T + TOP;
      const pad = c.dx === undefined ? 1 : 3;
      ctx.fillStyle = "#f28c3a";
      if (c.dx) ctx.fillRect(px, py + pad, T, T - pad * 2);
      else if (c.dy) ctx.fillRect(px + pad, py, T - pad * 2, T);
      else ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
      ctx.fillStyle = fade > 0.5 ? "#fff3b0" : "#ffcd4a";
      if (c.dx) ctx.fillRect(px, py + pad + 3, T, T - pad * 2 - 6);
      else if (c.dy) ctx.fillRect(px + pad + 3, py, T - pad * 2 - 6, T);
      else ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
    }
  }
  for (const b of bugs) {
    const squish = Math.floor(t * 6 + b.x) % 2;
    ctx.drawImage(SPR.bug, Math.round(b.x) + 2, Math.round(b.y) + TOP + 4 + squish);
  }
  if (state !== "over" && (player.inv <= 0 || Math.floor(t * 14) % 2)) {
    const img = player.moving && Math.floor(t * 8) % 2 ? SPR.p2 : SPR.p1;
    const px = Math.round(player.x) + 2, py = Math.round(player.y) + TOP + 1;
    if (player.face < 0) {
      ctx.save();
      ctx.translate(px + img.width, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else ctx.drawImage(img, px, py);
  }
  for (const s of sparks) {
    ctx.fillStyle = s.color;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
  }

  // HUD strip
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, TOP);
  text(pad(score, 6), 4, 4);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < lives ? 1 : 0.25;
    ctx.drawImage(SPR.heart, 58 + i * 9, 4);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(SPR.bug, 92, 3);
  text(`x${bugs.length}`, 106, 4, bugs.length > 6 ? "#ef4f63" : "#38d46a");
  text(`L${level}`, 140, 4, "#9aa0c8");
  text(`HI ${pad(best, 6)}`, W - 4, 4, "#ffcd4a", 8, "right");
  if (banner && state === "play") text(banner.text, W / 2, TOP + 6, banner.color, 8, "center");

  if (state === "title") {
    shade();
    text("HOTFIX", W / 2, 48, "#ffcd4a", 16, "center");
    text("Patch the bugs before", W / 2, 76, "#9aa0c8", 8, "center");
    text("they copy themselves.", W / 2, 88, "#9aa0c8", 8, "center");
    if (Math.floor(t * 2) % 2 === 0) text("TAP OR PRESS SPACE", W / 2, 124, "#e8e8f4", 8, "center");
  } else if (state === "paused") {
    shade();
    text("PAUSED", W / 2, 80, "#ffcd4a", 16, "center");
    text("TAP / SPACE TO RESUME", W / 2, 108, "#e8e8f4", 8, "center");
  } else if (state === "clear") {
    shade();
    text("LEVEL CLEAR!", W / 2, 70, "#38d46a", 16, "center");
    text(`+${500 * level} PTS`, W / 2, 98, "#ffcd4a", 8, "center");
    if (banner) text(banner.text, W / 2, 116, banner.color, 8, "center");
  } else if (state === "over") {
    shade();
    text("BUILD BROKEN", W / 2, 64, "#ef4f63", 16, "center");
    text(`SCORE ${score}  LEVEL ${level}`, W / 2, 92, "#e8e8f4", 8, "center");
    if (score > 0 && score >= best) text("NEW HIGH SCORE!", W / 2, 108, "#ffcd4a", 8, "center");
    if (Math.floor(t * 2) % 2 === 0) text("TAP / SPACE TO RETRY", W / 2, 132, "#e8e8f4", 8, "center");
  }
}
function shade() {
  ctx.fillStyle = "#050612d0";
  ctx.fillRect(0, 0, W, H);
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === "play") update(dt);
  else {
    t += dt;
    if (state === "clear") {
      if (banner && (banner.t -= dt) <= 0) banner = null;
      if (t - clearAt > 2.2) nextLevel();
    }
  }
  draw();
  requestAnimationFrame(loop);
}
const bestEl = document.getElementById("best");
function renderBest() { bestEl.textContent = pad(best, 6); }
renderBest();
document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(loop));
