// src/utils/keyboards.js - ОПТИМІЗОВАНА ВЕРСІЯ З TIMEZONE KEYBOARD + НОВЕ ГОЛОВНЕ МЕНЮ

import { TIMEZONES, SUBSCRIPTION_PLANS } from '../config/constants.js';

// ===== УНІВЕРСАЛЬНІ ГЕНЕРАТОРИ =====

const skipKeyboard = (field, withBack = false) => {
  const buttons = [[{ text: `⏭️ Пропустити ${field}`, callback_data: `skip_${field}` }]];
  if (withBack) {
    buttons.push([{ text: '🔙 Назад', callback_data: `back_${field}` }]);
  }
  return { reply_markup: { inline_keyboard: buttons } };
};

const actionKeyboard = (entity, actions = ['start', 'exit']) => {
  const icons = {
    start: '▶️',
    continue: '🔁',
    exit: '🚪',
    later: '⏭'
  };
  
  const labels = {
    start: 'Почати',
    continue: 'Продовжити',
    exit: 'Вийти',
    later: 'Пізніше'
  };
  
  const buttons = actions.map(action => [{
    text: `${icons[action]} ${labels[action]}`,
    callback_data: `${action}_${entity}`
  }]);
  
  return { reply_markup: { inline_keyboard: buttons } };
};

const navigationKeyboard = (backTo = null, withMainMenu = true) => {
  const buttons = [];
  
  if (backTo) {
    buttons.push([{ text: '🔙 Назад', callback_data: backTo }]);
  }
  
  if (withMainMenu) {
    buttons.push([{ text: '🏠 До меню', callback_data: 'main_menu' }]);
  }
  
  return { reply_markup: { inline_keyboard: buttons } };
};

const menuKeyboard = (options, withNavigation = true) => {
  const buttons = options.map(opt => [{
    text: opt.text,
    callback_data: opt.callback_data
  }]);
  
  if (withNavigation) {
    buttons.push([{ text: '🔙 Назад', callback_data: 'main_menu' }]);
  }
  
  return { reply_markup: { inline_keyboard: buttons } };
};

// ===== ОСНОВНІ КЛАВІАТУРИ =====

const keyboards = {
  // ====== 🏠 ГОЛОВНЕ МЕНЮ (6 КНОПОК: AI, КОЛЕСО, ЗВІТИ, ІНФО, ПІДПИСКА, ЗВ'ЯЗОК) ======
  mainMenuKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📊 Звіти' }, { text: 'ℹ️ Інформація про бота' }],
          [{ text: '💰 Підписка' }, { text: '📞 Зв\'язок' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
      }
    };
  },
