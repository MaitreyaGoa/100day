// ============================================================
// 100-DAY DISCIPLINE CHALLENGE — app.js
// ------------------------------------------------------------
// 1. Deploy Code.gs as an Apps Script Web App (Access: Anyone).
// 2. Paste the deployment URL below.
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbzQVO9LcwwOYctnO-r4TOpZe8P2uhkpZDytERcVLACZRO7hIUnvQAc3xqNHn32RFfhADw/exec";

let state = {
  name: null,
  password: null,
  startDate: null,
  today: null,
  selectedDate: null,
  dayNumber: 1,
  bestStreak: 0,
  currentStreak: 0,
  dailyBudget: 150,
  items: [],
  logs: [],
  checklist: {},
  spend: "",
  balance: 0,
};

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

async function api(action, params) {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
    $("configNote").style.display = "block";
    throw new Error("API not configured");
  }
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.keys(params || {}).forEach((k) => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ---------------- LOGIN ----------------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("nameInput").value.trim();
  const password = $("passwordInput").value;
  if (!name || !password) return;
  await doLogin(name, password);
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("ddc_name");
  location.reload();
});

async function doLogin(name, password) {
  try {
    await api("login", { name, password });
    localStorage.setItem("ddc_name", name);
    state.name = name;
    state.password = password;
    await loadData();
    showApp();
  } catch (err) {
    toast("Wrong name or password");
    console.error(err);
  }
}

async function loadData() {
  const data = await api("getData", { name: state.name, password: state.password });
  state.startDate = data.startDate;
  state.today = data.today;
  state.selectedDate = state.selectedDate || data.today;
  state.dayNumber = data.dayNumber;
  state.bestStreak = data.bestStreak || 0;
  state.dailyBudget = data.dailyBudget || 150;
  state.items = data.customItems || [];
  state.logs = data.logs || [];
  state.balance = data.dayNumber * state.dailyBudget - state.logs.reduce((sum, l) => sum + (parseFloat(l.spend) || 0), 0);
  loadChecklistForDate(state.selectedDate);
  computeStreakLocal();
  render();
}

function loadChecklistForDate(dateStr) {
  const log = state.logs.find((l) => l.date === dateStr);
  state.checklist = log ? JSON.parse(log.checklist || "{}") : {};
  state.spend = log ? log.spend : "";
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayNumberForDate(dateStr) {
  const start = new Date(state.startDate + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - start) / 86400000) + 1;
}

function formatDateLabel(dateStr) {
  if (dateStr === state.today) return "Today";
  if (dateStr === addDays(state.today, -1)) return "Yesterday";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function goToDate(dateStr) {
  if (dateStr > state.today) dateStr = state.today;
  if (dateStr < state.startDate) dateStr = state.startDate;
  state.selectedDate = dateStr;
  loadChecklistForDate(dateStr);
  render();
}

$("prevDayBtn").addEventListener("click", () => goToDate(addDays(state.selectedDate, -1)));
$("nextDayBtn").addEventListener("click", () => goToDate(addDays(state.selectedDate, 1)));

function showApp() {
  $("loginView").style.display = "none";
  $("appView").style.display = "block";
  $("userNameLbl").textContent = state.name;
}

// ---------------- RENDER ----------------
function allItems() {
  return [...state.items].sort((a, b) => (a.sortHour ?? 12) - (b.sortHour ?? 12));
}

function computeStreakLocal() {
  const sorted = [...state.logs].sort((a, b) => (a.date < b.date ? -1 : 1));
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].complete === true || sorted[i].complete === "TRUE") current++;
    else break;
  }
  state.currentStreak = current;
}

function render() {
  $("dayNumLbl").textContent = state.dayNumber;
  $("streakNum").textContent = state.currentStreak;
  $("bestStreakNum").textContent = Math.max(state.bestStreak, state.currentStreak);

  // date navigation
  const isToday = state.selectedDate === state.today;
  const dateLbl = $("selectedDateLbl");
  dateLbl.textContent = isToday
    ? "Today"
    : `${formatDateLabel(state.selectedDate)} · Day ${dayNumberForDate(state.selectedDate)}`;
  dateLbl.classList.toggle("editing", !isToday);
  $("nextDayBtn").disabled = state.selectedDate >= state.today;
  $("prevDayBtn").disabled = state.selectedDate <= state.startDate;
  $("rosterEyebrow").textContent = isToday ? "Today's Roster" : "Editing Past Day";

  // punch row — last 20 logged days
  const row = $("punchRow");
  row.innerHTML = "";
  const recent = [...state.logs].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-20);
  recent.forEach((l) => {
    const d = document.createElement("div");
    d.className = "punch " + (l.complete === true || l.complete === "TRUE" ? "hit" : "miss");
    row.appendChild(d);
  });

  // timeline
  const tl = $("timeline");
  tl.innerHTML = "";
  allItems().forEach((item) => {
    const done = !!state.checklist[item.itemId];
    const row = document.createElement("div");
    row.className = "tl-item";
    row.innerHTML = `
      <div class="tl-time">${item.timeLabel || ""}</div>
      <button class="tl-check ${done ? "done" : ""}" data-id="${item.itemId}"></button>
      <div class="tl-label">${item.label}</div>
      <button class="tl-edit" data-edit="${item.itemId}">✎</button>
      <button class="tl-delete" data-del="${item.itemId}">✕</button>
    `;
    tl.appendChild(row);
  });

  document.querySelectorAll(".tl-check").forEach((btn) => {
    btn.addEventListener("click", () => toggleItem(btn.dataset.id));
  });
  document.querySelectorAll(".tl-edit").forEach((btn) => {
    btn.addEventListener("click", () => editItem(btn.dataset.edit));
  });
  document.querySelectorAll(".tl-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(btn.dataset.del));
  });

  // banner — matches the server's streak rule: checklist done AND not over the rollover budget
  const total = allItems().length;
  const doneCount = Object.values(state.checklist).filter(Boolean).length;
  const checklistDone = total > 0 && doneCount === total;
  $("completeBanner").classList.toggle("show", checklistDone && state.balance >= 0);

  // money
  $("spendInput").value = state.spend || "";
  $("budgetLabel").textContent = `RUNNING BALANCE (₹${state.dailyBudget}/day, rolls over)`;
  const bal = $("balanceFigure");
  bal.textContent = (state.balance >= 0 ? "+₹" : "−₹") + Math.abs(Math.round(state.balance));
  bal.className = "balance-figure " + (state.balance >= 0 ? "pos" : "neg");
}

