// src/features/free5videos/constants.js
export const FUNNEL_KEY = 'free_5_videos';

export const VIDEOS = {
  1: {
    id: 1,
    title: 'Розпізнай свій шаблон застою',
    url: 'https://www.youtube.com/watch?v=Tkx-7Dhg0pQ',
    duration: 600,
    description: '☑️ розпізнаєш свій шаблон застою',
    thumbnail: 'https://img.youtube.com/vi/Tkx-7Dhg0pQ/maxresdefault.jpg'
  },
  2: {
    id: 2,
    title: 'Чому "ще один курс" не працює',
    url: 'https://www.youtube.com/watch?v=dyeFBWIrHKw',
    duration: 600,
    description: '☑️ зрозумієш чому "ще один курс" не працює',
    thumbnail: 'https://img.youtube.com/vi/dyeFBWIrHKw/maxresdefault.jpg'
  },
  3: {
    id: 3,
    title: 'Алгоритм Стан → Ціль → Вибір → Рішення → Дія',
    url: 'https://www.youtube.com/watch?v=DEc7GJHAi_c',
    duration: 600,
    description: '☑️ отримаєш алгоритм Стан → Ціль → Вибір → Рішення → Дія',
    thumbnail: 'https://img.youtube.com/vi/DEc7GJHAi_c/maxresdefault.jpg'
  },
  4: {
    id: 4,
    title: 'Інтеграція алгоритму у життя',
    url: 'https://www.youtube.com/watch?v=CtfdXW5dHKk',
    duration: 600,
    description: '☑️ побачиш, як цей алгоритм інтегрувати у своє життя',
    thumbnail: 'https://img.youtube.com/vi/CtfdXW5dHKk/maxresdefault.jpg'
  },
  5: {
    id: 5,
    title: 'Перший крок до прориву',
    url: 'https://www.youtube.com/watch?v=9BLay2YVq-E',
    duration: 600,
    description: '☑️ зробиш свій перший реальний крок до прориву',
    thumbnail: 'https://img.youtube.com/vi/9BLay2YVq-E/maxresdefault.jpg'
  }
};

export const CHANNEL_URL = 'https://t.me/+CqpdcJOHZqExZWVi';
export const CHANNEL_ID = process.env.CHANNEL_ID || '@your_channel';

