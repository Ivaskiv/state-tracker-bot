//src/config/constants.js

// ===== ІСНУЮЧІ КОНСТАНТИ (БЕЗ ЗМІН) =====

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

export const CONTACTS = Object.freeze({
  MENTOR_EMAIL: 'nadyastarway@gmail.com',
  MENTOR_TELEGRAM: '@Nadya2316',
  TECH_SUPPORT_TELEGRAM: '@vira_333',
  SUPPORT_RESPONSE_TIME: '2–4 години у робочі дні'
});

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

export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: `${MM} ${MH} * * *`,
  EVENING_QUESTIONS: `${EM} ${EH} * * *`,
  WEEKLY_REPORTS: '0 19 * * 0',
  WEEKLY_ACTIVITY: '0 20 * * 0',
  MONTHLY_WHEEL_CHECK: '0 10 1 * *',
  SUBSCRIPTION_CHECK: '0 10 * * *',
  DAILY_FINALIZATION: '59 23 * * *',

  FUNNEL_REMINDERS: '0 * * * *'
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
  
  // AI-воронки (НОВІ!)
  FREE_FUNNEL: 'free_funnel',
  FUNNEL_7DAYS: 'funnel_7days',

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
  
  // AI-воронки (НОВІ!)
  FREE_FUNNEL_ACTIVE: 'free_funnel_active',
  FUNNEL_7DAYS_ACTIVE: 'funnel_7days_active',
});

export const DAILY_MESSAGES = Object.freeze({
  EVENING_WITHOUT_MORNING: (userName) =>
    `🌙 Добрий вечір, ${userName}!\n\n⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\nЩо робимо?`,
  MORNING_SKIPPED: '✅ Добре! Почнімо відразу з вечірньої рефлексії.',
  SESSION_EXITED: '✅ Зрозуміла! Повертайся коли будеш готова. 💪',
});

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

// ========================================
// ===== AI-ВОРОНКИ (НОВІ КОНСТАНТИ) =====
// ========================================

// ===== СТАТУСИ ВОРОНКИ =====
export const FUNNEL_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped'
});

// ===== ТИПИ БОНУСІВ =====
export const BONUS_TYPES = Object.freeze({
  FULL: 'full',       // 5/5 життів
  PARTIAL: 'partial', // 1-4 життя
  NONE: 'none'        // 0 життів
});

// ===== ЦІНИ (в гривнях) =====
export const FUNNEL_PRICING = Object.freeze({
  REGULAR: 2500,        // Звичайна ціна
  FULL_BONUS: 1750,     // З 5/5 життів (-30%)
  PARTIAL_BONUS: 2125,  // З 1-4 життів (-15%)
  DISCOUNT_FULL: 30,    // % знижки для 5/5
  DISCOUNT_PARTIAL: 15  // % знижки для 1-4
});

// ===== ТАЙМЕРИ (в годинах) =====
export const FUNNEL_TIMERS = Object.freeze({
  VIDEO_RESPONSE_HOURS: 24,        // Скільки годин на відповідь
  REMINDER_HOURS: 12,              // Нагадування через 12 год якщо не відповів
  PAYMENT_REMINDER_HOURS: 24       // Нагадування про покупку через 24 год
});

// ===== ЛІМИТИ =====
export const FUNNEL_LIMITS = Object.freeze({
  MAX_LIVES: 5,
  MAX_VIDEOS: 5,
  MAX_DAYS: 7,
  ACCESS_DAYS: 30       // Днів доступу після покупки
});

