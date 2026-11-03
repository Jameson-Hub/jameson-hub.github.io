// World Stats page: the Umami overview, redrawn in the portfolio's pixel style.
const DAY = 86400000;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const status = document.getElementById("stats-status");
const body = document.getElementById("stats-body");
const chart = document.getElementById("chart");
const tip = document.getElementById("chart-tip");

const EVENT_NAMES = {
  "game-over": "Games played",
  achievement: "Achievements",
  "app-store": "App Store clicks",
  "trophy-link": "Trophy links",
  "build-open": "Builds opened",
  "cv-open": "CV opens",
  "contact-sent": "Messages sent",
};
const PAGE_NAMES = { "/": "Home", "/game.html": "Deploy Run", "/jet.html": "Bug Strike", "/hotfix.html": "Hotfix", "/stats.html": "World Stats", "/work/meridian/": "Meridian build" };
let countryName;
try { countryName = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
const LABEL = {
  path: (x) => PAGE_NAMES[x] ?? PAGE_NAMES[x.replace(/index\.html$/, "")] ?? x,
  event: (x) => EVENT_NAMES[x] ?? x,
  country: (x) => countryName?.of(x) ?? x,
  referrer: (x) => x,
  device: (x) => x[0].toUpperCase() + x.slice(1),
  browser: (x) => ({ chrome: "Chrome", ios: "Safari (iOS)", safari: "Safari", firefox: "Firefox", "edge-chromium": "Edge", "crios": "Chrome (iOS)", samsung: "Samsung" })[x] ?? x,
};
const EMPTY = { referrer: "No outside sources yet" };

const fmt = (n) => n.toLocaleString();
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;
const dayKey = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });

async function load(days) {
  status.textContent = "LOADING STATS...";
  status.className = "form-status";
  status.hidden = false;
  const startAt = days === "all" ? STATS_SINCE : Math.max(STATS_SINCE, Date.now() - days * DAY);
  const p = { startAt, timezone: TZ };
  try {
    const [stats, series, ...lists] = await Promise.all([
      umamiGet("stats", p),
      umamiGet("pageviews?unit=day", p),
      ...Object.keys(LABEL).map((type) => umamiGet(`metrics?type=${type}`, p)),
    ]);
    renderTiles(stats);
    renderChart(series, startAt);
    Object.keys(LABEL).forEach((type, i) => renderList(type, lists[i]));
    status.hidden = true;
    body.hidden = false;
  } catch {
    status.textContent = "STATS OFFLINE — TRY AGAIN LATER";
    status.className = "form-status err";
    body.hidden = true;
  }
}

function renderTiles(s) {
  const visits = s.visits || 0;
  const avg = visits ? Math.round(s.totaltime / visits) : 0;
  const values = {
    visitors: fmt(s.visitors),
    visits: fmt(visits),
    pageviews: fmt(s.pageviews),
    bounce: `${visits ? Math.round((s.bounces / visits) * 100) : 0}%`,
    duration: avg >= 60 ? `${Math.floor(avg / 60)}m ${avg % 60}s` : `${avg}s`,
  };
  for (const [k, v] of Object.entries(values)) document.querySelector(`[data-tile="${k}"]`).textContent = v;
}

// One bar per day, gaps filled with zero; visitors ride along in the tooltip.
function renderChart(series, startAt) {
  const views = new Map(series.pageviews.map((d) => [dayKey(d.x), d.y]));
  const people = new Map(series.sessions.map((d) => [dayKey(d.x), d.y]));
  const days = [];
  for (let t = startAt; dayKey(t) <= dayKey(Date.now()); t += DAY) {
    const key = dayKey(t);
    if (days.at(-1)?.key !== key) days.push({ key, views: views.get(key) ?? 0, visitors: people.get(key) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.views));
  const top = niceMax(max);
  const step = Math.max(1, Math.ceil(days.length / 7));
  chart.style.setProperty("--n", days.length);
  chart.innerHTML = `
    <div class="ch-axis" aria-hidden="true"><span>${top}</span><span>${top / 2}</span><span>0</span></div>
    <div class="ch-plot">
      <div class="ch-grid" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="ch-bars" role="list">${days
        .map(
          (d, i) => `<button class="ch-bar" type="button" role="listitem" data-i="${i}" aria-label="${dayLabel(d.key)}: ${plural(d.views, "view")}, ${plural(d.visitors, "visitor")}">
            <span class="ch-fill" style="height:${(d.views / top) * 100}%"></span>
            <span class="ch-tick">${i % step === 0 ? dayLabel(d.key) : ""}</span></button>`
        )
        .join("")}</div>
    </div>`;
  chart.querySelectorAll(".ch-bar").forEach((bar) => {
    const d = days[bar.dataset.i];
    const show = () => {
      tip.innerHTML = `<b>${dayLabel(d.key)}</b><br>${plural(d.views, "view")} · ${plural(d.visitors, "visitor")}`;
      tip.hidden = false;
      const r = bar.getBoundingClientRect();
      const box = chart.parentElement.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2 - box.left, 70), box.width - 70);
      tip.style.left = `${x}px`;
      tip.style.top = `${r.top - box.top + r.height - bar.querySelector(".ch-fill").offsetHeight - 54}px`;
    };
    bar.addEventListener("mouseenter", show);
    bar.addEventListener("focus", show);
    bar.addEventListener("mouseleave", () => (tip.hidden = true));
    bar.addEventListener("blur", () => (tip.hidden = true));
  });
}

function niceMax(n) {
  const mag = 10 ** Math.floor(Math.log10(n));
  const top = [1, 2, 4, 5, 10].map((m) => m * mag).find((v) => v >= n);
  return top % 2 ? top * 2 : top; // keep the midpoint label whole
}

function renderList(type, rows) {
  const table = document.querySelector(`[data-list="${type}"]`);
  const items = rows.filter((r) => r.x).slice(0, 6);
  if (!items.length) {
    table.innerHTML = `<tr><td class="empty">${EMPTY[type] ?? "No data yet"}</td></tr>`;
    return;
  }
  const max = items[0].y;
  table.innerHTML = items
    .map(
      (r) => `<tr style="--w:${(r.y / max) * 100}%"><th scope="row"><span class="rank-label"></span></th><td>${fmt(r.y)}</td></tr>`
    )
    .join("");
  // Labels come from visitors' URLs and referrers, so set them as text, never HTML.
  table.querySelectorAll(".rank-label").forEach((el, i) => (el.textContent = LABEL[type](items[i].x)));
}

const buttons = document.querySelectorAll(".range .btn");
buttons.forEach((b) =>
  b.addEventListener("click", () => {
    buttons.forEach((o) => o.setAttribute("aria-pressed", o === b));
    load(b.dataset.days === "all" ? "all" : Number(b.dataset.days));
  })
);
load(7);
