const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Config ───────────────────────────────────────────────────────────────────
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "quiz1234";
const SCORES_FILE = path.join(__dirname, "scores.json");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Multer (in-memory, for JSON upload) ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/json" || file.originalname.endsWith(".json")) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readScores() {
  if (!fs.existsSync(SCORES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SCORES_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

function readQuestions() {
  if (!fs.existsSync(QUESTIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUESTIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/login
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });
  if (password === MASTER_PASSWORD) {
    return res.json({ success: true, message: "Access granted" });
  }
  return res.status(401).json({ error: "Invalid password" });
});

// POST /api/questions/upload  — admin uploads a JSON file
app.post("/api/questions/upload", upload.single("questions"), (req, res) => {
  const { password } = req.body;
  if (password !== MASTER_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let questions;
  try {
    questions = JSON.parse(req.file.buffer.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON file" });
  }

  // Validate structure
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: "JSON must be an array of questions" });
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (
      typeof q.question !== "string" ||
      !q.options ||
      typeof q.options !== "object" ||
      !q.options.A || !q.options.B || !q.options.C || !q.options.D ||
      !["A", "B", "C", "D"].includes(q.answer)
    ) {
      return res.status(400).json({
        error: `Question at index ${i} is invalid. Each question must have: question (string), options {A,B,C,D}, answer (A|B|C|D)`,
      });
    }
  }

  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2));
  res.json({ success: true, count: questions.length, message: `${questions.length} questions loaded successfully` });
});

// GET /api/questions  — returns questions WITHOUT answers (for quiz takers)
app.get("/api/questions", (req, res) => {
  const questions = readQuestions();
  if (questions.length === 0) {
    return res.status(404).json({ error: "No questions loaded yet" });
  }
  // Strip the answer field before sending to client
  const safe = questions.map(({ answer, explanation, ...rest }) => rest);
  res.json({ questions: safe, total: safe.length });
});

// POST /api/submit  — user submits their answers
app.post("/api/submit", (req, res) => {
  const { name, answers, timeTaken, totalQuestions } = req.body;

  if (!name || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: "name and answers[] are required" });
  }

  const allQuestions = readQuestions();
  if (allQuestions.length === 0) {
    return res.status(400).json({ error: "No questions available" });
  }

  // Score the submission
  let correct = 0;
  const corrections = answers.map((ans) => {
    const question = allQuestions.find((q) => q.id === ans.id);
    if (!question) return null;

    const isCorrect = ans.selected === question.answer;
    if (isCorrect) correct++;

    return {
      id: ans.id,
      question: question.question,
      options: question.options,
      selected: ans.selected,
      correct: question.answer,
      isCorrect,
      explanation: question.explanation || null,
    };
  }).filter(Boolean);

  const score = {
    id: Date.now(),
    name: name.trim(),
    score: correct,
    total: answers.length,
    percentage: Math.round((correct / answers.length) * 100),
    timeTaken: timeTaken || 0,
    submittedAt: new Date().toISOString(),
  };

  // Save score to backend
  const scores = readScores();
  scores.push(score);
  writeScores(scores);

  console.log(`[SCORE] ${score.name} — ${score.score}/${score.total} (${score.percentage}%) in ${score.timeTaken}s`);

  res.json({ success: true, score, corrections });
});

// GET /api/scores  — view all stored scores (password-protected)
app.get("/api/scores", (req, res) => {
  const { password } = req.query;
  if (password !== MASTER_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const scores = readScores();
  res.json({ scores, total: scores.length });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Quiz server running at http://localhost:${PORT}`);
  console.log(`🔑  Master password: "${MASTER_PASSWORD}"`);
  console.log(`📁  Scores saved to: ${SCORES_FILE}\n`);
});
