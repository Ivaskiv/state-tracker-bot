// src/services/dailySessions/keyboards.js

export const buildExitKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [[{ text: '🚪 Вийти з сесії', callback_data: 'exit_session' }]]
  }
});

export const buildRestartWarningKeyboard = (type) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔄 Почати заново', callback_data: `restart_${type}` }],
      [{ text: '✅ Залишити як є', callback_data: 'dismiss_reminder' }],
      [{ text: '🏠 До меню', callback_data: 'main_menu' }]
    ]
  }
});

export const buildEveningWithoutMorningKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '🌞 Пройти ранкові зараз', callback_data: 'start_morning' }],
      [{ text: '⏭️ Пропустити ранкові', callback_data: 'skip_morning_do_evening' }],
      [{ text: '🏠 До меню', callback_data: 'main_menu' }]
    ]
  }
});

export const buildSessionStartKeyboard = (type) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: type === 'morning' ? '🌞 Почати ранкову' : '🌙 Почати вечірню', callback_data: `start_${type}` }],
      [{ text: '⏭️ Пізніше', callback_data: `later_${type}` }]
    ]
  }
});