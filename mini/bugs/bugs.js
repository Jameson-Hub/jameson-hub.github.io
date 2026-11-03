// Bug Tracker: create / read / update / delete issues, kept in localStorage.
// All user text is rendered with textContent, never as HTML.
const $ = (id) => document.getElementById(id);
const KEY = "mini-bugs";
const STATUSES = [["open", "Open"], ["progress", "In progress"], ["resolved", "Resolved"]];
const PRIORITY = { critical: ["Critical", 0], high: ["High", 1], medium: ["Medium", 2], low: ["Low", 3] };
const DAY = 86400000;

const demo = () => {
  const t = Date.now();
  return [
    { title: "Checkout total ignores discount code", description: "Applying SAVE10 shows the discount line, but the final total is charged at full price.", priority: "critical", status: "open", area: "Payments", created: t - 2 * DAY, updated: t - 3600000 },
    { title: "Dark mode: chart labels unreadable", description: "Axis labels stay dark grey on the dark background.", priority: "medium", status: "progress", area: "UI", created: t - 5 * DAY, updated: t - DAY },
    { title: "Password reset email arrives twice", description: "Double-clicking Send triggers two emails.", priority: "high", status: "open", area: "Auth", created: t - 3 * DAY, updated: t - 2 * DAY },
    { title: "Export CSV drops rows with commas", description: "Fields containing commas aren't quoted.", priority: "high", status: "resolved", area: "Reports", created: t - 9 * DAY, updated: t - 4 * DAY },
    { title: "Typo on pricing page", description: "\"Anual\" should be \"Annual\".", priority: "low", status: "resolved", area: "Marketing", created: t - 12 * DAY, updated: t - 8 * DAY },
    { title: "Search is slow with 10k+ records", description: "Takes ~4s to return results; add an index.", priority: "medium", status: "open", area: "API", created: t - DAY, updated: t - DAY },
  ].map((b, i) => ({ id: i + 1, ...b }));
};

let bugs;
try { bugs = JSON.parse(localStorage.getItem(KEY)) ?? demo(); } catch { bugs = demo(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(bugs)); } catch {} };
let view = "board";

// ---------- rendering ----------
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const badge = (cls, text) => el("span", `badge ${cls}`, text);
const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function visible() {
  const q = $("search").value.trim().toLowerCase();
  const p = $("filter-priority").value;
  const sort = $("sort").value;
  return bugs
    .filter((b) => (!p || b.priority === p) && (!q || `${b.title} ${b.description} ${b.area} #${b.id}`.toLowerCase().includes(q)))
    .sort((a, b) => sort === "priority" ? PRIORITY[a.priority][1] - PRIORITY[b.priority][1] || b.updated - a.updated : sort === "created" ? b.created - a.created : b.updated - a.updated);
}

function render() {
  const open = bugs.filter((b) => b.status !== "resolved");
  const stats = [
    ["Open", bugs.filter((b) => b.status === "open").length],
    ["In progress", bugs.filter((b) => b.status === "progress").length],
    ["Resolved", bugs.filter((b) => b.status === "resolved").length],
    ["Critical open", open.filter((b) => b.priority === "critical").length],
  ];
  $("summary").replaceChildren(...stats.map(([k, v]) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); return d; }));

  const items = visible();
  $("board").hidden = view !== "board";
  $("list").hidden = view !== "list";
  view === "board" ? renderBoard(items) : renderList(items);
}

function renderBoard(items) {
  $("board").replaceChildren(...STATUSES.map(([key, label]) => {
    const col = el("section", "col");
    col.dataset.status = key;
    const head = el("h2", "col-head", label);
    const inCol = items.filter((b) => b.status === key);
    head.append(el("span", null, inCol.length));
    const ol = el("ol");
    inCol.forEach((b) => ol.append(ticket(b)));
    if (!inCol.length) ol.append(el("li", "empty", "Nothing here"));
    col.append(head, ol);
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
    col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("over");
      update(+e.dataTransfer.getData("text/plain"), { status: key });
    });
    return col;
  }));
}

