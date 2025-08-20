// src/utils/scheduler.js
import cron from "node-cron";
import { bot } from "../../server.js";

export const questionsData = {
  morning: [
    "1️⃣ Хто я сьогодні?",
    "2️⃣ Яка я?",
    "3️⃣ Мої 10 цілей на рік",
    "4️⃣ На яку одну ціль я фокусуюсь сьогодні?",
    "5️⃣ Який мій стан сьогодні?",
    "6️⃣ Чому я гідна мати все це прямо зараз?"
  ],
  evening: [
    "1️⃣ Що мене сьогодні наповнило енергією?",
    "2️⃣ Де я сьогодні злила енергію чи втратила стан?",
    "3️⃣ Яка програма або переконання активувалась сьогодні?",
    "4️⃣ З якої точки я діяла сьогодні: сили чи страху?",
    "5️⃣ Яка моя головна перемога сьогодні?"
  ]
};

// Функція для старту питань для конкретного користувача
export async function startQuestions(ctx, type) {
  const tgId = ctx.from.id;

  if (!ctx.session) ctx.session = {};
  ctx.session.questionType = type;
  ctx.session.currentQuestion = 0;
  ctx.session.questions = questionsData[type];

  await ctx.reply(`📩 ${type === "morning" ? "Ранкові" : "Вечірні"} питання надіслані! Відповідайте по черзі.`);
  await ctx.reply(ctx.session.questions[0]);
}

export const initScheduler = () => {
  // 08:00 ранкові
  cron.schedule("0 8 * * *", async () => {
    console.log("🕗 Надсилання ранкових питань (усім користувачам)");
    // тут можна додати логіку для всіх активних користувачів
  });

  // 20:30 вечірні
  cron.schedule("30 20 * * *", async () => {
    console.log("🕣 Надсилання вечірніх питань (усім користувачам)");
    // тут можна додати логіку для всіх активних користувачів
  });
};
