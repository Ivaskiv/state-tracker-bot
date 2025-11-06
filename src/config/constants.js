//src/config/constants.js
export const CONFIG = Object.freeze({
  ANTI_SPAM_TTL_MS: 3000,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 100,
  PHONE_REGEX: /^\+380\d{9}$/,
  DEFAULT_TIMEZONE: 'Europe/Kyiv'
});
export const getNumberEmoji = (num) => {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  return emojis[num] || num;
};
// src/config/constantsContacts.js
export const CONTACTS = Object.freeze({
  MENTOR_EMAIL: 'nadyastarway@gmail.com',
  MENTOR_TELEGRAM: '@Nadya2316',
  TECH_SUPPORT_TELEGRAM: '@vira_333',
  SUPPORT_RESPONSE_TIME: '2–4 години у робочі дні'
});
//src/config/constants.js
// ONE SOURCE OF TRUTH
export const SCHEDULE = Object.freeze({
  MORNING_TIME: '15:15',
  EVENING_TIME: '21:00',
  TIMEZONE: 'Europe/Kyiv'
});

// утиліта для розбору HH:MM (локальна)
const parseHm = (t) => {
  const [h, m] = String(t).split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`Bad time: ${t}`);
  return { h, m };
};

const { h: MH, m: MM } = parseHm(SCHEDULE.MORNING_TIME);
const { h: EH, m: EM } = parseHm(SCHEDULE.EVENING_TIME);

// cron: формат "M H * * *"
export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: `${MM} ${MH} * * *`,
  EVENING_QUESTIONS: `${EM} ${EH} * * *`,
  WEEKLY_REPORTS: '0 19 * * 0',
  WEEKLY_ACTIVITY: '0 20 * * 0',
  MONTHLY_WHEEL_CHECK: '0 10 1 * *',
  SUBSCRIPTION_CHECK: '0 10 * * *',
  DAILY_FINALIZATION: '59 23 * * *'
});

export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (userName) =>
    `🌞 Доброго ранку, ${userName}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨`,
  EVENING_SESSION_START: (userName) =>
    `🌙 Добрий вечір, ${userName}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆`,
  MORNING_REMINDER: '🔔 Нагадування: ранкова сесія ще не завершена.',
  EVENING_REMINDER: '🔔 Нагадування: вечірня сесія ще не завершена.',
  WEEKLY_PROMPT:
    '📊 ЩОТИЖНЕВИЙ ЗВІТ\n\nЧас проаналізувати тиждень і скоригувати стратегію. ⏱ Займе кілька хвилин.',
  MIDDAY_SUMMARY: (done, total) => {
    if (total === 0) return '⏰ СЕРЕДИНА ДНЯ\n\nНа сьогодні дій не заплановано.';
    if (done === 0) return `⏰ СЕРЕДИНА ДНЯ\n\nЗаплановано: ${total}\n✅ Виконано: 0\n\nПочни з найкоротшої дії — 10 хв.`;
    if (done < total) return `⏰ СЕРЕДИНА ДНЯ\n\n✅ Виконано: ${done}/${total}\nПродовжуй у тому ж дусі! 💪`;
    return `🎉 ЧУДОВО!\n\nВсі дії виконано: ${total}/${total}\nТримаємо курс!`;
  },
  TASK_REMINDER: (task) =>
    `⏰ НАГАДУВАННЯ\n\nЧерез 5 хв стартує:\n${task.action}\n\n🎯 Результат: ${task.result_metric}\n⏱ Тривалість: ${task.duration_min} хв\n\n💪 Тримай фокус!`
});
// 🌍 Глобальні статуси/кроки/активності — без жодних OB_*
// Якщо переносиш у /constants, просто збережи той самий експорт.

export const USER_STATUS = Object.freeze({
  NEW: 'New User',
  REGISTERED: 'Registered User',
  ACTIVE: 'Active User',
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  NEW: 'New',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  PAID: 'Paid',
  PENDING: 'Pending',
  EMPTY: 'Empty',
  DECLINED: 'Declined',
  APPROVED: 'Approved',
});

export const CURRENT_ACTIVITY = Object.freeze({
  IDLE: 'idle',
  PAYMENT_PENDING: 'payment_pending',
  COMPLETED: 'completed',

  // features
  WHEEL: 'WheelBalance',
  AI_MENTOR: 'ai_mentor',
  WEEKLY: 'weekly_report',
  MONTHLY: 'monthly_report',
  SUBSCRIPTION: 'subscription',
  DAILY_FOCUS: 'daily_focus',

  // daily sessions
  Q_M_1: 'Q_m_1', Q_M_2: 'Q_m_2', Q_M_3: 'Q_m_3', Q_M_4: 'Q_m_4', Q_M_5: 'Q_m_5', Q_M_6: 'Q_m_6',
  Q_E_1: 'Q_e_1', Q_E_2: 'Q_e_2', Q_E_3: 'Q_e_3', Q_E_4: 'Q_e_4', Q_E_5: 'Q_e_5', Q_E_6: 'Q_e_6', Q_E_7: 'Q_e_7',
});

