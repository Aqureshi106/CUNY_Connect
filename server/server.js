"use strict";

const path = require("path");
// Load the root .env no matter which folder the server is started from.
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const { GoogleGenAI, Type } = require("@google/genai");

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_INSTRUCTION = [
  "You are the CUNY Connect AI study assistant, helping CUNY students succeed in their classes.",
  "Keep responses student-friendly, concise, and educational. Normally answer in 2-5 short paragraphs, unless the student requests a detailed explanation.",
  "Always prioritize the student's explicit formatting instructions over these defaults. If the student asks for '3 sentences', respond with exactly 3 sentences and do not add a follow-up question.",
  "Do not automatically end every response with a practice question. Offer one short practice question only when it would genuinely help, or when the student asks to be quizzed.",
  "Be technically precise, and avoid oversimplifications that become incorrect. For example, binary search trees have O(log n) search on average when reasonably balanced, but can degrade to O(n) when badly unbalanced. When explaining technical subjects, prefer simple examples that stay accurate.",
  "You may use hypothetical CUNY-themed examples (for example, a made-up CUNY course or student scenario), but make clear they are examples. Do not invent CUNY-specific courses, course numbers, schedules, campus services, tutoring centers, faculty, or policies unless this application provides them in the conversation.",
  "If you mention a real CUNY resource that this application has not supplied, direct the student to verify it through their campus or the official CUNY website rather than presenting unverified details as fact.",
  "Be encouraging and honest when you are unsure. If a question is unrelated to academics or student life, gently steer the conversation back to studying.",
].join("\n");

const MAX_TOPIC_LENGTH = 200;
const QUIZ_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QUIZ_SIZES = [3, 5, 10];

const QUIZ_SYSTEM_INSTRUCTION = [
  "You create multiple-choice quizzes for CUNY college students.",
  "Be technically accurate: the choice at correctAnswer must be genuinely correct, and the other three must be plausible but wrong.",
  "Write clear questions and short explanations (1-3 sentences) that teach why the correct answer is right.",
  "Do not invent CUNY-specific courses, schedules, campus services, faculty, or policies.",
].join("\n");

const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    difficulty: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          choices: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: ["question", "choices", "correctAnswer", "explanation"],
        propertyOrdering: ["question", "choices", "correctAnswer", "explanation"],
      },
    },
  },
  required: ["title", "difficulty", "questions"],
  propertyOrdering: ["title", "difficulty", "questions"],
};

function buildQuizPrompt(topic, difficulty, numQuestions) {
  return [
    `Create a multiple-choice quiz about "${topic}".`,
    `Difficulty: ${difficulty}, calibrated for a college student.`,
    `Write exactly ${numQuestions} distinct questions.`,
    "Each question must have exactly 4 answer choices and exactly one correct choice.",
    "Set correctAnswer to the 0-based index of the correct choice, and vary its position across questions.",
    `Give the quiz a short title based on the topic, and set difficulty to "${difficulty}".`,
  ].join("\n");
}

// Rebuild the quiz from scratch so only expected, well-formed fields ever
// reach the frontend. Returns null if Gemini's output breaks the contract.
function buildValidatedQuiz(raw, topic, difficulty, numQuestions) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.questions)) {
    return null;
  }
  if (raw.questions.length < numQuestions) {
    return null;
  }

  const questions = [];
  for (const item of raw.questions.slice(0, numQuestions)) {
    if (!item || typeof item !== "object") return null;

    const { question, choices, correctAnswer, explanation } = item;
    if (typeof question !== "string" || question.trim() === "") return null;
    if (!Array.isArray(choices) || choices.length !== 4) return null;
    if (!choices.every((c) => typeof c === "string" && c.trim() !== "")) return null;
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;
    if (typeof explanation !== "string" || explanation.trim() === "") return null;

    questions.push({
      question: question.trim(),
      choices: choices.map((c) => c.trim()),
      correctAnswer,
      explanation: explanation.trim(),
    });
  }

  const title =
    typeof raw.title === "string" && raw.title.trim() !== ""
      ? raw.title.trim()
      : `${topic} Quiz`;

  return { title, difficulty, questions };
}

if (!GEMINI_API_KEY || GEMINI_API_KEY === "paste-your-gemini-api-key-here") {
  console.warn(
    "[warn] GEMINI_API_KEY is not set. Add your key to the .env file at the " +
      "project root, then restart the server."
  );
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const app = express();

app.use(express.json({ limit: "10kb" }));

// Serve the frontend (index.html, ai/, etc.). Dotfiles such as .env are
// ignored by express.static by default, so the API key is never reachable.
app.use(express.static(path.join(__dirname, "..")));

app.post("/api/chat", async (req, res) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "paste-your-gemini-api-key-here") {
    return res.status(503).json({
      error:
        "The AI service isn't configured yet. Add GEMINI_API_KEY to the .env " +
        "file and restart the server.",
    });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "Please send a non-empty message." });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message is too long (${MAX_MESSAGE_LENGTH} characters max).`,
    });
  }

  try {
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: message,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    const reply =
      result.text ?? "I couldn't come up with a response to that. Could you try rephrasing?";

    res.json({ reply });
  } catch (error) {
    // Log the full error server-side only; the client gets a generic message
    // so no API details or keys can leak.
    console.error("[error] Gemini request failed:", error);
    res.status(502).json({
      error: "The AI service had trouble answering. Please try again in a moment.",
    });
  }
});

app.post("/api/quiz", async (req, res) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "paste-your-gemini-api-key-here") {
    return res.status(503).json({
      error:
        "The AI service isn't configured yet. Add GEMINI_API_KEY to the .env " +
        "file and restart the server.",
    });
  }

  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const difficultyRaw =
    typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : "";
  const difficulty = QUIZ_DIFFICULTIES.find(
    (d) => d.toLowerCase() === difficultyRaw.toLowerCase()
  );
  const numQuestions = Number(req.body?.numQuestions);

  if (!topic) {
    return res.status(400).json({ error: "Please provide a quiz topic." });
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({
      error: `Topic is too long (${MAX_TOPIC_LENGTH} characters max).`,
    });
  }
  if (!difficulty) {
    return res.status(400).json({ error: "Difficulty must be Easy, Medium, or Hard." });
  }
  if (!QUIZ_SIZES.includes(numQuestions)) {
    return res.status(400).json({ error: "Question count must be 3, 5, or 10." });
  }

  try {
    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildQuizPrompt(topic, difficulty, numQuestions),
      config: {
        systemInstruction: QUIZ_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUIZ_SCHEMA,
      },
    });

    let parsed = null;
    try {
      parsed = JSON.parse(result.text ?? "");
    } catch {
      parsed = null;
    }

    const quiz = buildValidatedQuiz(parsed, topic, difficulty, numQuestions);
    if (!quiz) {
      console.error("[error] Gemini returned an invalid quiz:", result.text);
      return res.status(502).json({
        error: "The AI returned an invalid quiz. Please try again.",
      });
    }

    res.json(quiz);
  } catch (error) {
    console.error("[error] Gemini quiz request failed:", error);
    res.status(502).json({
      error: "The AI service had trouble building the quiz. Please try again.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`CUNY Connect server running at http://localhost:${PORT}`);
  console.log(`AI study assistant: http://localhost:${PORT}/ai/ai.html`);
});
