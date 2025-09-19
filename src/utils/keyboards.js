const keyboards = {
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
        persistent: true
      }
    };
  },

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

  onboardingPlanKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Тиждень 7€', callback_data: 'pick_plan_week_7' }],
          [{ text: '📅 Місяць 30€', callback_data: 'pick_plan_month_30' }],
          [{ text: '🗓️ Рік 300€', callback_data: 'pick_plan_year_300' }],
          [{ text: '🧪 Free 7 днів', callback_data: 'pick_plan_trial_7d' }]
        ]
      }
    };
  },

  onboardingPlanConfirmKeyboard(planValue) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатити', callback_data: `pay_${planValue}` }],
          [{ text: '🔙 Змінити', callback_data: 'back_plan' }]
        ]
      }
    };
  },

  onboardingPaymentSuccessKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚙️ Налаштувати нагадування', callback_data: 'reminders' }]
        ]
      }
    };
  },

  onboardingRemindersKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Ок', callback_data: 'rem_ok' }],
          [{ text: '⏱️ Змінити пізніше', callback_data: 'rem_later' }]
        ]
      }
    };
  },

  onboardingWheelStartKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🧭 Почати колесо', callback_data: 'wheel_start' }]
        ]
      }
    };
  },

  aiMentorStartKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Задати питання', callback_data: 'ai_continue' }],
          [{ text: '🚪 Вийти', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  aiMentorControlKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Продовжити діалог', callback_data: 'ai_continue' }],
          [{ text: '🚪 Завершити', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  wheelScoreInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '0', callback_data: 'wheel_score_0' },
            { text: '1', callback_data: 'wheel_score_1' },
            { text: '2', callback_data: 'wheel_score_2' },
            { text: '3', callback_data: 'wheel_score_3' },
            { text: '4', callback_data: 'wheel_score_4' },
            { text: '5', callback_data: 'wheel_score_5' }
          ],
          [
            { text: '6', callback_data: 'wheel_score_6' },
            { text: '7', callback_data: 'wheel_score_7' },
            { text: '8', callback_data: 'wheel_score_8' },
            { text: '9', callback_data: 'wheel_score_9' },
            { text: '10', callback_data: 'wheel_score_10' }
          ],
          [
            { text: '🚪 Вийти', callback_data: 'wheel_exit' }
          ]
        ]
      }
    };
  },

  wheelBalanceCompleteKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Пройти знову', callback_data: 'wheel_start_new' }],
          [{ text: '🏠 Головне меню', callback_data: 'wheel_to_menu' }]
        ]
      }
    };
  },

  continueAnswersKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Продовжити відповіді', callback_data: 'continue_answers' }],
          [{ text: '⏭️ Пропустити сесію', callback_data: 'skip_session' }]
        ]
      }
    };
  },

  subscriptionKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Інформація про підписку', callback_data: 'subscription_info' }],
          [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
          [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
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
        persistent: true
      }
    };
  }
};

export default keyboards;