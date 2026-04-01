/* ─── QuizMaster — app.js ─────────────────────────────────────────────────── */
"use strict";

const API = "http://localhost:3000"; // same origin; change to e.g. "http://localhost:3000" if needed

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  userName:        "",
  password:        "",
  allQuestions:    [],     // full pool (from server or local JSON)
  quizQuestions:   [],     // selected subset for this session
  answers:         {},     // { id: "A"|"B"|"C"|"D" }
  currentIndex:    0,
  numQuestions:    10,
  secondsPerQ:     30,
  totalSeconds:    0,
  timeElapsed:     0,
  timerInterval:   null,
  shuffle:         true,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const screens = {
  login:   $("screen-login"),
  setup:   $("screen-setup"),
  quiz:    $("screen-quiz"),
  results: $("screen-results"),
};

// ─── SCREEN ROUTER ────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCREEN 1 — LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
$("eye-toggle").addEventListener("click", () => {
  const inp = $("input-password");
  const isHidden = inp.type === "password";
  inp.type = isHidden ? "text" : "password";
  $("eye-icon").innerHTML = isHidden
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

async function doLogin() {
  const name = $("input-name").value.trim();
  const pwd  = $("input-password").value;
  $("login-error").classList.add("hidden");

  if (!name) { showError("login-error", "Please enter your name."); return; }
  if (!pwd)  { showError("login-error", "Please enter the access password."); return; }

  try {
    const res  = await fetch(`${API}/api/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password: pwd }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.userName = name;
      state.password = pwd;
      initSetup();
      showScreen("setup");
    } else {
      showError("login-error", data.error || "Invalid password.");
    }
  } catch {
    showError("login-error", "Cannot reach server. Check your connection.");
  }
}

$("btn-login").addEventListener("click", doLogin);
["input-name","input-password"].forEach((id) =>
  $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); })
);

function showError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCREEN 2 — SETUP
// ═══════════════════════════════════════════════════════════════════════════════
async function initSetup() {
  $("header-user-name").textContent = `👤 ${state.userName}`;
  updateCounterDisplay();

  // Try loading questions from server
  try {
    const res  = await fetch(`${API}/api/questions`);
    const data = await res.json();
    if (res.ok && data.questions) {
      state.allQuestions = data.questions;
      $("question-count-info").textContent = `✓ ${data.total} questions available`;
      clampNumQuestions();
    }
  } catch {
    $("question-count-info").textContent = "⚠ Could not load questions from server.";
  }
}

// Counter
$("btn-dec").addEventListener("click", () => {
  if (state.numQuestions > 1) { state.numQuestions--; clampNumQuestions(); updateCounterDisplay(); }
});
$("btn-inc").addEventListener("click", () => {
  const max = state.allQuestions.length || 999;
  if (state.numQuestions < max) { state.numQuestions++; updateCounterDisplay(); }
});
function updateCounterDisplay() {
  $("q-count-display").textContent = state.numQuestions;
}
function clampNumQuestions() {
  if (state.allQuestions.length && state.numQuestions > state.allQuestions.length) {
    state.numQuestions = state.allQuestions.length;
    updateCounterDisplay();
  }
}

// Time options
document.querySelectorAll(".time-opt").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".time-opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.secondsPerQ = parseInt(btn.dataset.seconds, 10);
  });
});

// Shuffle toggle
$("shuffle-toggle").addEventListener("change", (e) => {
  state.shuffle = e.target.checked;
});

// ── Start quiz ────────────────────────────────────────────────────────────────
$("btn-start").addEventListener("click", () => {
  if (state.allQuestions.length === 0) {
    alert("No questions loaded. Please ensure the server has questions in questions.json.");
    return;
  }
  startQuiz();
  showScreen("quiz");
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SCREEN 3 — QUIZ
// ═══════════════════════════════════════════════════════════════════════════════
function startQuiz() {
  // Select and optionally shuffle questions
  let pool = [...state.allQuestions];
  if (state.shuffle) pool = shuffleArray(pool);
  state.quizQuestions = pool.slice(0, state.numQuestions);
  state.answers       = {};
  state.currentIndex  = 0;
  state.timeElapsed   = 0;
  state.totalSeconds  = state.numQuestions * state.secondsPerQ;

  $("q-total").textContent = state.quizQuestions.length;
  updateProgressBar();
  renderQuestion();
  startTimer();
}

function renderQuestion() {
  const idx = state.currentIndex;
  const q   = state.quizQuestions[idx];
  if (!q) return;

  $("question-num").textContent = `Question ${idx + 1} of ${state.quizQuestions.length}`;
  $("question-text").textContent = q.question;
  $("q-current").textContent    = idx + 1;

  const grid = $("options-grid");
  grid.innerHTML = "";

  ["A","B","C","D"].forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "option-btn" + (state.answers[q.id] === key ? " selected" : "");
    btn.innerHTML = `
      <span class="option-key">${key}</span>
      <span class="option-text">${q.options[key]}</span>
    `;
    btn.addEventListener("click", () => selectOption(q.id, key));
    grid.appendChild(btn);
  });

  // Prev/next visibility
  $("btn-prev").style.visibility = idx === 0 ? "hidden" : "visible";
  $("btn-next").style.display    = idx === state.quizQuestions.length - 1 ? "none" : "inline-flex";
  $("btn-submit-quiz").style.display = idx === state.quizQuestions.length - 1 ? "inline-flex" : "none";

  updateAnsweredCounter();
  updateProgressBar();
}

function selectOption(questionId, key) {
  state.answers[questionId] = key;
  // Re-render options to reflect selection
  document.querySelectorAll(".option-btn").forEach((btn, i) => {
    const optKey = ["A","B","C","D"][i];
    btn.classList.toggle("selected", optKey === key);
    const keyEl = btn.querySelector(".option-key");
    if (keyEl) keyEl.style.cssText = ""; // force re-render via class
  });
  updateAnsweredCounter();
}

function updateAnsweredCounter() {
  const answered = Object.keys(state.answers).length;
  const total    = state.quizQuestions.length;
  $("answered-counter").textContent = `${answered} / ${total} answered`;
}

function updateProgressBar() {
  const pct = ((state.currentIndex + 1) / state.quizQuestions.length) * 100;
  $("progress-bar").style.width = pct + "%";
}

// Timer
function startTimer() {
  clearInterval(state.timerInterval);
  let remaining = state.totalSeconds;
  renderTimer(remaining);

  state.timerInterval = setInterval(() => {
    remaining--;
    state.timeElapsed++;
    renderTimer(remaining);

    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      submitQuiz(true);
    }
  }, 1000);
}

function renderTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  $("timer-display").textContent = `${m}:${s}`;
  $("timer-block").classList.toggle("warning", seconds <= 30 && seconds > 0);
}

// Navigation
$("btn-prev").addEventListener("click", () => {
  if (state.currentIndex > 0) { state.currentIndex--; renderQuestion(); }
});
$("btn-next").addEventListener("click", () => {
  if (state.currentIndex < state.quizQuestions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  }
});

// Submit
$("btn-submit-quiz").addEventListener("click", () => {
  const answered = Object.keys(state.answers).length;
  const total    = state.quizQuestions.length;
  if (answered < total) {
    $("modal-msg").textContent =
      `You have ${total - answered} unanswered question(s). Submit anyway?`;
    $("modal-overlay").classList.remove("hidden");
  } else {
    submitQuiz(false);
  }
});

$("modal-cancel").addEventListener("click", () => $("modal-overlay").classList.add("hidden"));
$("modal-confirm").addEventListener("click", () => {
  $("modal-overlay").classList.add("hidden");
  submitQuiz(false);
});

async function submitQuiz(timedOut) {
  clearInterval(state.timerInterval);

  const answersPayload = state.quizQuestions.map((q) => ({
    id:       q.id,
    selected: state.answers[q.id] || null,
  }));

  try {
    const res  = await fetch(`${API}/api/submit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:           state.userName,
        answers:        answersPayload,
        timeTaken:      state.timeElapsed,
        totalQuestions: state.quizQuestions.length,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      renderResults(data.score, data.corrections, timedOut);
      showScreen("results");
    } else {
      alert("Error submitting: " + (data.error || "Unknown error"));
    }
  } catch {
    alert("Could not reach server to submit. Check your connection.");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCREEN 4 — RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function renderResults(score, corrections, timedOut) {
  // Pct ring animation
  const pct = score.percentage;
  const circumference = 326.7;
  const offset = circumference - (pct / 100) * circumference;
  const ringFill = $("score-ring-fill");

  // Color ring by score
  if (pct >= 70) ringFill.style.stroke = "var(--correct)";
  else if (pct >= 50) ringFill.style.stroke = "var(--accent)";
  else ringFill.style.stroke = "var(--wrong)";

  setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);

  $("result-pct").textContent = pct + "%";

  // Stats
  $("stat-correct").textContent = score.score;
  $("stat-wrong").textContent   = score.total - score.score;
  $("stat-time").textContent    = formatTime(score.timeTaken);
  $("stat-grade").textContent   = getGrade(pct);

  // Message
  const msgs = [
    [90, "Outstanding performance! 🏆"],
    [75, "Excellent work! 🌟"],
    [60, "Good effort, keep it up! 👍"],
    [50, "Almost there — practice more! 📚"],
    [0,  "Keep studying and try again! 💪"],
  ];
  $("result-message").textContent =
    (timedOut ? "⏰ Time's up! " : "") +
    (msgs.find(([min]) => pct >= min)?.[1] ?? "");

  // Corrections
  const list = $("corrections-list");
  list.innerHTML = "";

  corrections.forEach((c, i) => {
    if (!c) return;
    const item = document.createElement("div");
    item.className = `correction-item ${c.isCorrect ? "is-correct" : "is-wrong"}`;
    item.style.animationDelay = `${i * 0.05}s`;

    const optionsHTML = ["A","B","C","D"].map((key) => {
      let cls = "neutral";
      if (key === c.correct) cls = "is-answer";
      else if (key === c.selected && !c.isCorrect) cls = "is-selected-wrong";
      const icon = key === c.correct ? "✓" : key === c.selected && !c.isCorrect ? "✗" : "";
      return `<div class="corr-opt ${cls}">
        <span class="corr-key">${key}</span>
        <span>${c.options[key]}${icon ? ` <strong>${icon}</strong>` : ""}</span>
      </div>`;
    }).join("");

    item.innerHTML = `
      <div class="correction-header">
        <div class="correction-q">Q${i + 1}. ${c.question}</div>
        <span class="correction-badge ${c.isCorrect ? "correct" : "wrong"}">
          ${c.isCorrect ? "CORRECT" : "WRONG"}
        </span>
      </div>
      <div class="correction-options">${optionsHTML}</div>
      ${c.explanation ? `<div class="correction-explanation">💡 ${c.explanation}</div>` : ""}
    `;
    list.appendChild(item);
  });
}

$("btn-retake").addEventListener("click", () => {
  state.answers = {};
  state.currentIndex = 0;
  showScreen("setup");
});

// ─── UTILS ────────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function getGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
showScreen("login");
