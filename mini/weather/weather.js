// Weather: Open-Meteo geocoding + forecast (free, no key). Units and recent
// searches are remembered in localStorage.
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const DEFAULT_PLACE = { name: "Manila", admin1: "Metro Manila", country: "Philippines", latitude: 14.6042, longitude: 120.9822 };
let unit = store.get("mini-weather-unit", "celsius");
let place = store.get("mini-weather-place", DEFAULT_PLACE);
let recent = store.get("mini-weather-recent", []);

// ---------- icons (WMO weather codes) ----------
const SVG = (cls, body) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 9.5 4.25 4.25 0 0 0 7 18Z"/>';
const ICONS = {
  sun: SVG("ico-sun", '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: SVG("ico-moon", '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  partlyDay: SVG("ico-sun", '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1"/>' + '<path class="ico-cloud" stroke="#94a3b8" d="M9 20h8a3.5 3.5 0 0 0 .4-6.98A4.8 4.8 0 0 0 9 12.5a3.75 3.75 0 0 0 0 7.5Z"/>'),
  partlyNight: SVG("ico-moon", '<path d="M13 7.5A5 5 0 0 1 6.5 1 5 5 0 1 0 13 7.5Z"/>' + '<path stroke="#94a3b8" d="M9 21h8a3.5 3.5 0 0 0 .4-6.98A4.8 4.8 0 0 0 9 13.5a3.75 3.75 0 0 0 0 7.5Z"/>'),
  cloud: SVG("ico-cloud", CLOUD),
  fog: SVG("ico-cloud", '<path d="M4 9h16M3 13h18M5 17h14"/>'),
  rain: SVG("ico-rain", '<path d="M7 15h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'),
  snow: SVG("ico-snow", '<path d="M7 15h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15Z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>'),
  storm: SVG("ico-storm", '<path d="M7 15h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 6.5 4.25 4.25 0 0 0 7 15Z"/><path d="m12 15-2 4h4l-2 4"/>'),
};
function describe(code, day = true) {
  if (code === 0) return [day ? "Clear sky" : "Clear night", day ? ICONS.sun : ICONS.moon];
  if (code <= 2) return [code === 1 ? "Mostly clear" : "Partly cloudy", day ? ICONS.partlyDay : ICONS.partlyNight];
  if (code === 3) return ["Overcast", ICONS.cloud];
  if (code <= 48) return ["Fog", ICONS.fog];
  if (code <= 57) return ["Drizzle", ICONS.rain];
  if (code <= 67) return [code >= 65 ? "Heavy rain" : "Rain", ICONS.rain];
  if (code <= 77) return ["Snow", ICONS.snow];
  if (code <= 82) return ["Rain showers", ICONS.rain];
  if (code <= 86) return ["Snow showers", ICONS.snow];
  return ["Thunderstorm", ICONS.storm];
}

// ---------- forecast ----------
const deg = (t) => `${Math.round(t)}°`;
// Open-Meteo returns local wall-clock times ("2026-11-04T14:00") when timezone=auto.
const hourOf = (iso) => { const h = +iso.slice(11, 13); return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`; };
const weekday = (iso, i) => (i === 0 ? "Today" : new Date(`${iso}T12:00:00`).toLocaleDateString("en", { weekday: "short" }));
const placeLabel = (p) => [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : null, p.country].filter(Boolean).join(", ");

let loadId = 0;
async function loadForecast() {
  const id = ++loadId;
  setStatus("Loading forecast…");
  const q = new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude, timezone: "auto", forecast_days: 7, temperature_unit: unit,
    wind_speed_unit: unit === "celsius" ? "kmh" : "mph",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (id !== loadId) return; // a newer request won
    render(data);
    setStatus("");
    $("weather").hidden = false;
  } catch {
    setStatus("Couldn't load the forecast. Check your connection and try again.", true);
  }
}

function render(d) {
  const c = d.current, daily = d.daily, units = d.current_units;
  const [desc, icon] = describe(c.weather_code, c.is_day === 1);
  $("place").textContent = placeLabel(place);
  $("when").textContent = new Date(`${c.time}:00`).toLocaleString("en", { weekday: "long", hour: "numeric", minute: "2-digit" }) + " local time";
  $("now-icon").innerHTML = icon;
  $("now-temp").textContent = deg(c.temperature_2m);
  $("now-desc").textContent = `${desc} · H ${deg(daily.temperature_2m_max[0])} L ${deg(daily.temperature_2m_min[0])}`;
  $("feels").textContent = deg(c.apparent_temperature);
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} ${units.wind_speed_10m.replace("mp/h", "mph")}`;
  $("rain").textContent = `${daily.precipitation_probability_max[0] ?? 0}%`;
  $("sunrise").textContent = hourMin(daily.sunrise[0]);
  $("sunset").textContent = hourMin(daily.sunset[0]);

  const h = d.hourly;
  const start = Math.max(0, h.time.findIndex((t) => t >= c.time.slice(0, 13)));
  $("hourly").innerHTML = h.time.slice(start, start + 24).map((t, k) => {
    const i = start + k;
    const pop = h.precipitation_probability[i];
    return `<li class="${k ? "" : "first"}"><span>${k ? hourOf(t) : "Now"}</span>${describe(h.weather_code[i], h.is_day[i] === 1)[1]}<b>${deg(h.temperature_2m[i])}</b><small>${pop >= 20 ? pop + "%" : ""}</small></li>`;
  }).join("");

  const lo = Math.min(...daily.temperature_2m_min), hi = Math.max(...daily.temperature_2m_max), span = Math.max(1, hi - lo);
  $("week").innerHTML = daily.time.map((t, i) => {
    const [label, ico] = describe(daily.weather_code[i]);
    const a = ((daily.temperature_2m_min[i] - lo) / span) * 100, b = ((daily.temperature_2m_max[i] - lo) / span) * 100;
    const pop = daily.precipitation_probability_max[i] ?? 0;
    return `<li><span class="day">${weekday(t, i)}</span><span title="${label}">${ico}</span><span class="pop">${pop >= 20 ? pop + "%" : ""}</span>
      <span class="lo">${deg(daily.temperature_2m_min[i])}</span><span class="range"><i style="left:${a}%;right:${100 - b}%"></i></span><span class="hi">${deg(daily.temperature_2m_max[i])}</span></li>`;
  }).join("");
}
const hourMin = (iso) => { const [hh, mm] = iso.slice(11, 16).split(":"); return `${+hh % 12 || 12}:${mm} ${+hh < 12 ? "AM" : "PM"}`; };

function setStatus(text, err = false) {
  $("status").textContent = text;
  $("status").className = `status${err ? " err" : ""}`;
}

// ---------- search ----------
const input = $("q"), list = $("results");
let matches = [], active = -1, searchTimer;
input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const term = input.value.trim();
  if (term.length < 2) return closeResults();
  searchTimer = setTimeout(() => search(term), 250);
});
async function search(term) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: term, count: 6, language: "en" })}`);
    const data = await res.json();
    if (input.value.trim() !== term) return;
    matches = data.results ?? [];
    active = matches.length ? 0 : -1;
    drawResults();
  } catch { closeResults(); }
}
function drawResults() {
  if (!matches.length) {
    list.innerHTML = `<li class="none" aria-disabled="true">No matching places</li>`;
  } else {
    list.innerHTML = "";
    matches.forEach((m, i) => {
      const li = document.createElement("li");
      li.role = "option";
      li.id = `opt-${i}`;
      li.setAttribute("aria-selected", i === active);
      li.textContent = m.name;
      const small = document.createElement("small");
      small.textContent = [m.admin1, m.country].filter(Boolean).join(", ");
      li.append(small);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(m); });
      list.append(li);
    });
  }
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", active >= 0 ? `opt-${active}` : "");
}
function closeResults() { list.hidden = true; matches = []; input.setAttribute("aria-expanded", "false"); }
input.addEventListener("keydown", (e) => {
  if (list.hidden || !matches.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
    drawResults();
  } else if (e.key === "Escape") closeResults();
});
input.addEventListener("blur", () => setTimeout(closeResults, 100));
$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (matches[active]) choose(matches[active]);
});

function choose(m) {
  place = { name: m.name, admin1: m.admin1, country: m.country, latitude: m.latitude, longitude: m.longitude };
  store.set("mini-weather-place", place);
  recent = [place, ...recent.filter((r) => placeLabel(r) !== placeLabel(place))].slice(0, 5);
  store.set("mini-weather-recent", recent);
  input.value = "";
  closeResults();
  drawRecent();
  loadForecast();
}
function drawRecent() {
  $("recent").innerHTML = "";
  for (const r of recent) {
    if (placeLabel(r) === placeLabel(place)) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = r.name;
    b.title = placeLabel(r);
    b.addEventListener("click", () => choose(r));
    $("recent").append(b);
  }
}

$("locate").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Location isn't available in this browser.", true);
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      place = { name: "My location", latitude: +pos.coords.latitude.toFixed(3), longitude: +pos.coords.longitude.toFixed(3) };
      loadForecast();
    },
    () => setStatus("Location permission was denied. Search for a city instead.", true),
    { timeout: 10000 }
  );
});

document.querySelectorAll("[data-unit]").forEach((b) => {
  b.setAttribute("aria-pressed", b.dataset.unit === unit);
  b.addEventListener("click", () => {
    unit = b.dataset.unit;
    store.set("mini-weather-unit", unit);
    document.querySelectorAll("[data-unit]").forEach((o) => o.setAttribute("aria-pressed", o === b));
    loadForecast();
  });
});

drawRecent();
loadForecast();
