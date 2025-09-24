// src/config/constants.js - ВИПРАВЛЕНО: ЦЕНТРАЛІЗОВАНІ КОНСТАНТИ

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

// --- Кроки відповідей / онбордингу ---
export const ANSWER_STEPS = Object.freeze({
  // Основні кроки
  BEGIN: 'Begin_answer',
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
  
  // Динамічні вечірні питання
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',

  // Колесо балансу
  WHEEL_BALANCE_ACTIVE: 'WheelBalance',

  // AI наставник
  AI_MENTOR_ACTIVE: 'ai_mentor_active'
});

// --- Запитання ---
export const QUESTIONS = {
  morning: [
    {
      text: 'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили. (1 речення)',
      hint: 'Опиши себе з позиції сили — яка ти сьогодні? (1 речення)',
      field: 'Q_m_1'
    },
    {
      text: 'Які мої сильні якості сьогодні?',
      hint: 'Обери 3–5 якостей, які відчуваєш в собі прямо зараз',
      field: 'Q_m_2'
    },
    {
      text: 'Мої мікро-цілі на сьогодні?',
      hint: 'Введи 1–3 конкретні дії, які хочеш зробити сьогодні',
      field: 'Q_m_3'
    },
    {
      text: 'На що зосереджуюся сьогодні?',
      hint: 'Головний фокус дня — одна найважливіша справа',
      field: 'Q_m_4'
    },
    {
      text: 'Мій стан прямо зараз?',
      hint: 'Опиши своє відчуття, настрій, енергію (1–2 речення)',
      field: 'Q_m_5'
    },
    {
      text: 'Чому я гідна цього вже зараз?',
      hint: 'Одне сильне речення про те, що ти заслуговуєш на свої цілі',
      field: 'Q_m_6'
    }
  ],

  evening: [
    {
      text: 'Що наповнило мене енергією сьогодні?',
      hint: 'Що давало сили та радість протягом дня?',
      field: 'Q_e_1'
    },
    {
      text: 'Де я втратила енергію?',
      hint: 'Які ситуації або думки забирали сили?',
      field: 'Q_e_2'
    },
    {
      text: 'Яка ментальна програма спрацювала?',
      hint: 'Які автоматичні думки чи реакції ти помітила? (страх, сумніви, критика...)',
      field: 'Q_e_3'
    },
    {
      text: 'Я діяла зі сили чи страху?',
      hint: 'Коротко — що більше керувало твоїми рішеннями сьогодні?',
      field: 'Q_e_4'
    },
    {
      text: 'Моя головна перемога сьогодні?',
      hint: 'Що тебе найбільше тішить із того, що зробила або відчула сьогодні?',
      field: 'Q_e_5'
    }
  ]
};

// Для сумісності
export const MORNING_QUESTIONS = QUESTIONS.morning.map(q => q.text);
export const EVENING_QUESTIONS = QUESTIONS.evening.map(q => q.text);

// --- Колесо балансу ---
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
  'Health',
  'Self_Growth',
  'Relationships',
  'Career_Business',
  'Finance',
  'Rest_Leisure',
  'Spirituality',
  'Housing'
];

export const NOTE_FIELDS = [
  'Health_Notes',
  'Self_Growth_Notes',
  'Relationships_Notes',
  'Career_Notes',
  'Finance_Notes',
  'Leisure_Notes',
  'Spirituality_Notes',
  'Housing_Notes'
];

// --- Часові налаштування ---
export const SCHEDULE = Object.freeze({
  MORNING_TIME: '08:00',
  EVENING_TIME: '21:30',
  MORNING_HOUR: 8,
  MORNING_MINUTE: 0,
  EVENING_HOUR: 21,
  EVENING_MINUTE: 30,
  TIMEZONE: 'Europe/Kyiv'
});

// --- CRON ---
export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: `0 8 * * *`,  // 08:00
  EVENING_QUESTIONS: `30 21 * * *`, // 21:30
  SUBSCRIPTION_CHECK: '0 10 * * *',
  MONTHLY_WHEEL_CHECK: '0 10 1 * *' // 1 число кожного місяця
});

// --- Повідомлення планувальника ---
export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (name) =>
    `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨`,
  EVENING_SESSION_START: (name) =>
    `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆`,
  MORNING_REMINDER: '🔔 Не забудь відповісти на ранкові питання!',
  EVENING_REMINDER: '🔔 Час для вечірньої рефлексії!'
});

// --- Меню тексти ---
export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`,
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`,
  INSTRUCTIONS: `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊 Мій прогрес" — статистика\n• "🤖 AI наставник" — персональна підтримка\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• ${SCHEDULE.MORNING_TIME} — ранкові питання (${MORNING_QUESTIONS.length} запитань)\n• ${SCHEDULE.EVENING_TIME} — вечірні питання (${EVENING_QUESTIONS.length} запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`
});

// === Onboarding steps alias ===
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

// === Таймзони для UI ===
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

// Лог ініціалізації
console.log('✅ [constants] Константи ініціалізовано');
console.log(`✅ [constants] Ранкових питань: ${MORNING_QUESTIONS.length}`);
console.log(`✅ [constants] Вечірніх питань: ${EVENING_QUESTIONS.length}`);
console.log(`✅ [constants] Сфер колеса: ${LIFE_SPHERES.length}`);
console.log(`✅ [constants] CRON розклад: ранок ${SCHEDULE.MORNING_TIME}, вечір ${SCHEDULE.EVENING_TIME}`);