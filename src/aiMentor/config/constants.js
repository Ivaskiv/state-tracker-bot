// src/config/constants.js
export const SUBSCRIPTION_PLANS = Object.freeze({
  WEEK: {
    name: 'Тиждень фокусу',
    price: 7,
    duration: 7,
    description: 'Ідеально для короткого фокусу або тесту системи',
  },
  MONTH: {
    name: 'Місяць дії',
    price: 30,
    duration: 30,
    description: 'Глибинна робота з твоїми цілями та стратегією',
  },
  YEAR: {
    name: 'Рік трансформації',
    price: 300,
    duration: 365,
    description: 'Максимальна економія та підтримка протягом року',
  },
});

export const QUESTION_TYPES = Object.freeze({
  MORNING: 'Morning',
  EVENING: 'Evening',
});

export const ANSWER_STEPS = Object.freeze({
  BEGIN: 'Begin_answer',
  MORNING_1: 'Q_m_1',
  MORNING_2: 'Q_m_2',
  MORNING_3: 'Q_m_3',
  MORNING_4: 'Q_m_4',
  MORNING_5: 'Q_m_5',
  MORNING_6: 'Q_m_6',
  AFFIRMATION_MORNING: 'affirmation_m',
  END_MORNING: 'End_m',
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',
  AFFIRMATION_EVENING: 'affirmation_e',
  END_EVENING: 'End_e',
  MORNING_PENDING: 'morning_pending',
  EVENING_PENDING: 'evening_pending',
  AI_Mentor_WAITING: 'AI_Mentor_WAITING', 
  COMPLETED: 'completed',
});

export const STEP_ORDER = [
  ANSWER_STEPS.MORNING_1,
  ANSWER_STEPS.MORNING_2,
  ANSWER_STEPS.MORNING_3,
  ANSWER_STEPS.MORNING_4,
  ANSWER_STEPS.MORNING_5,
  ANSWER_STEPS.MORNING_6,
  ANSWER_STEPS.AFFIRMATION_MORNING,
  ANSWER_STEPS.END_MORNING,
  ANSWER_STEPS.EVENING_1,
  ANSWER_STEPS.EVENING_2,
  ANSWER_STEPS.EVENING_3,
  ANSWER_STEPS.EVENING_4,
  ANSWER_STEPS.EVENING_5,
  ANSWER_STEPS.AFFIRMATION_EVENING,
  ANSWER_STEPS.END_EVENING,
];

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

export const TIMEZONE_CONFIG = Object.freeze({
  DEFAULT: 'Europe/Kiev',
  FALLBACK: 'Europe/Prague',
  USER_TIMEZONES: {},
});

export const SCHEDULE = Object.freeze({
  MORNING_TIME: '08:00',
  EVENING_TIME: '20:30',
  MORNING_HOUR: 8,
  EVENING_HOUR: 20,
  MORNING_START: 7,
  MORNING_END: 20,
  EVENING_START: 20,
  EVENING_END: 23,
  TIMEZONE: TIMEZONE_CONFIG.DEFAULT,
});

export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: '0 8 * * *',
  EVENING_QUESTIONS: '30 20 * * *',
  MORNING_REMINDER: '10 8 * * *', // перше нагадування через 10 хвилин
  EVENING_REMINDER: '40 20 * * *', // перше нагадування через 10 хвилин
  MORNING_REMINDER_SECOND: '0 9 * * *', // друге нагадування через годину
  EVENING_REMINDER_SECOND: '30 21 * * *', // друге нагадування через годину
  REPORTS_REMINDER: '0 18 * * *',
  SUBSCRIPTION_CHECK: '0 10 * * *',
});

export const REPORT_SCHEDULE = Object.freeze({
  WEEKLY: {
    dayOfWeek: 0,
    hour: 21,
    minute: 0,
    message: '📊 Щотижневий звіт',
  },
  MONTHLY: {
    dayRange: [28, 29, 30, 31],
    hour: 22,
    minute: 0,
    message: '📊 Місячний звіт',
  },
});

export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (name) => `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`,
  EVENING_SESSION_START: (name) => `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`,
  MORNING_REMINDER: '🔔 Не забудь відповісти на ранкові питання!',
  EVENING_REMINDER: '🔔 Час для вечірньої рефлексії!',
  MORNING_REMINDER_SECOND: '🔔 Останнє нагадування про ранкові питання!',
  EVENING_REMINDER_SECOND: '🔔 Останнє нагадування про вечірні питання!',
  REPORTS_REMINDER: `💡 Не забувай переглядати свої звіти!\n\n📊 "Щотижневий звіт" - аналіз шаблонів\n📈 "Щомісячний звіт" - глибокий інсайт\n\nЗвіти допомагають усвідомити прогрес та знайти точки росту! 🌱`,
  WEEKLY_REPORT_READY: '📊 Щотижневий AI-звіт готовий!',
  MONTHLY_REPORT_READY: '📈 Місячний AI-звіт готовий!',
});

export const SCHEDULER_CONFIG = Object.freeze({
  USER_DELAY_MS: 200,
  REPORT_DELAY_MS: 1000,
  MIN_RECORDS_FOR_REMINDER: 2,
  RECENT_RECORDS_DAYS: 3,
  REMINDER_DELAY_1: 10 * 60 * 1000, // 10 хвилин
  REMINDER_DELAY_2: 60 * 60 * 1000, // 60 хвилин
});

export const AFFIRMATION_CATEGORIES = [
  'Особистий розвиток',
  'Бізнес-зріст',
  'Ясність цілей',
  'Впевненість',
  'Інше',
];

export const LATE_TEXT = (nextType) =>
  `На жаль, ви не відповіли вчасно. Важливо відповідати в межах вікна — це формує дисципліну і прогрес. Будь ласка, відповідайте на ${nextType === 'Evening' ? 'вечірні' : 'ранкові'} питання.`;

