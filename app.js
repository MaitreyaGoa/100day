// ============================================================
// 100-DAY DISCIPLINE CHALLENGE — app.js
// ------------------------------------------------------------
// 1. Deploy Code.gs as an Apps Script Web App (Access: Anyone).
// 2. Paste the deployment URL below.
// ============================================================
const API_URL = "https://script.google.com/macros/s/AKfycbzQVO9LcwwOYctnO-r4TOpZe8P2uhkpZDytERcVLACZRO7hIUnvQAc3xqNHn32RFfhADw/exec";

const DEFAULT_ITEMS = [
  { itemId: "nofood",   label: "No sugar / maida / deep-fried", timeLabel: "All day",        sortHour: -1, builtIn: true },
  { itemId: "gym",      label: "Gym",                            timeLabel: "",                sortHour: 6,  builtIn: true },
  { itemId: "breakfast",label: "Breakfast",                      timeLabel: "",                sortHour: 8,  builtIn: true },
  { itemId: "lunch",    label: "Lunch",                           timeLabel: "",                sortHour: 13, builtIn: true },
  { itemId: "class1",   label: "Class",                           timeLabel: "3:00–5:00 PM",    sortHour: 15, builtIn: true },
  { itemId: "class2",   label: "Online Class",                    timeLabel: "7:00–8:30 PM",    sortHour: 19, builtIn: true },
  { itemId: "norec",    label: "No recreation",                   timeLabel: "Until 10:00 PM",  sortHour: 22, builtIn: true },
];

let state = {
  name: null,
  startDate: null,
  dayNumber: 1,
  bestStreak: 0,
  currentStreak: 0,
  customItems: [],
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
  if (!name) return;
  await doLogin(name);
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("ddc_name");
  location.reload();
});

async function doLogin(name) {
  try {
    const res = await api("login", { name });
    localStorage.setItem("ddc_name", name);
    state.name = name;
    await loadData();
    showApp();
  } catch (err) {
    toast("Couldn't reach the log — check setup");
    console.error(err);
  }
}

async function loadData() {
  const data = await api("getData", { name: state.name });
  state.startDate = data.startDate;
  state.dayNumber = data.dayNumber;
  state.bestStreak = data.bestStreak || 0;
  state.customItems = data.customItems || [];
  state.logs = data.logs || [];
  state.checklist = data.todayLog ? JSON.parse(data.todayLog.checklist || "{}") : {};
  state.spend = data.todayLog ? data.todayLog.spend : "";
  state.balance = data.dayNumber * 150 - state.logs.reduce((sum, l) => sum + (parseFloat(l.spend) || 0), 0);
  computeStreakLocal();
  render();
}

function showApp() {
  $("loginView").style.display = "none";
  $("appView").style.display = "block";
  $("userNameLbl").textContent = state.name;
}

// ---------------- RENDER ----------------
function allItems() {
  return [...DEFAULT_ITEMS, ...state.customItems].sort((a, b) => (a.sortHour ?? 12) - (b.sortHour ?? 12));
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
      ${item.builtIn ? "" : `<button class="tl-delete" data-del="${item.itemId}">✕</button>`}
    `;
    tl.appendChild(row);
  });

  document.querySelectorAll(".tl-check").forEach((btn) => {
    btn.addEventListener("click", () => toggleItem(btn.dataset.id));
  });
  document.querySelectorAll(".tl-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(btn.dataset.del));
  });

  // banner
  const total = allItems().length;
  const doneCount = Object.values(state.checklist).filter(Boolean).length;
  $("completeBanner").classList.toggle("show", total > 0 && doneCount === total);

  // money
  $("spendInput").value = state.spend || "";
  const bal = $("balanceFigure");
  bal.textContent = (state.balance >= 0 ? "+₹" : "−₹") + Math.abs(Math.round(state.balance));
  bal.className = "balance-figure " + (state.balance >= 0 ? "pos" : "neg");
}

// ---------------- ACTIONS ----------------
async function toggleItem(itemId) {
  state.checklist[itemId] = !state.checklist[itemId];
  render();
  await persistToday();
}

async function persistToday() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const res = await api("saveLog", {
      name: state.name,
      date: today,
      checklist: JSON.stringify(state.checklist),
      spend: state.spend || 0,
    });
    state.bestStreak = res.bestStreak;
    state.currentStreak = res.currentStreak;
    state.balance = res.balance;
    // reflect in local logs cache
    const idx = state.logs.findIndex((l) => l.date === today);
    const entry = { date: today, dayNumber: res.dayNumber, checklist: JSON.stringify(state.checklist), spend: state.spend || 0, complete: res.complete };
    if (idx === -1) state.logs.push(entry); else state.logs[idx] = entry;
    render();
  } catch (err) {
    toast("Save failed — check connection");
    console.error(err);
  }
}

$("saveSpendBtn").addEventListener("click", async () => {
  state.spend = $("spendInput").value;
  await persistToday();
  toast("Spend logged");
});

$("addItemBtn").addEventListener("click", async () => {
  const label = $("newItemLabel").value.trim();
  const timeLabel = $("newItemTime").value.trim();
  if (!label) return;
  let sortHour = 12;
  const match = timeLabel.match(/(\d{1,2})/);
  if (match) sortHour = parseInt(match[1], 10);
  try {
    const res = await api("addItem", { name: state.name, label, timeLabel, sortHour });
    state.customItems.push({ itemId: res.itemId, label, timeLabel, sortHour, builtIn: false });
    $("newItemLabel").value = "";
    $("newItemTime").value = "";
    render();
    toast("Item added");
  } catch (err) {
    toast("Couldn't add item");
  }
});

async function deleteItem(itemId) {
  try {
    await api("deleteItem", { name: state.name, itemId });
    state.customItems = state.customItems.filter((i) => i.itemId !== itemId);
    delete state.checklist[itemId];
    render();
  } catch (err) {
    toast("Couldn't remove item");
  }
}

// ---------------- BOOT ----------------
(async function boot() {
  const savedName = localStorage.getItem("ddc_name");
  if (savedName) {
    $("nameInput").value = savedName;
    state.name = savedName;
    try {
      await loadData();
      showApp();
    } catch (err) {
      // fall back to login screen if fetch fails (e.g. API not set yet)
      console.error(err);
    }
  }
})();
