// Shared helpers for the arcade games: storage, achievements, 8-bit sound,
// ASCII-art sprites and pixel text. Loaded before each game's own script.

// ---------- storage (guarded: private windows can throw) ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// Analytics event (no-op when Umami is blocked or not loaded yet).
function track(name, data) { try { window.umami?.track(name, data); } catch {} }

// Returns true the first time an achievement is earned.
function unlock(id) {
  const got = new Set(store.get("jb-ach", []));
  if (got.has(id)) return false;
  got.add(id);
  store.set("jb-ach", [...got]);
  track("achievement", { id });
  return true;
}

// ---------- sound (shares the portfolio's on/off setting) ----------
let soundOn = store.get("jb-sound", false);
let audio;
function beep(notes, type = "square", vol = 0.06) {
  if (!soundOn) return;
  audio ??= new AudioContext();
  let t = audio.currentTime;
  for (const [freq, dur] of notes) {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
    t += dur * 0.8;
  }
}
// Wires a ♪ button to the shared sound setting; `after` runs on each toggle.
function soundButton(btn, after) {
  const render = () => {
    btn.textContent = soundOn ? "♪ ON" : "♪ OFF";
    btn.setAttribute("aria-pressed", soundOn);
  };
  btn.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("jb-sound", soundOn);
    render();
    after?.();
  });
  render();
}

// ---------- sprites from ASCII art ----------
const PAL = {
  k: "#14101f", C: "#6b4a2b", W: "#f4f4f4", H: "#2a1d14", S: "#e0a878", E: "#14101f", M: "#3b2a1d",
  R: "#7a1f35", T: "#f4f4f4", J: "#7fb0e0", G: "#38d46a", L: "#a8f0b8", D: "#1f8a45",
  g: "#9aa0c8", Y: "#ffcd4a", r: "#ef4f63", b: "#6b3f1f", w: "#c8ccf0",
  B: "#41a6f6", P: "#9b5cff", V: "#c04ad8", O: "#f28c3a", X: "#ff4f8b",
};
function sprite(art, pal = PAL) {
  const rows = art.trim().split("\n").map((r) => r.trim());
  const c = document.createElement("canvas");
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext("2d");
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    g.fillStyle = pal[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

// ---------- pixel text with a 1px drop shadow ----------
function drawText(ctx, str, x, y, color = "#e8e8f4", size = 8, align = "left") {
  ctx.font = `${size}px "Press Start 2P"`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";
  ctx.fillText(str, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}
const pad = (n, len = 5) => String(n).padStart(len, "0");
