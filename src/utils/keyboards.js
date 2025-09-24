// src/utils/keyboards.js - ВИПРАВЛЕНІ КЛАВІАТУРИ

import { TIMEZONES, parseTz } from '../config/constants.js';

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
          ...TIMEZONES.map(tz => ([{ text: tz, callback_data: `tz_${parseTz(tz)}` }])),
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
      reply_markup: { 
        remove_keyboard: true 
      }
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
  }
};

export default keyboards; 