// Read-only access to the site's Umami stats through the public share link.
// No API key needed (Umami's API keys are Pro-only). This isn't an official
// API, so callers must treat any failure as "no stats" and hide their UI.
const UMAMI_API = "https://cloud.umami.is/analytics/us/api";
const UMAMI_SHARE = "dygmYfVEwVvyxovB";
const STATS_SINCE = Date.UTC(2026, 10, 1); // site launch

let umamiSession;
// Fetch one stats endpoint, e.g. umamiGet("metrics?type=path", { startAt }).
async function umamiGet(path, params = {}) {
  umamiSession ??= fetch(`${UMAMI_API}/share/${UMAMI_SHARE}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const share = await umamiSession;
  const q = new URLSearchParams({ startAt: STATS_SINCE, endAt: Date.now(), timezone: "UTC", ...params });
  const res = await fetch(`${UMAMI_API}/websites/${share.websiteId}/${path}${path.includes("?") ? "&" : "?"}${q}`, {
    headers: { "x-umami-share-token": share.token, "x-umami-share-context": "1" },
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