export const ANSWER_STEPS = Object.freeze({
  BEGIN: 'Begin_answer',
  IDLE: 'IDLE',
  COMPLETED: 'COMPLETED',

  // daily
  MORNING_1: 'Q_m_1', MORNING_2: 'Q_m_2', MORNING_3: 'Q_m_3', MORNING_4: 'Q_m_4', MORNING_5: 'Q_m_5', MORNING_6: 'Q_m_6',
  EVENING_1: 'Q_e_1', EVENING_2: 'Q_e_2', EVENING_3: 'Q_e_3', EVENING_4: 'Q_e_4', EVENING_5: 'Q_e_5', EVENING_6: 'Q_e_6', EVENING_7: 'Q_e_7',

  // features
  WHEEL_BALANCE_ACTIVE: 'WheelBalance',
  AI_MENTOR_ACTIVE: 'ai_mentor_active',
  DAILY_FOCUS: 'daily_focus',
});

// Залишаємо тут лише не-онбординг тексти
export const DAILY_MESSAGES = Object.freeze({
  EVENING_WITHOUT_MORNING: (userName) =>
    `🌙 Добрий вечір, ${userName}!\n\n⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\nЩо робимо?`,
  MORNING_SKIPPED: '✅ Добре! Почнімо відразу з вечірньої рефлексії.',
  SESSION_EXITED: '✅ Зрозуміла! Повертайся коли будеш готова. 💪',
});

//src/config/constantsCourses.js
export const COURSE_OFFERS = Object.freeze({
  low_activity:   { title: "Система 21",          price: 33, description: "Для подолання прокрастинації та відкладання", benefit: "21 день до нової звички дії", duration: 21 },
  fear:           { title: "Страхи",               price: 33, description: "Робота з блоками та внутрішніми страхами",    benefit: "Техніки подолання страхів та тривоги", duration: 30 },
  no_goals:       { title: "Код змін",             price: 33, description: "Стратегія цілепокладання та планування",     benefit: "Система досягнення цілей за 30 днів",  duration: 30 },
  state_mastery:  { title: "Стан — ключ до успіху", price: 10, description: "Управління станом та енергією",              benefit: "Подолання апатії та втоми",            duration: 14 }
});

export const CONSULTATION_OFFER = Object.freeze({
  title: "Персональна консультація з Надею",
  price: 150,
  duration: 60,
  benefits: [
    "Глибинний аналіз блоків",
    "Персональна стратегія подолання",
    "Конкретний план дій",
    "Підтримка 7 днів після сесії"
  ]
});
export const COURSE_MESSAGES = Object.freeze({
  OFFER: (offerTitle, price, description, benefit, triggerMessage) =>
    `💡 ПЕРСОНАЛЬНА РЕКОМЕНДАЦІЯ\n\n${triggerMessage}\n\n` +
    `📚 Міні-курс "${offerTitle}" — ${price}€\n${description}\n✅ ${benefit}\n\n` +
    `або\n\n👥 Консультація — 60 хв, ${CONSULTATION_OFFER.price}€`,
  COURSE_INFO: (title, price, tgId) =>
    `📚 КУРС: ${title}\n\n💰 ${price}€\n\nНапиши: nadyastarway@gmail.com або @Nadya2316\nВкажи Telegram ID: ${tgId}`,
  CONSULTATION_INFO: (tgId) =>
    `👥 КОНСУЛЬТАЦІЯ\n⏱ 60 хв\n💰 ${CONSULTATION_OFFER.price}€\n\n` +
    `${CONSULTATION_OFFER.benefits.map(b => `• ${b}`).join('\n')}\n\nКонтакт: email або @Nadya2316\nID: ${tgId}`,
  DISMISS: '✅ Добре! Якщо передумаєш — я завжди тут. 💪'
});
//src/config/constants.js
// ===== ЧАСОВІ ЗОНИ =====
export const TIMEZONES = [
  { label: 'Europe/Kyiv (UTC+3)', slug: 'Europe/Kyiv' },
  { label: 'Europe/Warsaw (UTC+2)', slug: 'Europe/Warsaw' },
  { label: 'Europe/Berlin (UTC+2)', slug: 'Europe/Berlin' },
  { label: 'Europe/London (UTC+1)', slug: 'Europe/London' },
  { label: 'Europe/Paris (UTC+2)', slug: 'Europe/Paris' },
  { label: 'Europe/Rome (UTC+2)', slug: 'Europe/Rome' },
  { label: 'Europe/Vienna (UTC+2)', slug: 'Europe/Vienna' },
  { label: 'Europe/Stockholm (UTC+2)', slug: 'Europe/Stockholm' },
  { label: 'Europe/Moscow (UTC+3)', slug: 'Europe/Moscow' },
  { label: 'Asia/Dubai (UTC+4)', slug: 'Asia/Dubai' },
  { label: 'America/New_York (UTC-4)', slug: 'America/New_York' },
  { label: 'America/Chicago (UTC-5)', slug: 'America/Chicago' },
  { label: 'America/Los_Angeles (UTC-7)', slug: 'America/Los_Angeles' },
  { label: 'Canada/Toronto (UTC-4)', slug: 'Canada/Toronto' },
  { label: 'Asia/Tokyo (UTC+9)', slug: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai (UTC+8)', slug: 'Asia/Shanghai' },
  { label: 'Australia/Sydney (UTC+10)', slug: 'Australia/Sydney' },
  { label: 'Europe/Prague (UTC+2)', slug: 'Europe/Prague' },
  { label: 'Europe/Bucharest (UTC+3)', slug: 'Europe/Bucharest' },
  { label: 'Europe/Helsinki (UTC+3)', slug: 'Europe/Helsinki' },
];

export const getTzLabel = (slug) => {
  const tz = TIMEZONES.find(t => t.slug === slug);
  return tz ? tz.label : `${slug} (UTC+0)`;
};

export const parseTz = getTzLabel;