// ---------------- ACTIONS ----------------
async function toggleItem(itemId) {
  state.checklist[itemId] = !state.checklist[itemId];
  render();
  await persistDay();
}

async function persistDay() {
  const date = state.selectedDate;
  try {
    const res = await api("saveLog", {
      name: state.name,
      password: state.password,
      date: date,
      checklist: JSON.stringify(state.checklist),
      spend: state.spend || 0,
    });
    state.bestStreak = res.bestStreak;
    state.currentStreak = res.currentStreak;
    state.balance = res.balance; // always reflects today's real running balance
    // reflect in local logs cache
    const idx = state.logs.findIndex((l) => l.date === date);
    const entry = { date: date, dayNumber: res.dayNumber, checklist: JSON.stringify(state.checklist), spend: state.spend || 0, complete: res.complete };
    if (idx === -1) state.logs.push(entry); else state.logs[idx] = entry;
    computeStreakLocal();
    render();
  } catch (err) {
    toast("Save failed — check connection");
    console.error(err);
  }
}

$("saveSpendBtn").addEventListener("click", async () => {
  state.spend = $("spendInput").value;
  await persistDay();
  toast(state.selectedDate === state.today ? "Spend logged" : `Spend logged for ${formatDateLabel(state.selectedDate)}`);
});

$("addItemBtn").addEventListener("click", async () => {
  const label = $("newItemLabel").value.trim();
  const timeLabel = $("newItemTime").value.trim();
  if (!label) return;
  let sortHour = 12;
  const match = timeLabel.match(/(\d{1,2})/);
  if (match) sortHour = parseInt(match[1], 10);
  try {
    const res = await api("addItem", { name: state.name, password: state.password, label, timeLabel, sortHour });
    state.items.push({ itemId: res.itemId, label, timeLabel, sortHour });
    $("newItemLabel").value = "";
    $("newItemTime").value = "";
    render();
    toast("Item added");
  } catch (err) {
    toast("Couldn't add item");
  }
});

async function editItem(itemId) {
  const item = state.items.find((i) => i.itemId === itemId);
  if (!item) return;
  const newLabel = prompt("Edit item name:", item.label);
  if (newLabel === null) return;
  const newTime = prompt("Edit time (blank = untimed, all day, etc):", item.timeLabel || "");
  if (newTime === null) return;
  let sortHour = item.sortHour;
  const match = (newTime || "").match(/(\d{1,2})/);
  if (match) sortHour = parseInt(match[1], 10);
  try {
    await api("updateItem", { name: state.name, password: state.password, itemId, label: newLabel, timeLabel: newTime, sortHour });
    item.label = newLabel;
    item.timeLabel = newTime;
    item.sortHour = sortHour;
    render();
    toast("Item updated");
  } catch (err) {
    toast("Couldn't update item");
  }
}

async function deleteItem(itemId) {
  try {
    await api("deleteItem", { name: state.name, password: state.password, itemId });
    state.items = state.items.filter((i) => i.itemId !== itemId);
    delete state.checklist[itemId];
    render();
  } catch (err) {
    toast("Couldn't remove item");
  }
}

$("editBudgetBtn").addEventListener("click", async () => {
  const newBudget = prompt("Set your daily budget (₹):", state.dailyBudget);
  if (newBudget === null) return;
  const num = parseFloat(newBudget);
  if (isNaN(num) || num < 0) { toast("Enter a valid amount"); return; }
  try {
    const res = await api("updateBudget", { name: state.name, password: state.password, budget: num });
    state.dailyBudget = res.dailyBudget;
    state.balance = res.balance;
    render();
    toast("Budget updated");
  } catch (err) {
    toast("Couldn't update budget");
  }
});

// ---------------- BOOT ----------------
(async function boot() {
  const savedName = localStorage.getItem("ddc_name");
  if (savedName) {
    $("nameInput").value = savedName;
  }
  // Password is never stored on the device — it must be entered each visit.
})();
