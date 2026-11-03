// Expense Tracker: create / read / update / delete expenses, kept in localStorage,
// with monthly totals, a category breakdown, daily chart and CSV export.
const $ = (id) => document.getElementById(id);
const KEY = "mini-expenses";
const CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Health", "Fun", "Other"];
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Demo data: a full previous month plus this month up to today.
function demo() {
  const now = new Date();
  const at = (monthsBack, day) => isoDay(new Date(now.getFullYear(), now.getMonth() - monthsBack, day));
  const last = [
    [1, "Rent share", 8000, "Bills"], [2, "Groceries", 2450, "Food"], [3, "Grab to office", 280, "Transport"],
    [5, "Electric bill", 3120, "Bills"], [6, "Coffee", 165, "Food"], [8, "Gym membership", 1800, "Health"],
    [9, "Lunch with team", 640, "Food"], [11, "Internet", 1699, "Bills"], [12, "Movie night", 520, "Fun"],
    [14, "Running shoes", 4200, "Shopping"], [16, "Groceries", 1980, "Food"], [17, "MRT card top-up", 500, "Transport"],
    [19, "Pharmacy", 380, "Health"], [21, "Concert tickets", 3500, "Fun"], [23, "Dinner out", 1250, "Food"],
    [24, "Water bill", 640, "Bills"], [26, "Groceries", 2210, "Food"], [27, "Grab home", 310, "Transport"],
    [28, "Birthday gift", 1500, "Shopping"],
  ].map(([d, ...r]) => [at(1, d), ...r]);
  const current = [
    [1, "Rent share", 8000, "Bills"], [1, "Groceries", 2380, "Food"], [2, "Coffee", 165, "Food"],
    [3, "Grab to office", 290, "Transport"], [4, "Lunch", 420, "Food"], [6, "Electric bill", 2980, "Bills"],
    [9, "Gym membership", 1800, "Health"], [12, "Book", 690, "Shopping"],
  ].filter(([d]) => d <= now.getDate()).map(([d, ...r]) => [at(0, d), ...r]);
  return [...last, ...current].map(([date, note, amount, category], i) => ({ id: i + 1, date, note, amount, category }));
}

let items = store.get(KEY, null) ?? demo();
let currency = store.get("mini-expenses-currency", "PHP");
let cursor = new Date(); cursor.setDate(1);
const save = () => store.set(KEY, items);
const money = (n) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(n);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// ---------- rendering ----------
function render() {
  const key = monthKey(cursor);
  const month = items.filter((x) => x.date.startsWith(key));
  $("month").textContent = cursor.toLocaleDateString("en", { month: "long", year: "numeric" });
  const isThisMonth = key === monthKey(new Date());
  $("next").disabled = isThisMonth;

  const total = month.reduce((s, x) => s + x.amount, 0);
  const daysIn = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const daysSoFar = isThisMonth ? new Date().getDate() : daysIn;
  const byCat = CATEGORIES.map((c) => [c, month.filter((x) => x.category === c).reduce((s, x) => s + x.amount, 0)]).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  const biggest = month.reduce((m, x) => (x.amount > (m?.amount ?? 0) ? x : m), null);

  const tiles = [
    ["Spent this month", money(total), `${month.length} expense${month.length === 1 ? "" : "s"}`],
    ["Daily average", money(total / daysSoFar), `over ${daysSoFar} day${daysSoFar === 1 ? "" : "s"}`],
    ["Top category", byCat[0]?.[0] ?? "—", byCat[0] ? money(byCat[0][1]) : "no spending yet"],
    ["Largest expense", biggest ? money(biggest.amount) : "—", biggest?.note ?? "no spending yet"],
  ];
  $("summary").replaceChildren(...tiles.map(([k, v, sub]) => {
    const d = el("div"), dd = el("dd", null, v);
    dd.title = v;
    d.append(el("dt", null, k), dd, el("small", null, sub));
    return d;
  }));

  renderCats(byCat, total);
  renderDaily(month, daysIn);
  renderRows(month);
}

function renderCats(byCat, total) {
  if (!byCat.length) return $("cats").replaceChildren(el("li", "empty", "No expenses this month"));
  const max = byCat[0][1];
  $("cats").replaceChildren(...byCat.map(([c, v]) => {
    const li = el("li");
    const amt = el("span", "amt", money(v));
    amt.append(el("span", "share", `${Math.round((v / total) * 100)}%`));
    const bar = el("span", "bar"), fill = el("i");
    fill.style.width = `${(v / max) * 100}%`;
    bar.append(fill);
    li.append(el("span", null, c), amt, bar);
    return li;
  }));
}

