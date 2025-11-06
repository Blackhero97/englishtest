require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini AI
let model;
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  // Use original gemini-pro model (most stable, works on all API versions)
  model = genAI.getGenerativeModel({
    model: "gemini-pro",
  });
  console.log("✅ Gemini AI initialized successfully with gemini-pro");
} catch (error) {
  console.warn("⚠️  Gemini AI initialization failed:", error.message);
}

// Middleware - CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://missnoraenglish.netlify.app",
  process.env.FRONTEND_URL, // Add this in Render env vars
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⚠️  Running without database. Deploy to use MongoDB Atlas.");
  });

// Models
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

// Result Schema - O'quvchi natijalari
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
    answers: [Number], // O'quvchining javoblari
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", ResultSchema);

// Routes

// GET /api/tests - Get all test sets
app.get("/api/tests", async (req, res) => {
  try {
    const tests = await TestSet.find().sort({ createdAt: -1 });
    res.json({ testSets: tests });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tests" });
  }
});

// GET /api/tests/:id - Get single test set
app.get("/api/tests/:id", async (req, res) => {
  try {
    const test = await TestSet.findOne({ id: req.params.id });
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch test" });
  }
});

// POST /api/tests - Create new test set
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

// PUT /api/tests/:id - Update test set
app.put("/api/tests/:id", async (req, res) => {
  try {
    const { name, description, duration, questions } = req.body;

    console.log("Update request for test:", req.params.id);
    console.log("Update data:", {
      name,
      description,
      duration,
      questionsCount: questions?.length,
    });

    const test = await TestSet.findOneAndUpdate(
      { id: req.params.id },
      { name, description, duration, questions },
      { new: true }
    );
    if (!test) {
      console.error("Test not found:", req.params.id);
      return res.status(404).json({ error: "Test not found" });
    }
    console.log("Test updated successfully:", test.id);
    res.json(test);
  } catch (error) {
    console.error("Update error:", error);
    res
      .status(500)
      .json({ error: "Failed to update test", details: error.message });
  }
});

// DELETE /api/tests/:id - Delete test set
app.delete("/api/tests/:id", async (req, res) => {
  try {
    const test = await TestSet.findOneAndDelete({ id: req.params.id });
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }
    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// ===== RESULT ROUTES =====

// GET /api/results - Get all results
app.get("/api/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

// POST /api/results - Save test result
app.post("/api/results", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      testId,
      testName,
      score,
      percentage,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      answers,
    } = req.body;

    const newResult = new Result({
      firstName,
      lastName,
      testId,
      testName,
      score,
      percentage,
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      answers,
    });

    await newResult.save();
    res
      .status(201)
      .json({ message: "Result saved successfully", result: newResult });
  } catch (error) {
    console.error("Save result error:", error);
    res
      .status(500)
      .json({ error: "Failed to save result", details: error.message });
  }
});

// DELETE /api/results/:id - Delete result
app.delete("/api/results/:id", async (req, res) => {
  try {
    const result = await Result.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }
    res.json({ message: "Result deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete result" });
  }
});

// ===== AI ROUTES =====

// POST /api/ai/generate-test - Generate test questions using AI
app.post("/api/ai/generate-test", async (req, res) => {
  try {
    const { topic, difficulty, questionCount } = req.body;

    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return res.status(400).json({
        error:
          "Gemini API key not configured. Please add GEMINI_API_KEY to .env file",
      });
    }

    const prompt = `Generate ${
      questionCount || 5
    } English proficiency test questions about "${topic || "General English"}".
Difficulty level: ${difficulty || "intermediate"}

Create multiple choice questions in this exact JSON format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0
    }
  ]
}

Rules:
- Questions should test ${topic || "grammar, vocabulary, and comprehension"}
- Each question must have exactly 4 options
- Answer is the index (0-3) of the correct option
- Make questions clear and educational
- Difficulty: ${difficulty || "intermediate"} level
- Return ONLY valid JSON, no additional text`;

    console.log("🤖 Generating AI questions for:", topic);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI Response:", text);

    // Parse JSON from response
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }

    const aiData = JSON.parse(jsonMatch[0]);

    res.json({
      success: true,
      questions: aiData.questions || [],
      topic: topic || "General English",
      difficulty: difficulty || "intermediate",
    });
  } catch (error) {
    console.error("AI Generate Error:", error.message);
    res.status(500).json({
      error: "Failed to generate questions",
      details: error.message,
    });
  }
});

// POST /api/ai/chat - AI Chatbot for learning assistance
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return res.status(400).json({
        error: "Gemini API key not configured",
      });
    }

    const systemContext = context
      ? `
Student Context:
- Test Name: ${context.testName}
- Score: ${context.score}/${context.totalQuestions}
- Percentage: ${context.percentage}%
- Weak Areas: ${context.weakAreas || "Not specified"}

You are an English teacher helping this student improve their English skills.
Be encouraging, clear, and provide specific learning tips.
`
      : "You are a helpful English teacher assistant.";

    const prompt = `${systemContext}

Student Question: ${message}

Please provide a helpful, encouraging response focused on English learning.`;

    console.log("💬 AI Chat request:", message);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      reply: text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI Chat Error:", error.message);
    res.status(500).json({
      error: "Failed to process chat",
      details: error.message,
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ message: "English Test API - Running ✅", version: "1.0.0" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
