// 📁 src/features/freeVideoFunnel/constants.js
// URLs відео, тексти повідомлень, таймінги

export const VIDEOS = {
  1: {
    title: 'Відео 1: Розпізнай свій шаблон застою',
    url: 'https://www.youtube.com/watch?v=Tkx-7Dhg0pQ',
    duration: 600,
    description: '☑️ розпізнаєш свій шаблон застою'
  },
  2: {
    title: 'Відео 2: Чому "ще один курс" не працює',
    url: 'https://www.youtube.com/watch?v=dyeFBWIrHKw',
    duration: 600,
    description: '☑️ зрозумієш чому "ще один курс" не працює'
  },
  3: {
    title: 'Відео 3: Алгоритм Стан → Ціль → Вибір → Рішення → Дія',
    url: 'https://www.youtube.com/watch?v=DEc7GJHAi_c',
    duration: 600,
    description: '☑️ отримаєш алгоритм Стан → Ціль → Вибір → Рішення → Дія'
  },
  4: {
    title: 'Відео 4: Інтеграція алгоритму у життя',
    url: 'https://www.youtube.com/watch?v=CtfdXW5dHKk',
    duration: 600,
    description: '☑️ побачиш, як цей алгоритм інтегрувати у своє життя'
  },
  5: {
    title: 'Відео 5: Перший крок до прориву',
    url: 'https://www.youtube.com/watch?v=9BLay2YVq-E',
    duration: 600,
    description: '☑️ зробиш свій перший реальний крок до прориву'
  }
};

export const CHANNEL_URL = 'https://t.me/+CqpdcJOHZqExZWVi';
export const TILDA_PROFILE_URL = 'https://yoursite.tilda.ws/profile';      // заміни на реальний
export const TILDA_FUNNEL_URL  = 'https://yoursite.tilda.ws/free-course';   // заміни на реальний

export const BONUS_DAYS = 7;
export const TOTAL_VIDEOS = 5;
export const TIME_LIMIT_HOURS = 24;
export const INITIAL_LIVES = 5;

export const MESSAGES = {
  MAIN_MENU: `🎯 Головне меню AI-наставника

Оберіть, що хочете зробити:

🎬 Безкоштовний курс "Поверни себе з вигорання за 5 днів"
👤 Мій профіль та прогрес
🎡 Колесо балансу
📊 Звіти та статистика
💎 Афірмації
🎮 Гейміфікація та досягнення

Оберіть розділ нижче 👇`,

  WELCOME_FUNNEL: `Вітаю по той бік вигорання, де я покажу як повернути себе та знайти ясність з особистим AI-наставником 🚀

За 5 відео я покажу:
✅ як розпізнати свій шаблон застою
✅ чому "ще один курс" не працює
✅ алгоритм виходу із застою
✅ як інтегрувати його у життя
✅ твій перший реальний крок до прориву

📹 Я розкрила всі деталі, а далі ти зможеш протестувати мого AI-наставника, але умова одна: тобі потрібно переглянути всі відео, доки не згоріли всі життя.
 
В кінці ти зможеш забрати 7 днів безкоштовного AI-коучингу, якщо дійдеш до кінця 🥳
 
💝 У тебе є 5 життів
❌ Пропустиш відео - втратиш життя
✅ Дійдеш до кінця - отримаєш 7 днів з AI-наставником

🕐 P.S. У тебе є 23 години і 59 хвилин, щоб встигнути пройти всі відео - далі доступ закриється, а бонус згорить 👇`,

  SUBSCRIPTION_REQUEST: `📢 Перед стартом - один важливий крок

Підпишись на Telegram-канал, де ти отримаєш додаткові інсайти для трансформації.

Після підписки натисни "✅ Я підписалась"`,

  VIDEO_UNLOCKED: `✨ {title}

{description}

🎥 Переглянь відео уважно — кожна хвилина має значення.

💝 Життів: {lives}/5
⏰ Залишилось: {timeLeft}

Після перегляду натисни "✅ Переглянула відео"`,

  VIDEO_COMPLETED: `🎉 Чудово! Відео {number} пройдено

Ти на крок ближче до прориву!

💝 Життів: {lives}/5
⏰ Залишилось: {timeLeft}`,

  LIFE_LOST: `💔 Життя втрачено!

Ти пропустила відео та втратила 1 життя.

💝 Залишилось життів: {lives}/5

⚠️ Коли всі життя згорять - доступ до програми закриється назавжди.

Продовжуй прямо зараз! 👇`,

  ALL_LIVES_LOST: `❌ Всі життя згоріли

На жаль, ти не встигла пройти програму вчасно.

Доступ до відео та бонусів закрито.

🔄 Але ти можеш почати заново! Натисни /start_funnel`,

  ALL_VIDEOS_COMPLETED: `🔥 ВІТАЮ! Ти пройшла всі 5 відео!

Ти отримала повну картину алгоритму трансформації та зберегла всі {lives} життів! 💝

🎁 Твій бонус готовий:

✨ 7 ДНІВ БЕЗКОШТОВНОГО AI-НАСТАВНИКА

Протягом наступних 7 днів ти отримуватимеш:
• 🎡 Колесо балансу + персональний аналіз
• 📅 Щотижневий аналіз прогресу
• 🌞🌙 Щоденні ранкові/вечірні сесії
• 💎 Персональні афірмації
• 🎮 Гейміфікацію та досягнення
• 🤖 Інсайти від AI на основі твоїх відповідей

⏰ УВАГА: У тебе є 23 години 59 хвилин, щоб пройти Колесо балансу - далі доступ закриється!

Готова почати? 👇`,

  BONUS_ACTIVATED: `✅ Бонус активовано!

Вітаю в програмі "7 днів з AI-наставником"! 🎉

Твій шлях трансформації розпочинається ЗАРАЗ.

🎡 Перший крок: Колесо балансу

Це фундамент твоєї трансформації. AI проаналізує твій поточний стан у 8 сферах життя та сформує персональний план дій.

⏰ У тебе є 23 години 59 хвилин на проходження!

Почнемо? 👇`,

  TIME_EXPIRED: `⏰ Час вийшов

На жаль, 24-годинний доступ до програми завершився.

Всі бонуси згоріли 🔥

Але ти завжди можеш почати спочатку! 
Натисни /start_funnel або поверніться через головне меню.`,

  NEXT_VIDEO_LOCKED: `🔒 Відео {number} заблоковане

Спочатку переглянь попереднє відео.

💝 Життів: {lives}/5
⏰ Залишилось: {timeLeft}`,

  EXIT_TO_TILDA: `🌐 Ви вийшли з особистого кабінету програми

Якщо ви захочете повернутися до особистого кабінету, використовуйте посилання нижче 👇`,

  REMINDER_21H: `⏰ Залишилось 21 година та 58 хвилин!

Ти ще не завершила перегляд відео.

💝 Життів: {lives}/5

Не втрачай можливість отримати 7 днів з AI-наставником безкоштовно!

Продовж зараз 👇`,

  REMINDER_12H: `🔥 Залишилось 12 годин!

Ти пройшла {completed}/5 відео.

💝 Життів: {lives}/5

Не втрачай бонус! Продовжуй прямо зараз 👇`,

  REMINDER_4H: `⚠️ ОСТАННІ 4 ГОДИНИ!

Ти на відстані {remaining} відео від бонусу.

💝 Життів: {lives}/5

Доступ закриється НЕЗАБАРОМ!

Завершуй прямо зараз 👇`,

  REMINDER_1H: `🚨 ОСТАННІЙ ЧАС!!!

Залишилась ОДНА година до закриття доступу!

💝 Життів: {lives}/5
📹 Залишилось відео: {remaining}

ЦЕ ОСТАННІЙ ШАНС отримати 7 днів з AI-наставником!

ДІЙ ЗАРАЗ! 👇`
};

