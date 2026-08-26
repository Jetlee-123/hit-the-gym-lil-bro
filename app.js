let state = {};
const ADMIN_PASSPHRASE = "GymAdmin2026"; // Client-side gate only — anyone can read this via view-source/devtools.
                                          // It stops casual button-pressing, not a determined attacker. For real
                                          // protection, enforce this server-side with Firestore security rules
                                          // tied to a specific signed-in admin UID instead of a shared string.

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Discipline beats motivation every single time, lil bro.",
  "Small consistent reps beat big sporadic efforts.",
  "You don't have to be extreme, just consistent.",
  "Progress, not perfection. Show up today.",
  "Every meal and every set is a vote for the person you're becoming.",
  "Sore today, stronger tomorrow.",
  "The gym doesn't care about excuses — go hit it, lil bro."
];
const WISDOM = [
  "Skipping leg day is a crime against shorts everywhere.",
  "Protein shake in one hand, excuses in the trash, lil bro.",
  "The iron doesn't care about your feelings, but it respects consistency.",
  "You miss 100% of the gains you don't chase.",
  "Cardio is just resistance training against your own laziness.",
  "Bro science says: if it doesn't get logged, it doesn't count. Log it.",
  "A bad workout is still 1000x better than the workout you didn't do.",
  "Sleep is the most underrated supplement, and it's free.",
  "Form over ego — your joints will thank you at 40.",
  "The gym is 20% lifting, 80% deciding to show up."
];
const CHALLENGES = [
  { id: "protein3", title: "Protein Streak", desc: "Hit your protein target 3 days this week", xp: 60 },
  { id: "logall", title: "Full Logger", desc: "Log all 3 main meals today", xp: 30 },
  { id: "water8", title: "Hydration Hero", desc: "Fill your entire water tracker today", xp: 25 },
  { id: "notrain", title: "No Skip Zone", desc: "Complete today's workout without skipping a day", xp: 40 },
  { id: "earlylog", title: "Early Bird", desc: "Log breakfast before 10am", xp: 20 }
];
const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "🌅", quick: [
      { name: "Oats (50g)", cal: 190 }, { name: "Eggs (2)", cal: 156 }, { name: "Greek yogurt", cal: 100 },
      { name: "Banana", cal: 105 }, { name: "Toast + PB", cal: 250 }, { name: "Protein shake", cal: 120 } ] },
  { key: "lunch", label: "Lunch", icon: "🍱", quick: [
      { name: "Chicken breast (100g)", cal: 165 }, { name: "Rice (1 cup)", cal: 200 }, { name: "Side salad", cal: 80 },
      { name: "Sandwich", cal: 350 }, { name: "Soup", cal: 180 }, { name: "Wrap", cal: 320 } ] },
  { key: "dinner", label: "Dinner", icon: "🍽️", quick: [
      { name: "Salmon (150g)", cal: 280 }, { name: "Steak (150g)", cal: 340 }, { name: "Pasta (1 cup)", cal: 220 },
      { name: "Mixed veg", cal: 70 }, { name: "Sweet potato", cal: 180 }, { name: "Stir fry", cal: 300 } ] },
  { key: "snacks", label: "Snacks", icon: "🍎", quick: [
      { name: "Protein bar", cal: 200 }, { name: "Mixed nuts (30g)", cal: 180 }, { name: "Apple", cal: 95 },
      { name: "Peanut butter (1 tbsp)", cal: 95 }, { name: "Rice cakes (2)", cal: 70 }, { name: "Yogurt", cal: 100 } ] }
];

function ns(key){ return getActiveProfile() + "-" + key; }
function getProfiles(){ return JSON.parse(localStorage.getItem("gymapp-profiles") || "[\"Player 1\"]"); }
function saveProfiles(list){ localStorage.setItem("gymapp-profiles", JSON.stringify(list)); }
function getActiveProfile(){ return localStorage.getItem("gymapp-active-profile") || "Player 1"; }
function setActiveProfile(name){ localStorage.setItem("gymapp-active-profile", name); location.reload(); }
function cloudPinKeyFor(name){ return "cloudpin-" + name; }
function hasCloudLink(name){ return localStorage.getItem(cloudPinKeyFor(name)) !== null; }
function getCloudPin(name){ return localStorage.getItem(cloudPinKeyFor(name)); }

