// Title screen: dismiss on click, any key, or after a short wait.
const splash = document.getElementById("splash");
const hideSplash = () => {
  if (!splash.isConnected) return;
  splash.classList.add("hide");
  setTimeout(() => splash.remove(), 300);
  document.querySelectorAll(".hero .bar i").forEach((b) => b.classList.add("go"));
};
if (document.documentElement.classList.contains("splash-seen")) hideSplash();
else {
  try { sessionStorage.setItem("splash-seen", "1"); } catch {}
  splash.addEventListener("click", hideSplash);
  addEventListener("keydown", hideSplash, { once: true });
  setTimeout(hideSplash, 2200);
}

document.querySelectorAll(".year").forEach((el) => (el.textContent = new Date().getFullYear()));

// Per-visitor storage; private windows can throw, so every access is guarded.
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

// ---------- 8-bit sound (off until the visitor turns it on) ----------
let soundOn = store.get("jb-sound", false);
let audio;
function beep(notes, type = "square") {
  if (!soundOn) return;
  audio ??= new AudioContext();
  let t = audio.currentTime;
  for (const [freq, dur] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
    t += dur * 0.8;
  }
}
const sfx = {
  coin: () => beep([[988, 0.08], [1319, 0.25]]),
  jump: () => beep([[300, 0.06], [450, 0.06], [600, 0.1]]),
  select: () => beep([[660, 0.05]]),
  unlock: () => beep([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]]),
  pause: () => beep([[880, 0.08], [440, 0.12]]),
};

const soundBtns = [document.getElementById("sound-btn"), document.getElementById("sound-btn-p")];
function renderSound() {
  soundBtns[0].textContent = soundOn ? "♪ ON" : "♪ OFF";
  soundBtns[0].setAttribute("aria-pressed", soundOn);
  soundBtns[1].textContent = `SOUND: ${soundOn ? "ON" : "OFF"}`;
}
soundBtns.forEach((b) =>
  b.addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("jb-sound", soundOn);
    renderSound();
    sfx.select();
  })
);
renderSound();
document.querySelectorAll(".hud-nav a, .pad a, .btn").forEach((el) => el.addEventListener("mouseenter", sfx.select));

// ---------- Achievements ----------
const ACHIEVEMENTS = {
  start: ["PRESS START", "Started scrolling"],
  explorer: ["EXPLORER", "Reached the Quest Log"],
  looter: ["LOOTER", "Opened the Inventory"],
  collector: ["COLLECTOR", "Grabbed your first coin"],
  hunter: ["TREASURE HUNTER", "Collected every coin"],
  friend: ["ANIMAL FRIEND", "Pet the cat"],
  boss: ["FINAL STAGE", "Made it to Contact"],
  pen: ["PEN PAL", "Sent a message"],
  gamer: ["PLAYER ONE", "Played Deploy Run"],
  shipper: ["SHIP IT", "Scored 1000 in Deploy Run"],
  ace: ["ACE PILOT", "Flew in Bug Strike"],
  patched: ["LEAK PATCHED", "Beat a Memory Leak boss"],
  hotfixer: ["HOTFIXER", "Played Hotfix"],
  bugfree: ["BUG FREE", "Cleared level 3 in Hotfix"],
};
const unlocked = new Set(store.get("jb-ach", []));
const toasts = document.getElementById("toasts");

function unlock(id) {
  if (unlocked.has(id)) return;
  unlocked.add(id);
  store.set("jb-ach", [...unlocked]);
  try { window.umami?.track("achievement", { id }); } catch {}
  renderAchievements();
  const [title, desc] = ACHIEVEMENTS[id];
  const t = document.createElement("div");
  t.className = "toast px-box";
  t.innerHTML = `<svg class="toast-ico"><use href="#i-trophy" /></svg><div><p class="toast-label">ACHIEVEMENT UNLOCKED</p><p class="toast-title"></p></div>`;
  t.querySelector(".toast-title").textContent = title;
  toasts.append(t);
  sfx.unlock();
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3700);
}

function renderAchievements() {
  const ids = Object.keys(ACHIEVEMENTS);
  document.getElementById("ach-count").textContent = `${unlocked.size}/${ids.length}`;
  document.getElementById("ach-list").innerHTML = ids
    .map((id) => {
      const [title, desc] = ACHIEVEMENTS[id];
      const got = unlocked.has(id);
      return `<li class="${got ? "got" : ""}"><span>${got ? "★" : "?"}</span><b>${got ? title : "???"}</b><em>${desc}</em></li>`;
    })
    .join("");
}
renderAchievements();

// Section-based achievements
const sectionAch = { experience: "explorer", skills: "looter", contact: "boss" };
const achSpy = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && unlock(sectionAch[e.target.id])),
  { threshold: 0.3 }
);
Object.keys(sectionAch).forEach((id) => achSpy.observe(document.getElementById(id)));
addEventListener("scroll", () => scrollY > 200 && unlock("start"), { passive: true });