// ===== ТЕКСТИ ПОВІДОМЛЕНЬ ВОРОНКИ =====
export const FUNNEL_MESSAGES = Object.freeze({
  WELCOME: (firstName) => 
    `👋 *Привіт, ${firstName}!*\n\n` +
    `Ти щойно зробила перший крок до змін.\n\n` +
    `Протягом наступних 5 днів я проведу тебе через систему, яка допомагає ` +
    `вийти з кола "почала — зупинилась" і почати діяти без страху.\n\n` +
    `🎮 *ПРАВИЛА ГРИ:*\n` +
    `У тебе є 5 життів 💚💚💚💚💚\n\n` +
    `Кожне відео завершується коротким завданням.\n` +
    `Якщо ти не відповідаєш протягом ${FUNNEL_TIMERS.VIDEO_RESPONSE_HOURS} годин — втрачаєш 1 життя.\n\n` +
    `🎁 *ЩО ОТРИМАЄШ:*\n` +
    `✅ 5 потужних відео про вихід зі стану\n` +
    `✅ Практичні завдання після кожного\n` +
    `✅ Бонуси за проходження\n` +
    `✅ Доступ до 7-денної програми зі знижкою\n\n` +
    `Готова почати? 👇`,

  LIFE_LOST: (livesLeft) => {
    const emoji = '💚'.repeat(livesLeft) + '💔'.repeat(FUNNEL_LIMITS.MAX_LIVES - livesLeft);
    return `💔 *Ти втратила життя!*\n\n` +
           `Життя: ${emoji}\n` +
           `Залишилось: ${livesLeft}/${FUNNEL_LIMITS.MAX_LIVES}\n\n` +
           `Продовжуй воронку, щоб не втратити більше!`;
  },

  VIDEO_COMPLETED: (videoNum) => 
    videoNum < FUNNEL_LIMITS.MAX_VIDEOS
      ? `✅ Відповідь збережено!\n\nЧудово! Переходимо до наступного відео 👇`
      : `✅ Відповідь збережено!\n\n🎉 Ти завершила всі відео!`,

  PROGRESS: (currentVideo, lives) => {
    const emoji = '💚'.repeat(lives) + '💔'.repeat(FUNNEL_LIMITS.MAX_LIVES - lives);
    return `📊 *Твій прогрес:*\n\n` +
           `Відео: ${currentVideo}/${FUNNEL_LIMITS.MAX_VIDEOS}\n` +
           `Життя: ${emoji}\n\n` +
           `Продовжуй звідси 👇`;
  },

  FULL_BONUS_REWARD: 
    `🎉 *ВІТАЮ! Ти пройшла всі 5 відео без втрат!*\n\n` +
    `Життя: 💚💚💚💚💚\n\n` +
    `Ти довела собі, що готова змінюватись.\n\n` +
    `🎁 *ТВОЇ БОНУСИ:*\n\n` +
    `🎧 Аудіопрактика "Ресурсний стан за 10 хвилин"\n` +
    `📄 PDF-чек-лист "Алгоритм виходу з ступору"\n` +
    `🎁 Доступ до безкоштовного уроку з 7-денної програми\n` +
    `💰 Спеціальна ціна ${FUNNEL_PRICING.FULL_BONUS} грн замість ${FUNNEL_PRICING.REGULAR} грн`,

  PARTIAL_BONUS_REWARD: (livesLost) =>
    `👏 *Ти пройшла всі 5 відео!*\n\n` +
    `Хоча ти втратила ${livesLost} ${livesLost === 1 ? 'життя' : 'життів'}, ` +
    `ти все одно дійшла до кінця. Це вже результат.\n\n` +
    `🎁 *ТВІЙ БОНУС:*\n\n` +
    `🎧 Аудіопрактика "Ресурсний стан за 10 хвилин"\n` +
    `💰 Знижка ${FUNNEL_PRICING.DISCOUNT_PARTIAL}% на 7-денну програму`,

  NO_LIVES_LEFT:
    `На жаль, ти втратила всі життя 💔💔💔💔💔\n\n` +
    `Але це не кінець! Ти можеш:\n` +
    `• Спробувати воронку ще раз 🔄\n` +
    `• Або одразу перейти до 7-денної програми`,

  PAID_PROGRAM_OFFER: (price, discount) =>
    `🚀 *Програма "Вихід зі стану за 7 днів"*\n\n` +
    `*Що тебе чекає:*\n\n` +
    `📚 7 модулів з покроковими уроками\n` +
    `🎯 Щоденні практики і завдання\n` +
    `💬 Підтримка в чаті\n` +
    `🎁 Бонусні матеріали\n\n` +
    `*Структура:*\n` +
    `День 1-2: Діагностика і усвідомлення\n` +
    `День 3-4: Перепрограмування патернів\n` +
    `День 5-7: Нова реальність і перші дії\n\n` +
    `Після проходження ти зможеш:\n` +
    `✅ Легко виходити зі станів застою\n` +
    `✅ Приймати рішення без страху\n` +
    `✅ Рухатись до цілей постійно\n\n` +
    `*Вартість:*\n` +
    `~~${FUNNEL_PRICING.REGULAR} грн~~ → *${price} грн* (-${discount}%)\n\n` +
    `💡 Спеціальна ціна тільки для тебе!\n\n` +
    `Готова почати трансформацію?`,

  PAYMENT_SUCCESS: (firstName) =>
    `🎉 *Оплата успішна, ${firstName}!*\n\n` +
    `Вітаю! Тепер у тебе є повний доступ до програми ` +
    `"Вихід зі стану за 7 днів".\n\n` +
    `📚 Починаємо з Дня 1!\n\n` +
    `Готова? 👇`,

  PAYMENT_PENDING:
    `💳 *Оформлення оплати*\n\n` +
    `Програма: "Вихід зі стану за 7 днів"\n\n` +
    `Після оплати ти одразу отримаєш доступ!\n\n` +
    `Обери спосіб оплати:`,

  RESTART_FUNNEL: 
    `Окей, починаємо спочатку! 🔄\n\n` +
    `У тебе знову є 5 життів 💚💚💚💚💚`,

  THINK_ABOUT_IT:
    `Розумію, це важливе рішення 💭\n\n` +
    `Я нагадаю тобі через 24 години.\n\n` +
    `А поки можеш дізнатись більше про програму.`,
});