function ticket(b) {
  const li = el("li");
  const card = el("button", "ticket");
  card.type = "button";
  card.draggable = true;
  card.setAttribute("aria-label", `#${b.id} ${b.title}, ${PRIORITY[b.priority][0]} priority. Open to edit.`);
  card.append(el("h3", null, b.title));
  if (b.description) card.append(el("p", null, b.description));
  const meta = el("div", "meta");
  meta.append(badge(`p-${b.priority}`, PRIORITY[b.priority][0]));
  if (b.area) meta.append(badge("tag", b.area));
  meta.append(el("span", "id", `#${b.id} · ${ago(b.updated)}`));
  card.append(meta);
  card.addEventListener("click", () => openDialog(b));
  card.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", b.id); card.classList.add("dragging"); });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  li.append(card);
  return li;
}

function renderList(items) {
  if (!items.length) {
    const td = el("td", "empty", "No bugs match your filters.");
    td.colSpan = 5;
    const tr = el("tr"); tr.append(td);
    return $("rows").replaceChildren(tr);
  }
  $("rows").replaceChildren(...items.map((b) => {
    const tr = el("tr");
    const title = el("td", "title-cell", b.title);
    title.append(el("small", null, `#${b.id}${b.area ? " · " + b.area : ""}`));
    const pr = el("td"); pr.append(badge(`p-${b.priority}`, PRIORITY[b.priority][0]));
    const st = el("td");
    const sel = el("select", "input");
    sel.setAttribute("aria-label", `Status of #${b.id}`);
    STATUSES.forEach(([k, l]) => { const o = el("option", null, l); o.value = k; o.selected = b.status === k; sel.append(o); });
    sel.addEventListener("change", () => update(b.id, { status: sel.value }));
    st.append(sel);
    const actions = el("td");
    const edit = el("button", "btn", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => openDialog(b));
    actions.append(edit);
    tr.append(title, pr, st, el("td", "when", ago(b.updated)), actions);
    return tr;
  }));
}

// ---------- create / update / delete ----------
function update(id, changes) {
  const b = bugs.find((x) => x.id === id);
  if (!b || Object.entries(changes).every(([k, v]) => b[k] === v)) return;
  Object.assign(b, changes, { updated: Date.now() });
  save();
  render();
}

const dialog = $("dialog"), form = $("form");
let editing = null;
function openDialog(b = null) {
  editing = b;
  form.reset();
  $("dialog-title").textContent = b ? `Edit bug #${b.id}` : "New bug";
  $("save").textContent = b ? "Save changes" : "Create bug";
  $("delete").hidden = !b;
  if (b) for (const k of ["title", "description", "priority", "status", "area"]) form.elements[k].value = b[k] ?? "";
  dialog.showModal();
  form.elements.title.focus();
}
// Save on submit, not on the dialog's "close" event: close fires later, after a
// quick follow-up edit could already have changed `editing`.
form.addEventListener("submit", (e) => {
  if (e.submitter?.value !== "save") return;
  const data = Object.fromEntries(["title", "description", "priority", "status", "area"].map((k) => [k, form.elements[k].value.trim()]));
  if (!data.title) return;
  if (editing) update(editing.id, data);
  else {
    const now = Date.now();
    bugs.push({ id: Math.max(0, ...bugs.map((b) => b.id)) + 1, ...data, created: now, updated: now });
    save();
    render();
    toast("Bug created");
  }
});
$("delete").addEventListener("click", () => {
  const b = editing;
  const index = bugs.indexOf(b);
  bugs.splice(index, 1);
  save();
  dialog.close("deleted");
  render();
  toast(`Deleted #${b.id}`, () => { bugs.splice(index, 0, b); save(); render(); });
});

let toastTimer;
function toast(text, undo) {
  document.querySelector(".toast")?.remove();
  clearTimeout(toastTimer);
  const t = el("div", "toast", text);
  t.setAttribute("role", "status");
  if (undo) {
    const btn = el("button", null, "Undo");
    btn.type = "button";
    btn.addEventListener("click", () => { undo(); t.remove(); });
    t.append(btn);
  }
  document.body.append(t);
  toastTimer = setTimeout(() => t.remove(), 5000);
}

// ---------- controls ----------
$("new-bug").addEventListener("click", () => openDialog());
["search", "filter-priority", "sort"].forEach((id) => $(id).addEventListener("input", render));
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
  view = b.dataset.view;
  document.querySelectorAll("[data-view]").forEach((o) => o.setAttribute("aria-pressed", o === b));
  render();
}));
$("reset-text").addEventListener("click", () => {
  if (!confirm("Replace your bugs with the demo data?")) return;
  bugs = demo();
  save();
  render();
});

render();