// ---------- Coins ----------
let coins = 0;
const coinCount = document.getElementById("coins");
const isVisible = (el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed";

function collect(el) {
  if (el.classList.contains("got")) return;
  el.classList.add("got");
  coins++;
  coinCount.textContent = String(coins).padStart(2, "0");
  coinCount.parentElement.classList.remove("bump");
  void coinCount.offsetWidth;
  coinCount.parentElement.classList.add("bump");
  sfx.coin();
  unlock("collector");
  const left = [...document.querySelectorAll(".pickup, .sprite-coin")].filter((c) => !c.classList.contains("got") && isVisible(c));
  if (left.length === 0) unlock("hunter");
}
document.querySelectorAll(".pickup, .sprite-coin").forEach((c) => c.addEventListener("click", () => collect(c)));

// Side characters hop when clicked
document.querySelectorAll(".sprite:not(.sprite-coin)").forEach((s) => {
  s.addEventListener("click", () => {
    s.classList.remove("jump");
    void s.offsetWidth;
    s.classList.add("jump");
    sfx.jump();
    if (s.classList.contains("sprite-cat")) unlock("friend");
  });
  s.addEventListener("animationend", (e) => e.animationName === "jump" && s.classList.remove("jump"));
});

// ---------- Pause menu ----------
const pause = document.getElementById("pause");
let lastFocus;
function setPaused(on) {
  if (on === !pause.hidden) return;
  pause.hidden = !on;
  document.body.classList.toggle("paused", on);
  sfx.pause();
  if (on) {
    lastFocus = document.activeElement;
    pause.querySelector("[data-resume]").focus();
  } else {
    lastFocus?.focus?.();
  }
}
document.getElementById("pause-btn").addEventListener("click", () => setPaused(true));
document.getElementById("pause-btn-m").addEventListener("click", () => setPaused(true));
pause.querySelector("[data-resume]").addEventListener("click", () => setPaused(false));
pause.querySelectorAll(".pause-menu a").forEach((a) => a.addEventListener("click", () => setPaused(false)));
pause.addEventListener("click", (e) => e.target === pause && setPaused(false));
addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "Escape" || e.key === "p" || e.key === "P") setPaused(pause.hidden);
});

// ---------- Nav highlight ----------
const links = [...document.querySelectorAll(".hud-nav a, .pad a")];
const spy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
    }
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
document.querySelectorAll("section[id]").forEach((s) => spy.observe(s));

// Reveal sections and count up stats on first view
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      reveal.unobserve(e.target);
    }
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".section .wrap").forEach((el) => {
  el.classList.add("reveal");
  reveal.observe(el);
});

function countUp(el) {
  const target = Number(el.dataset.count);
  let n = 0;
  const tick = setInterval(() => {
    el.textContent = ++n;
    if (n >= target) clearInterval(tick);
  }, 90);
}

// ---------- World stats (live, via umami-share.js) ----------
const STATS_MIN_PLAYERS = 0; // raise to hide the panel while numbers are small
async function loadWorldStats() {
  const panel = document.getElementById("world-stats");
  if (!panel) return;
  try {
    const [stats, events] = await Promise.all([umamiGet("stats"), umamiGet("metrics?type=event")]);
    const count = (name) => events.find((e) => e.x === name)?.y ?? 0;
    if (stats.visitors < STATS_MIN_PLAYERS) return;
    const values = { players: stats.visitors, views: stats.pageviews, games: count("game-over"), achievements: count("achievement") };
    for (const [k, v] of Object.entries(values)) panel.querySelector(`[data-stat="${k}"]`).textContent = v.toLocaleString();
    panel.hidden = false;
  } catch {}
}
loadWorldStats();

// ---------- Contact form ----------
// Delivered to the inbox via Web3Forms (no backend needed).
// If that fails, fall back to opening the visitor's mail app.
const TO = "bagainjameson@gmail.com";
// Web3Forms access key for TO — public by design, it only allows sending to that inbox
const FORM_KEY = "10f5f206-e061-4375-8e41-0fc81cf15b71";
const form = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const sendBtn = form.querySelector("button");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(form);
  sendBtn.disabled = true;
  formStatus.textContent = "SENDING...";
  formStatus.className = "form-status";
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: FORM_KEY,
        name: f.get("name"),
        email: f.get("email"),
        message: f.get("message"),
        subject: `Portfolio message from ${f.get("name")}`,
        from_name: "Portfolio contact form",
        botcheck: f.get("botcheck"),
      }),
    });
    const data = await res.json();
    if (!res.ok || String(data.success) !== "true") throw new Error(data.message || res.status);
    form.reset();
    formStatus.textContent = "★ MESSAGE SENT! +1000 PTS";
    formStatus.className = "form-status ok";
    unlock("pen");
    try { window.umami?.track("contact-sent"); } catch {}
  } catch {
    formStatus.textContent = "SEND FAILED — opening your mail app instead...";
    formStatus.className = "form-status err";
    const subject = encodeURIComponent(`Portfolio message from ${f.get("name")}`);
    const body = encodeURIComponent(`${f.get("message")}\n\n— ${f.get("name")} (${f.get("email")})`);
    location.href = `mailto:${TO}?subject=${subject}&body=${body}`;
  } finally {
    sendBtn.disabled = false;
  }
});

// Companion walks while you scroll and faces the scroll direction
const companion = document.getElementById("companion");
let lastY = scrollY, stopTimer;
addEventListener("scroll", () => {
  companion.classList.toggle("flip", scrollY < lastY);
  companion.classList.add("walk");
  lastY = scrollY;
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => companion.classList.remove("walk"), 150);
}, { passive: true });
