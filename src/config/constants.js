// src/config/constants.js
// ===== ЧАСОВІ ЗОНИ =====
export const TIMEZONES = [
  { label: 'Europe/Kiev (UTC+3)', slug: 'Europe/Kiev' },
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

// ===== ПЛАНИ ПІДПИСКИ =====
export const SUBSCRIPTION_PLANS = Object.freeze({
  TRIAL: {
    key: 'TRIAL',
    name: '🧪 Пробний період — 0€',
    price: 0,
    duration: 7,
    description: 'Повний доступ на 7 днів'
  },
  WEEK: {
    key: 'WEEK',
    name: 'Тиждень фокусу — 7€',
    price: 7,
    duration: 7,
    description: 'Ідеально для короткого фокусу або тесту системи'
  },
  MONTH: {
    key: 'MONTH',
    name: 'Місяць дії — 30€',
    price: 30,
    duration: 30,
    description: 'Глибинна робота з твоїми цілями та стратегією'
  },
  YEAR: {
    key: 'YEAR',
    name: 'Рік трансформації — 300€',
    price: 300,
    duration: 365,
    description: 'Максимальна економія та підтримка протягом року'
  }
});

// ===== СТАТУСИ =====
export const USER_STATUS = Object.freeze({
  NEW: 'New User',
  REGISTERED: 'Registered User',
  ACTIVE: 'Active User'
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
  APPROVED: 'Approved'
});

// ===== КРОКИ ВІДПОВІДЕЙ =====
export const CURRENT_ACTIVITY = Object.freeze({
  IDLE: 'idle',
  OB_NAME: 'ob_name',
  OB_EMAIL: 'ob_email',
  OB_PHONE: 'ob_phone',
  OB_TZ: 'ob_timezone',
  OB_PLAN: 'ob_plan',
  PAYMENT_PENDING: 'payment_pending',
  COMPLETED: 'completed',
  WHEEL: 'WheelBalance',
  AI_MENTOR: 'ai_mentor',
  WEEKLY: 'weekly_report',
  MONTHLY: 'monthly_report',
  SUBSCRIPTION: 'subscription',
  Q_M_1: 'Q_m_1', Q_M_2: 'Q_m_2', Q_M_3: 'Q_m_3',
  Q_M_4: 'Q_m_4', Q_M_5: 'Q_m_5', Q_M_6: 'Q_m_6',
  Q_E_1: 'Q_e_1', Q_E_2: 'Q_e_2', Q_E_3: 'Q_e_3', Q_E_4: 'Q_e_4', Q_E_5: 'Q_e_5',
});

export const ANSWER_STEPS = Object.freeze({
  BEGIN: 'Begin_answer',
  COMPLETED: 'completed',
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
  MORNING_1: 'Q_m_1',
  MORNING_2: 'Q_m_2',
  MORNING_3: 'Q_m_3',
  MORNING_4: 'Q_m_4',
  MORNING_5: 'Q_m_5',
  MORNING_6: 'Q_m_6',
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',
  WHEEL_BALANCE_ACTIVE: 'WheelBalance',
  AI_MENTOR_ACTIVE: 'ai_mentor_active'
});

export const ONBOARDING_STEPS = Object.freeze({
  NAME: ANSWER_STEPS.OB_NAME,
  EMAIL: ANSWER_STEPS.OB_EMAIL,
  PHONE: ANSWER_STEPS.OB_PHONE,
  TIMEZONE: ANSWER_STEPS.OB_TIMEZONE,
  PLAN: ANSWER_STEPS.OB_PLAN,
  COMPLETED: ANSWER_STEPS.COMPLETED
});

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

// ===== ЗАПИТАННЯ =====
export const QUESTIONS = {
  morning: [
    {
      text: 'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили. (1 речення)',
      hint: 'Опиши себе з позиції сили — яка ти сьогодні? (1 речення)',
      field: 'Q_m_1'
    },
    {
      text: 'Яка я? Які мої сильні якості сьогодні?',
      hint: 'Обери 3–5 якостей, які відчуваєш в собі прямо зараз',
      field: 'Q_m_2'
    },
    {
      text: 'Мої 10 цілей на рік.',
      hint: 'Пропиши їх щодня, ніби вони вже реальність.',
      field: 'Q_m_3'
    },
    {
      text: 'На що зосереджуюся сьогодні? Мої мікро-цілі на сьогодні? Яка головна ціль дня?',
      hint: ' Введи 1–3 конкретні дії, які хочеш зробити сьогодні. Головний фокус дня — одна найважливіша справа',
      field: 'Q_m_4'
    },
    {
 text: 'Мій стан прямо зараз? Чому я гідна цього вже зараз?',
      hint: 'Опиши своє відчуття, настрій, енергію (1–2 речення). Якщо стан не ресурсний — обери новий: впевненість, рішучість, легкість, сила.',
            field: 'Q_m_5'
    },
    {
  text: 'Які 3 конкретні дії я зроблю сьогодні?',
      hint: 'Напиши 3 чіткі дії, які зроблять твій день продуктивним. Формат: кожна дія з нового рядка',
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
 text: 'Які 3 дії я заплановані на сьогодні я виконала?\n\n[ТУТ ПОКАЗАТИ СПИСОК З РАНКУ]\n\nВідмічай: ✅ зроблено / ⏭ не зроблено',
      hint: 'Чесно - що зробила, а що ні. Це не оцінка, а точка росту.',
           field: 'Q_e_5'
    },
    {
      text: 'Чи наблизилася я до своїх 10 цілей сьогодні?\n\n[ТУТ ПОКАЗАТИ ЦІЛІ З РАНКУ]\n\nДо якої цілі ти зробила крок?',
      hint: 'Навіть маленький крок — це прогрес. До якої з 10 цілей ти наблизилася?',
      field: 'Q_e_6'
    },
    {
      text: 'Моя головна перемога сьогодні?',
      hint: 'Що тебе найбільше тішить із того, що зробила або відчула сьогодні?',
      field: 'Q_e_7'
    }
  ]
};

export const MORNING_QUESTIONS = QUESTIONS.morning.map(q => q.text);
export const EVENING_QUESTIONS = QUESTIONS.evening.map(q => q.text);

// ===== КОЛЕСО БАЛАНСУ =====
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

// ===== ЧАСОВІ НАЛАШТУВАННЯ =====
// ONE SOURCE OF TRUTH
export const SCHEDULE = Object.freeze({
  MORNING_TIME: '12:00',
  EVENING_TIME: '12:45',
  TIMEZONE: 'Europe/Kyiv' 
});

// утиліта для розбору HH:MM
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
// ===== SCHEDULER ПОВІДОМЛЕННЯ =====
// export const SCHEDULER_MESSAGES = Object.freeze({
//   MORNING_SESSION_START: (name) =>
//     `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨`,
//   EVENING_SESSION_START: (name) =>
//     `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆`,
//   MORNING_REMINDER: '🔔 Не забудь відповісти на ранкові питання!',
//   EVENING_REMINDER: '🔔 Час для вечірньої рефлексії!'
// });


export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (name) =>
    `🌞 Доброго ранку, ${name}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨`,
  EVENING_SESSION_START: (name) =>
    `🌙 Добрий вечір, ${name}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆`,
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
// ===== ПОВІДОМЛЕННЯ =====
export const MESSAGES = Object.freeze({
  WELCOME: (name) => 
    `👋 Привіт, ${name}!\n\nЯ твій AI-мотиватор і коуч!\n\nДопомагаю:\n🎯 Ставити цілі\n⚖️ Знаходити баланс\n💪 Підтримувати мотивацію\n\nГотова розпочати?`,
  
  ONBOARDING_NAME_CHOICE: (userName) =>
    `👋 Привіт, ${userName}!\n\n` +
    `Я твій AI-мотиватор та коуч! Допомагаю:\n\n` +
    `🎯 Ставити та досягати цілі\n` +
    `⚖️ Знаходити баланс у житті\n` +
    `💪 Підтримувати мотивацію\n` +
    `📈 Відслідковувати прогрес\n\n` +
    `Залишити ім'я "${userName}" або ввести інше?`,

WELCOME_BACK_ACTIVE: (name, endStr) =>
    `👋 З поверненням, ${name}!\n` +
    `✅ Підписка активна до ${endStr}.\n\n` +
    `Продовжуємо ...\n\n`+
    `Нагадую, що  ⬇️\n` +
    `• 🌞 Ранкові питання надсилатиму о ${SCHEDULE.MORNING_TIME} — сфокусуємо день\n` +
    `• 🌙 Вечірню рефлексію — о ${SCHEDULE.EVENING_TIME} — підсумуємо\n\n` +
    `У будь-який момент ти можеш:\n` +
    `• 🤖 AI наставник — запитай і отримай план\n` +
    `• 🎯 Колесо балансу — щомісячний аудит\n` +
    `• 📊 Мій прогрес — статистика\n\n`+
    `Використовуй головне меню внизу.`,

  WELCOME_BACK_INACTIVE: (name) =>
    `👋 З поверненням, ${name}!\n\n` +
    `❗ Підписка не активна. Щоб користуватися усіма функціями — активуй або продовж.\n\n` +
    `Натисни «💰 Підписка» нижче, або обери інший розділ з меню.\n\n`+
    `Використовуй головне меню внизу.`,
  
  ASK_NAME: 'Як до тебе звертатись?\n\nВведи ім\'я (2–50 символів).',
  ASK_EMAIL: 'Вкажи свій e-mail (для надсилання звітів).\nАбо пропусти.',
  ASK_PHONE: 'Залиш номер телефону (для зв\'язку).\nАбо пропусти.',
  ASK_TIMEZONE: '⚠️ ВАЖЛИВО: Обери свій часовий пояс!\n\nЯ надсилатиму ранкові питання о 08:00 за твоїм місцевим часом.\n\n🌍 Твій часовий пояс:',
  ASK_PLAN: 'Обери план доступу.\nМожеш почати з безкоштовного пробного тижня.',
  TRIAL_ACTIVATED: '🎉 Реєстрацію завершено!\n🧪 Пробний доступ активовано на 7 днів.\n\nГотова почати?',
  
  ERROR_GENERIC: '❌ Виникла помилка. Спробуй ще раз /start',
  ERROR_NAME: 'Ім\'я має бути від 2 до 50 символів. Введи ще раз.',
  ERROR_EMAIL: 'Схоже, email некоректний. Введи інший або пропусти.',
  ERROR_PHONE: 'Виглядає як некоректний номер. Введи у форматі +380XXXXXXXXX або пропусти.'
});

export const REGISTRATION_SUCCESS_TEMPLATE =
`✅ Реєстрація успішна!
🧪 Пробний доступ активовано до {END_DATE}.

Користуйся кнопками меню внизу:
• 🤖 AI наставник — відповіді та мікро-дії
• 🎯 Колесо балансу — щомісячний аудит
• 📈 Звіти — щотижневий і щомісячний
• 💎 Афірмація 
• 📊 Мій прогрес 
• 💰 Підписка

🔔 Нагадування:
• 🌞 Ранкові питання — о ${SCHEDULE.MORNING_TIME}
• 🌙 Вечірні питання — о ${SCHEDULE.EVENING_TIME}
• 📈 Щотижневий звіт — щонеділі ввечері
• 📅 Щомісячний звіт 
• повторне «колесо» — 1 числа кожного місяця`;

export const MENU_TEXTS = Object.freeze({
  HELP: `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`,
  
  CONTACT: `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`,
  
  INSTRUCTIONS: `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊 Мій прогрес" — статистика\n• "🤖 AI наставник" — персональна підтримка\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• ${SCHEDULE.MORNING_TIME} — ранкові питання (${MORNING_QUESTIONS.length} запитань)\n• ${SCHEDULE.EVENING_TIME} — вечірні питання (${EVENING_QUESTIONS.length} запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`
});

// ===== AI НАСТАВНИК =====
export const AI_MENTOR_PROMPTS = Object.freeze({
  // Системний промпт — керує стилем і правилами відповіді.
  SYSTEM_PROMPT: `Ти — експертний AI-наставник, суміш Tony Robbins + Simon Sinek + Tim Ferriss, але говориш як представник покоління Z: просто, різко, без попси.
МІСІЯ:
- Форсити користувача на конкретні мікро-дії, які працюють.
- Підвищувати рішучість, впевненість і відповідальність.
- Генерувати реалістичні плани: день/тиждень/місяць.
ПРАВИЛА:
- Відповіді до 150 слів.
- УКРАЇНСЬКА. Жорстко, чесно, але не принижувати.
- НІ: загальні фрази типу "все буде добре", медичні поради, довгі лекції, без повторів користувача.
- Вихід має бути структурованим: короткий фідбек + 1–3 конкретні дії (action, time, duration) + коротка мотивація (1 речення).
- Якщо запитали SMART-конвертацію — повертай чітку SMART-версію дії.
- Формати відповіді: plain text для чатів; JSON коли просить бекенд (див. нижче).`,

  // Загальний шаблон фідбеку — використовується коли потрібно давати швидкий коментар.
  FEEDBACK_PROMPT: `Ти — мудрий коуч. Даєш короткий підтримуючий фідбек з конкретними порадами.
ФОРМАТ ВІДПОВІДІ (текст):
1) Оцінка (1 рядок): коротко — чітко.
2) Дії (1–3 пункти): "Дія — час — тривалість — очікуваний результат".
3) Tiny reset (1 рядок): 1 техніка ресету (2–3 хв).
4) Мотивація (1 речення).
Мова: українська. Тон: прямолінійний, емпатичний, Gen Z.`,

  // Промпт для ранкової сесії — коли бот отримує ранкові відповіді від користувача.
  MORNING_PROMPT: `Ти аналізуєш ранкові відповіді користувача (поля: who_today, mood_words, yearly_goals, month_priorities, main_goal_today, three_actions).
ЗАВДАННЯ:
1) Перевір кожну з трьох дій — чи достатньо SMART.
2) Якщо дія розмита — перетвори її у SMART (action, time, duration, measurable result).
3) Поверни JSON:
{
 "reply_text":"короткий мотиваційний текст",
 "actions":[
   {"action":"...", "time":"HH:MM або 'зараз'", "duration_min":25, "result":"очікуваний результат"},
   ...
 ],
 "reminder_schedule":[{"action_index":0,"remind_after_min":180}],
 "entry_tags":["ресурсний"|"нересурсний", "top_trigger_if_any"]
}
Тон: рішучий, не мʼякий. До 120 слів текст.`,

  // Промпт для вечірньої сесії — аналіз дій і класифікація причин пропусків.
  EVENING_PROMPT: `Ти аналізуєш вечірні відповіді (поля: day_summary, done_actions[], undone_actions[], energy_sources, energy_drains, activated_beliefs).
ЗАВДАННЯ:
1) Класифікуй причину пропусків: "перевантаження"|"відсутність плану"|"емоційний блок"|"зовнішні обставини".
2) Поверни JSON:
{
 "summary_text":"короткий коментар + головна перемога",
 "classification":"<one of four>",
 "recommendations":[ "tiny_action (10 min)","reset_ritual (2 min breathing)","concrete_step_for_tomorrow" ],
 "suggest_zoom": true|false
}
Якщо classification == "емоційний блок" — додай tiny_action 5–10 хв. Тон: підбадьорливий, реалістичний.`,

  // Промпт для щотижневого звіту — агрегація, навички, план.
  WEEKLY_PROMPT: `Від користувача отримані щотижневі відповіді: top3_actions_done, failed_items[], energy_map, progress_percent_by_goal.
ЗАВДАННЯ:
1) Сформуй короткий звіт (до 120 слів): Перемоги, Де зливається енергія, % виконання.
2) Визнач 1–2 навички для прокачки (рішучість, дисципліна, тайм-менеджмент) на основі failed_items.
3) Запропонуй 3 конкретні дії на наступний тиждень з часом і тривалістю.
Формат JSON:
{
 "report_text":"...",
 "skills":["discipline","decisiveness"],
 "next_week_actions":[{"action":"...","day":"Mon","time":"09:00","duration_min":25}, ...]
}`,

  // Промпт для місячного аудиту / колеса балансу
  MONTHLY_PROMPT: `Отримано wheel_scores (array з 8 чисел 0-10) і prev_month_scores (opt).
ЗАВДАННЯ:
1) Обчисли balance_index = mean(wheel_scores).
2) Для кожної сфери поверни short_insight:
   - score<=4 => "ТЕРМІНОВО" + 3 конкретні кроки
   - 5-7 => "ПІДСИЛИТИ" + 2 кроки
   - 8-10 => "ТРИМАТИ" + 1 порада
3) Обчисли delta_from_prev (для кожної) і trend (up/flat/down, на основі prev_month_scores).
4) Формат JSON:
{
 "balance_index":5.4,
 "insights":[ {"field":"Здоровʼя","score":7,"level":"ТРИМАТИ","advice":["..."]}, ... ],
 "recommend_priorities":["..."],
 "pdf_note":"короткий текст для шапки PDF (<=50 слів)"
}`,

  // Промпт SMART-конвертера — перетворює розмиті дії у SMART
  SMART_CONVERTER_PROMPT: `Отримуєш одну строку з дією користувача, яка може бути розмита, або масив дій.
ЗАВДАННЯ:
1) Для кожної дії поверни SMART-варіант: {action, time, duration_min, measurable_result}.
2) Правила: якщо немає часу -> додай 25 хв; якщо коротко -> 10 або 25 хв; якщо немає результату -> вказати числовий/конкретний результат (словами).
3) Повертай JSON масив:
[{"original":"працювати над проектом","smart":{"action":"Написати план розділу 1","time":"10:00","duration_min":25,"result":"мін. 1 сторінка"}}]`,

  // Промпт для класифікатора причин (вечір)
  CLASSIFIER_PROMPT: `Отповідь користувача на "Чому не зробила?" — короткий текст. Визнач категорію: "перевантаження"|"відсутність плану"|"емоційний блок"|"зовнішні обставини".
ПОВЕРТАТИ JSON: {"text":"...","classification":"...","confidence":0.0}`,

  // Промпт для генерації повідомлень при пропусках / автоматичній реакції
  TRIGGER_PROMPT: `Умови: missed_days_count (int), low_activity_weeks_count (int), last_response_text (opt).
ЗАВДАННЯ:
1) Якщо missed_days_count >=2 і <4 => дай мʼяке повідомлення (1 рядок) + одну пропозицію tiny_action.
2) Якщо missed_days_count >=4 => дай більш пряме повідомлення + варіанти: "Зареєструватись на Zoom (150€)" або "Міні-курс (33€)".
3) Якщо в last_response_text знайдено "страх"|"тривога" — додай сценарій: 2 хв дихання + 5-хв план.
ПОВЕРТАЙ JSON:
{"message":"...","options":[{"label":"Зарезервувати Zoom","action":"book_zoom"},{"label":"Поки ні","action":"no"}]}`,

  // Промпт пропозиції курсу / продажу — обмежити ротацію
  SALE_OFFER_PROMPT: `Отримано trigger_reason і user_metrics (progress_by_goal, missed_days_count, streak_days).
ПРАВИЛА:
- Не більше 2 пропозицій/міс (контролюється бекендом).
- Пропонувати лише якщо progress_by_goal <30% два місяці поспіль або missed_days_count>=4 або low_activity_weeks_count>=2.
ФОРМАТ ВІДПОВІДІ:
{"title":"Індив. консультація з Надею","price":"150€","text":"Коротко чому це потрібно (<=2 рядки)","cta":["Зареєструватись","Поки ні"]}`,

  // Промпт для автосумаризації довгих текстів (>300 зн.)
  SUMMARY_PROMPT: `Отриманий текст (довгий). Зроби 3–4 речення резюме + витягни 1–3 ключових тригери/ключові слова.
ПОВЕРТАЙ JSON:
{"summary":"...","key_triggers":["страх","перфекціонізм"]}`,

  // Шаблон мотиваційного рядка (ротація)
  SHORT_MOTIVATION_PROMPT: `Генеруй 1 короткий, різкий мотиваційний рядок (<=12 слів) в тоні "Очі в очі". Підставляй {goal} якщо є.
Приклади стилю: "Дія — твоя мова проти страху."`,

  // Тонкі установки для всіх промптів
  META: `Всі відповіді українською. Стиль: Gen Z, прямолінійний, емпатичний, без шаблонів.
Якщо повертаєш JSON — ключі мають бути строго як в описі (reply_text, actions, classification, recommendations тощо).
Максимальна довжина тексту відповіді в полі reply_text — 150 слів (переважно <=120).`,

  // Лаконічний фідбек (fallback)
  FALLBACK_FEEDBACK: `Коротко: я бачу. Ось 1 дія — зроби її завтра о 10:00, 25хв. Ресет: 2 хв дихання. Ти можеш це.`
});

export const AI_MENTOR_CONFIG = Object.freeze({
  FALLBACK_FEEDBACK: "Дякую за чесність у відповідях. Кожен день робить тебе сильнішою.",
  MAX_CONVERSATION_HISTORY: 5,
  RESPONSE_TIMEOUT: 30000
});

export const CONTEXT_TYPES = {
  GOAL_SETTING: 'goal_setting',
  MOTIVATION: 'motivation',
  MICRO_ACTIONS: 'micro_actions',
  LIFE_BALANCE: 'life_balance',
  BLOCK_ANALYSIS: 'block_analysis',
  GENERAL: 'general'
};

// ===== КУРСИ =====
export const COURSE_OFFERS = Object.freeze({
  low_activity: {
    title: "Система 21",
    price: 33,
    description: "Для подолання прокрастинації та відкладання",
    benefit: "21 день до нової звички дії",
    duration: 21
  },
  fear: {
    title: "Страхи",
    price: 33,
    description: "Робота з блоками та внутрішніми страхами",
    benefit: "Техніки подолання страхів та тривоги",
    duration: 30
  },
  no_goals: {
    title: "Код змін",
    price: 33,
    description: "Стратегія цілепокладання та планування",
    benefit: "Система досягнення цілей за 30 днів",
    duration: 30
  },
  state_mastery: {
    title: "Стан — ключ до успіху",
    price: 10,
    description: "Управління станом та енергією",
    benefit: "Подолання апатії та втоми",
    duration: 14
  }
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

export const ACTIVITY_TRIGGERS = Object.freeze({
  MISSED_DAYS_THRESHOLD: 2,
  INACTIVE_HOURS_THRESHOLD: 48,
  LOW_ACTIVITY_WEEKS_THRESHOLD: 2,
  LOW_COMPLETION_RATE: 30,
  MAX_OFFERS_PER_MONTH: 2
});

export const PROBLEM_TYPES = Object.freeze({
  LOW_ACTIVITY: 'low_activity',
  FEAR: 'fear',
  NO_GOALS: 'no_goals',
  STATE_MASTERY: 'state_mastery'
});

export const PROBLEM_DESCRIPTIONS = Object.freeze({
  [PROBLEM_TYPES.LOW_ACTIVITY]: 'прокрастинації та відкладанні дій',
  [PROBLEM_TYPES.FEAR]: 'страхах та внутрішніх блоках',
  [PROBLEM_TYPES.NO_GOALS]: 'відсутності чіткої стратегії',
  [PROBLEM_TYPES.STATE_MASTERY]: 'управлінні станом та енергією'
});

// ===== ПІДПИСКИ =====
export const SUBSCRIPTION_MESSAGES = Object.freeze({
  INFO_ACTIVE: (plan, start, end) => 
    `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`,
  
  INFO_EXPIRING: (daysLeft) => 
    `\n\n⚠️ Підписка закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : (daysLeft >= 2 && daysLeft <= 4 ? 'і' : 'ів')}!`,
  
  INFO_INACTIVE: 
    '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n' +
    '🔹 Тиждень фокусу — 7€\n' +
    '🔹 Місяць дії — 30€\n' +
    '🔹 Рік трансформації — 300€\n\n' +
    '💳 Оплата через WayForPay. Натисни, щоб обрати план:',
  
  PLANS_LIST:
    '💰 ОБЕРИ ПЛАН ПІДПИСКИ:\n\n' +
    '🔹 Тиждень фокусу — 7€\n' +
    'Ідеально для короткого фокусу або тесту системи\n\n' +
    '🔹 Місяць дії — 30€\n' +
    'Глибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 Рік трансформації — 300€\n' +
    'Максимальна економія та підтримка протягом року\n\n' +
    '✅ Безпечна оплата через WayForPay',
  
  PAYMENT: (planName, price, duration, link) =>
    `💳 ОПЛАТА ПІДПИСКИ\n\n` +
    `📋 План: ${planName}\n` +
    `💰 Вартість: ${price}€\n` +
    `⏰ Тривалість: ${duration} днів\n\n` +
    `🔗 Посилання для оплати:\n${link}\n\n` +
    `💡 Після оплати натисни «🔄 Я вже оплатив» для автоматичної активації.`,
  
  RENEWAL: (planName, price, duration, link) =>
    `🔄 ПРОДОВЖЕННЯ ПІДПИСКИ\n\n` +
    `📋 План: ${planName}\n` +
    `💰 Вартість: ${price}€\n` +
    `⏰ Тривалість: ${duration} днів\n\n` +
    `✅ Після оплати натисни «🔄 Перевірити оплату»\n\n` +
    `🔗 Посилання для оплати:\n${link}`,
  
  SUPPORT: (tgId) =>
    `📞 ЗВʼЯЗОК З ПІДТРИМКОЮ\n\n` +
    `💬 Про підписку:\n` +
    `• Email: nadyastarway@gmail.com\n` +
    `• Telegram: @Nadya2316 (ментор)\n` +
    `• Telegram: @vira_333 (техпідтримка)\n\n` +
    `📋 Що написати:\n` +
    `• Твій Telegram ID: ${tgId}\n` +
    `• Проблема з оплатою або активацією\n` +
    `• Скрін чеку (якщо є)\n\n` +
    `⏰ Час відповіді: 2-4 години у робочі дні\n\n` +
    `💡 Швидке рішення:\n` +
    `Натисни «🔄 Я вже оплатив» для автоматичної перевірки`,
  
  EXPIRATION_REMINDER: (planName, endDate) =>
    `⚠️ Підписка закінчується завтра!\n\n` +
    `📋 План: ${planName}\n` +
    `📅 Діє до: ${endDate}\n\n` +
    `💰 Продовж підписку зараз, щоб не втратити доступ до всіх функцій!`
});

export const COURSE_MESSAGES = Object.freeze({
  OFFER: (offerTitle, price, description, benefit, triggerMessage) =>
    `💡 ПЕРСОНАЛЬНА РЕКОМЕНДАЦІЯ\n\n` +
    `${triggerMessage}\n\n` +
    `🎯 Можу запропонувати:\n\n` +
    `📚 Міні-курс "${offerTitle}" — ${price}€\n` +
    `${description}\n` +
    `✅ ${benefit}\n\n` +
    `або\n\n` +
    `👥 Консультація з Надею — 60 хв, ${CONSULTATION_OFFER.price}€\n` +
    `Персональна стратегія подолання блоків\n\n` +
    `💡 Вибір за тобою. Я тут, щоб підтримати будь-яке рішення.`,
  
  COURSE_INFO: (title, price, tgId) =>
    `📚 КУРС: ${title}\n\n` +
    `💰 Вартість: ${price}€\n\n` +
    `📧 Для оформлення:\n` +
    `Напиши на email: nadyastarway@gmail.com\n` +
    `або Telegram: @Nadya2316\n\n` +
    `📋 Вкажи:\n` +
    `• Твій Telegram ID: ${tgId}\n` +
    `• Назву курсу: ${title}\n\n` +
    `✅ Після оплати отримаєш доступ протягом 24 годин.`,
  
  CONSULTATION_INFO: (tgId) =>
    `👥 КОНСУЛЬТАЦІЯ З НАДЕЮ\n\n` +
    `⏱ Тривалість: ${CONSULTATION_OFFER.duration} хвилин\n` +
    `💰 Вартість: ${CONSULTATION_OFFER.price}€\n\n` +
    `📋 Що включено:\n` +
    `${CONSULTATION_OFFER.benefits.map(b => `• ${b}`).join('\n')}\n\n` +
    `📧 Запис:\n` +
    `Email: nadyastarway@gmail.com\n` +
    `Telegram: @Nadya2316\n\n` +
    `📋 Вкажи:\n` +
    `• Твій Telegram ID: ${tgId}\n` +
    `• Бажаний час консультації\n` +
    `• Основна тема для обговорення`,
  
  DISMISS: 
    '✅ Добре! Якщо передумаєш — я завжди тут.\n\n💪 Продовжуємо рухатись вперед своїми силами!'
});

// ===== КОНТАКТИ =====
export const CONTACTS = Object.freeze({
  MENTOR_EMAIL: 'nadyastarway@gmail.com',
  MENTOR_TELEGRAM: '@Nadya2316',
  TECH_SUPPORT_TELEGRAM: '@vira_333',
  SUPPORT_RESPONSE_TIME: '2–4 години у робочі дні'
});

// ===== WAYFORPAY =====
export const WAYFORPAY_LINKS = Object.freeze({
  WEEK:  'https://secure.wayforpay.com/button/b96923b913d29',
  MONTH: 'https://secure.wayforpay.com/button/b8df87678cd43',
  YEAR:  'https://secure.wayforpay.com/button/bf28701123683'
});

// ===== КОНФІГУРАЦІЯ =====
export const CONFIG = Object.freeze({
  ANTI_SPAM_TTL_MS: 3000,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 100,
  PHONE_REGEX: /^\+380\d{9}$/,
  DEFAULT_TIMEZONE: 'Europe/Kiev (UTC+3)'
});

// ===== АФІРМАЦІЇ =====
export const MORNING_AFFIRMATIONS = [
  "Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
  "Кожне рішення прокачує мою рішучість. Використовуй її щодня.",
  "Впевненість і рішучість — мої інструменти досягнення цілей. Прокачуй їх.",
  "Дія — це твоя мова проти страху. Починай зараз.",
  "Рішення — це м'яз. Тренуй його сьогодні."
];

export const EVENING_AFFIRMATIONS = [
  "Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої.",
  "Кожна дія сьогодні наблизила мене до моїх цілей.",
  "Я аналізую день, бачу прогрес та коригую стратегію для завтра.",
  "Сьогоднішня дія — завтра моя реальність.",
  "Не чекай натхнення. Створюй його діями."
];

export const GENERAL_AFFIRMATIONS = [
  'Моя енергія створює позитивні зміни',
  'Я заслуговую на все найкраще',
  'Моя рішучість творить можливості',
  'Щодня впевнено йду до мети',
  'Дія — мова проти страху',
  'Кожне рішення прокачує рішучість',
  'Впевненість і рішучість — мої інструменти'
];

// ===== МЕНЮ =====
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

// ===== ПАРСЕРИ ДЛЯ ІСНУЮЧИХ ПОЛІВ =====
export const QUESTION_PARSERS = {
  // Q_m_3: "Мої 10 цілей на рік" → масив Goal_1...Goal_10
  parseGoals: (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const goals = {};
    
    lines.forEach((line, index) => {
      if (index < 10) {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
        goals[`Goal_${index + 1}`] = cleaned;
      }
    });
    
    return goals;
  },

  // Q_m_4: "На що зосереджуюся сьогодні?" → Monthly_Priority_1/2/3 + Daily_Main_Goal
  parseDailyFocus: (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const result = {
      Daily_Main_Goal: lines[0] || text.substring(0, 200), // перша ціль - головна
      Monthly_Priority_1: lines[0] || '',
      Monthly_Priority_2: lines[1] || '',
      Monthly_Priority_3: lines[2] || ''
    };
    
    return result;
  },

  // Q_m_6: "Чому я гідна цього?" → Daily_Action_1/2/3
  parseActions: (text) => {
    // Якщо це афірмація - повертаємо як є
    if (text.length < 100 && !text.includes('\n')) {
      return { affirmation: text };
    }
    
    // Якщо це список дій
    const lines = text.split('\n').filter(l => l.trim());
    return {
      Daily_Action_1: lines[0] || '',
      Daily_Action_2: lines[1] || '',
      Daily_Action_3: lines[2] || ''
    };
  },

  // Q_m_5: "Мій стан" → використовуємо існуюче поле
  parseState: (text) => {
    return { Daily_State: text };
  }
};

// ===== НОВІ ПИТАННЯ (ОПЦІОНАЛЬНО) =====
// export const EXTENDED_MORNING_QUESTIONS = [
//   {
//     id: 7,
//     text: "Який мій стан сьогодні? (впевненість/рішучість/сила/легкість)",
//     field: 'Q_m_7',
//     hint: 'Обери найближчий стан або опиши своїми словами',
//     optional: true 
//   }
// ];

// ===== ЩОДЕННІ ПИТАННЯ - ПОВІДОМЛЕННЯ =====
export const DAILY_MESSAGES = Object.freeze({
  EVENING_WITHOUT_MORNING: (name) =>
    `🌙 Час вечірніх питань, ${name}!\n\n⚠️ Ти ще не пройшла ранкові питання.\n\nЩо робимо?`,
});

console.log('✅ [constants] Централізовані константи завантажено');
console.log(`   • Ранкових питань: ${MORNING_QUESTIONS.length}`);
console.log(`   • Вечірніх питань: ${EVENING_QUESTIONS.length}`);
console.log(`   • Сфер колеса: ${LIFE_SPHERES.length}`);
console.log(`   • Таймзон: ${TIMEZONES.length}`);
console.log(`   • CRON: ранок ${SCHEDULE.MORNING_TIME}, вечір ${SCHEDULE.EVENING_TIME}`);