export const MESSAGES = {
  WELCOME: (name) =>
    `👋 ${name || 'Привіт'}!\n\n` +
    `Це 5-відео міні-курс **«Вийди з кола "почала — зупинилась"»**.\n\n` +
    `За 5 коротких кроків ти:\n` +
    `• висвітлиш, де реально застрягла\n` +
    `• побачиш, що тебе тримає\n` +
    `• зробиш перше рішення, а не ще один план\n\n` +
    `**У тебе є:**\n` +
    `💝 5 життів\n` +
    `⏰ 72 години\n\n` +
    `**Умова:**\n` +
    `❌ Пропустиш відео = втратиш життя\n` +
    `✅ Дійдеш до кінця = отримаєш 7 днів з AI-наставником\n\n` +
    `Готова почати? 👇`,

  SUBSCRIPTION_REQUIRED:
    `📢 **Перед стартом - важливий крок**\n\n` +
    `Підпишись на Telegram-канал, де отримаєш додаткові інсайти для трансформації.\n\n` +
    `Після підписки натисни "✅ Я підписалась"`,

  VIDEO_UNLOCKED: (video, lives, timeLeft) =>
    `🎥 **Відео ${video.id}/5**\n\n` +
    `**${video.title}**\n\n` +
    `${video.description}\n\n` +
    `💝 Життів: ${lives}/5\n` +
    `⏰ Залишилось: ${timeLeft}\n\n` +
    `Подивись відео уважно — кожна хвилина має значення.`,

  VIDEO_COMPLETED: (videoNum, lives, timeLeft) =>
    `✅ **Відео ${videoNum} пройдено!**\n\n` +
    `Чудово! Ти на крок ближче до прориву.\n\n` +
    `💝 Життів: ${lives}/5\n` +
    `⏰ Залишилось: ${timeLeft}`,

  LIFE_LOST: (lives, reason) =>
    `💔 **Життя втрачено!**\n\n` +
    `Причина: ${reason}\n\n` +
    `💝 Залишилось: ${lives}/5\n\n` +
    `⚠️ Коли всі життя згорять - доступ закриється назавжди.\n\n` +
    `Продовжуй прямо зараз! 👇`,

  ALL_LIVES_LOST:
    `❌ **Всі життя згоріли**\n\n` +
    `На жаль, ти не встигла пройти програму вчасно.\n\n` +
    `Доступ до відео та бонусів закрито.\n\n` +
    `🔄 Але ти можеш почати заново! Натисни /start`,

  ALL_COMPLETED: (lives) =>
    `🔥 **ВІТАЮ! Ти пройшла всі 5 відео!**\n\n` +
    `Ти отримала повну картину алгоритму трансформації та зберегла всі ${lives} життів! 💝\n\n` +
    `🎁 **Твій бонус готовий:**\n\n` +
    `✨ **7 ДНІВ БЕЗКОШТОВНОГО AI-НАСТАВНИКА**\n\n` +
    `Протягом наступних 7 днів ти отримуватимеш:\n` +
    `• 🎡 Колесо балансу + персональний аналіз\n` +
    `• 📅 Щотижневий аналіз прогресу\n` +
    `• 🌞🌙 Щоденні ранкові/вечірні сесії\n` +
    `• 💎 Персональні афірмації\n` +
    `• 🎮 Гейміфікацію та досягнення\n` +
    `• 🤖 Інсайти від AI\n\n` +
    `⏰ УВАГА: У тебе є 23 години 59 хвилин, щоб пройти Колесо балансу!\n\n` +
    `Готова почати? 👇`,

  BONUS_ACTIVATED:
    `✅ **Бонус активовано!**\n\n` +
    `Вітаю в програмі "7 днів з AI-наставником"! 🎉\n\n` +
    `Твій шлях трансформації розпочинається ЗАРАЗ.\n\n` +
    `🎡 **Перший крок: Колесо балансу**\n\n` +
    `Це фундамент твоєї трансформації. AI проаналізує твій поточний стан у 8 сферах життя.\n\n` +
    `⏰ У тебе є 23 години 59 хвилин на проходження!\n\n` +
    `Почнемо? 👇`,

  TIME_EXPIRED:
    `⏰ **Час вийшов**\n\n` +
    `На жаль, 72-годинний доступ до програми завершився.\n\n` +
    `Всі бонуси згоріли 🔥\n\n` +
    `Але ти завжди можеш почати спочатку!\n` +
    `Натисни /start або поверніться через головне меню.`
};

export const KEYBOARDS = {
  start: {
    inline_keyboard: [[
      { text: '▶️ Почати курс', callback_data: 'free5_start' }
    ]]
  },

  checkSubscription: {
    inline_keyboard: [
      [{ text: '📢 Підписатись на канал', url: CHANNEL_URL }],
      [{ text: '✅ Я підписалась', callback_data: 'free5_check_sub' }]
    ]
  },

  video: (videoNum) => ({
    inline_keyboard: [
      [{ text: '🎥 Дивитись', url: VIDEOS[videoNum].url }],
      [{ text: '✅ Переглянула відео', callback_data: `free5_complete:${videoNum}` }],
      [{ text: '💝 Мої життя', callback_data: 'free5_lives' }],
      [{ text: '⏰ Час', callback_data: 'free5_timer' }]
    ]
  }),

  nextVideo: (videoNum) => ({
    inline_keyboard: [
      [{ text: `➡️ Відео ${videoNum}`, callback_data: `free5_video:${videoNum}` }],
      [{ text: '📊 Мій прогрес', callback_data: 'free5_progress' }]
    ]
  }),

  activateBonus: {
    inline_keyboard: [[
      { text: '🎁 Забрати бонус', callback_data: 'free5_activate_bonus' }
    ]]
  },

  startWheel: {
    inline_keyboard: [[
      { text: '🎡 Почати Колесо балансу', callback_data: 'wheel_start' }
    ]]
  }
};