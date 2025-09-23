// src/config/constants.js

// --- Плани підписки ---
export const SUBSCRIPTION_PLANS = Object.freeze({
  TRIAL: {
    name: '🧪 Пробний 7 днів — 0€',
    price: 0,
    duration: 7,
    description: 'Повний доступ на 7 днів',
  },
  WEEK: {
    name: 'Тиждень фокусу — 7€',
    price: 7,
    duration: 7,
    description: 'Ідеально для короткого фокусу або тесту системи',
  },
  MONTH: {
    name: 'Місяць дії — 30€',
    price: 30,
    duration: 30,
    description: 'Глибинна робота з твоїми цілями та стратегією',
  },
  YEAR: {
    name: 'Рік трансформації — 300€',
    price: 300,
    duration: 365,
    description: 'Максимальна економія та підтримка протягом року',
  }
});

// --- Типи питань ---
export const QUESTION_TYPES = Object.freeze({
  MORNING: 'Morning',
  EVENING: 'Evening',
  AI_MESSAGE: 'Just a message',
});

// --- Кроки відповідей / онбордингу ---
export const ANSWER_STEPS = Object.freeze({
  // Основні кроки
  BEGIN: 'Begin_answer',
  PLAN_SELECTION: 'plan_selection',
  COMPLETED: 'completed',

  // Онбординг (Flow: onboarding)
  OB_PITCH: 'ob_pitch',
  OB_NAME: 'ob_name',
  OB_EMAIL: 'ob_email',
  OB_PHONE: 'ob_phone',
  OB_TIMEZONE: 'ob_timezone',
  OB_PLAN: 'ob_plan',
  OB_PAYMENT_PENDING: 'ob_payment_pending',
  OB_PAYMENT_SUCCESS: 'ob_payment_success',
  OB_REMINDERS_INTRO: 'ob_reminders_intro',
  OB_DONE: 'ob_done',

  // Динамічні ранкові питання
  MORNING_1: 'Q_m_1',
  MORNING_2: 'Q_m_2',
  MORNING_3: 'Q_m_3',
  MORNING_4: 'Q_m_4',
  MORNING_5: 'Q_m_5',
  MORNING_6: 'Q_m_6',
  AFFIRMATION_MORNING: 'affirmation_m',
  END_MORNING: 'End_m',

  // Динамічні вечірні питання
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',
  AFFIRMATION_EVENING: 'affirmation_e',
  END_EVENING: 'End_e',

  // Спеціальні стани
  MORNING_PENDING: 'morning_pending',
  EVENING_PENDING: 'evening_pending',
  AI_MENTOR_ACTIVE: 'ai_mentor_active',
  WHEEL_BALANCE_ACTIVE: 'wheel_balance_active'
});

// --- Тексти питань ---
export const MORNING_QUESTIONS = [
  'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили.\n(Наприклад: я топ експерт, я власниця відомого бренду, я мільйонерка, я відома співачка...)\n_Я — ___________',
  'Яка я?\nДай відповідь на питання.\n(Наприклад: сильна, смілива, любляча, щира, рішуча...)\n_Я — ___________',
  'Мої 10 цілей на рік\nПропиши щодня наново — ніби вони вже реальність.\nНе дивись, що писала вчора.\n1. Я маю...\n2. Я живу...\n3. Я отримую...\n... до 10',
  'На яку одну ціль я фокусуюсь сьогодні?\nТе, що хочеш просунути зараз.\n_Я — ___________',
  'Який мій стан сьогодні?\nОпиши свій стан прямо зараз.\n_Я відчуваю: ___________\nЯкщо стан не ресурсний — обери новий: впевненість, рішучість, легкість, сила — і налаштуйся на нього.',
  'Чому я гідна мати все це прямо зараз?\nОдна сильна відповідь із позиції самоцінності.\n(Наприклад: бо я вже достатня / цінна / варта.)\n_Я — ___________',
];

export const EVENING_QUESTIONS = [
  'Що мене сьогодні наповнило енергією?\nЛюди, дії, ситуації, стани.\n_Мене сьогодні наповнило енергією: ___________',
  'Де я сьогодні злила енергію чи втратила стан?\nТригер, сумнів, ситуація, реакція.\n_Я сьогодні злила енергією в: ___________',
  'Яка програма або переконання активувалась сьогодні?\n(Наприклад: страх, "мені не вийде", "я не заслуговую"...)\n_У мене сьогодні активувалась програма: ___________',
  'З якої точки я діяла сьогодні: сили чи страху?\nЧесна відповідь. Що керувало тобою?\n_Мною сьогодні керувала/керував: ___________',
  'Яка моя головна перемога сьогодні?\nДія, стан, рішення — будь-який успіх.\n_Сьогодні я: ___________',
];

