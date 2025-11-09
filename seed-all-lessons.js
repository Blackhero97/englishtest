require("dotenv").config();
const mongoose = require("mongoose");
const { defaultLessons } = require("./defaultLessonsData.js");

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/english-test";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected for seeding"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

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

// Seed function
async function seedAllLessons() {
  try {
    console.log(`🌱 Starting to seed ${defaultLessons.length} lessons...`);

    // Clear existing default lessons
    const deleted = await Lesson.deleteMany({ isDefault: true });
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing default lessons`);

    // Insert all default lessons
    const inserted = await Lesson.insertMany(defaultLessons);
    console.log(`✅ Successfully seeded ${inserted.length} lessons!`);

    console.log("\n📚 Lessons by category:");
    const categories = {};
    inserted.forEach((lesson) => {
      if (!categories[lesson.category]) {
        categories[lesson.category] = [];
      }
      categories[lesson.category].push(lesson);
    });

    Object.keys(categories).forEach((category) => {
      console.log(`\n${category} (${categories[category].length}):`);
      categories[category].forEach((lesson, index) => {
        console.log(`  ${index + 1}. ${lesson.title} (${lesson.level})`);
      });
    });

    console.log(`\n✅ Total: ${inserted.length} lessons successfully seeded!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding lessons:", error);
    process.exit(1);
  }
}

// Run seed
seedAllLessons();