export const FUNNEL_STATES = {
  NOT_STARTED: 'not_started',
  WAITING_SUBSCRIPTION: 'waiting_subscription',
  WATCHING_VIDEO: 'watching_video',
  VIDEO_COMPLETED: 'video_completed',
  ALL_COMPLETED: 'all_completed',
  BONUS_ACTIVATED: 'bonus_activated',
  LIVES_LOST: 'lives_lost',
  EXPIRED: 'expired'
};

export const LIFE_LOSS_TRIGGERS = {
  SKIP_VIDEO: 1,
  TIME_EXPIRED: 5,
  INACTIVITY_12H: 1,
  INACTIVITY_18H: 2
};

export const REMINDER_SCHEDULE = [
  { hours: 2,  message: 'REMINDER_21H' },
  { hours: 12, message: 'REMINDER_12H' },
  { hours: 20, message: 'REMINDER_4H' },
  { hours: 23, message: 'REMINDER_1H' }
];

export const ANALYTICS_EVENTS = {
  FUNNEL_STARTED: 'funnel_started',
  VIDEO_STARTED: 'video_started',
  VIDEO_COMPLETED: 'video_completed',
  LIFE_LOST: 'life_lost',
  ALL_VIDEOS_COMPLETED: 'all_videos_completed',
  BONUS_ACTIVATED: 'bonus_activated',
  TIME_EXPIRED: 'time_expired',
  SUBSCRIPTION_CHECKED: 'subscription_checked'
};

// Для інтеграції з Airtable
export const AIRTABLE_FIELDS = {
  USER_ID: 'user_id',
  CURRENT_VIDEO: 'current_video',
  VIDEOS_COMPLETED: 'videos_completed',
  LIVES_REMAINING: 'lives_remaining',
  CHANNEL_SUBSCRIBED: 'channel_subscribed',
  BONUS_ACTIVATED: 'bonus_activated',
  STARTED_AT: 'started_at',
  LAST_ACTIVITY: 'last_activity',
  COMPLETED_AT: 'completed_at',
  TIME_EXPIRED: 'time_expired'
};
