// src/features/registration/constants.js
import { CONFIG, TIMEZONES as TZ_LIST, getTzLabel, SCHEDULE, USER_STATUS } from '../../config/constants.js';

import {
  validateName,
  validateEmail,
  validatePhone,
  validateTimezone,
  formatName,
  formatEmail,
  formatPhone,
} from '../../utils/validators.js';

import { EVENING_QUESTIONS, MORNING_QUESTIONS } from '../dailySessions/constants.js';

// ───────────────────────────────────────────────────────────────────────────────
// КРОКИ/СТАНИ
// ───────────────────────────────────────────────────────────────────────────────
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

export const STATES = Object.freeze({
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
});

// ───────────────────────────────────────────────────────────────────────────────
// ТЕКСТИ
// ───────────────────────────────────────────────────────────────────────────────
const INTRO = (n) => `👋 Привіт, ${n}!\n\nЯ твій AI-мотиватор та коуч!`;
const FEATURES =
  `Допомагаю:\n` +
  `🎯 Ставити та досягати цілі\n` +
  `⚖️ Знаходити баланс у житті\n` +
  `💪 Підтримувати мотивацію\n` +
  `📈 Відслідковувати прогрес`;
const REG_SUMMARY =
  `🎉 Реєстрацію завершено!\n` +
  `🧪 Пробний доступ активовано на 7 днів.`;
const BALANCE_HINT =
  `Почни з 🛞 «Колеса балансу» — 8 сфер життя: щомісячний аудит + щоденні ранкова/вечірня рефлексії…`;

// 🔥 ДОВГИЙ МАРКЕТИНГОВИЙ PITCH ДЛЯ TILDA/НОВИХ
export const PITCH_TILDA =
`👋 Вітаю!
Програма створена для тебе, якщо:
Ти — експерт, коуч, психолог, підприємець чи просто жінка 25–45, якій потрібна структура, фокус і підтримка, щоб діяти щодня.

Протягом 7 днів ти отримуватимеш у Telegram короткі запитання та мікрозавдання, щоб:
• вийти зі стану застою  
• повернути ясність і фокус  
• перейти від «почала — зупинилась» до стабільної дії

🤖 Твої відповіді аналізує AI-наставник і формує персональні інсайти, підсумки та наступні кроки.
⏰ Нагадування приходять у твоєму часовому поясі. Увесь прогрес зберігається.

Що всередині:
• 🎡 Щомісячне «Колесо балансу» + пріоритети на місяць  
• 📅 Щотижневий аналіз із коротким підсумком  
• 🌞🌙 Щоденні ранкові/вечірні сесії з мікрозавданнями  
• 💎 Афірмації, гейміфікація (життя, таймер, прогрес), статистика

🔥 Почни з Колеса балансу — яке відкриє доступ до наступних завдань.

🕐 P.S. У тебе є 48 годин, щоб пройти Колесо балансу — далі безкоштовний доступ закриється, а бонуси згорять.`;

// Основні повідомлення онбордингу та повернення
export const MESSAGES = Object.freeze({
  WELCOME: (userName) => `${INTRO(userName)}\n\n${FEATURES}\n\nГотова розпочати?`,

  ASK_NAME: 'Як звертатись? (2–30 символів)',
  CONFIRM_NAME: (userName) => `Залишити імʼя «${userName}» чи змінити?`,
  ASK_EMAIL: 'Вкажи e-mail (для звітів) або натисни «Пропустити».',
  ASK_PHONE: 'Залиши номер телефону (для звʼязку) або «Пропустити».',
  ASK_TIMEZONE: `⚠️ Вибери свій часовий пояс (ранкові о 08:00 за місц. часом).`,

  REG_SUCCESS: `${REG_SUMMARY}\n\nГотова почати?\n${BALANCE_HINT}`,
  TRIAL_ACTIVATED: `${REG_SUMMARY}\n\nГотова почати?`,

  ONBOARDING_NAME_CHOICE: (userName) =>
    `👋 Вітаю, ${userName}!\n\n${FEATURES}\n\nЗалишити ім'я «${userName}» або ввести інше?`,

  // Повернення користувача
  WELCOME_BACK_ACTIVE: (userName, endDate, stats) =>
    `👋 Рада вітати тебе знову, ${userName}!\n\n` +
    `Ось коротко про твої справи:\n\n` +
    `🛞 Колесо балансу — ${stats.wheelStatus}\n` +
    `🔥 Активність — ${stats.streakText}\n` +
    `📊 Остання сесія — ${stats.lastSessionDate}\n` +
    `💰 Підписка — ✅ Активна до ${endDate}`,

  WELCOME_BACK_INACTIVE: (userName, stats) =>
    `👋 Рада вітати тебе знову, ${userName}!\n\n` +
    `Ось коротко про твої справи:\n\n` +
    `🛞 Колесо балансу — ${stats.wheelStatus}\n` +
    `🔥 Активність —  ${stats.streakText}\n` +
    `📊 Остання сесія — ${stats.lastSessionDate}\n` +
    `💰 Підписка — ❌ Немає активної підписки`,

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

// ───────────────────────────────────────────────────────────────────────────────
// Меню
// ───────────────────────────────────────────────────────────────────────────────
export const MENU_BUTTONS = Object.freeze({
  AI_MENTOR: '🤖 AI наставник',
  WHEEL: '🎯 Колесо балансу',
  SUBSCRIPTION: '💰 Підписка',
  HELP: '❓ Допомога',
  PROGRESS: '📊 Мій прогрес',
  AFFIRMATION: '🧭 Фокус дня',
  INSTRUCTIONS: '📝 Інструкції',
  CONTACT: '📞 Зв\'язок',
});

export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nПишіть на nadyastarway@gmail.com або дивіться інструкції в меню.`,
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n⏰ Відповідь: до 24 год.`,
  INSTRUCTIONS:
    `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n` +
    `⏰ Автоматичні питання:\n• ${SCHEDULE.MORNING_TIME} — ранок (${MORNING_QUESTIONS.length})\n` +
    `• ${SCHEDULE.EVENING_TIME} — вечір (${EVENING_QUESTIONS.length})\n\n` +
    `Поради: відповідай щиро, переглядай звіти, пиши у «Зв'язок» при проблемах.`,
});