// --- Хелпери для динамічних питань ---
export const getMorningStep = (questionIndex) => `Q_m_${questionIndex}`;
export const getEveningStep = (questionIndex) => `Q_e_${questionIndex}`;
export const getCurrentQuestionIndex = (step) => {
  const match = step.match(/Q_[me]_(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};
export const isLastQuestion = (step, questions) => {
  const index = getCurrentQuestionIndex(step);
  return index >= questions.length;
};
export const getNextQuestionStep = (currentStep, questions) => {
  const currentIndex = getCurrentQuestionIndex(currentStep);
  if (currentIndex < questions.length) {
    const isEvening = currentStep.startsWith('Q_e_');
    return isEvening ? getEveningStep(currentIndex + 1) : getMorningStep(currentIndex + 1);
  }
  return null;
};

// --- Колесо балансу ---
export const WHEEL_BALANCE = Object.freeze({
  TABLE: 'WheelBalance',
  STATUS: { ACTIVE: 'Active', COMPLETED: 'Completed' },
  FIELDS: {
    TG_ID: 'TG_id',
    STATUS: 'Status',
    STEP: 'Step',
    CREATED_DATE: 'Created_Date',
    COMPLETED_DATE: 'Completed_Date',
    TOTAL_SCORE: 'Total_Score',
    HEALTH: 'Health',
    SELF_GROWTH: 'Self_Growth',
    RELATIONSHIPS: 'Relationships',
    CAREER_BUSINESS: 'Career_Business',
    FINANCE: 'Finance',
    REST_LEISURE: 'Rest_Leisure',
    SPIRITUALITY: 'Spirituality',
    HOUSING: 'Housing'
  }
});

export const LIFE_SPHERES = [
  'Здоров\'я та енергія',
  'Особистісний розвиток',
  'Стосунки (сім\'я, друзі)',
  'Кар\'єра та професія',
  'Фінанси та достаток',
  'Дозвілля та відпочинок',
  'Духовність та цінності',
  'Побут та оточення'
];

export const SPHERE_FIELDS = [
  WHEEL_BALANCE.FIELDS.HEALTH,
  WHEEL_BALANCE.FIELDS.SELF_GROWTH,
  WHEEL_BALANCE.FIELDS.RELATIONSHIPS,
  WHEEL_BALANCE.FIELDS.CAREER_BUSINESS,
  WHEEL_BALANCE.FIELDS.FINANCE,
  WHEEL_BALANCE.FIELDS.REST_LEISURE,
  WHEEL_BALANCE.FIELDS.SPIRITUALITY,
  WHEEL_BALANCE.FIELDS.HOUSING
];

export const NOTE_FIELDS = [
  'Health_Notes',
  'Self_Growth_Notes',
  'Relationships_Notes',
  'Career_Notes',
  'Finance_Notes',
  'Leisure_Notes',
  'Spirituality_Notes',
  'Housing_Notes',
];

// узгодженість списків сфер/полів
if (LIFE_SPHERES.length !== SPHERE_FIELDS.length || SPHERE_FIELDS.length !== NOTE_FIELDS.length) {
  console.warn('⚠️ LIFE_SPHERES, SPHERE_FIELDS та NOTE_FIELDS мають різну довжину!');
}

// --- Часові налаштування ---
export const TIMEZONE_CONFIG = Object.freeze({
  DEFAULT: 'Europe/Kiev',   // виправлено з Kiev → Kyiv
  FALLBACK: 'Europe/Prague',
  USER_TIMEZONES: {},
});

// --- Розклад ---
// const _SCHEDULE = {
//   MORNING_TIME: '20:47',
//   EVENING_TIME: '21:30',
//   MORNING_START: 7,
//   MORNING_END: 20,
//   EVENING_START: 20,
//   EVENING_END: 23,
//   TIMEZONE: TIMEZONE_CONFIG.DEFAULT,
// };
const _SCHEDULE = {
  MORNING_TIME: '15:57',  // ваш тестовий час
  EVENING_TIME: '21:30',
  MORNING_START: 0,       // ✅ РОЗШИРЕНО (0-23)
  MORNING_END: 23,        // ✅ РОЗШИРЕНО
  EVENING_START: 0,       // ✅ РОЗШИРЕНО (0-23)  
  EVENING_END: 23,        // ✅ РОЗШИРЕНО
  TIMEZONE: 'Europe/Kiev', // ✅ ФІКСОВАНО
};
const parseTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
  let h = m ? parseInt(m[1], 10) : 9;
  let min = m ? parseInt(m[2], 10) : 0;
  if (Number.isNaN(h) || h < 0 || h > 23) h = 9;
  if (Number.isNaN(min) || min < 0 || min > 59) min = 0;
  return { hour: h, minute: min };
};

const { hour: MH, minute: MM } = parseTime(_SCHEDULE.MORNING_TIME);
const { hour: EH, minute: EM } = parseTime(_SCHEDULE.EVENING_TIME);

_SCHEDULE.MORNING_HOUR = MH;
_SCHEDULE.MORNING_MINUTE = MM;
_SCHEDULE.EVENING_HOUR = EH;
_SCHEDULE.EVENING_MINUTE = EM;
console.log(`[constants] 🕐 Парсинг часу:`);
console.log(`- MORNING_TIME: "${_SCHEDULE.MORNING_TIME}" → ${MH}:${MM}`);
console.log(`- EVENING_TIME: "${_SCHEDULE.EVENING_TIME}" → ${EH}:${EM}`);
export const SCHEDULE = Object.freeze(_SCHEDULE);

// --- CRON ---
const cronFrom = (hour, minute) => `${minute} ${hour} * * *`;

export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: cronFrom(MH, MM),
  EVENING_QUESTIONS: cronFrom(EH, EM),
  MORNING_REMINDER: cronFrom(MH, MM),
  EVENING_REMINDER: cronFrom(EH, EM),
  REPORTS_REMINDER: '0 18 * * *',
  SUBSCRIPTION_CHECK: '0 10 * * *',
});

