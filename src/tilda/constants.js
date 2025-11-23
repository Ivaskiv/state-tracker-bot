// src/tilda/constants.js

export const TILDA_MESSAGES = Object.freeze({
  MEMBER_AREA: (url) => 
    `🗂️ **ТВІЙ ОСОБИСТИЙ КАБІНЕТ**\n\n` +
    `📚 Всі твої матеріали зібрані в одному місці\n\n` +
    `🔗 ${url}\n\n` +
    `💡 Посилання дійсне 7 днів`,
    
  ACCESS_EXPIRED: 
    `⚠️ **ДОСТУП ЗАКІНЧИВСЯ**\n\n` +
    `Твоя підписка неактивна.\n\n` +
    `Продовж зараз, щоб відкрити всі матеріали 👇`,
    
  FREE_ACCESS_ONLY:
    `🎁 **БЕЗКОШТОВНИЙ ДОСТУП**\n\n` +
    `Зараз тобі доступні тільки базові матеріали:\n\n` +
    `• Вступне відео\n` +
    `• Базовий чек-лист\n\n` +
    `💎 Оформи trial, щоб отримати повний доступ на 7 днів 👇`,
    
  TRIAL_ACCESS:
    `🧪 **ПРОБНИЙ ПЕРІОД**\n\n` +
    `У тебе активний пробний доступ!\n\n` +
    `📚 Доступно:\n` +
    `• Всі відео воронки\n` +
    `• Колесо балансу\n` +
    `• AI наставник\n` +
    `• Базові матеріали\n\n` +
    `⏰ Доступ до: {END_DATE}`,
    
  PAID_ACCESS:
    `⭐ **ПОВНИЙ ДОСТУП**\n\n` +
    `У тебе активна підписка!\n\n` +
    `📚 Доступно ВСЕ:\n` +
    `• 7-денна програма\n` +
    `• Щотижневі звіти\n` +
    `• Персональний AI\n` +
    `• Бонусні матеріали\n` +
    `• Закриті уроки\n\n` +
    `⏰ Підписка до: {END_DATE}`,
    
  ERROR_GENERATING_LINK:
    `❌ Помилка генерації посилання\n\n` +
    `Спробуй пізніше або зверніться в підтримку: @vira_333`,
    
  FORM_SUBMITTED:
    `✅ **ДЯКУЄМО!**\n\n` +
    `Твої дані оновлено.\n` +
    `Тепер ти можеш отримувати персоналізовані звіти на email.`
});

export const TILDA_CALLBACKS = Object.freeze({
  OPEN_CABINET: 'tilda_open_cabinet',
  UPGRADE_ACCESS: 'tilda_upgrade',
  REFRESH_TOKEN: 'tilda_refresh_token',
  VIEW_SUBSCRIPTION: 'tilda_view_subscription'
});

export const TILDA_COMMANDS = Object.freeze({
  CABINET: 'cabinet',
  TILDA: 'tilda'
});

// Мапа контенту за рівнями доступу
export const CONTENT_MAP = Object.freeze({
  free: {
    title: '🎁 Безкоштовний доступ',
    resources: [
      { title: 'Вступне відео', type: 'video', url: 'https://youtube.com/...' },
      { title: 'PDF чек-лист', type: 'pdf', url: 'https://star-way.pro/files/checklist.pdf' }
    ]
  },
  trial: {
    title: '🧪 Пробний період',
    resources: [
      { title: 'Всі відео воронки (5 днів)', type: 'video' },
      { title: 'Колесо балансу', type: 'interactive' },
      { title: 'AI наставник', type: 'bot' }
    ]
  },
  paid: {
    title: '⭐ Повний доступ',
    resources: [
      { title: '7-денна програма', type: 'course' },
      { title: 'Щотижневі звіти', type: 'reports' },
      { title: 'Бонусні матеріали', type: 'bonus' }
    ]
  }
});

console.log('✅ [Tilda Constants] Завантажено');