mainMenuInline() {
  return {
      inline_keyboard: [
[{ text: 'Інформація', callback_data: 'info_menu' }],
    [{ text: 'Підписка', callback_data: 'subscription_info' }],
    [{ text: 'Контакти', callback_data: 'contact' }]      ]
  };
},
  // ====== 📊 ЗВІТИ (INLINE МЕНЮ) ======
  reportsMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Щотижневий звіт', callback_data: 'get_weekly_report' }],
          [{ text: '📅 Щомісячний звіт', callback_data: 'get_monthly_report' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== ℹ️ ІНФОРМАЦІЯ ПРО БОТА (INLINE МЕНЮ) ======
  infoMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Можливості', callback_data: 'show_capabilities' }],
          [{ text: '📝 Інструкції', callback_data: 'instructions' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== 📞 ЗВ'ЯЗОК (INLINE МЕНЮ З ДОПОМОГОЮ) ======
  contactMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '💎 Афірмація', callback_data: 'show_affirmation' }],
          [{ text: '❓ Допомога', callback_data: 'help' }],
          [{ text: '🔙 Назад', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== 💰 ПІДПИСКА (INLINE МЕНЮ З ПРОГРЕСОМ) ======
  subscriptionMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Статус підписки', callback_data: 'subscription_status' }],
          [{ text: '💳 Оформити/Продовжити', callback_data: 'subscription_plans' }],
          [{ text: '📈 Мій прогрес', callback_data: 'my_progress' }],
          [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
          [{ text: '🔙 Назад', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== ПІСЛЯ РЕЄСТРАЦІЇ ======
  afterRegistrationKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Перше колесо балансу', callback_data: 'wheel_start' }],
          [{ text: '📋 Що можу робити?', callback_data: 'show_capabilities' }]
        ]
      }
    };
  },

  // ====== МОЖЛИВОСТІ ======
  capabilitiesInline() {
    return menuKeyboard([
      { text: '🤖 AI Наставник', callback_data: 'capability_ai' },
      { text: '🎯 Колесо балансу', callback_data: 'capability_wheel' },
      { text: '📊 Звіти', callback_data: 'capability_reports' },
      { text: '💰 Підписка', callback_data: 'capability_subscription' },
      { text: '🏠 До меню', callback_data: 'main_menu' }
    ], false);
  },

  // ====== ТИМЗОНИ (ПАГІНОВАНО, 5 НА РЯДОК) ======
  timezoneKeyboard(page = 0, perPage = 5) {
    const start = page * perPage;
    const end = start + perPage;
    const pageTz = TIMEZONES.slice(start, end);
    const buttons = pageTz.map(tz => [{ text: tz.label, callback_data: `tz_${tz.slug}` }]);
    
    const nav = [];
    if (start > 0) nav.push([{ text: '⬅️ Попередні', callback_data: `tz_page_${page - 1}` }]);
    if (end < TIMEZONES.length) nav.push([{ text: '➡️ Наступні', callback_data: `tz_page_${page + 1}` }]);
    if (nav.length > 0) buttons.push(nav[0]);
    
    buttons.push([{ text: '🏠 До меню', callback_data: 'main_menu' }]);
    
    return { reply_markup: { inline_keyboard: buttons } };
  },

  // ====== EMAIL INPUT ======
  emailInputKeyboard() {
    return skipKeyboard('email', true);
  },

  // ====== PHONE INPUT ======
  phoneInputKeyboard() {
    return skipKeyboard('phone', true);
  },

  subscriptionInfoActiveKeyboard(expiringSoon = false) {
    const options = [];
    
    if (expiringSoon) {
      options.push({ text: '🔄 Продовжити', callback_data: 'renew_subscription' });
    }
    
    options.push(
      { text: '🔄 Оновити статус', callback_data: 'sync_subscription' },
      { text: '📞 Підтримка', callback_data: 'contact_support' }
    );
    
    return menuKeyboard(options);
  },

  subscriptionInfoInactiveKeyboard() {
    return menuKeyboard([
      { text: '💳 Оформити', callback_data: 'subscription_plans' },
      { text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' },
      { text: '📞 Підтримка', callback_data: 'contact_support' }
    ]);
  },

  subscriptionPlansKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: SUBSCRIPTION_PLANS.TRIAL.name, callback_data: 'plan_free' }],
          [{ text: SUBSCRIPTION_PLANS.WEEK.name, callback_data: 'plan_week' }],
          [{ text: SUBSCRIPTION_PLANS.MONTH.name, callback_data: 'plan_month' }],
          [{ text: SUBSCRIPTION_PLANS.YEAR.name, callback_data: 'plan_year' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_info' }]
        ]
      }
    };
  },

  subscriptionPaymentKeyboard(paymentLink) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Оплатити', url: paymentLink }],
          [{ text: '🔄 Перевірити', callback_data: 'sync_subscription' }],
          ...navigationKeyboard('subscription_plans').reply_markup.inline_keyboard
        ]
      }
    };
  },

  subscriptionExpiringKeyboard() {
    return menuKeyboard([
      { text: '🔄 Тиждень — 7€', callback_data: 'renew_week' },
      { text: '🔄 Місяць — 30€', callback_data: 'renew_month' },
      { text: '🔄 Рік — 300€', callback_data: 'renew_year' },
      { text: '📞 Підтримка', callback_data: 'contact_support' }
    ], false);
  },

  // ====== КОЛЕСО БАЛАНСУ ======
  wheelScoreInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          Array.from({ length: 6 }, (_, i) => ({
            text: String(i),
            callback_data: `wheel_score_${i}`
          })),
          Array.from({ length: 5 }, (_, i) => ({
            text: String(i + 6),
            callback_data: `wheel_score_${i + 6}`
          })),
          [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
        ]
      }
    };
  },

  wheelBalanceCompleteKeyboard() {
    return menuKeyboard([
      { text: '📊 Переглянути звіт', callback_data: 'wheel_stats' }
    ]);
  },

  // ====== AI НАСТАВНИК ======
  aiMentorControlKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Продовжити', callback_data: 'ai_continue' }],
          [
            { text: '👍 Корисно', callback_data: 'rate_helpful' },
            { text: '👎 Не дуже', callback_data: 'rate_not_helpful' }
          ],
          [{ text: '🚪 Вийти', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  // ====== ЩОДЕННІ ПИТАННЯ ======
  morningStartInline() {
    return actionKeyboard('morning', ['start', 'later']);
  },

  eveningStartInline() {
    return actionKeyboard('evening', ['start', 'later']);
  },

  sessionReminderInline(sessionType) {
    return actionKeyboard(sessionType, ['continue', 'exit']);
  },

  // ====== КУРСИ ======
  courseOfferKeyboard(problemType, title, price) {
    return menuKeyboard([
      { text: `📚 "${title}" — ${price}€`, callback_data: `buy_course_${problemType}` },
      { text: '👥 Консультація (150€)', callback_data: 'book_consultation' },
      { text: '⏭ Подумаю', callback_data: 'dismiss_offer' }
    ], false);
  },

  courseInfoKeyboard() {
    return navigationKeyboard('contact_support');
  },

  consultationInfoKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Написати Наді', url: 'https://t.me/Nadya2316' }],
          [{ text: '📧 Email', callback_data: 'contact_support' }],
          ...navigationKeyboard(null, true).reply_markup.inline_keyboard
        ]
      }
    };
  },
// ====== ПЕРЕВІРКА СТАТУСУ СЕСІЙ ======
eveningWithoutMorningKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌞 Пройти ранкові', callback_data: 'start_morning' }],
        [{ text: '⏭ Пропустити ранкові', callback_data: 'skip_morning_do_evening' }],
        [{ text: '🌙 Тільки вечірні', callback_data: 'force_evening' }],
        [{ text: '🚪 Вийти', callback_data: 'exit_all' }]
      ]
    }
  };
},
  // ====== УТИЛІТИ ======
  dismissOfferKeyboard() {
    return navigationKeyboard(null, true);
  },

  // Експортуємо універсальні функції
  utils: {
    skipKeyboard,
    actionKeyboard,
    navigationKeyboard,
    menuKeyboard
  }
};



export default keyboards;
export { skipKeyboard, actionKeyboard, navigationKeyboard, menuKeyboard };