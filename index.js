require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// =========================
// 🔹 Gemini AI Config (dynamic)
// =========================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// We'll detect available models at startup for this API key and pick
// the best-supported models for generateContent (test) and chat.
let GEMINI_URL_TEST = null;
let GEMINI_URL_CHAT = null;

const MODEL_PREFERENCES = {
  // prefer the most recent 2.x family, then 1.5, then gemini-pro
  test: [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-1.5-flash-latest",
    "models/gemini-pro",
    "models/gemini-1.5-pro",
  ],
  chat: [
    "models/gemini-2.5-pro",
    "models/gemini-2.0-pro",
    "models/gemini-pro",
    "models/gemini-1.5-pro",
  ],
};

async function detectAndConfigureModels() {
  if (!GEMINI_API_KEY) {
    console.warn(
      "⚠️ GEMINI_API_KEY is not set. AI routes will fail until you set the key."
    );
    return;
  }

  // Try listing models with retries (handles transient network blips)
  const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
  let attempt = 0;
  let body = null;
  while (attempt < 3) {
    attempt += 1;
    try {
      const resp = await fetch(listUrl);
      body = await resp.json();
      break;
    } catch (err) {
      console.warn(
        `Attempt ${attempt} to list models failed:`,
        err?.message || err
      );
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  if (body && body.models) {
    const available = (body.models || []).map((m) => m.name);
    console.log("ℹ️ Available Gemini models:", available);

    function findSupported(prefList) {
      for (const pref of prefList) {
        if (available.includes(pref)) return pref;
      }
      return null;
    }

    const testModel = findSupported(MODEL_PREFERENCES.test);
    const chatModel = findSupported(MODEL_PREFERENCES.chat);

    if (testModel) {
      GEMINI_URL_TEST = `https://generativelanguage.googleapis.com/v1/${testModel}:generateContent`;
    }
    if (chatModel) {
      GEMINI_URL_CHAT = `https://generativelanguage.googleapis.com/v1/${chatModel}:generateContent`;
    }

    if (!GEMINI_URL_TEST && !GEMINI_URL_CHAT) {
      console.warn(
        "⚠️ No supported Gemini models were found for this API key. Check model access in Google Cloud Console."
      );
    } else {
      console.log(
        `✅ Gemini AI configured. test=${GEMINI_URL_TEST || "(none)"}, chat=${
          GEMINI_URL_CHAT || "(none)"
        }`
      );
    }
  } else {
    // Listing failed after retries — set reasonable fallbacks (2.5 models are common)
    console.warn(
      "⚠️ Could not list models — applying fallback model choices (may still 404 if key lacks access)"
    );
    GEMINI_URL_TEST = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`;
    GEMINI_URL_CHAT = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent`;
    console.log(
      `ℹ️ Fallback Gemini URLs set. test=${GEMINI_URL_TEST}, chat=${GEMINI_URL_CHAT}`
    );
  }
}

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

    const prompt = `You are an English test generator. Create ${
      questionCount || 5
    } multiple-choice questions about "${topic || "General English"}".
Difficulty level: ${difficulty || "intermediate"}

IMPORTANT: Return ONLY valid JSON in this EXACT format (no markdown, no explanation):
{
  "questions": [
    {
      "question": "Your question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0
    }
  ]
}

Rules:
- "answer" is the index (0-3) of the correct option
- Each question must have exactly 4 options
- Questions must test English grammar, vocabulary, or comprehension
- Return ONLY the JSON object, nothing else`;

    console.log("🤖 Generating AI questions for:", topic);

    const response = await fetch(`${GEMINI_URL_TEST}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini API Error:", data);
      throw new Error(data.error?.message || "Gemini API request failed");
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📥 AI Response:", text.substring(0, 200) + "...");

    // Remove markdown code blocks if present
    let cleanText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ No JSON found in response:", text);
      throw new Error("AI did not return valid JSON format");
    }

    const aiData = JSON.parse(jsonMatch[0]);

    if (!aiData.questions || !Array.isArray(aiData.questions)) {
      throw new Error("Invalid questions format");
    }

    res.json({
      success: true,
      topic: topic || "General English",
      difficulty: difficulty || "intermediate",
      questions: aiData.questions,
    });
  } catch (error) {
    console.error("AI Generate Error:", error.message);
    res.status(500).json({
      error: "Failed to generate questions",
      details: error.message,
    });
  }
});

// 🔸 Chat & Feedback (pro model)
app.post("/api/ai/chat", async (req, res) => {
  try {
    // Input validation
    const { message, context } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ 
        error: "Message is required and cannot be empty",
        details: "Please provide a valid message"
      });
    }

    // Check if Gemini is properly configured
    if (!GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is not configured");
      return res.status(500).json({
        error: "AI service is not available",
        details: "Chat service is currently unavailable. Please try again later."
      });
    }

    if (!GEMINI_URL_CHAT) {
      console.error("❌ GEMINI_URL_CHAT is not configured");
      return res.status(500).json({
        error: "AI service is not available", 
        details: "Chat service is currently unavailable. Please try again later."
      });
    }

    const systemContext = context
      ? `You are a friendly and helpful English teacher assisting a student who completed a test.

Test Results:
- Test Name: ${context.testName}
- Score: ${context.correctAnswers}/${context.totalQuestions} (${context.percentage}%)
- Wrong Answers: ${context.wrongAnswers}

Instructions:
- Answer questions about English grammar, vocabulary, pronunciation, writing, speaking, listening, and reading
- Help improve English skills based on test results
- Provide clear explanations with examples
- Be encouraging and supportive
- Keep responses conversational and easy to understand (2-4 paragraphs)
- If asked in Uzbek or Russian, you may respond in that language
- Answer naturally without being overly strict about topics`
      : `You are a friendly and helpful English teacher for international students.

Instructions:
- Answer questions about English language learning (grammar, vocabulary, pronunciation, etc.)
- Help with IELTS, TOEFL, Cambridge exam preparation
- Provide study tips and learning strategies
- Explain concepts clearly with practical examples
- Be encouraging, patient, and supportive
- Keep responses conversational and helpful (2-4 paragraphs)
- If asked in Uzbek or Russian, you may respond in that language
- Answer naturally and be flexible with conversation topics related to learning`;

    const prompt = `${systemContext}\n\nStudent Question: ${message}\n\nYour Response:`;

    console.log("💬 AI Chat request:", {
      hasContext: !!context,
      message: message.substring(0, 50),
      apiKeyConfigured: !!GEMINI_API_KEY,
      chatUrlConfigured: !!GEMINI_URL_CHAT
    });

    const response = await fetch(`${GEMINI_URL_CHAT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini Chat API Error:", data);
      
      // Handle specific API errors
      if (response.status === 400) {
        return res.status(500).json({
          error: "Invalid request to AI service",
          details: "The message could not be processed. Please try rephrasing your question."
        });
      } else if (response.status === 403) {
        return res.status(500).json({
          error: "AI service access denied",
          details: "The AI service is currently unavailable. Please try again later."
        });
      } else if (response.status === 429) {
        return res.status(500).json({
          error: "Too many requests",
          details: "The AI service is busy. Please wait a moment and try again."
        });
      }
      
      throw new Error(data.error?.message || `API error: ${response.status}`);
    }

    // Check if candidates exist
    if (!data.candidates || data.candidates.length === 0) {
      console.error("❌ No candidates in response:", data);
      return res.status(500).json({
        error: "AI response unavailable",
        details: "The AI couldn't generate a response. Please try asking your question differently."
      });
    }

    const candidate = data.candidates[0];
    
    // Check for content filtering
    if (candidate.finishReason === "SAFETY") {
      console.log("⚠️ Content was filtered for safety");
      return res.status(500).json({
        error: "Content filtered",
        details: "Your message was filtered for safety. Please try asking your question in a different way."
      });
    }

    const text = candidate?.content?.parts?.[0]?.text;

    if (!text || text.trim().length === 0) {
      console.error("❌ No text in candidate:", candidate);
      return res.status(500).json({
        error: "Empty AI response",
        details: "The AI couldn't generate a response. Please try asking your question again."
      });
    }

    console.log(
      "✅ AI Chat response received:",
      text.substring(0, 100) + "..."
    );

    res.json({ success: true, reply: text.trim() });
  } catch (error) {
    console.error("AI Chat Error:", error.message);
    
    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({
        error: "Network error",
        details: "Cannot connect to AI service. Please check your internet connection and try again."
      });
    }
    
    // Handle timeout errors
    if (error.code === 'ETIMEDOUT') {
      return res.status(500).json({
        error: "Request timeout", 
        details: "The AI service is taking too long to respond. Please try again."
      });
    }

    res.status(500).json({ 
      error: "Chat service error", 
      details: "Something went wrong with the chat service. Please try again later."
    });
  }
});

// =========================
// 🔹 Health Check
// =========================
app.get("/", (req, res) => {
  res.json({ message: "English Test API running ✅", version: "1.1.0" });
});

// Start server after attempting to detect available Gemini models.
(async () => {
  await detectAndConfigureModels();

  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
