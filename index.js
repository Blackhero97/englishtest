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
  "https://englishtest-dbrs.onrender.com",
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
    startDate: { type: Date },
    endDate: { type: Date },
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
    answers: [
      {
        question: String,
        options: [String],
        correctAnswer: Number,
        selectedAnswer: Number,
      },
    ],
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", ResultSchema);

// Lesson Schema
const LessonSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, sparse: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true },
    level: { type: String, required: true },
    duration: { type: String, default: "15 min" },
    content: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Lesson = mongoose.model("Lesson", LessonSchema);

// User Schema for Google OAuth
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    picture: { type: String },
    googleId: { type: String },
    firstName: { type: String },
    lastName: { type: String },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

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

// Delete a result
app.delete("/api/results/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Result.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    res.json({ message: "Result deleted successfully" });
  } catch (error) {
    console.error("Delete result error:", error);
    res.status(500).json({ error: "Failed to delete result" });
  }
});

// Generate PDF for a result
app.get("/api/results/:id/pdf", async (req, res) => {
  try {
    const PDFDocument = require("pdfkit");
    const { id } = req.params;
    const result = await Result.findById(id);

    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${result.firstName}_${result.lastName}_Results.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("English Test Results", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#666666")
      .text(
        new Date(result.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        { align: "center" }
      );
    doc.moveDown(2);

    // Student Info Box
    doc.fontSize(10).fillColor("#000000");
    doc.rect(50, doc.y, 495, 60).fillAndStroke("#f0f9ff", "#3b82f6");
    doc
      .fillColor("#1e40af")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Student Information", 60, doc.y + 15);
    doc
      .fillColor("#000000")
      .fontSize(10)
      .font("Helvetica")
      .text(`Name: ${result.firstName} ${result.lastName}`, 60, doc.y + 10)
      .text(`Test: ${result.testName}`, 60, doc.y + 5);
    doc.moveDown(3);

    // Score Section
    const totalQuestions = result.answers?.length || 0;
    const correctAnswers = result.score || 0;
    const percentage =
      totalQuestions > 0
        ? ((correctAnswers / totalQuestions) * 100).toFixed(1)
        : 0;

    doc.rect(50, doc.y, 495, 80).fillAndStroke("#f0fdf4", "#22c55e");
    doc
      .fillColor("#166534")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Final Score", 60, doc.y + 15);
    doc.fontSize(32).text(`${percentage}%`, 60, doc.y + 10);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `${correctAnswers} out of ${totalQuestions} correct`,
        60,
        doc.y + 5
      );
    doc.moveDown(4);

    // Performance Summary
    doc
      .fillColor("#000000")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Performance Summary:");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc
      .fillColor("#22c55e")
      .text(`✓ Correct Answers: ${correctAnswers}`, { continued: true });
    doc.fillColor("#000000").text(`  (${percentage}%)`);
    doc
      .fillColor("#ef4444")
      .text(`✗ Wrong Answers: ${totalQuestions - correctAnswers}`, {
        continued: true,
      });
    doc.fillColor("#000000").text(`  (${(100 - percentage).toFixed(1)}%)`);
    doc
      .fillColor("#3b82f6")
      .text(`⏱ Time Taken: ${result.timeTaken || result.testDuration} minutes`);
    doc.moveDown(2);

    // Question Details
    if (result.answers && result.answers.length > 0) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text("Detailed Analysis:");
      doc.moveDown(1);

      result.answers.forEach((answer, index) => {
        const isCorrect = answer.selectedAnswer === answer.correctAnswer;

        // Question number and status
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor(isCorrect ? "#22c55e" : "#ef4444")
          .text(`Q${index + 1}. ${isCorrect ? "✓" : "✗"}`, { continued: true });

        doc
          .fillColor("#000000")
          .font("Helvetica")
          .text(
            ` ${answer.question?.substring(0, 80)}${
              answer.question?.length > 80 ? "..." : ""
            }`
          );

        // Answers
        doc
          .fontSize(9)
          .fillColor("#666666")
          .text(`   Your Answer: ${answer.selectedAnswer}`, { indent: 20 });

        if (!isCorrect) {
          doc
            .fillColor("#22c55e")
            .text(`   Correct Answer: ${answer.correctAnswer}`, { indent: 20 });
        }

        doc.moveDown(0.5);

        // Add new page if needed
        if (doc.y > 700) {
          doc.addPage();
        }
      });
    }

    // Footer
    doc
      .fontSize(8)
      .fillColor("#999999")
      .text("Generated by English Test Platform", 50, doc.page.height - 50, {
        align: "center",
      });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ----- LESSON ROUTES -----
app.get("/api/lessons", async (req, res) => {
  try {
    const lessons = await Lesson.find().sort({ createdAt: -1 });

    // Ensure all lessons have id field
    const lessonsWithId = lessons.map((lesson) => {
      const lessonObj = lesson.toObject();
      return {
        ...lessonObj,
        id: lessonObj.id || lessonObj._id.toString(),
      };
    });

    res.json({ lessons: lessonsWithId });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

app.get("/api/lessons/:id", async (req, res) => {
  try {
    // Try to find by custom 'id' field first, then by MongoDB _id
    let lesson = await Lesson.findOne({ id: req.params.id });

    if (!lesson) {
      // If not found by custom id, try MongoDB _id
      lesson = await Lesson.findById(req.params.id);
    }

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Convert to plain object and ensure id is included
    const lessonObj = lesson.toObject();
    res.json({
      lesson: {
        ...lessonObj,
        id: lessonObj.id || lessonObj._id.toString(), // Use custom id or MongoDB _id
      },
    });
  } catch (error) {
    console.error("Fetch lesson error:", error);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

app.post("/api/lessons", async (req, res) => {
  try {
    const lessonData = {
      ...req.body,
      id: `lesson-${Date.now()}`,
      isDefault: false,
    };

    const lesson = new Lesson(lessonData);
    await lesson.save();

    // Convert to plain object and ensure id is included
    const lessonObj = lesson.toObject();

    res.status(201).json({
      message: "Lesson created successfully",
      lesson: {
        ...lessonObj,
        id: lessonObj.id || lessonData.id, // Ensure id is always present
      },
    });
  } catch (error) {
    console.error("Create lesson error:", error);
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

app.put("/api/lessons/:id", async (req, res) => {
  try {
    // Try to find and update by custom 'id' field first, then by MongoDB _id
    let lesson = await Lesson.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );

    if (!lesson) {
      // If not found by custom id, try MongoDB _id
      lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
    }

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Convert to plain object and ensure id is included
    const lessonObj = lesson.toObject();
    res.json({
      message: "Lesson updated successfully",
      lesson: {
        ...lessonObj,
        id: lessonObj.id || lessonObj._id.toString(),
      },
    });
  } catch (error) {
    console.error("Update lesson error:", error);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

app.delete("/api/lessons/:id", async (req, res) => {
  try {
    // Try to find and delete by custom 'id' field first, then by MongoDB _id
    let lesson = await Lesson.findOneAndDelete({ id: req.params.id });

    if (!lesson) {
      // If not found by custom id, try MongoDB _id
      lesson = await Lesson.findByIdAndDelete(req.params.id);
    }

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    res.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Delete lesson error:", error);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

// =========================
// 🔹 GOOGLE AUTH ENDPOINT
// =========================

app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, name, picture, googleId } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (user) {
      // Update existing user
      user.name = name;
      user.picture = picture;
      if (googleId) user.googleId = googleId;
      await user.save();
    } else {
      // Create new user
      user = new User({
        email,
        name,
        picture,
        googleId,
        firstName: name.split(" ")[0] || "",
        lastName: name.split(" ").slice(1).join(" ") || "",
      });
      await user.save();
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Failed to authenticate user" });
  }
});

// =========================
// 🔹 AI ROUTES
// =========================

// 🔸 Generate Test Questions (flash model)
app.post("/api/ai/generate-test", async (req, res) => {
  try {
    const { topic, context, difficulty, questionCount } = req.body;

    // Build prompt based on whether context is provided
    let prompt;
    
    if (context && context.trim()) {
      // Generate questions based on provided context/material
      prompt = `You are an English test generator. Generate ${questionCount || 5} multiple-choice questions based on the following material.

MATERIAL/CONTEXT:
${context}

TOPIC: ${topic || "Based on the provided material"}
DIFFICULTY: ${difficulty || "intermediate"}

OUTPUT FORMAT - Return ONLY this JSON structure with NO additional text, NO markdown, NO explanation:

{
  "questions": [
    {
      "question": "Question text goes here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Generate questions DIRECTLY from the provided material above
2. If vocabulary list: test word meanings, usage, synonyms
3. If text passage: test comprehension, grammar, context
4. "answer" must be index 0, 1, 2, or 3 (not the text)
5. Exactly 4 options per question
6. Return COMPLETE and VALID JSON only
7. Start response immediately with { character
8. End response with } character
9. IMPORTANT: Complete ALL ${questionCount || 5} questions - do not stop mid-question
10. Double-check JSON is complete before sending

Generate ALL ${questionCount || 5} complete questions now:`;
    } else {
      // Generate general questions on topic
      prompt = `Generate ${questionCount || 5} English test questions about "${topic || "General English"}" at ${difficulty || "intermediate"} level.

OUTPUT FORMAT - Return ONLY this JSON structure with NO additional text, NO markdown, NO explanation:

{
  "questions": [
    {
      "question": "Question text goes here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0
    }
  ]
}

CRITICAL REQUIREMENTS:
1. "answer" must be index 0, 1, 2, or 3 (not the text)
2. Exactly 4 options per question
3. Test English grammar, vocabulary, or reading comprehension
4. Return COMPLETE and VALID JSON only
5. Start response immediately with { character
6. End response with } character
7. IMPORTANT: Complete ALL ${questionCount || 5} questions - do not stop mid-question
8. Ensure proper commas between questions
9. Double-check JSON is complete before sending

Generate ALL ${questionCount || 5} complete questions now:`;
    }

    console.log("🤖 Generating AI questions:", { 
      topic, 
      hasContext: !!context, 
      contextLength: context?.length || 0 
    });

    // Retry logic for overloaded API
    let response;
    let data;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Attempt ${attempt}/${maxRetries} - Calling Gemini API...`);
        
        response = await fetch(`${GEMINI_URL_TEST}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096, // Increased from 2048 to ensure complete responses
              candidateCount: 1,
            },
          }),
        });

        data = await response.json();

        // Check if API is overloaded (503) or unavailable
        if (!response.ok && data.error?.code === 503) {
          lastError = new Error(`Model overloaded (attempt ${attempt}/${maxRetries})`);
          console.warn(`⚠️ ${lastError.message}, retrying in ${attempt * 2}s...`);
          
          if (attempt < maxRetries) {
            // Wait before retry (2s, 4s, 6s)
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
        } else if (!response.ok) {
          console.error("❌ Gemini API Error:", data);
          throw new Error(data.error?.message || "Gemini API request failed");
        }
        
        // Success - break retry loop
        break;
        
      } catch (fetchError) {
        lastError = fetchError;
        console.error(`❌ Attempt ${attempt} failed:`, fetchError.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    // If all retries failed
    if (!response.ok) {
      throw lastError || new Error("Failed after all retry attempts");
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("📥 AI Response (first 300 chars):", text.substring(0, 300));

    if (!text || text.length < 10) {
      console.error("❌ Empty or too short response from AI");
      throw new Error("AI returned empty response");
    }

    // Try multiple cleaning strategies
    let cleanText = text.trim();
    
    // Remove markdown code blocks
    cleanText = cleanText
      .replace(/```json\s*/gi, "")
      .replace(/```javascript\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    
    // Try to find JSON object
    let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      // If no match, try finding just the array part
      jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        // Wrap array in questions object
        cleanText = `{"questions": ${jsonMatch[0]}}`;
        jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      }
    }
    
    if (!jsonMatch) {
      console.error("❌ No JSON found in response. Full text:", text);
      throw new Error("AI did not return valid JSON format. Response: " + text.substring(0, 200));
    }

    let jsonText = jsonMatch[0];
    
    // Fix common JSON issues
    // 1. Fix incomplete arrays - add closing bracket if missing
    const openBrackets = (jsonText.match(/\[/g) || []).length;
    const closeBrackets = (jsonText.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      console.warn("⚠️ Fixing incomplete array - adding missing ]");
      // Add missing closing brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        jsonText += ']';
      }
    }
    
    // 2. Fix incomplete objects - add closing brace if missing
    const openBraces = (jsonText.match(/\{/g) || []).length;
    const closeBraces = (jsonText.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      console.warn("⚠️ Fixing incomplete object - adding missing }");
      for (let i = 0; i < openBraces - closeBraces; i++) {
        jsonText += '}';
      }
    }
    
    // 3. Remove trailing commas before closing brackets/braces
    jsonText = jsonText.replace(/,(\s*[\]}])/g, '$1');
    
    // 4. Fix missing commas between array elements (common AI mistake)
    jsonText = jsonText.replace(/\}(\s*)\{/g, '},$1{');
    
    // 5. Fix malformed answer field patterns like "answer""}]} or "answer""
    jsonText = jsonText.replace(/"answer"\s*"\s*"?\s*[\]\}]/g, (match) => {
      console.warn("⚠️ Fixing malformed answer field:", match);
      return '"answer": 0}';
    });
    
    // 6. Fix incomplete last question - if we see "answer" without value followed by end
    if (/"answer"\s*$/.test(jsonText) || /"answer"\s*"\s*$/.test(jsonText)) {
      console.warn("⚠️ Fixing incomplete last answer field");
      jsonText = jsonText.replace(/"answer"\s*"?\s*$/, '"answer": 0}]}');
    }
    
    // 7. Fix pattern: "answer""}]} -> "answer": 0}]}
    jsonText = jsonText.replace(/"answer"\s*"\s*"?\s*\}\s*\]\s*\}/g, '"answer": 0}]}');
    
    // 8. If JSON doesn't end properly, try to close it
    if (!jsonText.endsWith('}')) {
      const lastBrace = jsonText.lastIndexOf('}');
      const afterLastBrace = jsonText.substring(lastBrace + 1);
      
      // Check if we need to add closing brackets
      if (!afterLastBrace.includes(']')) {
        console.warn("⚠️ Adding missing closing brackets");
        jsonText = jsonText.substring(0, lastBrace + 1) + ']}';
      }
    }

    let aiData;
    try {
      aiData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError.message);
      console.error("Attempted to parse (first 500 chars):", jsonText.substring(0, 500));
      console.error("Last 200 chars:", jsonText.substring(jsonText.length - 200));
      
      // Last resort: try to extract valid questions even from broken JSON
      try {
        console.warn("⚠️ Attempting to salvage partial questions...");
        const questionMatches = jsonText.matchAll(/\{\s*"question":\s*"[^"]*",\s*"options":\s*\[[^\]]*\],\s*"answer":\s*\d+\s*\}/g);
        const salvaged = Array.from(questionMatches);
        
        if (salvaged.length > 0) {
          console.log(`✅ Salvaged ${salvaged.length} valid questions from broken JSON`);
          aiData = {
            questions: salvaged.map(match => JSON.parse(match[0]))
          };
        } else {
          throw parseError;
        }
      } catch (salvageError) {
        console.error("❌ Could not salvage questions");
        throw new Error("Invalid JSON format from AI: " + parseError.message);
      }
    }

    if (!aiData.questions || !Array.isArray(aiData.questions)) {
      console.error("❌ Invalid structure:", aiData);
      throw new Error("Invalid questions format - expected 'questions' array");
    }
    
    if (aiData.questions.length === 0) {
      throw new Error("AI returned empty questions array");
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
    const { message, context } = req.body;

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
    });

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError = null;

    // Try with fallback models if primary fails
    const modelsToTry = [
      GEMINI_URL_CHAT,
      GEMINI_URL_TEST, // fallback to test model
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
    ].filter(Boolean);

    for (let modelIndex = 0; modelIndex < modelsToTry.length; modelIndex++) {
      const currentModel = modelsToTry[modelIndex];

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch(
            `${currentModel}?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.8,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 4096,
                },
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            // Check if it's an overload error
            if (
              data.error?.status === "UNAVAILABLE" ||
              data.error?.message?.includes("overloaded")
            ) {
              console.warn(
                `⚠️ Model overloaded (attempt ${attempt + 1}/${maxRetries}):`,
                data.error?.message
              );
              lastError = new Error(
                data.error?.message || "Model is overloaded"
              );

              // Wait before retry (exponential backoff)
              if (attempt < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise((r) => setTimeout(r, delay));
                continue; // Try again with same model
              } else {
                // Move to next model
                break;
              }
            }

            console.error("❌ Gemini Chat API Error:", data);
            throw new Error(data.error?.message || "Gemini API request failed");
          }

          // Debug: Log full response
          console.log(
            "🔍 Full Gemini Response:",
            JSON.stringify(data, null, 2)
          );

          // Check if candidates exist
          if (!data.candidates || data.candidates.length === 0) {
            console.error("❌ No candidates in response:", data);
            throw new Error(
              "AI did not generate a response. Please try again."
            );
          }

          const text = data.candidates[0]?.content?.parts?.[0]?.text;

          if (!text) {
            console.error("❌ No text in candidate:", data.candidates[0]);
            throw new Error("AI response was empty. Please try again.");
          }

          console.log(
            "✅ AI Chat response received:",
            text.substring(0, 100) + "..."
          );

          return res.json({ success: true, reply: text });
        } catch (error) {
          lastError = error;
          console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);

          if (attempt === maxRetries - 1) {
            // Last attempt with this model failed, try next model
            break;
          }
        }
      }
    }

    // If we got here, all models and retries failed
    throw lastError || new Error("All AI models are currently unavailable");
  } catch (error) {
    console.error("AI Chat Error:", error.message);
    res.status(503).json({
      error:
        "AI service temporarily unavailable. Please try again in a moment.",
      details: error.message,
    });
  }
});

// 🔸 Generate Lesson Content (pro model)
app.post("/api/ai/generate-lesson", async (req, res) => {
  try {
    const { title, level, category } = req.body;

    if (!title || !level || !category) {
      return res
        .status(400)
        .json({ error: "Title, level, and category are required" });
    }

    if (!GEMINI_URL_CHAT || !GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini Chat API not configured" });
    }

    const prompt = `Create a comprehensive English lesson about "${title}" for ${level} level students in the ${category} category.

Structure the lesson in Markdown format with the following sections:

# ${title}

## Introduction
Brief overview of the topic (2-3 sentences)

## Key Concepts
Main points to learn (3-5 bullet points)

## Detailed Explanation
In-depth explanation with examples

## Practice Examples
5-7 practical examples with clear demonstrations

## Common Mistakes
3-4 common mistakes students make and how to avoid them

## Practice Exercises
3-5 exercises for students to practice

## Summary
Key takeaways (2-3 sentences)

Make it engaging, clear, and appropriate for ${level} level. Use simple language and provide plenty of examples. The lesson should take about 15-25 minutes to read and understand.`;

    console.log("🤖 Generating lesson content for:", title);

    // Retry logic with exponential backoff
    let lastError = null;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let content = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📡 Attempt ${attempt}/${maxRetries} to generate lesson...`
        );

        const response = await fetch(GEMINI_URL_CHAT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 3072, // Reduced to avoid overload
            },
          }),
        });

        const data = await response.json();

        // Check for overload error specifically
        if (
          data.error?.code === 503 ||
          data.error?.message?.includes("overloaded")
        ) {
          console.warn(
            `⚠️ Model overloaded on attempt ${attempt}, retrying...`
          );
          lastError = new Error(
            "The AI model is currently overloaded. Please try again in a moment."
          );

          if (attempt < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * attempt)
            );
            continue;
          }
        }

        if (!response.ok) {
          console.error("❌ Gemini Lesson API Error:", data);
          throw new Error(data.error?.message || "Gemini API request failed");
        }

        if (!data.candidates || data.candidates.length === 0) {
          throw new Error("AI did not generate lesson content");
        }

        content = data.candidates[0]?.content?.parts?.[0]?.text;

        if (!content) {
          throw new Error("AI response was empty");
        }

        // Success! Break out of retry loop
        console.log("✅ Lesson content generated successfully!");
        break;
      } catch (attemptError) {
        console.error(`❌ Attempt ${attempt} failed:`, attemptError.message);
        lastError = attemptError;

        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt)
          );
        }
      }
    }

    // If all retries failed, throw the last error
    if (!content) {
      throw lastError || new Error("Failed to generate lesson content");
    }

    // Generate a brief description
    let description = `Learn about ${title} for ${level} level`;

    try {
      const descriptionPrompt = `Based on this lesson content, write a brief 1-sentence description (max 100 characters):\n\n${content.substring(
        0,
        500
      )}`;

      const descResponse = await fetch(GEMINI_URL_CHAT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: descriptionPrompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 100,
          },
        }),
      });

      if (descResponse.ok) {
        const descData = await descResponse.json();
        const generatedDesc =
          descData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (generatedDesc) {
          description = generatedDesc
            .trim()
            .replace(/["']/g, "")
            .substring(0, 150);
        }
      }
    } catch (descError) {
      console.warn("⚠️ Could not generate description, using default");
    }

    res.json({
      success: true,
      content,
      description,
      duration: "20 min",
    });
  } catch (error) {
    console.error("AI Lesson Generation Error:", error.message);
    res.status(500).json({
      error: "Failed to generate lesson",
      details: error.message,
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
