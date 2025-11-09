require("dotenv").config();
const mongoose = require("mongoose");

// MongoDB connection
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/english-test";

mongoose
  .connect(MONGO_URI)
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

// Default lessons data
const defaultLessons = [
  {
    id: "lesson-1",
    title: "The English Alphabet",
    category: "Basics",
    level: "Beginner",
    description:
      "Learn all 26 letters of the English alphabet with pronunciation",
    content: `# The English Alphabet

## Overview
The English alphabet has 26 letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z

## Vowels
There are 5 vowels: **A, E, I, O, U**

## Consonants
The remaining 21 letters are consonants.

## Practice
Try to write the alphabet in both uppercase and lowercase:
- Uppercase: A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
- Lowercase: a b c d e f g h i j k l m n o p q r s t u v w x y z`,
    duration: "10 min",
    isDefault: true,
  },
  {
    id: "lesson-2",
    title: "Greetings and Introductions",
    category: "Speaking",
    level: "Beginner",
    description: "Common phrases for greeting people and introducing yourself",
    content: `# Greetings and Introductions

## Basic Greetings
- **Hello!** / **Hi!** - Salom!
- **Good morning!** - Xayrli tong!
- **Good afternoon!** - Xayrli kun!
- **Good evening!** - Xayrli kech!
- **Goodbye!** / **Bye!** - Xayr!

## Introductions
- **My name is...** - Mening ismim...
- **I am from...** - Men ...dan keldim
- **Nice to meet you!** - Tanishganimdan xursandman!
- **How are you?** - Qalaysiz?
- **I'm fine, thank you!** - Yaxshi, rahmat!`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-3",
    title: "Numbers 1-100",
    category: "Basics",
    level: "Beginner",
    description: "Learn to count from 1 to 100 in English",
    content: `# Numbers in English

## Numbers 1-10
1 - one, 2 - two, 3 - three, 4 - four, 5 - five
6 - six, 7 - seven, 8 - eight, 9 - nine, 10 - ten

## Numbers 11-20
11 - eleven, 12 - twelve, 13 - thirteen, 14 - fourteen, 15 - fifteen
16 - sixteen, 17 - seventeen, 18 - eighteen, 19 - nineteen, 20 - twenty

## Tens
20 - twenty, 30 - thirty, 40 - forty, 50 - fifty
60 - sixty, 70 - seventy, 80 - eighty, 90 - ninety, 100 - one hundred`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-4",
    title: "Colors",
    category: "Vocabulary",
    level: "Beginner",
    description: "Essential color vocabulary in English",
    content: `# Colors in English

## Basic Colors
- **Red** - Qizil
- **Blue** - Ko'k
- **Green** - Yashil
- **Yellow** - Sariq
- **Black** - Qora
- **White** - Oq
- **Orange** - To'q sariq
- **Purple** - Binafsha
- **Pink** - Pushti
- **Brown** - Jigarrang
- **Gray** - Kulrang

## Practice Sentences
- The sky is **blue**
- The grass is **green**
- The sun is **yellow**`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-5",
    title: "Days of the Week and Months",
    category: "Basics",
    level: "Beginner",
    description: "Learn the days of the week and months of the year",
    content: `# Days and Months

## Days of the Week
- **Monday** - Dushanba
- **Tuesday** - Seshanba
- **Wednesday** - Chorshanba
- **Thursday** - Payshanba
- **Friday** - Juma
- **Saturday** - Shanba
- **Sunday** - Yakshanba

## Months of the Year
January, February, March, April, May, June,
July, August, September, October, November, December`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-6",
    title: "Family Members",
    category: "Vocabulary",
    level: "Beginner",
    description: "Vocabulary for talking about family",
    content: `# Family Vocabulary

## Immediate Family
- **Mother/Mom** - Ona
- **Father/Dad** - Ota
- **Sister** - Opa/Singil
- **Brother** - Aka/Uka
- **Daughter** - Qiz
- **Son** - O'g'il

## Extended Family
- **Grandmother** - Buvi
- **Grandfather** - Bobo
- **Aunt** - Xola/Amma
- **Uncle** - Amaki/Tog'a
- **Cousin** - Amakivachcha`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-7",
    title: "Common Food and Drinks",
    category: "Vocabulary",
    level: "Beginner",
    description: "Essential food and beverage vocabulary",
    content: `# Food and Drinks

## Food
- **Bread** - Non
- **Rice** - Guruch
- **Meat** - Go'sht
- **Fish** - Baliq
- **Egg** - Tuxum
- **Apple** - Olma
- **Banana** - Banan

## Drinks
- **Water** - Suv
- **Tea** - Choy
- **Coffee** - Qahva
- **Milk** - Sut
- **Juice** - Sharbat`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-8",
    title: "Animals",
    category: "Vocabulary",
    level: "Beginner",
    description: "Common animal names in English",
    content: `# Animals

## Pets
- **Dog** - It
- **Cat** - Mushuk
- **Bird** - Qush
- **Fish** - Baliq

## Farm Animals
- **Cow** - Sigir
- **Horse** - Ot
- **Chicken** - Tovuq
- **Sheep** - Qo'y

## Wild Animals
- **Lion** - Sher
- **Tiger** - Yo'lbars
- **Elephant** - Fil
- **Bear** - Ayiq`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-9",
    title: "Common Verbs",
    category: "Grammar",
    level: "Beginner",
    description: "Most frequently used English verbs",
    content: `# Common Verbs

## Basic Actions
- **be** - bo'lmoq
- **have** - ega bo'lmoq
- **do** - qilmoq
- **go** - bormoq
- **get** - olmoq
- **make** - yasmoq
- **see** - ko'rmoq
- **come** - kelmoq
- **take** - olmoq
- **know** - bilmoq

## Daily Actions
- **eat** - yemoq
- **drink** - ichmoq
- **sleep** - uxlamoq
- **walk** - yurmoq
- **run** - yugurmfoq
- **sit** - o'tirmoq
- **stand** - turmoq`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-10",
    title: "Question Words",
    category: "Grammar",
    level: "Beginner",
    description: "Learn to ask questions in English",
    content: `# Question Words

## The 5 W's and How
- **What** - Nima?
- **Where** - Qayer?
- **When** - Qachon?
- **Who** - Kim?
- **Why** - Nega?
- **How** - Qanday?

## Example Questions
- **What** is your name?
- **Where** are you from?
- **When** is your birthday?
- **Who** is your teacher?
- **Why** are you learning English?
- **How** old are you?`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-11",
    title: "Present Simple Tense",
    category: "Grammar",
    level: "Beginner",
    description: "Learn the most basic English tense",
    content: `# Present Simple Tense

## Structure
**Subject + Verb (base form)**

## Positive Sentences
- I **work**
- You **work**
- He/She/It **works** (add -s)
- We **work**
- They **work**

## Negative Sentences
- I **do not** (don't) **work**
- He **does not** (doesn't) **work**

## Questions
- **Do** you work?
- **Does** he work?

## Examples
- I **live** in Tashkent
- She **likes** English
- They **play** football`,
    duration: "25 min",
    isDefault: true,
  },
  {
    id: "lesson-12",
    title: "Shopping Phrases",
    category: "Speaking",
    level: "Beginner",
    description: "Essential phrases for shopping",
    content: `# Shopping English

## At the Store
- **How much is this?** - Bu qancha?
- **I would like to buy...** - Men ... sotib olmoqchiman
- **Do you have...?** - Sizda ... bormi?
- **Can I try this on?** - Buni kiyib ko'rsam bo'ladimi?
- **I'll take it** - Buni olaman
- **That's too expensive** - Bu juda qimmat

## Payment
- **Can I pay by card?** - Karta bilan to'lasam bo'ladimi?
- **Do you accept cash?** - Naqd pul qabul qilasizmi?
- **Here's the money** - Mana pul`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-13",
    title: "Telling Time",
    category: "Basics",
    level: "Beginner",
    description: "Learn to tell time in English",
    content: `# Telling Time

## Hours
- It's **one o'clock** - Soat bir
- It's **two o'clock** - Soat ikki

## Minutes
- It's **quarter past** one - Bir yarim
- It's **half past** two - Ikki yarim
- It's **quarter to** three - Uchga chorak qoldi

## Time Expressions
- **in the morning** - ertalab
- **in the afternoon** - kunduzi
- **in the evening** - kechqurun
- **at night** - kechasi

## Examples
- It's **10:30** (ten thirty)
- It's **3:15** (three fifteen / quarter past three)`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-14",
    title: "Weather Vocabulary",
    category: "Vocabulary",
    level: "Beginner",
    description: "Talk about weather conditions",
    content: `# Weather

## Weather Conditions
- **Sunny** - Quyoshli
- **Rainy** - Yomg'irli
- **Cloudy** - Bulutli
- **Windy** - Shamollisnowy** - Qorli
- **Hot** - Issiq
- **Cold** - Sovuq
- **Warm** - Iliq
- **Cool** - Salqin

## Asking About Weather
- **What's the weather like?** - Ob-havo qanday?
- **How's the weather?** - Havo qalaykan?
- **Is it raining?** - Yomg'ir yogyaptimi?

## Example Sentences
- It's **sunny** today
- It was **cold** yesterday
- It will be **hot** tomorrow`,
    duration: "15 min",
    isDefault: true,
  },
  {
    id: "lesson-15",
    title: "At the Restaurant",
    category: "Speaking",
    level: "Beginner",
    description: "Ordering food and drinks at restaurants",
    content: `# Restaurant English

## Arriving
- **Table for two, please** - Ikki kishi uchun stol
- **Do you have a reservation?** - Bron qildingizmi?

## Ordering
- **I'd like...** - Men ... olmoqchiman
- **Can I have...?** - Menga ... berasizmi?
- **What do you recommend?** - Nima tavsiya qilasiz?
- **I'm vegetarian** - Men vegetarianman

## During the Meal
- **This is delicious!** - Bu juda mazali!
- **Can I have the bill, please?** - Hisobni bera olasizmi?
- **Keep the change** - Qaytimni oling`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-16",
    title: "Asking for Directions",
    category: "Speaking",
    level: "Beginner",
    description: "How to ask for and give directions",
    content: `# Directions

## Asking for Directions
- **Excuse me, where is...?** - Kechirasiz, ... qayerda?
- **How do I get to...?** - ... ga qanday boraman?
- **Is it far from here?** - Bu yerdan uzoqmi?

## Giving Directions
- **Go straight** - To'g'ri boring
- **Turn left/right** - Chapga/o'ngga buriling
- **It's on your left/right** - Chap/o'ng tomoningizda
- **It's next to...** - ... yonida
- **It's opposite...** - ... qarshisida

## Distance
- **It's 5 minutes walk** - 5 daqiqa piyoda
- **It's 2 blocks away** - 2 blok narida`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-17",
    title: "Hobbies and Free Time",
    category: "Speaking",
    level: "Beginner",
    description: "Talk about your hobbies and interests",
    content: `# Hobbies and Free Time

## Common Hobbies
- **Reading** - Kitob o'qish
- **Watching movies** - Kino tomosha qilish
- **Playing sports** - Sport bilan shug'ullanish
- **Listening to music** - Musiqa tinglash
- **Cooking** - Ovqat tayyorlash
- **Drawing/Painting** - Rasm chizish
- **Photography** - Fotografiya

## Talking About Hobbies
- **What do you like to do?** - Nima qilishni yoqtirasiz?
- **I like...** / **I love...** - Men... yoqtiraman
- **I enjoy...** - Men... dan zavqlanaman
- **In my free time, I...** - Bo'sh vaqtimda men...

## Examples
- I **like** reading books
- I **love** playing football
- I **enjoy** cooking`,
    duration: "20 min",
    isDefault: true,
  },
  {
    id: "lesson-18",
    title: "Past Simple Tense",
    category: "Grammar",
    level: "Intermediate",
    description: "Learn to talk about past events",
    content: `# Past Simple Tense

## Regular Verbs
Add **-ed** to the base verb:
- work → work**ed**
- play → play**ed**
- like → lik**ed**

## Irregular Verbs
These change completely:
- go → **went**
- see → **saw**
- eat → **ate**
- do → **did**
- have → **had**
- make → **made**

## Negative
- I **did not** (didn't) work
- She **didn't** go

## Questions
- **Did** you work?
- **Did** she go?

## Examples
- I **worked** yesterday
- They **went** to the park
- She **didn't** come to the party`,
    duration: "30 min",
    isDefault: true,
  },
  {
    id: "lesson-19",
    title: "Present Continuous Tense",
    category: "Grammar",
    level: "Intermediate",
    description: "Actions happening now",
    content: `# Present Continuous

## Structure
**Subject + am/is/are + verb-ing**

## Positive
- I **am working**
- You/We/They **are working**
- He/She/It **is working**

## Negative
- I **am not** (I'm not) working
- He **is not** (isn't) working
- They **are not** (aren't) working

## Questions
- **Am** I working?
- **Is** he working?
- **Are** they working?

## Uses
1. Actions happening NOW
   - I **am studying** right now
2. Temporary situations
   - She **is living** in London this year
3. Future plans
   - We **are meeting** tomorrow

## Examples
- I **am reading** a book
- They **are playing** football
- She **is cooking** dinner`,
    duration: "30 min",
    isDefault: true,
  },
  {
    id: "lesson-20",
    title: "Conditionals and Phrasal Verbs",
    category: "Grammar",
    level: "Advanced",
    description: "Complex grammar structures",
    content: `# Advanced Grammar

## First Conditional (Real Future)
**If + present simple, will + base verb**
- If it **rains**, I **will stay** home
- If you **study**, you **will pass**

## Second Conditional (Unreal Present)
**If + past simple, would + base verb**
- If I **had** money, I **would travel**
- If she **were** here, she **would help**

## Common Phrasal Verbs

### With "up"
- **wake up** - turmoq
- **give up** - taslim bo'lmoq
- **look up** - qidirmoq (lug'atda)
- **pick up** - ko'tarmoq/olmoq

### With "out"
- **find out** - bilib olmoq
- **work out** - mashq qilmoq
- **figure out** - tushunmoq
- **run out** - tugamoq

### With "on/off"
- **turn on** - yoqmoq
- **turn off** - o'chirmoq
- **put on** - kiymoq
- **take off** - yechmoq/uchib ketmoq

## Practice
Fill in with conditionals:
1. If it rains, I __________ (stay) home
2. If I had a car, I __________ (travel) more
3. If you had helped, we __________ (finish) earlier
4. If water freezes, it __________ (become) ice

Replace with phrasal verbs:
1. She removed her shoes → She __________ her shoes
2. I met John accidentally → I __________ John
3. Please submit your homework → Please __________ your homework
4. Don't quit! → Don't __________!

**Answers:**
Conditionals: 1) will stay 2) would travel 3) would have helped 4) freezes (becomes)
Phrasal Verbs: 1) took off 2) ran into 3) hand in 4) give up`,
    duration: "45 min",
    isDefault: true,
  },
  {
    id: "lesson-21",
    title: "Modal Verbs Dictionary",
    category: "Dictionary",
    level: "Intermediate",
    description:
      "Complete guide to English modal verbs with examples and usage",
    content: `# Modal Verbs - Complete Dictionary

Modal verbs are special verbs that express ability, possibility, permission, or obligation. They don't change form and are always followed by the base form of a verb.

## CAN / COULD

### CAN (present)
**Ability:** "I **can** speak English"
**Permission:** "**Can** I use your phone?"
**Possibility:** "It **can** be very cold in winter"
**Request:** "**Can** you help me?"

### COULD (past/polite)
**Past ability:** "I **could** swim when I was 5"
**Polite request:** "**Could** you pass the salt, please?"
**Possibility:** "It **could** rain tomorrow"
**Suggestion:** "We **could** go to the cinema"

**Examples:**
- I can drive a car (men mashina haydashim mumkin)
- Could you speak louder? (balandroq gapira olasizmi?)
- She could play piano when she was young (u yoshligida pianino chalib edi)

---

## MAY / MIGHT

### MAY
**Permission (formal):** "**May** I ask a question?"
**Possibility:** "It **may** snow tomorrow"
**Wish:** "**May** you have a happy life!"

### MIGHT
**Lower possibility:** "I **might** be late" (ehtimol kechikaman)
**Past possibility:** "He **might** have forgotten"
**Polite suggestion:** "You **might** want to check this"

**Examples:**
- May I come in? (kirsam bo'ladimi? - rasmiy)
- It might rain (yomg'ir yog'ishi mumkin - kichik ehtimol)
- You may leave now (endi ketishingiz mumkin)

---

## MUST / HAVE TO

### MUST
**Strong obligation:** "You **must** wear a seatbelt"
**Strong recommendation:** "You **must** see this movie!"
**Logical conclusion:** "He **must** be tired" (u charchagan bo'lishi kerak)

### HAVE TO
**Obligation (external):** "I **have to** work tomorrow"
**Necessity:** "We **have to** catch the 6 PM train"

**Negative difference:**
- **Mustn't** = prohibition (You mustn't smoke here - bu yerda chekish mumkin emas)
- **Don't have to** = no obligation (You don't have to come - kelmasangiz ham bo'ladi)

**Examples:**
- I must finish this today (bugun tugatishim shart)
- You must be joking! (hazil qilyapsiz shekilli!)
- I have to wake up early (ertaga erta turish kerak)
- You don't have to wait (kutmasangiz ham bo'ladi)

---

## SHOULD / OUGHT TO

### SHOULD
**Advice:** "You **should** see a doctor"
**Recommendation:** "You **should** try this restaurant"
**Expectation:** "He **should** be here by now"
**Regret (past):** "I **should have** studied harder"

### OUGHT TO (formal)
Same meaning as should but more formal
**Advice:** "You **ought to** apologize"
**Probability:** "She **ought to** pass the exam"

**Examples:**
- You should eat healthy food (sog'lom ovqat yeyishingiz kerak)
- I should have called you (sizga qo'ng'iroq qilishim kerak edi)
- We ought to help them (ularga yordam berishimiz kerak)

---

## WILL / WOULD

### WILL
**Future:** "I **will** call you tomorrow"
**Promise:** "I **will** help you"
**Instant decision:** "I **will** have tea, please"
**Prediction:** "It **will** rain"
**Request:** "**Will** you marry me?"

### WOULD
**Polite request:** "**Would** you like some coffee?"
**Past habit:** "I **would** play here as a child"
**Conditional:** "I **would** buy it if I had money"
**Preference:** "I **would** rather stay home"

**Examples:**
- I will be there at 5 PM (soat 5 da bo'laman)
- Would you like to dance? (raqsga tushmoqchimisiz?)
- I would go if I could (imkonim bo'lsa borardim)

---

## SHALL

**Suggestion (questions):** "**Shall** we dance?"
**Offer:** "**Shall** I help you?"
**Future (formal/British):** "I **shall** return"

**Examples:**
- Shall we go? (boramizmi?)
- Shall I open the window? (derazani ochayinmi?)

---

## Summary Table

| Modal | Main Use | Example | Uzbek |
|-------|----------|---------|-------|
| **can** | ability | I can swim | men suzaman |
| **could** | past ability/polite | Could you help? | yordam bera olasizmi? |
| **may** | permission/possibility | May I leave? | ketsam bo'ladimi? |
| **might** | possibility (less certain) | It might rain | yomg'ir yog'ishi mumkin |
| **must** | strong obligation | You must stop | to'xtashingiz shart |
| **have to** | obligation | I have to go | borishim kerak |
| **should** | advice | You should rest | dam olishingiz kerak |
| **will** | future | I will come | men kelaman |
| **would** | polite/conditional | Would you help? | yordam bera olasizmi? |

## Practice Exercises

Choose the correct modal:
1. I _____ speak three languages. (can/must)
2. You _____ smoke here. It's forbidden. (mustn't/don't have to)
3. _____ you help me with this? (Could/Must)
4. It _____ rain tomorrow. (should/might)
5. I _____ have called earlier. Sorry! (should/can)

**Answers:** 1) can 2) mustn't 3) Could 4) might 5) should`,
    duration: "30 min",
    isDefault: true,
  },
];

// Seed function
async function seedLessons() {
  try {
    console.log("🌱 Starting to seed lessons...");

    // Clear existing default lessons
    await Lesson.deleteMany({ isDefault: true });
    console.log("🗑️  Cleared existing default lessons");

    // Insert all default lessons
    const inserted = await Lesson.insertMany(defaultLessons);
    console.log(`✅ Successfully seeded ${inserted.length} lessons!`);

    // Display inserted lessons
    inserted.forEach((lesson, index) => {
      console.log(
        `${index + 1}. ${lesson.title} (${lesson.level} - ${lesson.category})`
      );
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding lessons:", error);
    process.exit(1);
  }
}

// Run seed
seedLessons();
