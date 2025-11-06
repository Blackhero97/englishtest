require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// =========================
// 🔹 Gemini AI Config
// =========================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Model URLs
const GEMINI_URL_TEST =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";
const GEMINI_URL_CHAT =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent";

console.log("✅ Gemini AI configured with v1 API (flash + pro models enabled)");

// =========================
// 🔹 Middleware
// =========================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://missnoraenglish.netlify.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =========================
// 🔹 MongoDB Connection
// =========================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⚠️ Running without database (for local dev only)");
  });

// =========================
// 🔹 Schemas and Models
// =========================
const TestSetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    questions: [
      {
        question: String,
        options: [String],
        answer: Number,
      },
    ],
  },
  { timestamps: true }
);

const TestSet = mongoose.model("TestSet", TestSetSchema);

const ResultSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    testId: { type: String, required: true },
    testName: { type: String, required: true },
    score: { type: Number, required: true },
    percentage: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    wrongAnswers: { type: Number, required: true },
    answers: [Number],
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", ResultSchema);

// =========================
// 🔹 ROUTES
// =========================

// ----- TEST CRUD -----
app.get("/api/tests", async (req, res) => {
  try {
    const tests = await TestSet.find().sort({ createdAt: -1 });
    res.json({ testSets: tests });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tests" });
  }
});

app.get("/api/tests/:id", async (req, res) => {
  try {
    const test = await TestSet.findOne({ id: req.params.id });
    if (!test) return res.status(404).json({ error: "Test not found" });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch test" });
  }
});

app.post("/api/tests", async (req, res) => {
  try {
    const { id, name, description, duration, questions } = req.body;
    const newTest = new TestSet({
      id: id || `test-${Date.now()}`,
      name,
      description,
      duration,
      questions: questions || [],
    });
    await newTest.save();
    res.status(201).json(newTest);
  } catch (error) {
    res.status(500).json({ error: "Failed to create test" });
  }
});

app.put("/api/tests/:id", async (req, res) => {
  try {
    const { name, description, duration, questions } = req.body;
    const test = await TestSet.findOneAndUpdate(
      { id: req.params.id },
      { name, description, duration, questions },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: "Test not found" });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Failed to update test" });
  }
});

app.delete("/api/tests/:id", async (req, res) => {
  try {
    const test = await TestSet.findOneAndDelete({ id: req.params.id });
    if (!test) return res.status(404).json({ error: "Test not found" });
    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// ----- RESULT ROUTES -----
app.get("/api/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

app.post("/api/results", async (req, res) => {
  try {
    const result = new Result(req.body);
    await result.save();
    res.status(201).json({ message: "Result saved successfully", result });
  } catch (error) {
    res.status(500).json({ error: "Failed to save result" });
  }
});

// =========================
// 🔹 AI ROUTES
// =========================

// 🔸 Generate Test Questions (flash model)
app.post("/api/ai/generate-test", async (req, res) => {
  try {
    const { topic, difficulty, questionCount } = req.body;

    const prompt = `
Generate ${questionCount || 5} multiple-choice English test questions about "${
      topic || "General English"
    }".
Difficulty: ${difficulty || "intermediate"}.
Return valid JSON like:
{
  "questions": [
    {
      "question": "Question?",
      "options": ["A","B","C","D"],
      "answer": 1
    }
  ]
}`;

    console.log("🤖 Generating AI questions for:", topic);

    const response = await fetch(`${GEMINI_URL_TEST}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const aiData = JSON.parse(jsonMatch[0]);

    res.json({
      success: true,
      topic: topic || "General English",
      difficulty: difficulty || "intermediate",
      questions: aiData.questions || [],
    });
  } catch (error) {
    console.error("AI Generate Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to generate questions", details: error.message });
  }
});

// 🔸 Chat & Feedback (pro model)
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    const systemContext = context
      ? `
Student Context:
- Test Name: ${context.testName}
- Score: ${context.score}/${context.totalQuestions}
- Percentage: ${context.percentage}%
- Weak Areas: ${context.weakAreas || "Not specified"}

You are an English teacher helping this student improve their skills.
Be encouraging, concise, and clear.`
      : "You are a helpful English learning assistant.";

    const prompt = `${systemContext}\n\nStudent Message: ${message}`;

    const response = await fetch(`${GEMINI_URL_CHAT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";

    res.json({ success: true, reply: text });
  } catch (error) {
    console.error("AI Chat Error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to process chat", details: error.message });
  }
});

// =========================
// 🔹 Health Check
// =========================
app.get("/", (req, res) => {
  res.json({ message: "English Test API running ✅", version: "1.1.0" });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