export const MENU = MENU_BUTTONS;

// ───────────────────────────────────────────────────────────────────────────────
export const CALLBACKS = Object.freeze({
  // START_REGISTRATION: 'start_registration',
  // SKIP_REGISTRATION: 'skip_registration',
  // CONFIRM_NAME: 'confirm_name',
  // CHANGE_NAME: 'change_name',
  // SKIP_NAME: 'skip_name',
  // SKIP_EMAIL: 'skip_email',
  // BACK_EMAIL: 'back_email',
  // SKIP_PHONE: 'skip_phone',
  // BACK_PHONE: 'back_phone',
  // TZ_PREFIX: 'tz_',
  // TRIAL: 'trial',
  // WEEK: 'week',
  // MONTH: 'month',
  // YEAR: 'year',
  // NO_SUBSCRIPTION: 'no_subscription',
  TZ_PREFIX: 'ob_tz_',
  SKIP_EMAIL: 'ob_skip_email',
  SKIP_PHONE: 'ob_skip_phone',
  TRIAL: 'ob_plan_trial',
  WEEK: 'ob_plan_week',
  MONTH: 'ob_plan_month',
  YEAR: 'ob_plan_year',
  NO_SUBSCRIPTION: 'ob_no_subscription',
  START_REGISTRATION: 'ob_start_reg',
  SKIP_REGISTRATION: 'ob_skip_reg',
  CONFIRM_NAME: 'ob_confirm_name',
  CHANGE_NAME: 'ob_change_name',
  BACK_EMAIL: 'ob_back_email',
  BACK_PHONE: 'ob_back_phone',
  SKIP_NAME: 'ob_skip_name',

    FREE_COURSE_START: 'free_course_start',
  FILL_FORM: 'fill_registration_form'

});

export const BUTTONS = Object.freeze({
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
});

// ───────────────────────────────────────────────────────────────────────────────
// Валідація/обробка
// ───────────────────────────────────────────────────────────────────────────────
const isSkip = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return s === '/skip' || s === 'пропустити';
};

export const VALIDATORS = Object.freeze({
  name: (v) => validateName(v),
  email: (v) => (isSkip(v) ? { valid: true, value: null, isEmpty: true } : validateEmail(v)),
  phone: (v) => (isSkip(v) ? { valid: true, value: null, isEmpty: true } : validatePhone(v)),
  timezone: (v) => validateTimezone(v),
});

export const PROCESSORS = Object.freeze({
  name: (v) => formatName(v),
  email: (v) => (isSkip(v) ? null : formatEmail(v)),
  phone: (v) => (isSkip(v) ? null : formatPhone(v)),
  timezone: (v) => String(v || '').trim(),
  plan: (v) => String(v || '').trim(),
});

export const VALIDATION = Object.freeze({
  NAME: { MIN: CONFIG.NAME_MIN_LENGTH, MAX: CONFIG.NAME_MAX_LENGTH },
  EMAIL: { MAX: CONFIG.EMAIL_MAX_LENGTH },
  PHONE: { REGEX: CONFIG.PHONE_REGEX, FORMAT: '+380XXXXXXXXX' },
});

