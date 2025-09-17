// src/utils/keyboards.js - ВИПРАВЛЕНА ВЕРСІЯ

const keyboards = {
  // Головне меню з кнопками
  mainMenuKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
          [{ text: '📊 Мій прогрес' }, { text: '💎 Афірмація' }],
          [{ text: '💰 Підписка' }, { text: '📞 Зв\'язок з нами' }],
          [{ text: 'ℹ️ Профіль' }, { text: '❓ Допомога' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        persistent: true
      }
    };
  },

  // Inline клавіатура для підтвердження дії
  confirmationInlineKeyboard(actionText = 'дію') {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Так', callback_data: 'confirm_yes' },
            { text: '❌ Ні', callback_data: 'confirm_no' }
          ]
        ]
      }
    };
  },

  // Inline клавіатура для AI наставника
  aiMentorInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Продовжити', callback_data: 'ai_continue' }],
          [{ text: '🚪 Вийти', callback_data: 'ai_exit' }]
        ]
      }
    };
  },

  // Inline клавіатура для колеса балансу (оцінки 1-10)
  wheelScoreInlineKeyboard() {
    const keyboard = [];
    
    // Перший ряд: 1-5
    keyboard.push([
      { text: '1️⃣', callback_data: 'wheel_score_1' },
      { text: '2️⃣', callback_data: 'wheel_score_2' },
      { text: '3️⃣', callback_data: 'wheel_score_3' },
      { text: '4️⃣', callback_data: 'wheel_score_4' },
      { text: '5️⃣', callback_data: 'wheel_score_5' }
    ]);
    
    // Другий ряд: 6-10
    keyboard.push([
      { text: '6️⃣', callback_data: 'wheel_score_6' },
      { text: '7️⃣', callback_data: 'wheel_score_7' },
      { text: '8️⃣', callback_data: 'wheel_score_8' },
      { text: '9️⃣', callback_data: 'wheel_score_9' },
      { text: '🔟', callback_data: 'wheel_score_10' }
    ]);
    
    // Третій ряд: кнопка виходу
    keyboard.push([
      { text: '🚪 Вийти', callback_data: 'wheel_exit' }
    ]);

    return {
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  },

  // Inline клавіатура після завершення колеса балансу
  wheelCompleteInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Пройти знову', callback_data: 'wheel_retry' }],
          [{ text: '🆕 Нове колесо', callback_data: 'wheel_start_new' }],
          [{ text: '🏠 В меню', callback_data: 'wheel_to_menu' }]
        ]
      }
    };
  },

  // Inline клавіатура для продовження/пропуску сесій
  continueSessionInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
          [{ text: '🚪 Пропустити сесію', callback_data: 'skip_session' }]
        ]
      }
    };
  },

  // Inline клавіатура для рестарту сесій
  restartSessionInlineKeyboard(sessionType) {
    const sessionText = sessionType === 'morning' ? 'ранкову сесію' : 'вечірню сесію';
    
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🔄 Перезапустити ${sessionText}`, callback_data: `restart_${sessionType}` }],
          [{ text: '❌ Скасувати', callback_data: 'cancel_restart' }]
        ]
      }
    };
  },

  // Inline клавіатура для підписки
  subscriptionInlineKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Інформація про підписку', callback_data: 'subscription_info' }],
          [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
        ]
      }
    };
  },

  // Просте видалення клавіатури
  removeKeyboard() {
    return {
      reply_markup: {
        remove_keyboard: true
      }
    };
  },

  // Форсоване оновлення клавіатури
  forceUpdateKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🤖 AI наставник' }, { text: '🎯 Колесо балансу' }],
          [{ text: '📈 Щотижневий звіт' }, { text: '📈 Щомісячний звіт' }],
          [{ text: '📊 Мій прогрес' }, { text: '💎 Афірмація' }],
          [{ text: '💰 Підписка' }, { text: '📞 Зв\'язок з нами' }],
          [{ text: 'ℹ️ Профіль' }, { text: '❓ Допомога' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        persistent: true,
        selective: false
      }
    };
  }
};

export default keyboards;