let syncTimeout = null;
function queueCloudSync(){
  const name = getActiveProfile();
  if (!hasCloudLink(name)) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(function(){ doCloudSync(name); }, 1200);
}
async function doCloudSync(name){
  try{
    const pin = getCloudPin(name);
    const prefix = name + "-";
    const dataObj = {};
    Object.keys(localStorage).filter(function(k){ return k.startsWith(prefix); })
      .forEach(function(k){ dataObj[k] = localStorage.getItem(k); });
    const now = Date.now();
    await window.fbSavePlayer(name, pin, dataObj, now);
    localStorage.setItem(prefix + "synctime", String(now));
  } catch(err){ console.error("cloud sync failed", err); }
}
async function pullCloudIfNewer(name){
  if (!hasCloudLink(name)) return false;
  try{
    const existing = await window.fbGetPlayer(name);
    if (!existing) return false;
    const cloudUpdatedAt = existing.updatedAt || 0;
    const adminAt = existing.adminActionAt || 0;
    const localSyncedAt = Number(localStorage.getItem(name + "-synctime")) || 0;
    const cloudIsAuthoritative = adminAt > localSyncedAt || cloudUpdatedAt > localSyncedAt;
    if (cloudIsAuthoritative){
      const cloudData = existing.data || {};
      Object.keys(cloudData).forEach(function(k){ localStorage.setItem(k, cloudData[k]); });
      localStorage.setItem(name + "-synctime", String(Math.max(cloudUpdatedAt, adminAt)));
      return true;
    }
  } catch(err){ console.error("pull failed", err); }
  return false;
}
async function cloudSignIn(){
  const nameInput = document.getElementById("cloudNameInput");
  const pinInput = document.getElementById("cloudPinInput");
  const statusEl = document.getElementById("cloudLoginStatus");
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  if (!name || !pin){ statusEl.textContent = "Enter both your name and a code."; return; }
  statusEl.textContent = "Connecting...";
  try{
    const existing = await window.fbGetPlayer(name);
    if (existing){
      if (existing.pin !== pin){
        statusEl.textContent = "That name is taken with a different code. Try another name or the right code.";
        return;
      }
      const cloudData = existing.data || {};
      Object.keys(cloudData).forEach(function(k){ localStorage.setItem(k, cloudData[k]); });
      localStorage.setItem(name + "-synctime", String(existing.updatedAt || Date.now()));
      localStorage.setItem(cloudPinKeyFor(name), pin);
      const list = getProfiles();
      if (!list.includes(name)){ list.push(name); saveProfiles(list); }
      statusEl.textContent = "Welcome back! Loading your data...";
      setTimeout(function(){ setActiveProfile(name); }, 400);
    } else {
      await window.fbCreatePlayer(name, pin);
      statusEl.textContent = "Account created — welcome!";
      localStorage.setItem(cloudPinKeyFor(name), pin);
      const list = getProfiles();
      if (!list.includes(name)){ list.push(name); saveProfiles(list); }
      setTimeout(function(){ setActiveProfile(name); }, 400);
    }
  } catch(err){ statusEl.textContent = "Connection error: " + err.message; }
}
function openProfileSwitcher(){
  const profiles = getProfiles().filter(function(n){ return hasCloudLink(n); });
  const active = getActiveProfile();
  const root = document.getElementById("profileModalRoot");
  root.innerHTML = "";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", function(e){ if (e.target === overlay) root.innerHTML = ""; });
  const box = document.createElement("div");
  box.className = "modal-box";
  const h3 = document.createElement("h3");
  h3.textContent = hasCloudLink(active) ? "Switch account" : "Sign in to get started";
  box.appendChild(h3);
  if (profiles.length > 0){
    const p = document.createElement("p");
    p.className = "small"; p.textContent = "Accounts signed in on this device:";
    box.appendChild(p);
    const list = document.createElement("div");
    list.className = "profile-list";
    profiles.forEach(function(name){
      const item = document.createElement("div");
      item.className = "profile-item" + (name === active ? " active" : "");
      const span = document.createElement("span");
      span.textContent = name + (name === active ? " (active)" : "");
      item.appendChild(span);
      item.addEventListener("click", function(){ setActiveProfile(name); });
      list.appendChild(item);
    });
    box.appendChild(list);
    const divider = document.createElement("div"); divider.className = "divider";
    box.appendChild(divider);
  }
  const h4 = document.createElement("h4");
  h4.textContent = profiles.length > 0 ? "Sign in as someone new" : "Enter your name to sign in";
  box.appendChild(h4);
  const cp = document.createElement("p");
  cp.className = "small";
  cp.textContent = "Pick any name and a short code. Use the exact same ones on any device to keep your progress synced, and everyone shows up on the leaderboard automatically. Note: names are case-insensitive — if a name is already taken, sign in with its existing code instead of creating a near-duplicate.";
  box.appendChild(cp);
  const cloudNameInput = document.createElement("input");
  cloudNameInput.id = "cloudNameInput"; cloudNameInput.placeholder = "Your name"; cloudNameInput.style.marginBottom = "8px";
  box.appendChild(cloudNameInput);
  const cloudPinInput = document.createElement("input");
  cloudPinInput.id = "cloudPinInput"; cloudPinInput.type = "password"; cloudPinInput.placeholder = "Code (any word or numbers)"; cloudPinInput.style.marginBottom = "8px";
  box.appendChild(cloudPinInput);
  const cloudBtn = document.createElement("button");
  cloudBtn.className = "btn small"; cloudBtn.style.width = "100%"; cloudBtn.textContent = "Let's go";
  cloudBtn.addEventListener("click", cloudSignIn);
  box.appendChild(cloudBtn);
  const cloudStatus = document.createElement("p");
  cloudStatus.id = "cloudLoginStatus"; cloudStatus.className = "cloud-status";
  box.appendChild(cloudStatus);
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn secondary"; closeBtn.style.width = "100%"; closeBtn.style.marginTop = "14px"; closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", function(){ root.innerHTML = ""; });
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  root.appendChild(overlay);
}

function openAdminPanel(){
  const entered = prompt("Enter admin passphrase:");
  if (entered !== ADMIN_PASSPHRASE){
    if (entered !== null) alert("Incorrect passphrase.");
    return;
  }
  window.fbGetLeaderboard().then(function(rows){
    const root = document.getElementById("profileModalRoot");
    root.innerHTML = "";
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", function(e){ if (e.target === overlay) root.innerHTML = ""; });
    const box = document.createElement("div");
    box.className = "modal-box";
    const h3 = document.createElement("h3"); h3.textContent = "🔑 Admin Panel";
    box.appendChild(h3);
    const p = document.createElement("p"); p.className = "small";
    p.textContent = "Pick a player, then adjust XP or fully reset their account.";
    box.appendChild(p);
    const select = document.createElement("select"); select.style.marginBottom = "10px";
    rows.forEach(function(r){
      const opt = document.createElement("option");
      opt.value = r.data.displayName || r.id; opt.textContent = r.data.displayName || r.id;
      select.appendChild(opt);
    });
    box.appendChild(select);
    const xpInput = document.createElement("input");
    xpInput.type = "number"; xpInput.placeholder = "Set XP to..."; xpInput.style.marginBottom = "8px";
    box.appendChild(xpInput);
    const setBtn = document.createElement("button");
    setBtn.className = "btn small"; setBtn.style.width = "100%"; setBtn.textContent = "Set XP";
    setBtn.addEventListener("click", async function(){
      const val = Number(xpInput.value);
      if (!Number.isFinite(val)) { alert("Enter a valid number."); return; }
      await window.fbAdminSetXP(select.value, val);
      alert("Updated " + select.value + "'s XP to " + val + ". They'll pick it up next time the app syncs.");
      root.innerHTML = "";
    });
    box.appendChild(setBtn);
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn small"; resetBtn.style.width = "100%"; resetBtn.style.marginTop = "8px"; resetBtn.style.background = "#f87171"; resetBtn.style.color = "#fff";
    resetBtn.textContent = "Fully reset this player's account";
    resetBtn.addEventListener("click", async function(){
      if (!confirm("This wipes ALL data for " + select.value + " (XP, food log, PRs, weight log). Continue?")) return;
      await window.fbAdminResetPlayer(select.value);
      alert(select.value + "'s account has been reset.");
      root.innerHTML = "";
    });
    box.appendChild(resetBtn);
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn secondary"; closeBtn.style.width = "100%"; closeBtn.style.marginTop = "14px"; closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", function(){ root.innerHTML = ""; });
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    root.appendChild(overlay);
  });
}