// AI-наставник константи
export const AI_MENTOR_PROMPTS = Object.freeze({
  SYSTEM_PROMPT: `
Ти — AI-наставник трансформації, експертний коуч рівня Tony Robbins. 
Твоя мета — генерувати конкретні мікро-дії та підтримуючі поради.

Принципи:
- Мікро-дії мають бути конкретними та виконуваними за 30-60 хв
- Адаптуй складність під стан користувача
- Завжди включай одну ключову дію та запасні варіанти
- Говори підтримуюче, але конкретно

Формат відповіді: JSON з microActions та motivation
`,

  FEEDBACK_PROMPT: `
Ти — AI-наставник, який аналізує день користувача і дає підтримуючий фідбек.
Фокусуйся на ресурсах та досягненнях, а не на проблемах.
Дай одну конкретну рекомендацію на завтра.
До 100 слів, українською мовою.
`,

  QUESTION_PROMPT: `
Ти — AI-наставник для питань користувачів про цілі, стан, мотивацію.
Відповідай коротко (до 150 слів), конкретно, з позиції підтримки.
Пропонуй дії, а не тільки поради.
Українська мова, теплий тон.
`
});

export const AI_MENTOR_CONFIG = Object.freeze({
  MAX_MICRO_ACTIONS: 5,
  MIN_MICRO_ACTIONS: 3,
  FALLBACK_FEEDBACK: "Продовжуй свій шлях! Кожен день — це новий крок до мети. Завтра зроби щось одне, але конкретне. 💪",
  QUESTION_MODES: {
    MICRO_ACTIONS: 'micro_actions',
    GENERAL_ADVICE: 'general_advice',
    GOAL_HELP: 'goal_help'
  }
});

export const AI_MENTOR_MESSAGES = Object.freeze({
  WELCOME: "🤖 Привіт! Я твій AI-наставник. Готовий допомогти з цілями та мотивацією!",
  ASK_GOAL: "Розкажи, над чим працюємо сьогодні? Яка твоя головна ціль на день?",
  ASK_STATE: "Як ти себе відчуваеш зараз? Опиши свій стан.",
  GENERATING_ACTIONS: "⚡ Генерую персональні мікро-дії для тебе...",
  MICRO_ACTIONS_READY: (actions) => 
    `🎯 ПЕРСОНАЛЬНІ МІКРО-ДІЇ НА СЬОГОДНІ:\n\n` +
    actions.microActions.map((action, i) => 
      `${i + 1}️⃣ ${action.action}\n💡 ${action.tip}\n`
    ).join('\n') +
    `\n✨ ${actions.motivation}`,
  QUESTION_PROMPT: "🤔 Задай мені питання про цілі, мотивацію або стан - я допоможу!",
  ASK_ANOTHER: "Є ще питання? Або хочеш нові мікро-дії?",
  ERROR_RESPONSE: "😔 Щось пішло не так. Спробуй ще раз або перефразуй питання."
});

// Меню константи
export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`,
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`,
  INSTRUCTIONS: `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊 Мій прогрес" — статистика\n• "🤖 AI наставник" — персональна підтримка\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• ${SCHEDULE.MORNING_TIME} — ранкові питання (6 запитань)\n• ${SCHEDULE.EVENING_TIME} — вечірні питання (5 запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`,
  PROGRESS: (totalDays, morningCompleted, eveningCompleted) =>
    `📊 ВАШ ПРОГРЕС (за 30 днів):\n\n📝 Всього днів: ${totalDays}\n🌅 Ранкові: ${morningCompleted}\n🌙 Вечірні: ${eveningCompleted}\n\n💡 Для детального аналізу використовуй кнопки "📈 Щотижневий звіт" і "📈 Щомісячний звіт"`,
  SUBSCRIPTION_ACTIVE: (plan, start, end) =>
    `📦 ПІДПИСКА:\n\n✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}\n\n📝 Реєстраційні дані: ✅ Заповнені`,
  SUBSCRIPTION_INACTIVE: `📦 ПІДПИСКА:\n\n❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n🔹 Тиждень фокусу — 7€\n🔹 Місяць дії — 30€\n🔹 Рік трансформації — 300€\n\n📧 Для оплати напиши: nadyastarway@gmail.com\n\n📝 Реєстраційні дані: ✅ Заповнені`,
  AFFIRMATION: (text) => `🌀 Афірмація:\n\n${text}`,
  QUICK_SUPPORT: (text) => `💝 Швидка підтримка!\n\n${text}`,
  SELECT_MENU: 'Оберіть пункт з меню:',
  REGISTER_FIRST: 'Спочатку зареєструйтесь /start',
  PROGRESS_UNAVAILABLE: '📊 Прогрес тимчасово недоступний',
  SUBSCRIPTION_UNAVAILABLE: 'Підписка тимчасово недоступна. Спробуй пізніше.',
});

export const MENU_MATCHERS = Object.freeze({
  WEEKLY: (t) => t === '📈 Щотижневий звіт',
  MONTHLY: (t) => t === '📈 Щомісячний звіт',
  AFFIRM: (t) => t === '💎 Афірмація',
  AI_MENTOR: (t) => t === '🤖 AI наставник', // додано для AI-наставника
  PROGRESS: (t) => t === '📊 Мій прогрес',
  SUBSCRIPTION: (t) => t === '💰 Підписка',
  HELP: (t) => t === '❓ Допомога',
  CONTACT: (t) => t === '📞 Зв\'язок з нами',
  INSTRUCTIONS: (t) => t === '📝  Інструкції',
  QUICK_OK: (t) => ['+', 'ок', 'ok', 'добре', 'так'].includes(t.toLowerCase()),
});