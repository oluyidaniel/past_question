# QuizMaster — Examination Portal

A clean, responsive quiz website with a Node.js backend, master-password login, timer, and automatic grading with full answer corrections.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open in browser
```
http://localhost:3000
```

---

## 🔑 Default Login

| Setting         | Value      |
|-----------------|------------|
| Master Password | `quiz1234` |

> Change it by setting the `MASTER_PASSWORD` environment variable:
> ```bash
> MASTER_PASSWORD=mysecretpass node server.js
> ```

---

## 📁 Question JSON Format

Upload a `.json` file with this structure:

```json
[
  {
    "id": 1,
    "question": "What is the capital of France?",
    "options": {
      "A": "Berlin",
      "B": "Madrid",
      "C": "Paris",
      "D": "Rome"
    },
    "answer": "C",
    "explanation": "Paris is the capital of France."
  }
]
```

### Rules
- `id` — unique number or string per question
- `question` — the question text (string)
- `options` — object with keys `A`, `B`, `C`, `D`
- `answer` — one of `"A"`, `"B"`, `"C"`, `"D"`
- `explanation` — *(optional)* shown in results as a hint

---

## 🖥️ Features

| Feature | Description |
|---------|-------------|
| 🔒 Login | Single master password — no registration needed |
| 📂 Upload | Upload a JSON file locally (in-browser) or to the server (admin) |
| ⚙️ Settings | Choose number of questions (1 to max) and time per question |
| ⏱️ Timer | Counts down per session; auto-submits when time runs out |
| 🔀 Shuffle | Optional question randomisation |
| ✅ Results | Score ring, grade, stats, and full per-question correction |
| 💡 Explanations | Optional explanations shown for each question in review |
| 📊 Score Log | Every submission saved to `scores.json` on the server |

---

## 📊 View All Scores (Admin)

```
GET http://localhost:3000/api/scores?password=quiz1234
```

Returns all stored scores as JSON.

---

## 📂 Project Structure

```
quiz-app/
├── server.js          ← Node.js + Express backend
├── package.json
├── questions.json     ← Default question bank (editable)
├── scores.json        ← Auto-created; stores all submissions
└── public/
    ├── index.html     ← Single-page app
    ├── style.css      ← Dark academic theme
    └── app.js         ← Frontend logic
```

---

## 🌍 Deploy

Point any Node.js host (Railway, Render, Heroku, VPS) to `npm start`.  
Set `MASTER_PASSWORD` and `PORT` as environment variables.