// ===== ТЕКСТИ ДЛЯ 7-ДЕННОЇ ПРОГРАМИ =====
export const PROGRAM_7DAYS_MESSAGES = Object.freeze({
  DAY_WELCOME: (day) =>
    `🎉 *День ${day} доступний!*\n\n` +
    `Готова почати? 👇`,

  DAY_COMPLETED: (day) =>
    `✅ *День ${day} завершено!*\n\n` +
    `Чудова робота! Ти рухаєшся вперед.\n\n` +
    `${day < FUNNEL_LIMITS.MAX_DAYS ? `Побачимося завтра на Дні ${day + 1}! 🚀` : 'Вітаю з завершенням програми! 🎉'}`,

  ALL_COMPLETED:
    `🎉 *ВІТАЮ!*\n\n` +
    `Ти завершила всю 7-денну програму!\n\n` +
    `Тепер у тебе є:\n` +
    `✅ Інструменти для виходу зі стану\n` +
    `✅ Практики для підтримки\n` +
    `✅ Алгоритм дій на майбутнє\n\n` +
    `Продовжуй практикувати і пам'ятай:\n` +
    `*Ти завжди можеш повернутися до матеріалів курсу.*\n\n` +
    `Бажаєш поділитися своїм досвідом? 💬`,

  PROGRESS: (currentDay, totalDays) =>
    `📊 *Твій прогрес у програмі:*\n\n` +
    `День: ${currentDay}/${totalDays}\n\n` +
    `Продовжуй звідси 👇`,
});

//src/config/constants.js
export const SUBSCRIPTION_PLANS = Object.freeze({
  TRIAL:  { key: 'TRIAL',  userName: '🧪 Пробний період — 0€', price: 0,   duration: 7,   description: 'Повний доступ на 7 днів' },
  WEEK:   { key: 'WEEK',   userName: 'Тиждень фокусу — 7€',     price: 7,   duration: 7,   description: 'Ідеально для короткого фокусу або тесту системи' },
  MONTH:  { key: 'MONTH',  userName: 'Місяць дії — 30€',        price: 30,  duration: 30,  description: 'Глибинна робота з твоїми цілями та стратегією' },
  YEAR:   { key: 'YEAR',   userName: 'Рік трансформації — 300€',price: 300, duration: 365, description: 'Максимальна економія та підтримка протягом року' }
});


export const SUBSCRIPTION_MESSAGES = Object.freeze({
  INFO_ACTIVE: (plan, start, end) => `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`,
  INFO_EXPIRING: (daysLeft) => `\n\n⚠️ Підписка закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : (daysLeft >= 2 && daysLeft <= 4 ? 'і' : 'ів')}!`,
  INFO_INACTIVE:
    '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n' +
    '🔹 Тиждень фокусу — 7€\n' +
    '🔹 Місяць дії — 30€\n' +
    '🔹 Рік трансформації — 300€\n\n' +
    '💳 Оплата через WayForPay. Натисни, щоб обрати план:',
  PLANS_LIST:
    '💰 ОБЕРИ ПЛАН ПІДПИСКИ:\н\n' +
    '🔹 Тиждень фокусу — 7€\nІдеально для короткого фокусу або тесту системи\n\n' +
    '🔹 Місяць дії — 30€\nГлибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 Рік трансформації — 300€\nМаксимальна економія та підтримка протягом року\n\n' +
    '✅ Безпечна оплата через WayForPay',
  PAYMENT: (planName, price, duration, link) =>
    `💳 ОПЛАТА ПІДПИСКИ\n\n📋 План: ${planName}\n💰 Вартість: ${price}€\n⏰ Тривалість: ${duration} днів\n\n🔗 Посилання для оплати:\n${link}\n\n💡 Після оплати натисни «🔄 Я вже оплатив».`,
  RENEWAL: (planName, price, duration, link) =>
    `🔄 ПРОДОВЖЕННЯ ПІДПИСКИ\n\n📋 План: ${planName}\n💰 Вартість: ${price}€\n⏰ Тривалість: ${duration} днів\n\n✅ Після оплати натисни «🔄 Перевірити оплату»\n\n🔗 ${link}`,
  SUPPORT: (tgId) =>
    `📞 ЗВʼЯЗОК З ПІДТРИМКОЮ\n\n• Email: nadyastarway@gmail.com\n• Telegram: @Nadya2316 (ментор)\n• Telegram: @vira_333 (техпідтримка)\n\nВкажи свій Telegram ID: ${tgId}`,
  EXPIRATION_REMINDER: (planName, endDate) =>
    `⚠️ Підписка закінчується завтра!\n\n📋 План: ${planName}\n📅 Діє до: ${endDate}\n\n💰 Продовж зараз, щоб не втратити доступ!`
});
export const WAYFORPAY_LINKS = Object.freeze({
  WEEK:  'https://secure.wayforpay.com/button/b96923b913d29',
  MONTH: 'https://secure.wayforpay.com/button/b8df87678cd43',
  YEAR:  'https://secure.wayforpay.com/button/bf28701123683'
});