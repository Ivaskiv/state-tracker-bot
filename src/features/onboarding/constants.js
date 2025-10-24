import { CONFIG, TIMEZONES as TZ_LIST, getTzLabel, SCHEDULE, USER_STATUS } from '../../config/constants.js';

import {
  validateName,
  validateEmail,
  validatePhone,
  validateTimezone,
  formatName,
  formatEmail,
  formatPhone
} from '../../utils/validators.js';
import { EVENING_QUESTIONS, MORNING_QUESTIONS } from '../dailySessions/constantsQuestions.js';

export const STEPS = Object.freeze({
  PITCH: 'pitch',
  NAME: 'name',
  EMAIL: 'email',
  PHONE: 'phone',
  TIMEZONE: 'timezone',
  PLAN: 'plan',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_SUCCESS: 'payment_success',
  REMINDERS_INTRO: 'reminders_intro',
  DONE: 'done',
});

export const STATES = {
  IDLE: 'idle',
  PITCH: STEPS.PITCH,
  ASKING_NAME: STEPS.NAME,
  ASKING_EMAIL: STEPS.EMAIL,
  ASKING_PHONE: STEPS.PHONE,
  ASKING_TIMEZONE: STEPS.TIMEZONE,
  ASKING_SUBSCRIPTION: STEPS.PLAN,
  PAYMENT_PENDING: STEPS.PAYMENT_PENDING,
  PAYMENT_SUCCESS: STEPS.PAYMENT_SUCCESS,
  COMPLETED: STEPS.DONE,
};

const INTRO = (n) => `👋 Привіт, ${n}!\n\nЯ твій AI-мотиватор та коуч!`;
const FEATURES = `Допомагаю:
🎯 Ставити та досягати цілі
⚖️ Знаходити баланс у житті
💪 Підтримувати мотивацію
📈 Відслідковувати прогрес`;
const REG_SUMMARY = `🎉 Реєстрацію завершено!
🧪 Пробний доступ активовано на 7 днів.`;
const BALANCE_HINT = `Почни з 🛞 «Колеса балансу» — 8 сфер життя: щотижневий аудит + щоденні ранкова/вечірня рефлексії...`;

export const MESSAGES = Object.freeze({
  WELCOME: (userName) => `${INTRO(userName)}\n\n${FEATURES}\n\nГотова розпочати?`,
  ASK_NAME: 'Як звертатись? (2–30 символів)',
  CONFIRM_NAME: (userName) => `Залишити імʼя «${userName}» чи змінити?`,
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
    `• 🧭 Фокус дня — щоденна мотивація\n\n` +
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
    `1️⃣ Колесо балансу → 2️⃣ Ранкова рефлексія → 3️⃣ AI-наставник 24/7`,
  INVALID_NAME: `❌ Ім'я має бути ${CONFIG.NAME_MIN_LENGTH}–${CONFIG.NAME_MAX_LENGTH} символів. Спробуй ще раз:`,
  INVALID_EMAIL: '❌ Некоректний email. Приклад: user@example.com',
  INVALID_PHONE: '❌ Формат: +380XXXXXXXXX (9 цифр після +380). Спробуй ще раз:',
});

export const REGISTRATION_SUCCESS_TEMPLATE =
`✅ Реєстрація успішна!
🧪 Пробний доступ активовано до {END_DATE}.

Користуйся меню:
• 🤖 AI наставник
• 🛞 Колесо балансу
• 📈 Звіти
• 🧭 Фокус дня 
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
  AFFIRMATION: '🧭 Фокус дня',
  INSTRUCTIONS: '📝 Інструкції',
  CONTACT: '📞 Зв\'язок'
});

export const CALLBACKS = {
  START_REGISTRATION: 'start_registration',
  SKIP_REGISTRATION: 'skip_registration',
  CONFIRM_NAME: 'confirm_name',
  CHANGE_NAME: 'change_name',
  SKIP_NAME: 'skip_name',
  SKIP_EMAIL: 'skip_email',
  BACK_EMAIL: 'back_email',
  SKIP_PHONE: 'skip_phone',
  BACK_PHONE: 'back_phone',
  TZ_PREFIX: 'tz_',
  TRIAL: 'trial',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
  NO_SUBSCRIPTION: 'no_subscription',
};

const isSkip = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s === '/skip' || s === 'пропустити';
};

export const VALIDATORS = {
  name: (v) => validateName(v),
  email: (v) => (isSkip(v) ? { valid: true, value: null, isEmpty: true } : validateEmail(v)),
  phone: (v) => (isSkip(v) ? { valid: true, value: null, isEmpty: true } : validatePhone(v)),
  timezone: (v) => validateTimezone(v),
};

export const PROCESSORS = {
  name: (v) => formatName(v),
  email: (v) => (isSkip(v) ? null : formatEmail(v)),
  phone: (v) => (isSkip(v) ? null : formatPhone(v)),
  timezone: (v) => String(v || '').trim(),
  plan: (v) => String(v || '').trim(),
};

export const VALIDATION = {
  NAME: { MIN: CONFIG.NAME_MIN_LENGTH, MAX: CONFIG.NAME_MAX_LENGTH },
  EMAIL: { MAX: CONFIG.EMAIL_MAX_LENGTH },
  PHONE: { REGEX: CONFIG.PHONE_REGEX, FORMAT: '+380XXXXXXXXX' },
};

export const TIMEZONE = {
  ALL: TZ_LIST,
  DEFAULT: CONFIG.DEFAULT_TIMEZONE,
  label: (slug) => getTzLabel(slug),
};

export const BUTTONS = {
  CONFIRM_YES: '✅ Так',
  CONFIRM_NO: '❌ Ні',
  SKIP: '⏭️ Пропустити',
  BACK: '🔙 Назад',
  CHANGE: '✏️ Змінити',
  TRIAL: '🧪 Пробний (0€)',
  WEEK: '📅 Тиждень (7€)',
  MONTH: '🎯 Місяць (30€)',
  YEAR: '⭐ Рік (300€)',
  NO_SUBSCRIPTION: '⏭️ Без підписки',
  START: '✅ Розпочати',
  LATER: '⏭️ Пізніше',
};

export const SCHEDULE_CONFIG = {
  MORNING_TIME: SCHEDULE.MORNING_TIME,
  EVENING_TIME: SCHEDULE.EVENING_TIME,
  TIMEZONE: SCHEDULE.TIMEZONE,
  TRIAL_DAYS: 7,
};

export const ERRORS = {
  USER_NOT_FOUND: '❌ Користувач не знайдено. Спробуй /start',
  DATABASE_ERROR: '❌ Помилка бази даних. Спробуй пізніше',
  VALIDATION_ERROR: '❌ Дані не відповідають формату',
  UNKNOWN_ERROR: '❌ Невідома помилка. Спробуй ще раз',
  INVALID_FORMAT: '❌ Невірний формат. Спробуй ще раз',
};

export const USER_STATUS_MAP = {
  NEW: USER_STATUS.NEW,
  REGISTERED: USER_STATUS.REGISTERED,
  ACTIVE: USER_STATUS.ACTIVE,
};

export const MENU = MENU_BUTTONS;
