// src/utils/scheduler.js
import cron from "node-cron";
import { bot } from "../../server.js";
import airtableService from "../services/airtableService.js";

const TIMEZONE = "Europe/Kiev";

const morningQuestions = [
  "Хто я сьогодні?",
  "Яка я?",
  "Мої 10 цілей на рік",
  "На яку одну ціль я фокусуюсь сьогодні?",
  "Який мій стан сьогодні?",
  "Чому я гідна мати все це прямо зараз?"
];

const eveningQuestions = [
  "Що мене сьогодні наповнило енергією?",
  "Де я сьогодні злила енергію чи втратила стан?",
  "Яка програма або переконання активувалась сьогодні?",
  "З якої точки я діяла сьогодні: сили чи страху?",
  "Яка моя головна перемога сьогодні?"
];

const sendNextQuestion = async (user, type) => {
  const tgId = user.TG_id;
  const questions = type === "morning" ? morningQuestions : eveningQuestions;
  const fieldIndex = type === "morning" ? "currentQuestionIndex_morning" : "currentQuestionIndex_evening";

  let currentIndex = user[fieldIndex] || 0;
  if (currentIndex >= questions.length) return;

  await bot.telegram.sendMessage(tgId, questions[currentIndex]);
  await airtableService.updateUser(user.recordId, { [fieldIndex]: currentIndex + 1 });
};

const checkAndSendMissedQuestions = async () => {
  try {
    const now = new Date();
    const hour = now.getHours();
    const activeUsers = await airtableService.getActiveUsers();

    for (const user of activeUsers) {
      if (hour >= 8 && (user.currentQuestionIndex_morning || 0) < morningQuestions.length) {
        await sendNextQuestion(user, "morning");
        console.log(`📩 Пропущене ранкове питання надіслано користувачу ${user.TG_id}`);
      }

      if (hour >= 20 && (user.currentQuestionIndex_evening || 0) < eveningQuestions.length) {
        await sendNextQuestion(user, "evening");
        console.log(`📩 Пропущене вечірнє питання надіслано користувачу ${user.TG_id}`);
      }
    }
  } catch (err) {
    console.error("❌ Помилка при перевірці пропущених питань:", err.message);
  }
};

export const initScheduler = () => {
  // Перевірка пропущених питань при старті
  checkAndSendMissedQuestions();

  // Ранкові повідомлення – для тесту через 5 хв після старту сервера
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  const testMinute = now.getMinutes();
  const testHour = now.getHours();

  cron.schedule(`${testMinute} ${testHour} * * *`, async () => {
    const activeUsers = await airtableService.getActiveUsers();
    for (const user of activeUsers) {
      await sendNextQuestion(user, "morning");
    }
    console.log(`✅ Тестові ранкові питання надіслано ${activeUsers.length} користувачам`);
  }, { timezone: TIMEZONE });

  // Вечірні питання о 20:30
  cron.schedule("30 20 * * *", async () => {
    const activeUsers = await airtableService.getActiveUsers();
    for (const user of activeUsers) {
      await sendNextQuestion(user, "evening");
    }
    console.log(`✅ Вечірні питання надіслано ${activeUsers.length} користувачам`);
  }, { timezone: TIMEZONE });
};
