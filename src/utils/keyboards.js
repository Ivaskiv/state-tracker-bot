// src/utils/keyboards.js
// Єдине джерело клавіатур. Використовуємо централізовані константи.

import { TIMEZONES, SUBSCRIPTION_PLANS, MENU_BUTTONS } from '../config/constants.js';

// ===== ІМЕНОВАНИЙ ЕКСПОРТ: кнопка після реєстрації =====
export const afterRegistrationKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '▶️ Почати', callback_data: 'open_main' }],
      [{ text: '💳 Підписка', callback_data: 'subscription_info' }]
    ]
  }
});

const keyboards = {
  // ====== ГОЛОВНЕ МЕНЮ ======
 mainMenuKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI Наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📊 Звіти та прогрес' }, { text: '💰 Підписка' }],
          [{ text: '❓ Допомога та 📞 підтримка' }], 
          [{ text: '📝 Інструкції', callback_data: 'instructions' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
      }
    };
  },

  // ====== МЕНЮ ЗВІТІВ ======
  reportsMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Щотижневий звіт', callback_data: 'get_weekly_report' }],
          [{ text: '📅 Щомісячний звіт', callback_data: 'get_monthly_report' }],
          [{ text: '📈 Мій прогрес', callback_data: 'my_progress' }],
          [{ text: '🎯 Статистика колеса', callback_data: 'wheel_stats' }],
          [{ text: '🔙 Назад до меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== МЕНЮ ДОПОМОГИ ======
  helpMenuInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Інструкції', callback_data: 'instructions' }],
          [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact' }],
          [{ text: '💎 Отримати афірмацію', callback_data: 'show_affirmation' }],
          [{ text: '🔙 Назад до меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  quickStartInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 AI наставник', callback_data: 'ai_start_question' },
            { text: '🎯 Колесо балансу', callback_data: 'wheel_start' }
          ],
          [
            { text: '📊 Мій прогрес', callback_data: 'wheel_stats' },
            { text: '💰 Підписка', callback_data: 'subscription_info' }
          ],
          [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== ОНБОРДИНГ ======
  greetingKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
          [{ text: 'ℹ️ Про бота', callback_data: 'about_bot' }]
        ]
      }
    };
  },

  emailInputKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити e-mail', callback_data: 'skip_email' }],
          [{ text: '🔙 Назад', callback_data: 'back_email' }]
        ]
      }
    };
  },

  phoneInputKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити телефон', callback_data: 'skip_phone' }],
          [{ text: '🔙 Назад', callback_data: 'back_phone' }]
        ]
      }
    };
  },

  timezoneKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          ...TIMEZONES.slice(0, 10).map((tz) => [{ text: tz.label, callback_data: `tz_${tz.slug}` }]),
          [{ text: '🔙 Назад', callback_data: 'back_timezone' }]
        ]
      }
    };
  },

  // ====== ПІДПИСКИ ======
  subscriptionKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Інформація про підписку', callback_data: 'subscription_info' }],
          [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
          [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }],
          [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  subscriptionInfoActiveKeyboard(expiringSoon = false) {
    const buttons = [];
    if (expiringSoon) {
      buttons.push([{ text: '🔄 Продовжити підписку', callback_data: 'renew_subscription' }]);
    }
    buttons.push(
      [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
      [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }],
      [{ text: '🏠 До меню', callback_data: 'main_menu' }]
    );
    return { reply_markup: { inline_keyboard: buttons } };
  },

  subscriptionInfoInactiveKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оформити підписку', callback_data: 'subscription_plans' }],
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ЄДИНИЙ варіант списку планів (без дубльованої функції)
  subscriptionPlansKeyboard() {
    // Використаємо SUBSCRIPTION_PLANS з констант — підписи стандартизовані
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
          [{ text: '🔗 Перейти до оплати', url: paymentLink }],
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_plans' }]
        ]
      }
    };
  },

  subscriptionRenewalKeyboard(paymentLink) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Перейти до оплати', url: paymentLink }],
          [{ text: '🔄 Перевірити оплату', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
        ]
      }
    };
  },

  subscriptionExpiringKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Продовжити на тиждень — 7€', callback_data: 'renew_week' }],
          [{ text: '🔄 Продовжити на місяць — 30€', callback_data: 'renew_month' }],
          [{ text: '🔄 Продовжити на рік — 300€', callback_data: 'renew_year' }],
          [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
        ]
      }
    };
  },

  subscriptionSupportKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '🔙 Назад до підписки', callback_data: 'subscription_info' }]
        ]
      }
    };
  },

  // ====== КОЛЕСО БАЛАНСУ ======
  wheelScoreInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '0',  callback_data: 'wheel_score_0'  },
            { text: '1',  callback_data: 'wheel_score_1'  },
            { text: '2',  callback_data: 'wheel_score_2'  },
            { text: '3',  callback_data: 'wheel_score_3'  },
            { text: '4',  callback_data: 'wheel_score_4'  },
            { text: '5',  callback_data: 'wheel_score_5'  }
          ],
          [
            { text: '6',  callback_data: 'wheel_score_6'  },
            { text: '7',  callback_data: 'wheel_score_7'  },
            { text: '8',  callback_data: 'wheel_score_8'  },
            { text: '9',  callback_data: 'wheel_score_9'  },
            { text: '10', callback_data: 'wheel_score_10' }
          ],
          [{ text: '🚪 Вийти із сесії', callback_data: 'wheel_exit' }]
        ]
      }
    };
  },

  wheelBalanceCompleteKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Мій прогрес', callback_data: 'wheel_stats' }],
          [{ text: '🔄 Пройти знову за місяць', callback_data: 'wheel_info' }],
          [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== AI НАСТАВНИК ======
  aiMentorStartKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Задати питання', callback_data: 'ai_start_question' }],
          [{ text: '🚪 Вийти', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  aiMentorControlKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Продовжити діалог', callback_data: 'ai_continue' }],
          [
            { text: '📊 Звіт за тиждень', callback_data: 'ai_report' },
            { text: '🎯 Режим цілей', callback_data: 'ai_goals' }
          ],
          [
            { text: '👍 Корисно', callback_data: 'rate_helpful' },
            { text: '👎 Не дуже', callback_data: 'rate_not_helpful' }
          ],
          [{ text: '🚪 Вийти', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  // ====== ПИТАННЯ-ВІДПОВІДІ ======
  continueAnswersKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
          [{ text: '🚪 Пропустити сесію', callback_data: 'skip_session' }]
        ]
      }
    };
  },

  exitSessionKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔁 Продовжити', callback_data: 'continue_answers' }],
          [{ text: '🚪 Вийти із сесії', callback_data: 'skip_session' }]
        ]
      }
    };
  },

  // ====== КУРСИ ======
  courseOfferKeyboard(problemType, title, price) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `📚 "${title}" — ${price}€`, callback_data: `buy_course_${problemType}` }],
          [{ text: '👥 Консультація (150€)', callback_data: 'book_consultation' }],
          [{ text: '💬 Продовжити без курсу', callback_data: 'ai_continue' }],
          [{ text: '⏭ Подумаю', callback_data: 'dismiss_offer' }]
        ]
      }
    };
  },

  courseInfoKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Написати в підтримку', callback_data: 'contact_support' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  consultationInfoKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Написати Наді', url: 'https://t.me/Nadya2316' }],
          [{ text: '📧 Email', callback_data: 'contact_support' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },
  morningStartInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌞 Почати ранкову рефлексію', callback_data: 'start_morning' }]
        ]
      }
    };
  },

  eveningStartInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌙 Почати вечірню рефлексію', callback_data: 'start_evening' }]
        ]
      }
    };
  },

  sessionReminderInline(sessionType) {
    const continueCb = sessionType === 'morning' ? 'continue_morning' : 'continue_evening';
    const exitCb = sessionType === 'morning' ? 'exit_morning' : 'exit_evening';
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔁 Продовжити', callback_data: continueCb }],
          [{ text: '🚪 Вийти', callback_data: exitCb }]
        ]
      }
    };
  },

  weeklyReportInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Почати щотижневий аналіз', callback_data: 'start_weekly' }]
        ]
      }
    };
  },

  midDayCheckInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Деталі', callback_data: 'show_task_details' }],
          [{ text: '🔄 Оновити план', callback_data: 'update_tasks' }]
        ]
      }
    };
  },

  taskReminderInline() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Готовий', callback_data: 'task_start' }],
          [{ text: '⏭ Перенести', callback_data: 'task_reschedule' }]
        ]
      }
    };
  },

  // ====== УТИЛІТАРНІ ======
  removeKeyboard() {
    return { reply_markup: { remove_keyboard: true } };
  },

  forceUpdateKeyboard() {
    return this.mainMenuKeyboard();
  },

  // Експортуємо також іменований afterRegistrationKeyboard
  afterRegistrationKeyboard
};

export default keyboards;