function renderDaily(month, daysIn) {
  const perDay = Array(daysIn).fill(0);
  month.forEach((x) => (perDay[+x.date.slice(8, 10) - 1] += x.amount));
  const max = Math.max(1, ...perDay);
  const box = $("daily");
  box.style.setProperty("--n", daysIn);
  box.replaceChildren(...perDay.map((v, i) => {
    const b = el("button", v ? "" : "zero");
    b.type = "button";
    const label = `${cursor.toLocaleDateString("en", { month: "short" })} ${i + 1}: ${money(v)}`;
    b.setAttribute("aria-label", label);
    const bar = el("i");
    bar.style.height = `${(v / max) * 100}%`;
    b.append(bar);
    const show = () => {
      const r = b.getBoundingClientRect(), p = box.parentElement.getBoundingClientRect();
      $("tip").textContent = label;
      $("tip").hidden = false;
      $("tip").style.left = `${Math.min(Math.max(r.left + r.width / 2 - p.left, 70), p.width - 70)}px`;
      $("tip").style.top = `${r.bottom - p.top - bar.offsetHeight - 40}px`;
    };
    b.addEventListener("mouseenter", show);
    b.addEventListener("focus", show);
    b.addEventListener("mouseleave", () => ($("tip").hidden = true));
    b.addEventListener("blur", () => ($("tip").hidden = true));
    return b;
  }));
  const axis = el("div", "axis-x");
  axis.append(el("span", null, "1"), el("span", null, String(Math.ceil(daysIn / 2))), el("span", null, String(daysIn)));
  box.nextElementSibling?.classList.contains("axis-x") ? box.nextElementSibling.replaceWith(axis) : box.after(axis);
}

function renderRows(month) {
  const q = $("search").value.trim().toLowerCase();
  const cat = $("filter").value;
  const rows = month
    .filter((x) => (!cat || x.category === cat) && (!q || x.note.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  if (!rows.length) {
    const td = el("td", "empty", month.length ? "No expenses match your search." : "No expenses this month yet.");
    td.colSpan = 5;
    const tr = el("tr"); tr.append(td);
    return $("rows").replaceChildren(tr);
  }
  $("rows").replaceChildren(...rows.map((x) => {
    const tr = el("tr");
    const date = new Date(`${x.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
    const cat = el("td"); cat.append(el("span", "badge", x.category));
    const actions = el("td");
    const edit = el("button", "btn", "Edit");
    edit.type = "button";
    edit.setAttribute("aria-label", `Edit ${x.note}`);
    edit.addEventListener("click", () => openDialog(x));
    actions.append(edit);
    tr.append(el("td", "date", date), el("td", "desc", x.note), cat, el("td", "num", money(x.amount)), actions);
    return tr;
  }));
}

// ---------- create / update / delete ----------
const dialog = $("dialog"), form = $("form");
let editing = null;
function openDialog(x = null) {
  editing = x;
  form.reset();
  $("dialog-title").textContent = x ? "Edit expense" : "Add expense";
  $("save").textContent = x ? "Save changes" : "Add expense";
  $("delete").hidden = !x;
  const today = isoDay(new Date());
  const inMonth = monthKey(cursor) === monthKey(new Date()) ? today : `${monthKey(cursor)}-01`;
  form.elements.note.value = x?.note ?? "";
  form.elements.amount.value = x?.amount ?? "";
  form.elements.date.value = x?.date ?? inMonth;
  form.elements.category.value = x?.category ?? "Food";
  dialog.showModal();
  form.elements.note.focus();
}
// Save on submit, not on the dialog's "close" event: close fires later, after a
// quick follow-up edit could already have changed `editing`.
form.addEventListener("submit", (e) => {
  if (e.submitter?.value !== "save") return;
  const data = {
    note: form.elements.note.value.trim(),
    amount: Math.round(parseFloat(form.elements.amount.value) * 100) / 100,
    date: form.elements.date.value,
    category: form.elements.category.value,
  };
  if (!data.note || !(data.amount > 0) || !data.date) return;
  if (editing) Object.assign(editing, data);
  else items.push({ id: Math.max(0, ...items.map((x) => x.id)) + 1, ...data });
  save();
  cursor = new Date(`${data.date}T12:00:00`); cursor.setDate(1); // jump to the month it landed in
  render();
  toast(editing ? "Expense updated" : "Expense added");
});
$("delete").addEventListener("click", () => {
  const x = editing, index = items.indexOf(x);
  items.splice(index, 1);
  save();
  dialog.close("deleted");
  render();
  toast(`Deleted "${x.note}"`, () => { items.splice(index, 0, x); save(); render(); });
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

// ---------- CSV export ----------
$("export").addEventListener("click", () => {
  const key = monthKey(cursor);
  const csvCell = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const lines = [["Date", "Description", "Category", `Amount (${currency})`], ...items.filter((x) => x.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, x.note, x.category, x.amount.toFixed(2)])];
  const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `expenses-${key}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- controls ----------
for (const c of CATEGORIES) {
  $("filter").append(Object.assign(el("option", null, c), { value: c }));
  $("category").append(Object.assign(el("option", null, c), { value: c }));
}
$("currency").value = currency;
$("currency").addEventListener("change", () => { currency = $("currency").value; store.set("mini-expenses-currency", currency); render(); });
$("prev").addEventListener("click", () => { cursor.setMonth(cursor.getMonth() - 1); render(); });
$("next").addEventListener("click", () => { cursor.setMonth(cursor.getMonth() + 1); render(); });
$("add").addEventListener("click", () => openDialog());
["search", "filter"].forEach((id) => $(id).addEventListener("input", () => renderRows(items.filter((x) => x.date.startsWith(monthKey(cursor))))));
$("reset").addEventListener("click", () => {
  if (!confirm("Replace your expenses with the demo data?")) return;
  items = demo();
  save();
  cursor = new Date(); cursor.setDate(1);
  render();
});

render();
