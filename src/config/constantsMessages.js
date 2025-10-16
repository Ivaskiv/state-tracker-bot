//src/config/constantsMessages.js
import { SCHEDULE } from './constantsSchedule.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS } from './constantsQuestions.js';
import { CONSULTATION_OFFER } from './constantsCourses.js';

// DRY-хелпери
const INTRO = (n)=>`👋 Привіт, ${n}!\n\nЯ твій AI-мотиватор та коуч!`;
const FEATURES = `Допомагаю:
🎯 Ставити та досягати цілі
⚖️ Знаходити баланс у житті
💪 Підтримувати мотивацію
📈 Відслідковувати прогрес`;
const REG_SUMMARY = `🎉 Реєстрацію завершено!
🧪 Пробний доступ активовано на 7 днів.`;
const BALANCE_HINT = `Почни з 🛞 «Колеса балансу» — 8 сфер життя: щотижневий аудит + щоденні ранкова/вечірня рефлексії...`;

export const MESSAGES = Object.freeze({
  WELCOME: (userName)=>`${INTRO(userName)}\n\n${FEATURES}\n\nГотова розпочати?`,
  ASK_NAME: 'Як звертатись? (2–30 символів)',
  CONFIRM_NAME: (userName)=>`Залишити імʼя «${userName}» чи змінити?`,
  ASK_EMAIL: 'Вкажи e-mail (для звітів) або натисни «Пропустити».',
  ASK_PHONE: 'Залиши номер телефону (для звʼязку) або «Пропустити».',
  ASK_TZ: `⚠️ Вибери свій часовий пояс (ранкові о 08:00 за місц. часом).`,
  ASK_TIMEZONE: `⚠️ Вибери свій часовий пояс (ранкові о 08:00 за місц. часом).`,
  REG_SUCCESS: `${REG_SUMMARY}\n\nГотова почати?\n${BALANCE_HINT}`,
  TRIAL_ACTIVATED: `${REG_SUMMARY}\n\nГотова почати?`,
  ONBOARDING_NAME_CHOICE: (userName) =>
    `👋 Привіт, ${userName}!\n\n${FEATURES}\n\nЗалишити ім'я «${userName}» або ввести інше?`,

  WELCOME_BACK_ACTIVE: (userName, endStr, stats = {}) =>
    `👋 Привіт, ${userName}!\n\nЯ твій AI-мотиватор та коуч — твій особистий супутник у досягненні цілей! 🎯\n\n` +
    `✅ Підписка активна до ${endStr}\n\n` +
    `📊 **Твої досягнення:**\n` +
    `• 🔥 Streak: ${stats.currentStreak || 0} днів поспіль\n` +
    `• ✅ Виконано сесій: ${stats.completedSessions || 0}\n` +
    `• 🎯 Колесо балансу: ${stats.wheelCompleted ? '✅ Заповнено' : '❌ Не заповнено'}\n` +
    `• 📈 Прогрес по цілях: ${stats.goalProgress || 0}%\n\n` +
    `⏰ **Нагадування:**\n` +
    `• 🌞 Ранкова рефлексія — о ${SCHEDULE.MORNING_TIME}\n` +
    `• 🌙 Вечірня — о ${SCHEDULE.EVENING_TIME}\n` +
    `• 📊 Щотижневий звіт — щонеділі\n` +
    `• 🛞 Колесо — 1 числа місяця\n\n` +
    `💡 **Що можу для тебе зробити:**\n` +
    `• 🤖 AI-наставник — 24/7\n` +
    `• 🛞 Колесо балансу — аудит 8 сфер\n` +
    `• 📊 Мій прогрес — звіти\n` +
    `• 💎 Афірмація — щоденна мотивація\n\n` +
    `Обирай дію 👇`,

  WELCOME_BACK_INACTIVE: (userName, stats = {}) =>
    `👋 Привіт, ${userName}!\n\n` +
    `⚠️ **Підписка неактивна**\n` +
    `Щоб продовжити користуватись усіма можливостями, оформи підписку 💰\n\n` +
    `📊 **Досягнення:**\n` +
    `• 🔥 Streak: ${stats.currentStreak || 0} днів\n` +
    `• ✅ Сесій: ${stats.completedSessions || 0}\n` +
    `• 🛞 Колесо: ${stats.wheelCompleted ? '✅' : '❌'}\n\n` +
    `Доступно без підписки: статистика, оформлення підписки, зв'язок.`,

  REGISTRATION_INFO: (userData) =>
    `🎉 ВІТАЮ! РЕЄСТРАЦІЮ ЗАВЕРШЕНО!\n\n` +
    `👤 **Профіль:**\n` +
    `• Ім'я: ${userData.name}\n` +
    `• Email: ${userData.email || 'не вказано'}\n` +
    `• Телефон: ${userData.phone || 'не вказано'}\n` +
    `• Часовий пояс: ${userData.timezone}\n\n` +
    `🧪 Пробний період до: ${userData.endDate}\n\n` +
    `1️⃣ Колесо балансу → 2️⃣ Ранкова рефлексія → 3️⃣ AI-наставник 24/7`
});

export const REGISTRATION_SUCCESS_TEMPLATE =
`✅ Реєстрація успішна!
🧪 Пробний доступ активовано до {END_DATE}.

Користуйся меню:
• 🤖 AI наставник
• 🛞 Колесо балансу
• 📈 Звіти
• 💎 Афірмація 
• 📊 Мій прогрес 
• 💰 Підписка

🔔 Нагадування:
• 🌞 Ранок — ${SCHEDULE.MORNING_TIME}
• 🌙 Вечір — ${SCHEDULE.EVENING_TIME}
• 📈 Щотижневий — неділя
• 🛞 Колесо — 1 число`;

export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nПишіть на nadyastarway@gmail.com або дивіться інструкції в меню.`,
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n⏰ Відповідь: до 24 год.`,
  INSTRUCTIONS:
    `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n` +
    `⏰ Автоматичні питання:\n• ${SCHEDULE.MORNING_TIME} — ранок (${MORNING_QUESTIONS.length})\n• ${SCHEDULE.EVENING_TIME} — вечір (${EVENING_QUESTIONS.length})\n\n` +
    `Поради: відповідай щиро, переглядай звіти, пиши у «Зв'язок» при проблемах.`
});


export const MENU_BUTTONS = Object.freeze({
  AI_MENTOR: '🤖 AI наставник',
  WHEEL: '🎯 Колесо балансу',
  SUBSCRIPTION: '💰 Підписка',
  HELP: '❓ Допомога',
  PROGRESS: '📊 Мій прогрес',
  AFFIRMATION: '💎 Афірмація',
  INSTRUCTIONS: '📝 Інструкції',
  CONTACT: '📞 Зв\'язок'
});