function toggleTheme(){
  const body = document.body;
  const isDark = body.getAttribute("data-theme") === "dark";
  body.setAttribute("data-theme", isDark ? "light" : "dark");
  document.getElementById("themeBtn").textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("gymapp-theme", isDark ? "light" : "dark");
  if (document.getElementById("panel-progress").classList.contains("active")) drawWeightChart();
}
function initTheme(){
  const saved = localStorage.getItem("gymapp-theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  document.getElementById("themeBtn").textContent = saved === "dark" ? "🌙" : "☀️";
  document.getElementById("quoteBanner").textContent = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  document.getElementById("profilePill").textContent = getActiveProfile();
  if (!hasCloudLink(getActiveProfile())) setTimeout(openProfileSwitcher, 400);
}

function showTab(name){
  document.querySelectorAll(".tab").forEach(function(t){ t.classList.toggle("active", t.dataset.tab === name); });
  document.querySelectorAll(".panel").forEach(function(p){ p.classList.toggle("active", p.id === "panel-" + name); });
  if (name === "progress") renderProgressTab();
  if (name === "log") renderMealCards();
  if (name === "leaderboard") { pullCloudIfNewer(getActiveProfile()).then(renderLeaderboard); }
}
function setSeg(segId, hiddenId, btn){
  document.querySelectorAll("#" + segId + " button").forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  document.getElementById(hiddenId).value = btn.dataset.val;
}

function xpFromDataBlob(dataBlob){
  const key = Object.keys(dataBlob).find(function(k){ return k.endsWith("-xp"); });
  return key ? (Number(dataBlob[key]) || 0) : 0;
}
function streakFromDataBlob(dataBlob){
  const key = Object.keys(dataBlob).find(function(k){ return k.endsWith("-workoutdays"); });
  if (!key) return 0;
  let days;
  try{ days = JSON.parse(dataBlob[key]); }catch(e){ days = []; }
  days.sort();
  const dateSet = new Set(days);
  let current = 0;
  let cursor = new Date();
  while(true){
    const k = cursor.getFullYear() + "-" + (cursor.getMonth()+1) + "-" + cursor.getDate();
    if (dateSet.has(k)){ current++; cursor.setDate(cursor.getDate()-1); } else break;
  }
  return current;
}
async function renderLeaderboard(){
  const wrap = document.getElementById("leaderboardWrap");
  wrap.innerHTML = "<div class='empty-state'>Loading leaderboard...</div>";
  try{
    const rows = await window.fbGetLeaderboard();
    const active = getActiveProfile();
    const list = rows.map(function(r){
      const blob = r.data.data || {};
      return { name: blob.displayName || r.data.displayName || r.id, xp: xpFromDataBlob(blob), streak: streakFromDataBlob(blob) };
    }).sort(function(a,b){ return b.xp - a.xp; });
    wrap.innerHTML = "";
    if (list.length === 0){ wrap.innerHTML = "<div class='empty-state'>No players yet — be the first to sign up!</div>"; return; }
    list.forEach(function(p, idx){
      const info = levelForXP(p.xp);
      const row = document.createElement("div");
      row.className = "leaderboard-row" + (p.name.toLowerCase() === active.toLowerCase() ? " me" : "");
      const rank = document.createElement("span"); rank.className = "lb-rank"; rank.textContent = "#" + (idx+1);
      const nameEl = document.createElement("span"); nameEl.className = "lb-name"; nameEl.textContent = p.name;
      const lvl = document.createElement("span"); lvl.className = "lb-lvl"; lvl.textContent = "Lv" + info.level;
      const xp = document.createElement("span"); xp.className = "lb-xp"; xp.textContent = p.xp + " XP";
      const streak = document.createElement("span"); streak.className = "lb-streak"; streak.textContent = "🔥" + p.streak;
      row.appendChild(rank); row.appendChild(nameEl); row.appendChild(lvl); row.appendChild(xp); row.appendChild(streak);
      wrap.appendChild(row);
    });
  } catch(err){ wrap.innerHTML = "<div class='errbox'>Could not load leaderboard: " + err.message + "</div>"; }
}

const LEVELTITLES = ["Rookie","Getting Started","Consistent","Committed","Iron Apprentice","Gym Regular","Strong Contender","Beast Mode","Iron Veteran","Iron Beast"];
function getXP(){ return Number(localStorage.getItem(ns("xp"))) || 0; }
function addXP(amount, reason){
  const before = getXP();
  const after = before + Number(amount);
  localStorage.setItem(ns("xp"), String(after));
  const lvlBefore = levelForXP(before).level;
  const lvlAfter = levelForXP(after).level;
  renderLevelBar();
  queueCloudSync();
  if (lvlAfter > lvlBefore){
    fireConfetti();
    setTimeout(function(){ alert("Level up! You are now Level " + lvlAfter + " — " + levelForXP(after).title); }, 100);
  }
}
function levelForXP(xp){
  const level = Math.min(10, Math.floor(xp / 100) + 1);
  const xpIntoLevel = xp % 100;
  const title = LEVELTITLES[Math.min(level-1, LEVELTITLES.length-1)];
  return { level: level, xpIntoLevel: xpIntoLevel, title: title };
}
function renderLevelBar(){
  const xp = getXP();
  const info = levelForXP(xp);
  document.getElementById("levelBadgeNum").textContent = info.level;
  document.getElementById("levelTitle").textContent = "Level " + info.level + " · " + info.title;
  document.getElementById("xpBarInner").style.width = info.xpIntoLevel + "%";
  document.getElementById("xpText").textContent = info.xpIntoLevel + " / 100 XP";
}
function fireConfetti(){
  const colors = ["#22c55e","#38bdf8","#a78bfa","#f472b6","#fbbf24"];
  for(let i=0;i<40;i++){
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.left = Math.random()*100 + "vw";
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDelay = Math.random()*0.3 + "s";
    document.body.appendChild(p);
    setTimeout(function(){ p.remove(); }, 2600);
  }
}

function todaysChallenge(){
  const dayIndex = Math.floor(Date.now()/86400000) % CHALLENGES.length;
  return CHALLENGES[dayIndex];
}
function renderChallengeCard(){
  const ch = todaysChallenge();
  const todayKey = new Date().toDateString();
  const doneKey = ns("challengedone-" + todayKey);
  const done = localStorage.getItem(doneKey) === "1";
  const box = document.getElementById("challengeCard");
  box.innerHTML = "";
  const titleDiv = document.createElement("div"); titleDiv.className = "ch-title";
  titleDiv.textContent = (done ? "✅ " : "🎯 ") + "Today's Challenge: " + ch.title;
  const descDiv = document.createElement("div"); descDiv.className = "ch-desc"; descDiv.textContent = ch.desc;
  const xpDiv = document.createElement("div"); xpDiv.className = "ch-xp";
  xpDiv.textContent = done ? ("Completed! +" + ch.xp + " XP earned") : ("+" + ch.xp + " XP if completed");
  box.appendChild(titleDiv); box.appendChild(descDiv); box.appendChild(xpDiv);
  if (!done){
    const btn = document.createElement("button");
    btn.className = "btn small"; btn.style.marginTop = "10px"; btn.textContent = "Mark complete";
    btn.addEventListener("click", function(){
      localStorage.setItem(doneKey, "1");
      addXP(ch.xp, ch.title);
      renderChallengeCard();
    });
    box.appendChild(btn);
  }
}

let timerSeconds = 90, timerInterval = null, timerRemaining = 90;
function setTimer(sec){ timerSeconds = sec; timerRemaining = sec; clearInterval(timerInterval); timerInterval = null; updateTimerDisplay(); }
function updateTimerDisplay(){
  const m = Math.floor(timerRemaining/60).toString().padStart(2,"0");
  const s = (timerRemaining%60).toString().padStart(2,"0");
  document.getElementById("timerDisplay").textContent = m + ":" + s;
}
function startTimer(){
  if (timerInterval) return;
  timerInterval = setInterval(function(){
    timerRemaining--; updateTimerDisplay();
    if (timerRemaining <= 0){ clearInterval(timerInterval); timerInterval = null; alert("Rest over — back to it, lil bro!"); resetTimer(); }
  }, 1000);
}
function resetTimer(){ clearInterval(timerInterval); timerInterval = null; timerRemaining = timerSeconds; updateTimerDisplay(); }

const PRLIFTS = ["Squat","Bench Press","Deadlift"];
function loadPRs(){ return JSON.parse(localStorage.getItem(ns("prs")) || "{}"); }
function savePRs(prs){ localStorage.setItem(ns("prs"), JSON.stringify(prs)); queueCloudSync(); }
function renderPRs(){
  const prs = loadPRs();
  const wrap = document.getElementById("prRows");
  wrap.innerHTML = "";
  PRLIFTS.forEach(function(lift){
    const row = document.createElement("div"); row.className = "pr-row";
    const label = document.createElement("label"); label.textContent = lift + (prs[lift] ? (" (" + prs[lift] + "kg)") : "");
    const input = document.createElement("input"); input.type = "number"; input.placeholder = "kg";
    input.id = "pr-input-" + lift.replace(/ /g,"");
    const btn = document.createElement("button"); btn.className = "btn small"; btn.textContent = "Save";
    btn.addEventListener("click", function(){
      const val = Number(input.value);
      if (!val) return;
      const current = prs[lift] || 0;
      if (val > current){
        prs[lift] = val; savePRs(prs);
        addXP(15, "New PR: " + lift); fireConfetti(); renderPRs();
      } else {
        alert("That's not higher than your current PR of " + current + "kg — keep grinding!");
      }
    });
    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function showWisdom(){
  const box = document.getElementById("wisdomBox");
  box.textContent = WISDOM[Math.floor(Math.random()*WISDOM.length)];
  box.classList.remove("hidden");
}

function computeWeeklyRecap(){
  const now = new Date();
  let workoutDaysThisWeek = 0, totalCalLogged = 0, daysWithLog = 0;
  for(let i=0;i<7;i++){
    const d = new Date(now); d.setDate(now.getDate()-i);
    const key = d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
    const wDays = loadWorkoutDays();
    if (wDays.includes(key)) workoutDaysThisWeek++;
    const raw = localStorage.getItem(ns("meals-" + key));
    if (raw){
      const meals = JSON.parse(raw);
      const dayTotal = [].concat(meals.breakfast||[], meals.lunch||[], meals.dinner||[], meals.snacks||[])
        .reduce(function(s,it){ return s + it.cal; }, 0);
      if (dayTotal > 0){ totalCalLogged += dayTotal; daysWithLog++; }
    }
  }
  const avgCal = daysWithLog ? Math.round(totalCalLogged/daysWithLog) : 0;
  return { workoutDaysThisWeek: workoutDaysThisWeek, avgCal: avgCal, daysWithLog: daysWithLog };
}
function renderWeeklyRecap(){
  const r = computeWeeklyRecap();
  const box = document.getElementById("weeklyRecapBox");
  if (!state.target){ box.textContent = "Generate your plan first to unlock personalized weekly recaps."; return; }
  let msg = "You trained " + r.workoutDaysThisWeek + "/7 days this week.";
  if (r.daysWithLog > 0){
    msg += " and averaged " + r.avgCal + " kcal/day across " + r.daysWithLog + " logged day" + (r.daysWithLog!==1?"s":"") + " (target " + state.target + " kcal).";
    const diff = r.avgCal - state.target;
    if (Math.abs(diff) <= 100) msg += " Right on target — solid consistency.";
    else if (diff > 0) msg += " That's " + diff + " kcal above target on average — worth tightening up if that wasn't intentional.";
    else msg += " That's " + Math.abs(diff) + " kcal below target on average.";
  } else msg += " No food logs recorded this week — start logging meals to get a fuller recap.";
  box.textContent = msg;
}

function calculateAll(){
  try{
    document.getElementById("profileError").innerHTML = "";
    const sex = document.getElementById("sex").value;
    const age = Number(document.getElementById("age").value);
    const weight = Number(document.getElementById("weight").value);
    const height = Number(document.getElementById("height").value);
    const activity = Number(document.getElementById("activity").value);
    const goal = document.getElementById("goal").value;
    const location = document.getElementById("location").value;
    const exp = document.getElementById("exp").value;
    const days = Number(document.getElementById("days").value);
    if (!weight || !height || !age){
      document.getElementById("profileError").innerHTML = "<div class='errbox'>Please fill in age, weight, and height before generating a plan.</div>";
      return;
    }
    let bmr = sex === "male" ? (10*weight + 6.25*height - 5*age + 5) : (10*weight + 6.25*height - 5*age - 161);
    const tdee = bmr * activity;
    let target = tdee, explain = "", goalLabel = "";
    if (goal === "lose"){ target = tdee - 500; goalLabel = "Fat loss plan"; explain = "A 500 kcal/day deficit targets roughly 0.4–0.5 kg of fat loss per week while preserving muscle if protein and training stay high."; }
    else if (goal === "gain"){ target = tdee + 300; goalLabel = "Muscle-building plan"; explain = "A moderate 300 kcal/day surplus supports lean muscle gain while minimizing excess fat gain, paired with progressive resistance training."; }
    else { goalLabel = "Maintenance plan"; explain = "This target matches your estimated maintenance calories (TDEE) — expect weight to stay roughly stable if activity stays consistent."; }
    target = Math.round(target);
    document.getElementById("goalSummary").textContent = goalLabel + " based on " + weight + "kg, " + height + "cm, age " + age + ".";
    let proteinPerKg = goal === "lose" ? 2.2 : (goal === "gain" ? 2.0 : 1.8);
    let proteinG = Math.round(weight * proteinPerKg);
    let fatG = Math.round(target * 0.25 / 9);
    let proteinCal = proteinG * 4;
    let fatCal = fatG * 9;
    let carbCal = Math.max(target - proteinCal - fatCal, 0);
    let carbG = Math.round(carbCal / 4);
    const water = (weight * 0.033).toFixed(1);
    document.getElementById("bmrOut").textContent = Math.round(bmr);
    document.getElementById("tdeeOut").textContent = Math.round(tdee);
    document.getElementById("targetOut").textContent = target;
    document.getElementById("waterOut").textContent = water;
    document.getElementById("proteinG").textContent = proteinG;
    document.getElementById("carbG").textContent = carbG;
    document.getElementById("fatG").textContent = fatG;
    document.getElementById("explainText").textContent = explain;
    const pPct = (proteinCal/target*100).toFixed(0);
    const cPct = (carbCal/target*100).toFixed(0);
    const fPct = (fatCal/target*100).toFixed(0);
    document.getElementById("macroBar").innerHTML =
      "<div style='width:"+pPct+"%;background:#22c55e'></div>" +
      "<div style='width:"+cPct+"%;background:#38bdf8'></div>" +
      "<div style='width:"+fPct+"%;background:#fbbf24'></div>";
    const bmi = weight / Math.pow(height/100, 2);
    document.getElementById("bmiVal").textContent = bmi.toFixed(1);
    const bmiPill = document.getElementById("bmiPill");
    let bmiCat, bmiColor;
    if (bmi < 18.5){ bmiCat = "Underweight"; bmiColor = "#38bdf8"; }
    else if (bmi < 25){ bmiCat = "Healthy range"; bmiColor = "#22c55e"; }
    else if (bmi < 30){ bmiCat = "Above range"; bmiColor = "#fbbf24"; }
    else { bmiCat = "Well above range"; bmiColor = "#f87171"; }
    bmiPill.textContent = bmiCat;
    bmiPill.style.background = bmiColor + "30";
    bmiPill.style.color = bmiColor;
    state = { sex, age, weight, height, activity, goal, location, exp, days, bmr, tdee, target, proteinG, carbG, fatG, bmi };
    saveState();
    document.getElementById("dayTotalTarget").textContent = target;
    buildPlan(goal, exp, days, location);
    renderMealCards();
    renderWaterTracker();
    addXP(10, "Generated plan");
    queueCloudSync();
    document.querySelector(".tab[data-tab='results']").classList.remove("locked");
    document.querySelector(".tab[data-tab='plan']").classList.remove("locked");
    showTab("results");
  } catch(err){
    document.getElementById("profileError").innerHTML = "<div class='errbox'>Something went wrong generating your plan: " + err.message + ". Please try again.</div>";
    console.error(err);
  }
}
function saveState(){ localStorage.setItem(ns("state"), JSON.stringify(state)); queueCloudSync(); }
function loadState(){
  const raw = localStorage.getItem(ns("state"));
  if (!raw) return;
  try{ state = JSON.parse(raw); }catch(e){ return; }
  if (state.sex) document.getElementById("sex").value = state.sex;
  if (state.age) document.getElementById("age").value = state.age;
  if (state.weight) document.getElementById("weight").value = state.weight;
  if (state.height) document.getElementById("height").value = state.height;
}

function exName(key, loc){
  const table = {
    squat: { gym:"Barbell Back Squat", home:"Goblet Squat / Bodyweight Squat" },
    bench: { gym:"Barbell Bench Press", home:"Push-ups / Floor Press (dumbbells)" },
    row: { gym:"Bent-over Barbell Row", home:"Dumbbell Row / Resistance Band Row" },
    ohp: { gym:"Barbell Overhead Press", home:"Dumbbell Shoulder Press / Pike Push-ups" },
    deadlift: { gym:"Barbell Deadlift", home:"Dumbbell Romanian Deadlift" },
    pullup: { gym:"Lat Pulldown / Pull-ups", home:"Pull-ups (bar) / Band-Assisted Pulldown" },
    legpress: { gym:"Leg Press", home:"Bulgarian Split Squat (dumbbells)" },
    dip: { gym:"Dip Machine / Weighted Dips", home:"Chair Dips / Close-grip Push-ups" },
    lateral: { gym:"Cable Lateral Raise", home:"Dumbbell Lateral Raise" },
    facepull: { gym:"Cable Face Pull", home:"Resistance Band Face Pull" },
    hammer: { gym:"Dumbbell Hammer Curl", home:"Dumbbell Hammer Curl" },
    lunge: { gym:"Barbell/Dumbbell Lunge", home:"Bodyweight or Dumbbell Lunge" },
    calf: { gym:"Calf Raise Machine", home:"Standing Calf Raise (bodyweight)" },
    farmer: { gym:"Farmer Carry (dumbbells)", home:"Farmer Carry (water jugs / heavy bags)" },
    incline: { gym:"Incline Dumbbell Press", home:"Incline Push-ups (feet elevated)" },
    triceps: { gym:"Cable Triceps Pushdown", home:"Diamond Push-ups / Bench Dips" },
    curl: { gym:"Barbell/Dumbbell Bicep Curl", home:"Dumbbell or Band Bicep Curl" }
  };
  const entry = table[key];
  if (!entry) return key;
  let pick = loc;
  if (loc === "hybrid") pick = Math.random() < 0.5 ? "gym" : "home";
  return entry[pick] || entry.gym || key;
}
function buildPlan(goal, exp, days, location){
  const loc = location || "gym";
  const cardio = { beginner: "20 min brisk walk or bike, steady pace", intermediate: "25-30 min moderate jog/bike, intervals", advanced: "30-40 min HIIT intervals or tempo run" }[exp] || "25 min moderate cardio";
  const s = { beginner: "2-3 sets x 10-12 reps", intermediate: "3-4 sets x 8-12 reps", advanced: "4-5 sets x 6-10 reps" }[exp] || "3 sets x 10 reps";
  function e(key){ return exName(key, loc); }
  let template;
  if (days <= 3){
    template = [
      { day: "Day 1 — Full Body A", ex: [e("squat"), e("bench"), e("row"), e("lunge")] },
      { day: "Day 2 — Full Body B", ex: [e("deadlift"), e("ohp"), e("pullup"), e("calf")] },
      { day: "Day 3 — Full Body C", ex: [e("legpress"), e("incline"), e("facepull"), e("hammer")] }
    ].slice(0, days);
  } else if (days === 4){
    template = [
      { day: "Day 1 — Upper Push", ex: [e("bench"), e("ohp"), e("triceps"), e("lateral")] },
      { day: "Day 2 — Lower", ex: [e("squat"), e("legpress"), e("lunge"), e("calf")] },
      { day: "Day 3 — Upper Pull", ex: [e("row"), e("pullup"), e("facepull"), e("hammer")] },
      { day: "Day 4 — Full Body / Weak Points", ex: [e("deadlift"), e("incline"), e("farmer"), e("curl")] }
    ];
  } else {
    template = [
      { day: "Day 1 — Push", ex: [e("bench"), e("ohp"), e("incline"), e("triceps")] },
      { day: "Day 2 — Pull", ex: [e("deadlift"), e("row"), e("pullup"), e("facepull")] },
      { day: "Day 3 — Legs", ex: [e("squat"), e("legpress"), e("lunge"), e("calf")] },
      { day: "Day 4 — Push", ex: [e("bench"), e("lateral"), e("triceps"), e("hammer")] },
      { day: "Day 5 — Pull", ex: [e("row"), e("pullup"), e("facepull"), e("curl")] },
      { day: "Day 6 — Legs / Core", ex: [e("squat"), e("farmer"), e("calf"), e("lunge")] }
    ].slice(0, days);
  }
  const workoutDays = loadWorkoutDays();
  const todayKey = new Date().toDateString();
  const wrap = document.getElementById("planOutput");
  wrap.innerHTML = "";
  template.forEach(function(d, idx){
    const doneKey = ns("workoutdone-" + todayKey + "-" + idx);
    const isDone = localStorage.getItem(doneKey) === "1";
    const box = document.createElement("div");
    box.className = "plan-day" + (isDone ? " done" : "");
    const h3 = document.createElement("h3");
    const left = document.createElement("span"); left.className = "left"; left.textContent = d.day;
    h3.appendChild(left);
    const label = document.createElement("label"); label.className = "check-label";
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = isDone;
    cb.addEventListener("change", function(){
      if (cb.checked){
        localStorage.setItem(doneKey, "1");
        if (!workoutDays.includes(todayKey)){ workoutDays.push(todayKey); saveWorkoutDays(workoutDays); }
        addXP(20, "Workout complete: " + d.day);
      } else { localStorage.removeItem(doneKey); }
      buildPlan(goal, exp, days, location);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" Done"));
    h3.appendChild(label);
    box.appendChild(h3);
    const ul = document.createElement("ul");
    d.ex.forEach(function(name){ const li = document.createElement("li"); li.textContent = name + " — " + s; ul.appendChild(li); });
    const cardioLi = document.createElement("li"); cardioLi.textContent = "Cardio finisher: " + cardio;
    ul.appendChild(cardioLi);
    box.appendChild(ul);
    wrap.appendChild(box);
  });
}
function loadWorkoutDays(){ return JSON.parse(localStorage.getItem(ns("workoutdays")) || "[]"); }
function saveWorkoutDays(arr){ localStorage.setItem(ns("workoutdays"), JSON.stringify(arr)); queueCloudSync(); renderProgressTab(); }

function todayKeyForMeals(){ const d = new Date(); return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate(); }
function loadTodayMeals(){
  const raw = localStorage.getItem(ns("meals-" + todayKeyForMeals()));
  if (raw) { try{ return JSON.parse(raw); }catch(e){} }
  return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}
function saveTodayMeals(meals){
  localStorage.setItem(ns("meals-" + todayKeyForMeals()), JSON.stringify(meals));
  const logDaysKey = ns("logdays");
  const logDays = JSON.parse(localStorage.getItem(logDaysKey) || "[]");
  const today = todayKeyForMeals();
  if (!logDays.includes(today)){ logDays.push(today); localStorage.setItem(logDaysKey, JSON.stringify(logDays)); }
  queueCloudSync();
}
function mealTotal(items){ return items.reduce(function(s,it){ return s + it.cal; }, 0); }
function renderMealCards(){
  const meals = loadTodayMeals();
  const wrap = document.getElementById("mealCardsWrap");
  wrap.innerHTML = "";
  let dayTotal = 0;
  MEALS.forEach(function(m){
    const items = meals[m.key] || [];
    const total = mealTotal(items);
    dayTotal += total;
    const card = document.createElement("div"); card.className = "meal-card";
    const head = document.createElement("div"); head.className = "meal-head";
    const left = document.createElement("div"); left.className = "left";
    const icon = document.createElement("span"); icon.className = "icon"; icon.textContent = m.icon;
    const titleWrap = document.createElement("div");
    const title = document.createElement("div"); title.className = "title"; title.textContent = m.label;
    const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = items.length + " item" + (items.length!==1?"s":"");
    titleWrap.appendChild(title); titleWrap.appendChild(sub);
    left.appendChild(icon); left.appendChild(titleWrap);
    const right = document.createElement("div");
    const cals = document.createElement("span"); cals.className = "cals"; cals.textContent = total + " kcal";
    const chevron = document.createElement("span"); chevron.className = "chevron"; chevron.textContent = " ▾";
    right.appendChild(cals); right.appendChild(chevron);
    head.appendChild(left); head.appendChild(right);
    const body = document.createElement("div"); body.className = "meal-body";
    head.addEventListener("click", function(){ head.classList.toggle("open"); body.classList.toggle("open"); });
    const itemsWrap = document.createElement("div"); itemsWrap.className = "meal-items";
    items.forEach(function(it, idx){
      const row = document.createElement("div"); row.className = "meal-item";
      const span = document.createElement("span"); span.textContent = it.name + " — " + it.cal + " kcal";
      const del = document.createElement("button"); del.textContent = "✕";
      del.addEventListener("click", function(){
        items.splice(idx,1); meals[m.key] = items; saveTodayMeals(meals); renderMealCards();
      });
      row.appendChild(span); row.appendChild(del);
      itemsWrap.appendChild(row);
    });
    body.appendChild(itemsWrap);
    const chipsWrap = document.createElement("div"); chipsWrap.className = "suggestions";
    m.quick.forEach(function(q){
      const chip = document.createElement("div"); chip.className = "food-chip";
      chip.textContent = q.name + " (" + q.cal + ")";
      chip.addEventListener("click", function(){
        items.push({ name: q.name, cal: q.cal }); meals[m.key] = items; saveTodayMeals(meals); renderMealCards();
        addXP(2, "Logged " + q.name);
      });
      chipsWrap.appendChild(chip);
    });
    body.appendChild(chipsWrap);
    const addRow = document.createElement("div"); addRow.className = "meal-add-row";
    const nameInput = document.createElement("input"); nameInput.placeholder = "Custom food";
    const calInput = document.createElement("input"); calInput.type = "number"; calInput.placeholder = "kcal"; calInput.style.maxWidth = "90px";
    const addBtn = document.createElement("button"); addBtn.className = "btn small"; addBtn.textContent = "Add";
    addBtn.addEventListener("click", function(){
      const nm = nameInput.value.trim(); const cl = Number(calInput.value);
      if (!nm || !cl) return;
      items.push({ name: nm, cal: cl }); meals[m.key] = items; saveTodayMeals(meals); renderMealCards();
      addXP(2, "Logged " + nm);
    });
    addRow.appendChild(nameInput); addRow.appendChild(calInput); addRow.appendChild(addBtn);
    body.appendChild(addRow);
    card.appendChild(head); card.appendChild(body);
    wrap.appendChild(card);
  });
  document.getElementById("dayTotalCals").textContent = dayTotal + " kcal";
  const target = state.target || Number(document.getElementById("dayTotalTarget").textContent) || 2000;
  document.getElementById("dayTotalTarget").textContent = target;
  document.getElementById("logBar").style.width = Math.min(100, (dayTotal/target*100)) + "%";
}

function todayWaterKey(){ return ns("water-" + todayKeyForMeals()); }
function loadWater(){ return Number(localStorage.getItem(todayWaterKey())) || 0; }
function renderWaterTracker(){
  const filled = loadWater();
  const total = 8;
  const row = document.getElementById("waterRow");
  row.innerHTML = "";
  for(let i=0;i<total;i++){
    const g = document.createElement("div");
    g.className = "glass" + (i < filled ? " filled" : "");
    g.textContent = "💧";
    g.addEventListener("click", function(){
      const current = loadWater();
      const newVal = (i < current) ? i : i+1;
      localStorage.setItem(todayWaterKey(), String(newVal));
      queueCloudSync();
      renderWaterTracker();
      if (newVal === total) addXP(10, "Hydration goal hit");
    });
    row.appendChild(g);
  }
  document.getElementById("waterSummary").textContent = filled + " / " + total + " glasses today (~" + (filled*0.25).toFixed(2) + "L)";
}

function loadWeightLog(){ return JSON.parse(localStorage.getItem(ns("weightlog")) || "[]"); }
function saveWeightLog(log){ localStorage.setItem(ns("weightlog"), JSON.stringify(log)); queueCloudSync(); }
function addWeightEntry(){
  const val = Number(document.getElementById("weightLogInput").value);
  if (!val) return;
  const log = loadWeightLog();
  log.push({ date: new Date().toISOString().slice(0,10), weight: val });
  saveWeightLog(log);
  document.getElementById("weightLogInput").value = "";
  addXP(5, "Logged weight");
  renderProgressTab();
}
function drawWeightChart(){
  const log = loadWeightLog();
  const canvas = document.getElementById("weightChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth || 300; canvas.width = w; canvas.height = 180;
  ctx.clearRect(0,0,w,180);
  if (log.length < 2){
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
    ctx.font = "13px sans-serif";
    ctx.fillText("Log at least 2 entries to see your trend", 10, 90);
    return;
  }
  const weights = log.map(function(l){ return l.weight; });
  const min = Math.min.apply(null, weights) - 1;
  const max = Math.max.apply(null, weights) + 1;
  const pad = 20;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--accent");
  ctx.lineWidth = 2;
  ctx.beginPath();
  log.forEach(function(l, i){
    const x = pad + (i/(log.length-1)) * (w - pad*2);
    const y = 180 - pad - ((l.weight - min)/(max-min)) * (180 - pad*2);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}
function renderProgressTab(){
  renderPRs();
  drawWeightChart();
  const log = loadWeightLog();
  const trendEl = document.getElementById("weightTrend");
  if (log.length >= 2){
    const diff = log[log.length-1].weight - log[0].weight;
    trendEl.textContent = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "kg since your first entry (" + log[0].date + ").";
  } else trendEl.textContent = "";
  const workoutDays = loadWorkoutDays();
  const logDays = JSON.parse(localStorage.getItem(ns("logdays")) || "[]");
  document.getElementById("totalWorkoutsStat").textContent = workoutDays.length;
  document.getElementById("totalLogDaysStat").textContent = logDays.length;
  let streak = 0, best = 0, cursor = new Date();
  const dateSet = new Set(workoutDays);
  let tempStreak = 0;
  const sorted = workoutDays.slice().sort();
  sorted.forEach(function(d, i){
    if (i===0){ tempStreak = 1; } else {
      const prev = new Date(sorted[i-1]); const cur = new Date(d);
      const diffDays = Math.round((cur-prev)/86400000);
      tempStreak = diffDays === 1 ? tempStreak+1 : 1;
    }
    if (tempStreak > best) best = tempStreak;
  });
  while(true){
    const k = cursor.toDateString();
    if (dateSet.has(k)){ streak++; cursor.setDate(cursor.getDate()-1); } else break;
  }
  document.getElementById("streakStat").textContent = streak;
  document.getElementById("bestStreakStat").textContent = best;
  document.getElementById("streakBadge").textContent = "🔥 " + streak;
  renderBadges(workoutDays.length, logDays.length, streak, getXP());
  renderWeeklyRecap();
}
function renderBadges(workouts, logDays, streak, xp){
  const badges = [
    { name: "First Steps", req: "1 workout", emoji: "🥉", unlocked: workouts >= 1 },
    { name: "Regular", req: "10 workouts", emoji: "🥈", unlocked: workouts >= 10 },
    { name: "Dedicated", req: "30 workouts", emoji: "🥇", unlocked: workouts >= 30 },
    { name: "Logger", req: "7 days logged", emoji: "📝", unlocked: logDays >= 7 },
    { name: "On Fire", req: "5-day streak", emoji: "🔥", unlocked: streak >= 5 },
    { name: "Unstoppable", req: "14-day streak", emoji: "⚡", unlocked: streak >= 14 },
    { name: "Level 5", req: "400+ XP", emoji: "⭐", unlocked: xp >= 400 },
    { name: "Iron Beast", req: "900+ XP", emoji: "👑", unlocked: xp >= 900 }
  ];
  const grid = document.getElementById("badgesGrid");
  grid.innerHTML = "";
  badges.forEach(function(b){
    const card = document.createElement("div"); card.className = "badge-card" + (b.unlocked ? " unlocked" : "");
    card.innerHTML = "<div class='emoji'>" + b.emoji + "</div><div class='name'>" + b.name + "</div><div class='req'>" + b.req + "</div>";
    grid.appendChild(card);
  });
}

function exportCSV(){
  let rows = [["type","date","name/detail","calories/kg"]];
  for(let i=0;i<60;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
    const raw = localStorage.getItem(ns("meals-" + key));
    if (raw){
      const meals = JSON.parse(raw);
      Object.keys(meals).forEach(function(mk){
        (meals[mk]||[]).forEach(function(it){ rows.push(["food-" + mk, key, it.name, it.cal]); });
      });
    }
  }
  loadWeightLog().forEach(function(l){ rows.push(["weight", l.date, "", l.weight]); });
  const csv = rows.map(function(r){ return r.map(function(c){ return '"' + String(c).replace(/"/g,'""') + '"'; }).join(","); }).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "hit-the-gym-lil-bro-export.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function pushChat(text, who){
  const win = document.getElementById("chatWindow");
  const msg = document.createElement("div");
  msg.className = "msg " + who;
  msg.textContent = text;
  win.appendChild(msg);
  win.scrollTop = win.scrollHeight;
}
function askSuggested(q){ document.getElementById("chatInput").value = q; sendChat(); }
function sendChat(){
  const input = document.getElementById("chatInput");
  const q = input.value.trim();
  if (!q) return;
  pushChat(q, "user");
  input.value = "";
  setTimeout(function(){ pushChat(coachReply(q), "bot"); }, 300);
}
function coachReply(q){
  const lower = q.toLowerCase();
  if (!state.target) return "Head to the Profile tab and generate your plan first — then I can give you real numbers.";
  if (lower.includes("recap") || lower.includes("weekly")){
    const r = computeWeeklyRecap();
    return "This week: " + r.workoutDaysThisWeek + "/7 workout days, avg " + r.avgCal + " kcal/day logged across " + r.daysWithLog + " day(s), target " + state.target + " kcal.";
  }
  if (lower.includes("wisdom")) return WISDOM[Math.floor(Math.random()*WISDOM.length)];
  if (lower.includes("sore")) return "A little soreness is normal — light movement or a shorter session usually helps. Skip it only if the pain is sharp or joint-related; otherwise, show up and adjust volume down 20-30%.";
  if (lower.includes("swap") || lower.includes("squat")) return "Sure — if squats aren't working for you, try leg press or Bulgarian split squats to hit the same muscles with less spinal load.";
  if (lower.includes("progress") || lower.includes("today")){
    const meals = loadTodayMeals();
    const total = mealTotal(meals.breakfast||[]) + mealTotal(meals.lunch||[]) + mealTotal(meals.dinner||[]) + mealTotal(meals.snacks||[]);
    const diff = state.target - total;
    return "You've logged " + total + " kcal today out of your " + state.target + " kcal target — " + (diff >= 0 ? (diff + " kcal remaining.") : (Math.abs(diff) + " kcal over."));
  }
  if (lower.includes("eat") || lower.includes("macro")){
    return "Aim for " + state.proteinG + "g protein, " + state.carbG + "g carbs, " + state.fatG + "g fat today. Good picks: chicken/eggs for protein, rice/oats for carbs, nuts/olive oil for fat.";
  }
  return "I've got your profile and plan loaded — ask me about your macros, today's progress, exercise swaps, or your weekly recap.";
}

window.addEventListener("DOMContentLoaded", async function(){
  initTheme();
  await pullCloudIfNewer(getActiveProfile());
  loadState();
  renderLevelBar();
  renderChallengeCard();
  setTimer(90);
  renderPRs();
  renderWaterTracker();
  if (state.target){
    document.querySelector(".tab[data-tab='results']").classList.remove("locked");
    document.querySelector(".tab[data-tab='plan']").classList.remove("locked");
    document.getElementById("dayTotalTarget").textContent = state.target;
    buildPlan(state.goal, state.exp, state.days, state.location);
  }
  renderMealCards();
  pushChat("Hey lil bro! Set up your profile and generate a plan, then come back here — I'll answer questions using your real numbers.", "bot");
});
window.showTab = showTab;
window.setSeg = setSeg;
window.calculateAll = calculateAll;
window.setTimer = setTimer;
window.startTimer = startTimer;
window.resetTimer = resetTimer;
window.addWeightEntry = addWeightEntry;
window.showWisdom = showWisdom;
window.exportCSV = exportCSV;
window.renderLeaderboard = renderLeaderboard;
window.openProfileSwitcher = openProfileSwitcher;
window.openAdminPanel = openAdminPanel;
window.toggleTheme = toggleTheme;
window.askSuggested = askSuggested;
window.sendChat = sendChat;
window.cloudSignIn = cloudSignIn;