// ───────────────────────────────────────────────────────────────────────────────
// TZ/Schedule/Status
// ───────────────────────────────────────────────────────────────────────────────
export const TIMEZONE = Object.freeze({
  ALL: TZ_LIST,
  DEFAULT: CONFIG.DEFAULT_TIMEZONE,
  label: (slug) => getTzLabel(slug),
});

export const SCHEDULE_CONFIG = Object.freeze({
  MORNING_TIME: SCHEDULE.MORNING_TIME,
  EVENING_TIME: SCHEDULE.EVENING_TIME,
  TIMEZONE: SCHEDULE.TIMEZONE,
  TRIAL_DAYS: 7,
});

export const ERRORS = Object.freeze({
  USER_NOT_FOUND: '❌ Користувач не знайдено. Спробуй /start',
  DATABASE_ERROR: '❌ Помилка бази даних. Спробуй пізніше',
  VALIDATION_ERROR: '❌ Дані не відповідають формату',
  UNKNOWN_ERROR: '❌ Невідома помилка. Спробуй ще раз',
  INVALID_FORMAT: '❌ Невірний формат. Спробуй ще раз',
});

export const USER_STATUS_MAP = Object.freeze({
  NEW: USER_STATUS.NEW,
  REGISTERED: USER_STATUS.REGISTERED,
  ACTIVE: USER_STATUS.ACTIVE,
});

// ───────────────────────────────────────────────────────────────────────────────
// Утиліта для контролера: чи показувати маркетинговий PITCH
// ───────────────────────────────────────────────────────────────────────────────
export const shouldShowPitch = (meta, user) => {
  const fromTilda = String(meta?.src || '').toLowerCase().includes('tilda');
  const status = String(user?.fields?.Status || '').toLowerCase();
  const notRegistered = user?.fields?.UserRegistered !== true;
  const step = String(user?.fields?.Answer_Step || '');
  const inOnboarding = /^ob_/i.test(step);

  return fromTilda || notRegistered || status === 'new user' || inOnboarding || !user;
};


export const FREE_COURSE_MESSAGES = Object.freeze({
  WELCOME_EXISTING: (firstName) =>
    `👋 Вітаю, ${firstName}, на 5-денному практикумі\n` +
    `**5 ТОЧОК ВНУТРІШНЬОЇ ОПОРИ!**\n\n` +
    `Це простір, де ти перестаєш рухатись інерцією й нарешті бачиш, що саме керує твоїми рішеннями і щоденними діями. За ці 5 днів ти почнеш діяти не з напруги або звички, а з розуміння того, що тобі справді потрібно.\n\n` +
    `👉 Завдяки системі **«СТАН → ЦІЛЬ → ВИБІР → РІШЕННЯ → ДІЯ»** ти:\n` +
    `• побачиш, як формуються твої вибори щодня\n` +
    `• відокремиш власні бажання від того, що "прийнято" чи "потрібно"\n` +
    `• навчишся приймати рішення без метань і зайвого аналізу\n` +
    `• заміниш хаотичні рухи на конкретні кроки\n` +
    `• знімеш внутрішню напругу, яка постійно тисне «старайся більше»\n\n` +
    `❌ Без мотиваційних лозунгів.\n` +
    `❌ Без копання, яке виснажує.\n` +
    `❌ Без нескінченного безладу й відчуття «з чого почати».\n\n` +
    `Уроки відкриватимуться поступово: наступний відкриється тільки після того, як ти переглянеш попередній.\n\n` +
    `Це допоможе тобі рухатись послідовно, без перевантаження і стрибків між темами.\n\n` +
    `Кожен урок — короткий і практичний. Ти зможеш застосовувати інструменти в той самий день, без складних підготовок та "правильного настрою".\n\n` +
    `Зміни ти помітиш швидко: думки перестануть розбігатися, рішення стануть простішими, а дії — зібраними і чіткими.\n\n` +
    `💪 **Головне: тобі не потрібно ставати "кращою".**\n` +
    `Усе, що тобі потрібно для руху, вже є. Ми просто заберемо зайвий шум, який зупиняє.\n\n` +
    `Готова рухатись? Переходи до практикуму!`,

  WELCOME_NEW: (firstName) =>
    `👋 Привіт, ${firstName}!\n\n` +
    `Щоб отримати доступ до безкоштовного практикуму **"5 ТОЧОК ВНУТРІШНЬОЇ ОПОРИ"**, заповни, будь ласка, коротку форму.\n\n` +
    `Це займе лише хвилину! 📝`
});

