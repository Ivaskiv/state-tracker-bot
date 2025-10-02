// src/utils/keyboards.js - ОПТИМІЗОВАНА ВЕРСІЯ З УНІВЕРСАЛЬНИМИ ФУНКЦІЯМИ

import { TIMEZONES, SUBSCRIPTION_PLANS } from '../config/constants.js';

// ===== УНІВЕРСАЛЬНІ ГЕНЕРАТОРИ КЛАВІАТУР =====

/**
 * Універсальна функція для кнопки "Пропустити"
 * @param {string} field - назва поля (email, phone, тощо)
 * @param {boolean} withBack - додати кнопку "Назад"
 */
const skipKeyboard = (field, withBack = false) => {
  const buttons = [[{ text: `⏭️ Пропустити ${field}`, callback_data: `skip_${field}` }]];
  if (withBack) {
    buttons.push([{ text: '🔙 Назад', callback_data: `back_${field}` }]);
  }
  return { reply_markup: { inline_keyboard: buttons } };
};

/**
 * Універсальна функція для дій з об'єктом (старт/продовжити/вийти)
 * @param {string} entity - назва сутності (morning, evening, wheel, ai)
 * @param {Array} actions - масив дій ['start', 'continue', 'exit']
 */
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

/**
 * Універсальна функція для навігації назад/до меню
 * @param {string} backTo - callback для кнопки "Назад"
 * @param {boolean} withMainMenu - додати кнопку "До меню"
 */
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

/**
 * Універсальна функція для меню з опціями
 * @param {Array} options - масив об'єктів {text, callback_data}
 * @param {boolean} withNavigation - додати навігацію
 */
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
  // ====== ГОЛОВНЕ МЕНЮ ======
  mainMenuKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📊 Звіти' }, { text: '💰 Підписка' }],
          [{ text: '❓ Допомога' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
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
      { text: '📊 Звіти та аналітика', callback_data: 'capability_reports' },
      { text: '⏰ Автоматичні нагадування', callback_data: 'capability_schedule' }
    ], false);
  },

  // ====== МЕНЮ ЗВІТІВ ======
  reportsMenuInline() {
    return menuKeyboard([
      { text: '📊 Щотижневий', callback_data: 'get_weekly_report' },
      { text: '📅 Щомісячний', callback_data: 'get_monthly_report' },
      { text: '📈 Моя статистика', callback_data: 'my_progress' },
      { text: '🎯 Статистика колеса', callback_data: 'wheel_stats' }
    ]);
  },

  // ====== МЕНЮ ДОПОМОГИ ======
  helpMenuInline() {
    return menuKeyboard([
      { text: '📝 Інструкції', callback_data: 'instructions' },
      { text: '📞 Підтримка', callback_data: 'contact' },
      { text: '💎 Афірмація', callback_data: 'show_affirmation' }
    ]);
  },

  // ====== ОНБОРДИНГ (З УНІВЕРСАЛЬНИМИ ФУНКЦІЯМИ) ======
  greetingKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }]
        ]
      }
    };
  },

  // Використовуємо універсальну функцію skipKeyboard
  emailInputKeyboard() {
    return skipKeyboard('email');
  },

  phoneInputKeyboard() {
    return skipKeyboard('phone');
  },

  timezoneKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: TIMEZONES.slice(0, 10).map(tz => 
          [{ text: tz.label, callback_data: `tz_${tz.slug}` }]
        )
      }
    };
  },

  // ====== ПІДПИСКИ ======
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
          [{ text: SUBSCRIPTION_PLANS.YEAR.name, callback_data: 'plan_year' }]
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

  // ====== ЩОДЕННІ ПИТАННЯ (З УНІВЕРСАЛЬНОЮ ФУНКЦІЄЮ) ======
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

  // ====== УТИЛІТИ ======
  dismissOfferKeyboard() {
    return navigationKeyboard(null, true);
  },

  // Експортуємо універсальні функції для використання в інших місцях
  utils: {
    skipKeyboard,
    actionKeyboard,
    navigationKeyboard,
    menuKeyboard
  }
};

export default keyboards;

// Експортуємо також окремі утиліти
export { skipKeyboard, actionKeyboard, navigationKeyboard, menuKeyboard };