// ✅ ДОДАТИ ЛОГИ CRON:
console.log(`[constants] 📅 CRON розклад:`);
console.log(`- Ранок: ${CRON_SCHEDULES.MORNING_QUESTIONS} (${_SCHEDULE.MORNING_TIME})`);
console.log(`- Вечір: ${CRON_SCHEDULES.EVENING_QUESTIONS} (${_SCHEDULE.EVENING_TIME})`);
// --- Повідомлення планувальника ---
export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (name) => `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨\n\n1️⃣/${MORNING_QUESTIONS.length} ${MORNING_QUESTIONS[0]}`,
  EVENING_SESSION_START: (name) => `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆\n\n1️⃣/${EVENING_QUESTIONS.length} ${EVENING_QUESTIONS[0]}`,
  MORNING_REMINDER: '🔔 Не забудь відповісти на ранкові питання!\n\n🔄 Натисни "🔄 Продовжити відповіді"',
  EVENING_REMINDER: '🔔 Час для вечірньої рефлексії!\n\n🔄 Натисни "🔄 Продовжити відповіді"',
  MORNING_REMINDER_SECOND: '🔔 Останнє нагадування про ранкові питання!',
  EVENING_REMINDER_SECOND: '🔔 Останнє нагадування про вечірні питання!',
  REPORTS_REMINDER: `📊 Переглянь свої звіти для аналізу прогресу!\n\n"📈 Щотижневий звіт" та "📈 Щомісячний звіт" у меню.`,
  WEEKLY_REPORT_READY: '📊 Щотижневий AI-звіт готовий!',
  MONTHLY_REPORT_READY: '📈 Місячний AI-звіт готовий!',
});

export const SCHEDULER_CONFIG = Object.freeze({
  USER_DELAY_MS: 200,
  REPORT_DELAY_MS: 1000,
  MIN_RECORDS_FOR_REMINDER: 2,
  RECENT_RECORDS_DAYS: 3,
  REMINDER_DELAY_1: 10 * 60 * 1000,
  REMINDER_DELAY_2: 60 * 60 * 1000,
});

