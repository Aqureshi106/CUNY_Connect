import supabase from "../js/supabase.js";
import { recordAIActivity } from "../js/ai.js";

const chatHistory = document.getElementById("chat-history");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");
const suggestions = document.getElementById("suggestions");

const WELCOME_MESSAGE =
  "Hi! I'm the CUNY Connect study assistant. I can explain tricky concepts, " +
  "build study plans, and quiz you before exams. What are you working on today?";

const CONNECTION_ERROR_MESSAGE =
  "I couldn't reach the CUNY Connect server. Start it with \"npm start\" in " +
  "the project folder, then open http://localhost:3000/ai/ai.html.";

const AVATAR_HTML = `
  <div class="avatar" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  </div>
`;

let isWaitingForReply = false;

function scrollToBottom() {
  chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: "smooth" });
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message ${role}`;

  if (role === "assistant") {
    row.insertAdjacentHTML("beforeend", AVATAR_HTML);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);

  chatHistory.appendChild(row);
  scrollToBottom();
}

function showTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message assistant";
  row.id = "typing-indicator";
  row.innerHTML = `
    ${AVATAR_HTML}
    <div class="bubble typing-dots" aria-label="Assistant is typing">
      <span></span><span></span><span></span>
    </div>
  `;
  chatHistory.appendChild(row);
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

// The Gemini API key lives only on the server — the browser never sees it.
async function requestAssistantReply(userText) {
  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });
  } catch {
    throw new Error(CONNECTION_ERROR_MESSAGE);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || typeof data?.reply !== "string") {
    throw new Error(
      data?.error || "Something went wrong on the server. Please try again."
    );
  }

  return data.reply;
}

function refreshSendButton() {
  sendButton.disabled = isWaitingForReply || chatInput.value.trim() === "";
}

async function handleSend(text) {
  isWaitingForReply = true;
  refreshSendButton();

  addMessage("user", text);
  suggestions.hidden = true;
  showTypingIndicator();

  let reply;
  try {
    reply = await requestAssistantReply(text);
  } catch (error) {
    reply = error.message;
  }

  hideTypingIndicator();
  addMessage("assistant", reply);

  isWaitingForReply = false;
  refreshSendButton();
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (text === "" || isWaitingForReply) return;

  chatInput.value = "";
  refreshSendButton();
  handleSend(text);
});

chatInput.addEventListener("input", refreshSendButton);

suggestions.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip || isWaitingForReply) return;

  chatInput.value = chip.textContent.trim();
  refreshSendButton();
  chatForm.requestSubmit();
});

addMessage("assistant", WELCOME_MESSAGE);
chatInput.focus();

/* ---------- Quiz Mode ---------- */

const appEl = document.querySelector(".chat-app");
const tabChat = document.getElementById("tab-chat");
const tabQuiz = document.getElementById("tab-quiz");

const quizSetup = document.getElementById("quiz-setup");
const quizPlay = document.getElementById("quiz-play");
const quizResults = document.getElementById("quiz-results");

const quizTopicInput = document.getElementById("quiz-topic");
const quizDifficultyGroup = document.getElementById("quiz-difficulty");
const quizCountGroup = document.getElementById("quiz-count");
const generateButton = document.getElementById("generate-quiz");
const generateLabel = document.getElementById("generate-label");
const quizErrorEl = document.getElementById("quiz-error");

const quizProgressText = document.getElementById("quiz-progress-text");
const quizProgressFill = document.getElementById("quiz-progress-fill");
const quizTitleEl = document.getElementById("quiz-title");
const quizQuestionEl = document.getElementById("quiz-question");
const quizChoicesEl = document.getElementById("quiz-choices");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizVerdictEl = document.getElementById("quiz-verdict");
const quizExplanationEl = document.getElementById("quiz-explanation");
const quizNextButton = document.getElementById("quiz-next");

const scoreFractionEl = document.getElementById("quiz-score-fraction");
const scorePercentEl = document.getElementById("quiz-score-percent");
const scoreMessageEl = document.getElementById("quiz-score-message");
const quizPointsEl = document.getElementById("quiz-points");
const quizRetryButton = document.getElementById("quiz-retry");

const CHOICE_LETTERS = ["A", "B", "C", "D"];
const QUIZ_POINTS_REWARD = 25;

let quiz = null;
let questionIndex = 0;
let quizScore = 0;
let questionAnswered = false;
let quizLoading = false;
// One entry per question: the choice index (0-3) the student selected.
let selectedAnswers = [];
// Ensures the CUNY Points award fires at most once per quiz session.
let pointsAwarded = false;

function setMode(mode) {
  const quizMode = mode === "quiz";
  appEl.classList.toggle("quiz-mode", quizMode);
  tabChat.classList.toggle("active", !quizMode);
  tabQuiz.classList.toggle("active", quizMode);
  tabChat.setAttribute("aria-pressed", String(!quizMode));
  tabQuiz.setAttribute("aria-pressed", String(quizMode));

  if (quizMode && !quizSetup.hidden) {
    quizTopicInput.focus();
  } else if (!quizMode) {
    chatInput.focus();
  }
}

tabChat.addEventListener("click", () => setMode("chat"));
tabQuiz.addEventListener("click", () => setMode("quiz"));

function showQuizScreen(screen) {
  quizSetup.hidden = screen !== "setup";
  quizPlay.hidden = screen !== "play";
  quizResults.hidden = screen !== "results";
}

function segmentedValue(group) {
  return group.querySelector(".segment.active").dataset.value;
}

[quizDifficultyGroup, quizCountGroup].forEach((group) => {
  group.addEventListener("click", (event) => {
    const segment = event.target.closest(".segment");
    if (!segment || quizLoading) return;
    group.querySelectorAll(".segment").forEach((s) => s.classList.remove("active"));
    segment.classList.add("active");
  });
});

function refreshGenerateButton() {
  generateButton.disabled = quizLoading || quizTopicInput.value.trim() === "";
}

function setQuizLoading(loading) {
  quizLoading = loading;
  generateButton.classList.toggle("loading", loading);
  generateLabel.textContent = loading ? "Generating…" : "Generate Quiz";
  quizTopicInput.disabled = loading;
  refreshGenerateButton();
}

async function generateQuiz() {
  const topic = quizTopicInput.value.trim();
  if (topic === "" || quizLoading) return;

  setQuizLoading(true);
  quizErrorEl.hidden = true;

  try {
    let response;
    try {
      response = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          difficulty: segmentedValue(quizDifficultyGroup),
          numQuestions: Number(segmentedValue(quizCountGroup)),
        }),
      });
    } catch {
      throw new Error(CONNECTION_ERROR_MESSAGE);
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error(
        data?.error || "Something went wrong building the quiz. Please try again."
      );
    }

    quiz = data;
    questionIndex = 0;
    quizScore = 0;
    selectedAnswers = [];
    pointsAwarded = false;
    quizTitleEl.textContent = quiz.title;
    showQuizScreen("play");
    renderQuestion();
  } catch (error) {
    quizErrorEl.textContent = error.message;
    quizErrorEl.hidden = false;
  } finally {
    setQuizLoading(false);
  }
}

quizTopicInput.addEventListener("input", refreshGenerateButton);
quizTopicInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") generateQuiz();
});
generateButton.addEventListener("click", generateQuiz);

function renderQuestion() {
  const question = quiz.questions[questionIndex];
  questionAnswered = false;

  quizProgressText.textContent = `Question ${questionIndex + 1} of ${quiz.questions.length}`;
  quizProgressFill.style.width = `${((questionIndex + 1) / quiz.questions.length) * 100}%`;
  quizQuestionEl.textContent = question.question;

  quizChoicesEl.textContent = "";
  question.choices.forEach((choiceText, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";

    const letter = document.createElement("span");
    letter.className = "choice-letter";
    letter.textContent = CHOICE_LETTERS[index];

    const text = document.createElement("span");
    text.className = "choice-text";
    text.textContent = choiceText;

    button.append(letter, text);
    button.addEventListener("click", () => selectAnswer(index));
    quizChoicesEl.appendChild(button);
  });

  quizFeedbackEl.hidden = true;
  quizNextButton.hidden = true;
}

function selectAnswer(index) {
  if (questionAnswered) return;
  questionAnswered = true;

  selectedAnswers[questionIndex] = index;

  const question = quiz.questions[questionIndex];
  const isCorrect = index === question.correctAnswer;
  if (isCorrect) quizScore++;

  Array.from(quizChoicesEl.children).forEach((button, i) => {
    button.disabled = true;
    if (i === question.correctAnswer) {
      button.classList.add("correct");
    } else if (i === index) {
      button.classList.add("incorrect");
    } else {
      button.classList.add("dimmed");
    }
  });

  quizVerdictEl.textContent = isCorrect ? "✅ Correct!" : "❌ Not quite.";
  quizExplanationEl.textContent = question.explanation;
  quizFeedbackEl.classList.toggle("negative", !isCorrect);
  quizFeedbackEl.hidden = false;

  const isLastQuestion = questionIndex === quiz.questions.length - 1;
  quizNextButton.textContent = isLastQuestion ? "See Results" : "Next Question";
  quizNextButton.hidden = false;
  quizNextButton.focus();
}

quizNextButton.addEventListener("click", () => {
  if (questionIndex < quiz.questions.length - 1) {
    questionIndex++;
    renderQuestion();
  } else {
    showResults();
  }
});

function showResults() {
  const total = quiz.questions.length;
  const percent = Math.round((quizScore / total) * 100);

  scoreFractionEl.textContent = `${quizScore} / ${total}`;
  scorePercentEl.textContent = `${percent}%`;

  let message;
  if (percent === 100) {
    message = "Perfect score!";
  } else if (percent >= 80) {
    message = "Great work!";
  } else if (percent >= 60) {
    message = "Solid effort — review the ones you missed and try again.";
  } else {
    message = "Keep practicing — every attempt makes you stronger.";
  }
  scoreMessageEl.textContent = message;

  quizPointsEl.hidden = true;
  showQuizScreen("results");
  awardQuizPoints(); // fire-and-forget: the score above renders regardless
}

async function awardQuizPoints() {
  if (pointsAwarded) return;
  pointsAwarded = true; // set before any await so the award can never fire twice

  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return; // logged out: results stay as-is, no award

    const result = await recordAIActivity(
      user.id,
      "QUIZ_COMPLETED",
      QUIZ_POINTS_REWARD,
      `Completed quiz: ${quiz.title} (${quizScore}/${quiz.questions.length})`
    );

    if (result) {
      quizPointsEl.textContent = `+${QUIZ_POINTS_REWARD} CUNY Points earned!`;
      quizPointsEl.hidden = false;
    }
  } catch (error) {
    // A points failure must never break or hide the quiz results.
    console.error("CUNY Points award failed:", error);
  }
}

quizRetryButton.addEventListener("click", () => {
  showQuizScreen("setup");
  refreshGenerateButton();
  quizTopicInput.focus();
});
