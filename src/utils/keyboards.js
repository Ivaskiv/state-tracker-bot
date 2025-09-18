// src/utils/keyboards.js - ОНОВЛЕНО З КОЛЕСОМ БАЛАНСУ ТА ВСІМА ФУНКЦІЯМИ

const keyboards = {
  // Головне меню (ДОДАНО колесо балансу)
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

  // AI наставник
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

  // Колесо балансу (ВИПРАВЛЕНО: кнопки 0-10)
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

  // Завершення колеса
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

  wheelCompleteInlineKeyboard() {
    return this.wheelBalanceCompleteKeyboard();
  },

  // Продовження сесій
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

  // Підписка (ДОДАНО нові кнопки)
  subscriptionKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Інформація про підписку', callback_data: 'subscription_info' }],
          [{ text: '🔄 Оновити статус', callback_data: 'subscription_sync' }],
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

  // Реєстрація
  skipKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '⏭️ Пропустити' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
  },

  // Утиліти
  removeKeyboard() {
    return {
      reply_markup: {
        remove_keyboard: true
      }
    };
  },

  // Форсоване оновлення меню
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