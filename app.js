const PASS_SCORE = window.EXAM_KIT.passScore;
const HISTORY_KEY = "ai103-kit-history-v1";
const SESSION_KEY = "ai103-kit-session-v1";
const USER_COOKIE = "ai103_username";

const state = {
  selectedId: window.EXAM_KIT.exams[0].id,
  username: "",
  attempts: [],
  exam: null,
  session: null,
  index: 0,
  timerId: null,
};

const els = {
  loginView: document.getElementById("loginView"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  userBar: document.getElementById("userBar"),
  userLabel: document.getElementById("userLabel"),
  switchUserBtn: document.getElementById("switchUserBtn"),
  homeView: document.getElementById("homeView"),
  examView: document.getElementById("examView"),
  resultView: document.getElementById("resultView"),
  examList: document.getElementById("examList"),
  examDetail: document.getElementById("examDetail"),
  examRank: document.getElementById("examRank"),
  examProgress: document.getElementById("examProgress"),
  timerLabel: document.getElementById("timerLabel"),
  answeredLabel: document.getElementById("answeredLabel"),
  flaggedLabel: document.getElementById("flaggedLabel"),
  questionNav: document.getElementById("questionNav"),
  topicPill: document.getElementById("topicPill"),
  flagBtn: document.getElementById("flagBtn"),
  stem: document.getElementById("stem"),
  optionsForm: document.getElementById("optionsForm"),
  reasonBox: document.getElementById("reasonBox"),
  reasonVerdict: document.getElementById("reasonVerdict"),
  reasonText: document.getElementById("reasonText"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),
  leaveBtn: document.getElementById("leaveBtn"),
  resultBanner: document.getElementById("resultBanner"),
  topicResults: document.getElementById("topicResults"),
  resultFocus: document.getElementById("resultFocus"),
  reviewList: document.getElementById("reviewList"),
  backHomeBtn: document.getElementById("backHomeBtn"),
  modal: document.getElementById("modal"),
  modalText: document.getElementById("modalText"),
  modalYes: document.getElementById("modalYes"),
  modalNo: document.getElementById("modalNo"),
};

function examById(id) {
  return window.EXAM_KIT.exams.find((exam) => exam.id === id);
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function historyMap() {
  return readJson(HISTORY_KEY) || {};
}

function readCookie(name) {
  const row = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : "";
}

function writeCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function userKey(name) {
  const key = name.trim().toLowerCase().replace(/[.#$[\]/\s]+/g, "_").replace(/^_+|_+$/g, "");
  return key.slice(0, 40) || "user";
}

function dateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function show(view) {
  [els.loginView, els.homeView, els.examView, els.resultView].forEach((item) => {
    item.classList.add("is-hidden");
    item.hidden = true;
  });
  view.classList.remove("is-hidden");
  view.hidden = false;
  const title = view === els.loginView ? "Sign in" : view === els.homeView ? "Choose an exam" : state.exam.title;
  document.querySelector(".topbar h1").textContent = title;
}

function latestAttempt(examId) {
  return state.attempts.find((attempt) => attempt.examId === examId);
}

function loadAttempts() {
  return firebase.database().ref(`examKit/${userKey(state.username)}`).once("value").then((snapshot) => {
    const tree = snapshot.val() || {};
    const attempts = [];
    Object.entries(tree).forEach(([date, bucket]) => {
      if (!bucket || typeof bucket !== "object") return;
      Object.entries(bucket).forEach(([id, attempt]) => {
        if (attempt && attempt.examId) attempts.push({ id, date, ...attempt });
      });
    });
    attempts.sort((left, right) => String(right.finishedAt || "").localeCompare(String(left.finishedAt || "")));
    state.attempts = attempts;
    if (!els.homeView.hidden) {
      renderList();
      renderDetail();
    }
  });
}

function enterApp(name) {
  state.username = name.trim();
  writeCookie(USER_COOKIE, state.username);
  els.userLabel.textContent = state.username;
  els.userBar.classList.remove("is-hidden");
  els.userBar.hidden = false;
  show(els.homeView);
  renderList();
  renderDetail();
  loadAttempts().catch(() => {});
}

function showLogin() {
  els.userBar.classList.add("is-hidden");
  els.userBar.hidden = true;
  els.usernameInput.value = state.username || "";
  show(els.loginView);
}

function renderList() {
  const history = historyMap();
  const saved = readJson(SESSION_KEY);
  els.examList.innerHTML = "";
  window.EXAM_KIT.exams.forEach((exam) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "exam-card";
    if (exam.id === state.selectedId) button.classList.add("selected");
    const past = latestAttempt(exam.id) || history[exam.id];
    const resume = saved && saved.examId === exam.id && !saved.completed;
    const note = resume ? "In progress" : past ? `Last score ${past.score}` : `${exam.questions.length} questions`;
    button.innerHTML = `
      <span class="level-no bg-${exam.rank}">${exam.level}</span>
      <span><strong>${exam.title}</strong><small>${exam.cheat}</small></span>
      <span class="rank ${exam.rank}">${exam.rank}<br>${note}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedId = exam.id;
      renderList();
      renderDetail();
    });
    els.examList.appendChild(button);
  });
}

function renderDetail() {
  const exam = examById(state.selectedId);
  const history = latestAttempt(exam.id) || historyMap()[exam.id];
  const saved = readJson(SESSION_KEY);
  const tries = state.attempts.filter((attempt) => attempt.examId === exam.id).slice(0, 6);
  const canResume = saved && saved.examId === exam.id && !saved.completed;
  els.examDetail.innerHTML = `
    <p class="eyebrow">Exam ${exam.level} · ${exam.rank}</p>
    <h2>${exam.title}</h2>
    <p>${exam.blurb}</p>
    <div class="detail-meta">
      <span class="pill">${exam.questions.length} questions</span>
      <span class="pill">${exam.minutes} minutes</span>
      <span class="pill">${exam.cheat}</span>
    </div>
    <h3>Study this first</h3>
    <ul class="focus">${exam.focus.map((item) => `<li>${item}</li>`).join("")}</ul>
    <div class="q-actions">
      <button id="startBtn" class="primary" type="button">${canResume ? "Start fresh" : "Start this exam"}</button>
      ${canResume ? '<button id="resumeBtn" class="ghost" type="button">Resume</button>' : ""}
    </div>
    ${history ? `<p class="muted">Last attempt: ${history.score} / 1000 · ${history.correct} of ${history.total} correct</p>` : ""}
    ${tries.length ? `<h3>Saved tries</h3><ul class="tries">${tries.map((attempt) => `<li>${attempt.date} · ${attempt.score} / 1000 · ${attempt.correct}/${attempt.total}</li>`).join("")}</ul>` : ""}
  `;
  document.getElementById("startBtn").addEventListener("click", () => startExam(exam, false));
  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn) resumeBtn.addEventListener("click", () => startExam(exam, true));
}

function startExam(exam, resume) {
  state.exam = exam;
  if (resume) {
    state.session = readJson(SESSION_KEY);
    state.index = state.session.index || 0;
  } else {
    const now = Date.now();
    state.session = {
      examId: exam.id,
      index: 0,
      startedAt: now,
      endsAt: now + exam.minutes * 60 * 1000,
      completed: false,
      answers: {},
    };
    state.index = 0;
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  }
  show(els.examView);
  renderQuestion();
  startTimer();
}

function currentQuestion() {
  return state.exam.questions[state.index];
}

function answerRecord(question) {
  return state.session.answers[question.id] || { selected: null, flagged: false };
}

function saveSession() {
  state.session.index = state.index;
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
}

function renderNav() {
  els.questionNav.innerHTML = "";
  state.exam.questions.forEach((question, index) => {
    const record = answerRecord(question);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(index + 1);
    if (index === state.index) button.classList.add("current");
    if (record.selected !== null && record.selected !== undefined) button.classList.add("answered");
    if (record.flagged) button.classList.add("flagged");
    button.addEventListener("click", () => {
      state.index = index;
      renderQuestion();
    });
    els.questionNav.appendChild(button);
  });
}

function updateStatus() {
  const answered = state.exam.questions.filter((question) => answerRecord(question).selected !== null && answerRecord(question).selected !== undefined).length;
  const flagged = state.exam.questions.filter((question) => answerRecord(question).flagged).length;
  els.answeredLabel.textContent = `${answered} answered`;
  els.flaggedLabel.textContent = `${flagged} flagged`;
}

function renderQuestion() {
  const question = currentQuestion();
  const record = answerRecord(question);
  const total = state.exam.questions.length;
  els.examRank.textContent = `Exam ${state.exam.level} · ${state.exam.rank} · ${question.topic}`;
  els.examProgress.textContent = `Question ${state.index + 1} of ${total}`;
  els.topicPill.textContent = `Set ${question.source}`;
  els.flagBtn.textContent = record.flagged ? "Unflag" : "Flag";
  els.stem.textContent = question.stem;
  els.prevBtn.disabled = state.index === 0;
  els.nextBtn.disabled = state.index === total - 1;
  els.optionsForm.innerHTML = "";
  question.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = String(index);
    input.checked = record.selected === index;
    input.addEventListener("change", () => {
      const next = answerRecord(question);
      next.selected = index;
      state.session.answers[question.id] = next;
      saveSession();
      updateStatus();
      renderNav();
      showReason(question, next);
    });
    const text = document.createElement("span");
    text.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    label.append(input, text);
    els.optionsForm.appendChild(label);
  });
  showReason(question, record);
  updateStatus();
  renderNav();
  saveSession();
}

function showReason(question, record) {
  const chosen = record.selected;
  const revealed = chosen !== null && chosen !== undefined;
  [...els.optionsForm.querySelectorAll(".option")].forEach((label, index) => {
    label.classList.toggle("is-correct", revealed && index === question.answer);
    label.classList.toggle("is-wrong", revealed && chosen === index && index !== question.answer);
  });
  if (!revealed) {
    els.reasonBox.classList.add("is-hidden");
    els.reasonBox.hidden = true;
    return;
  }
  const letter = String.fromCharCode(65 + question.answer);
  els.reasonVerdict.textContent = chosen === question.answer
    ? `Right. ${letter} is the correct answer.`
    : `The correct answer is ${letter}. ${question.options[question.answer]}`;
  els.reasonText.textContent = question.explanation || "No explanation was saved for this question.";
  els.reasonBox.classList.remove("is-hidden");
  els.reasonBox.hidden = false;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function tick() {
  const remaining = Math.max(0, Math.floor((state.session.endsAt - Date.now()) / 1000));
  els.timerLabel.textContent = formatTime(remaining);
  if (remaining === 0) finishExam();
}

function startTimer() {
  clearInterval(state.timerId);
  tick();
  state.timerId = setInterval(tick, 1000);
}

function askFinish() {
  const unanswered = state.exam.questions.filter((question) => {
    const selected = answerRecord(question).selected;
    return selected === null || selected === undefined;
  }).length;
  els.modalText.textContent = unanswered
    ? `${unanswered} question${unanswered === 1 ? "" : "s"} still unanswered. Finish and score this exam?`
    : "Finish and score this exam?";
  els.modal.classList.remove("is-hidden");
  els.modal.hidden = false;
}

function finishExam() {
  clearInterval(state.timerId);
  els.modal.classList.add("is-hidden");
  els.modal.hidden = true;
  const questions = state.exam.questions;
  const correct = questions.filter((question) => answerRecord(question).selected === question.answer).length;
  const score = Math.round((correct / questions.length) * 1000);
  const passed = score >= PASS_SCORE;
  state.session.completed = true;
  localStorage.removeItem(SESSION_KEY);
  const history = historyMap();
  history[state.exam.id] = { score, correct, total: questions.length, at: Date.now() };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  show(els.resultView);
  els.resultBanner.className = `banner ${passed ? "pass" : "fail"}`;
  els.resultBanner.innerHTML = `
    <span>${passed ? "Pass" : "Keep practicing"} · ${state.exam.rank} exam ${state.exam.level}</span>
    <strong>${score} / 1000</strong>
    <p>${correct} correct out of ${questions.length}. A score of ${PASS_SCORE} or higher is the passing mark.</p>
    <p id="saveStatus">Saving answers for ${state.username}…</p>
  `;
  saveAttempt({ score, correct, total: questions.length, passed, questions });

  const byTopic = new Map();
  questions.forEach((question) => {
    const item = byTopic.get(question.topic) || { total: 0, correct: 0 };
    item.total += 1;
    if (answerRecord(question).selected === question.answer) item.correct += 1;
    byTopic.set(question.topic, item);
  });
  els.topicResults.innerHTML = [...byTopic.entries()].map(([topic, item]) => {
    const pct = Math.round((item.correct / item.total) * 100);
    return `<div><strong>${topic}</strong><br>${item.correct}/${item.total} correct (${pct}%)</div>`;
  }).join("");
  els.resultFocus.innerHTML = state.exam.focus.map((item) => `<li>${item}</li>`).join("");

  const review = questions
    .map((question, index) => ({ question, index, record: answerRecord(question) }))
    .filter(({ question, record }) => record.flagged || record.selected !== question.answer);
  els.reviewList.innerHTML = "";
  if (!review.length) {
    const article = document.createElement("article");
    article.textContent = "Every question was correct, and nothing was flagged.";
    els.reviewList.appendChild(article);
    return;
  }
  review.forEach(({ question, index, record }) => {
    const article = document.createElement("article");
    const title = document.createElement("strong");
    const right = record.selected === question.answer;
    title.textContent = `Question ${index + 1} · ${right ? "Flagged" : "Incorrect"} · ${question.topic}`;
    const stem = document.createElement("p");
    stem.textContent = question.stem;
    const answer = document.createElement("p");
    answer.textContent = `Correct answer: ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`;
    const why = document.createElement("p");
    why.textContent = question.explanation;
    article.append(title, stem, answer, why);
    els.reviewList.appendChild(article);
  });
}

function saveAttempt({ score, correct, total, passed, questions }) {
  const status = document.getElementById("saveStatus");
  const finished = new Date();
  const payload = {
    username: state.username,
    examId: state.exam.id,
    examTitle: state.exam.title,
    rank: state.exam.rank,
    level: state.exam.level,
    score,
    correct,
    total,
    passed,
    date: dateKey(finished),
    finishedAt: finished.toISOString(),
    answers: questions.map((question, index) => {
      const record = answerRecord(question);
      const selected = record.selected == null ? null : record.selected;
      return {
        n: index + 1,
        questionId: question.id,
        selected,
        selectedText: selected == null ? "" : question.options[selected],
        correctIndex: question.answer,
        correctText: question.options[question.answer],
        right: selected === question.answer,
        flagged: Boolean(record.flagged),
      };
    }),
  };
  return firebase.database()
    .ref(`examKit/${userKey(state.username)}/${payload.date}`)
    .push(payload)
    .then(() => {
      if (status) status.textContent = `Saved for ${state.username} on ${payload.date}.`;
      return loadAttempts();
    })
    .catch((error) => {
      if (status) status.textContent = `Could not save this try: ${error.message}`;
    });
}

function leaveExam() {
  clearInterval(state.timerId);
  saveSession();
  show(els.homeView);
  renderList();
  renderDetail();
}

els.flagBtn.addEventListener("click", () => {
  const question = currentQuestion();
  const record = answerRecord(question);
  record.flagged = !record.flagged;
  state.session.answers[question.id] = record;
  saveSession();
  renderQuestion();
});

els.prevBtn.addEventListener("click", () => {
  state.index = Math.max(0, state.index - 1);
  renderQuestion();
});

els.nextBtn.addEventListener("click", () => {
  state.index = Math.min(state.exam.questions.length - 1, state.index + 1);
  renderQuestion();
});

els.finishBtn.addEventListener("click", askFinish);
els.modalNo.addEventListener("click", () => {
  els.modal.classList.add("is-hidden");
  els.modal.hidden = true;
});
els.modalYes.addEventListener("click", finishExam);
els.leaveBtn.addEventListener("click", leaveExam);
els.backHomeBtn.addEventListener("click", () => {
  state.exam = null;
  state.session = null;
  show(els.homeView);
  renderList();
  renderDetail();
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = els.usernameInput.value.trim();
  if (!name) return;
  enterApp(name);
});

els.switchUserBtn.addEventListener("click", () => {
  clearCookie(USER_COOKIE);
  state.username = "";
  state.attempts = [];
  showLogin();
});

const savedName = readCookie(USER_COOKIE);
if (savedName) enterApp(savedName);
else showLogin();
