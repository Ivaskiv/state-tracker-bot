// src/utils/keyboards.js

import { TIMEZONES } from '../config/constants.js';

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
          [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
          [{ text: '💎 Афірмація' }, { text: '📊 Мій прогрес' }],
          [{ text: '💰 Підписка' }, { text: '❓ Допомога' }],
          [{ text: '📝 Інструкції' }, { text: '📞 Зв\'язок з нами' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
      }
    };
  },

  // ====== ОНБОРДИНГ ======
  onboardingStartKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Почати', callback_data: 'onboarding_start' }],
          [{ text: 'ℹ️ Про бота', callback_data: 'onboarding_about' }]
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
          ...TIMEZONES.map((tz) => [{ text: tz.label, callback_data: `tz_${tz.slug}` }]),
          [{ text: '🔙 Назад', callback_data: 'back_timezone' }]
        ]
      }
    };
  },

  timezoneConfirmedKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌍 Змінити TZ', callback_data: 'change_tz' }],
          [{ text: '🔙 Назад', callback_data: 'back_timezone' }],
          [{ text: '➡️ Далі', callback_data: 'go_plan' }]
        ]
      }
    };
  },

  onboardingPlanKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🧪 Пробний 7 днів — 0€', callback_data: 'pick_plan_trial_7d' }],
          [{ text: '🎯 Тиждень 7€', callback_data: 'pick_plan_week_7' }],
          [{ text: '📅 Місяць 30€', callback_data: 'pick_plan_month_30' }],
          [{ text: '🗓️ Рік 300€', callback_data: 'pick_plan_year_300' }]
        ]
      }
    };
  },

  onboardingPlanConfirmKeyboard(planValue) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Підтвердити', callback_data: `pay_${planValue}` }],
          [{ text: '🔙 Назад', callback_data: 'back_plan' }]
        ]
      }
    };
  },

  onboardingWheelStartKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Почати колесо', callback_data: 'wheel_start' }]
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

  // ====== ПІДПИСКА ======
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

  supportKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📞 Технічна підтримка', callback_data: 'contact_support' }],
          [{ text: '💰 Питання про підписку', callback_data: 'subscription_info' }],
          [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // ====== УТИЛІТАРНІ ======
  removeKeyboard() {
    return {
      reply_markup: { remove_keyboard: true }
    };
  },

  forceUpdateKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
          [{ text: '💎 Афірмація' }, { text: '📊 Мій прогрес' }],
          [{ text: '💰 Підписка' }, { text: '❓ Допомога' }],
          [{ text: '📝 Інструкції' }, { text: '📞 Зв\'язок з нами' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true
      }
    };
  },

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

  subscriptionPlansKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🧪 Пробний 7 днів — 0€', callback_data: 'plan_free' }],
          [{ text: '🎯 Тиждень — 7€', callback_data: 'plan_week' }],
          [{ text: '📅 Місяць — 30€', callback_data: 'plan_month' }],
          [{ text: '🗓️ Рік — 300€', callback_data: 'plan_year' }]
        ]
      }
    };
  },

  skipKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити', callback_data: 'skip_step' }]
        ]
      }
    };
  },

  confirmNameKeyboard(/* name */) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Залишити', callback_data: 'keep_name' }],
          [{ text: '✏️ Змінити',  callback_data: 'change_name' }]
        ]
      }
    };
  },
  // ====== ПІДПИСКИ - РОЗШИРЕНІ ======
  subscriptionInfoActiveKeyboard(expiringSoon = false) {
    const buttons = [];
    
    if (expiringSoon) {
      buttons.push([{ text: '🔄 Продовжити підписку', callback_data: 'renew_subscription' }]);
    }
    
    buttons.push(
      [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
      [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
    );
    
    return { reply_markup: { inline_keyboard: buttons } };
  },

  subscriptionInfoInactiveKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оформити підписку', callback_data: 'subscription_plans' }],
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
        ]
      }
    };
  },

  subscriptionPlansKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '7€ — Тиждень', callback_data: 'subscribe_week' }],
          [{ text: '30€ — Місяць', callback_data: 'subscribe_month' }],
          [{ text: '300€ — Рік', callback_data: 'subscribe_year' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_info' }]
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

  // ====== КУРСИ ТА ПРОПОЗИЦІЇ ======
  courseOfferKeyboard(problemType, offerTitle, price) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `📚 Курс "${offerTitle}" — ${price}€`, callback_data: `buy_course_${problemType}` }],
          [{ text: `👥 Консультація з Надею — 150€`, callback_data: 'book_consultation' }],
          [{ text: '⏭ Подумаю', callback_data: 'dismiss_offer' }],
          [{ text: '💬 Продовжити без курсу', callback_data: 'ai_continue' }]
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

  dismissOfferKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🤖 AI наставник', callback_data: 'ai_continue' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    };
  },

  // Додаємо також в default-об’єкт для зручності
  afterRegistrationKeyboard
};

export default keyboards;