// --- Меню тексти та матчери ---
export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`,
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`,
  INSTRUCTIONS: `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊 Мій прогрес" — статистика\n• "🤖 AI наставник" — персональна підтримка\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• ${SCHEDULE.MORNING_TIME} — ранкові питання (${MORNING_QUESTIONS.length} запитань)\n• ${SCHEDULE.EVENING_TIME} — вечірні питання (${EVENING_QUESTIONS.length} запитань)\n\n💡 **ПОРАДИ:**\н• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`,
  PROGRESS: (totalDays, morningCompleted, eveningCompleted) =>
    `📊 ВАШ ПРОГРЕС (за 30 днів):\n\n📝 Всього днів: ${totalDays}\n🌅 Ранкові: ${morningCompleted}\n🌙 Вечірні: ${eveningCompleted}\n\n💡 Для детального аналізу використовуй кнопки "📈 Щотижневий звіт" і "📈 Щомісячний звіт"`,
  SUBSCRIPTION_ACTIVE: (plan, start, end) =>
    `📦 ПІДПИСКА:\n\n✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}\n\n📝 Реєстраційні дані: ✅ Заповнені`,
  SUBSCRIPTION_INACTIVE: `📦 ПІДПИСКА:\n\n❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n🔹 Тиждень фокусу — 7€\n🔹 Місяць дії — 30€\n🔹 Рік трансформації — 300€\n\n📧 Для оплати напиши: nadyastarway@gmail.com\n\n📝 Реєстраційні дані: ✅ Заповнені`,
  SELECT_MENU: 'Оберіть пункт з меню:',
  REGISTER_FIRST: 'Спочатку зареєструйтесь /start',
  PROGRESS_UNAVAILABLE: '📊 Прогрес тимчасово недоступний',
  SUBSCRIPTION_UNAVAILABLE: 'Підписка тимчасово недоступна. Спробуй пізніше.',
});

export const MENU_MATCHERS = Object.freeze({
  WEEKLY: (t) => t === '📈 Щотижневий звіт',
  MONTHLY: (t) => t === '📈 Щомісячний звіт',
  AFFIRM: (t) => t === '💎 Афірмація',
  AI_MENTOR: (t) => t === '🤖 AI наставник',
  PROGRESS: (t) => t === '📊 Мій прогрес',
  SUBSCRIPTION: (t) => t === '💰 Підписка',
  HELP: (t) => t === '❓ Допомога',
  CONTACT: (t) => t === '📞 Зв\'язок з нами',
  INSTRUCTIONS: (t) => t === '📝 Інструкції',
  PROFILE: (t) => t === 'ℹ️ Профіль',
  CONTINUE_ANSWERS: (t) => t === '🔄 Продовжити відповіді',
  SKIP_SESSION: (t) => t === '⏭️ Пропустити',
  QUICK_OK: (t) => ['+', 'ок', 'ok', 'добре', 'так'].includes(t.toLowerCase()),
});

// === Onboarding steps alias (щоб не дублювати строки у модулях) ===
export const OB_STEPS = Object.freeze({
  PITCH: ANSWER_STEPS.OB_PITCH,
  NAME: ANSWER_STEPS.OB_NAME,
  EMAIL: ANSWER_STEPS.OB_EMAIL,
  PHONE: ANSWER_STEPS.OB_PHONE,
  TIMEZONE: ANSWER_STEPS.OB_TIMEZONE,
  PLAN: ANSWER_STEPS.OB_PLAN,
  PAYMENT_PENDING: ANSWER_STEPS.OB_PAYMENT_PENDING,
  PAYMENT_SUCCESS: ANSWER_STEPS.OB_PAYMENT_SUCCESS,
  REMINDERS_INTRO: ANSWER_STEPS.OB_REMINDERS_INTRO,
  DONE: ANSWER_STEPS.OB_DONE,
});

// === Таймзони для UI та парсер лейблу ===
export const TIMEZONES = Object.freeze([
  'Europe/Kyiv (UTC+2/UTC+3)',
  'Europe/Prague (UTC+1/UTC+2)',
  'Europe/Berlin (UTC+1/UTC+2)',
  'Europe/Paris (UTC+1/UTC+2)',
  'Europe/London (UTC+0/UTC+1)',
  'America/New_York (UTC-5/UTC-4)',
  'Asia/Dubai (UTC+4)'
]);

export const parseTz = (label) => (label || '').split(' ')[0];

// --- Лог ініціалізації ---
console.log('✅ [constants] Константи ініціалізовано');
console.log(`✅ [constants] Ранкових питань: ${MORNING_QUESTIONS.length}`);
console.log(`✅ [constants] Вечірніх питань: ${EVENING_QUESTIONS.length}`);
console.log(`✅ [constants] Сфер колеса: ${LIFE_SPHERES.length}`);
console.log(`✅ [constants] CRON розклад: ранок ${_SCHEDULE.MORNING_TIME}, вечір ${_SCHEDULE.EVENING_TIME}`);
