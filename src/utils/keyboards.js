// src/utils/keyboards.js - ДОДАНО КЛАВІАТУРУ ДЛЯ ЗАВЕРШЕННЯ КОЛЕСА

import { Markup } from 'telegraf';

export const BUTTONS = Object.freeze({
  WEEKLY_REPORT: '📈 Щотижневий звіт',
  MONTHLY_REPORT: '📈 Щомісячний звіт',
  AI_ASSISTANT: '🤖 AI наставник',
  AFFIRMATION: '💎 Афірмація',
  WHEEL_BALANCE: '🎯 Колесо балансу', 
  PROGRESS: '📊 Мій прогрес',
  SUBSCRIPTION: '💰 Підписка',
  HELP: '❓ Допомога',
  INSTRUCTIONS: '📝 Інструкції',
  CONTACT: '📞 Зв\'язок з нами',
  PROFILE: 'ℹ️ Профіль', 
  CONTINUE_ANSWERS: '🔄 Продовжити відповіді',
  SKIP: '⏭️ Пропустити',
  HOME: '🏠 Головне меню',
  AI_EXIT: '🔚 Вийти з AI',
});

export const mainMenuKeyboard = () => {
  return {
    reply_markup: {
      keyboard: [
        ["📈 Щотижневий звіт", "📈 Щомісячний звіт"],    
        ["🤖 AI наставник", "💎 Афірмація"],
        ["🎯 Колесо балансу", "📊 Мій прогрес"], 
        ["💰 Підписка", "❓ Допомога"],
        ["📝 Інструкції", "📞 Зв'язок з нами"],
        ['ℹ️ Профіль']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
};

export const continueAnswersKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Продовжити відповіді', 'continue_answers')],
      [Markup.button.callback('⏭️ Пропустити сесію', 'skip_session')]
    ]).reply_markup
  };
};

export const wheelBalanceCompleteKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 Пройти ще раз', callback_data: 'wheel_retry' },
          { text: '🏠 Головне меню', callback_data: 'wheel_exit' }
        ]
      ]
    }
  };
};

export const aiMentorStartKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔚 Вийти з AI', callback_data: 'ai_exit' }
        ]
      ]
    }
  };
};

export const aiMentorControlKeyboard = () => {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Запитати ще', callback_data: 'ai_continue' },
          { text: '🔚 Війти з AI', callback_data: 'ai_exit' }
        ]
      ]
    }
  };
};

const supportKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📱 Telegram ментора', 'https://t.me/Nadya2316')],
      [Markup.button.url('🔧 Техпідтримка', 'https://t.me/vira_333')]
    ]).reply_markup
  };
};

const skipKeyboard = () =>
  Markup.keyboard([
    ['⏭️ Пропустити'],
    ['🏠 Головне меню']
  ]).resize();

const subscriptionKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔹 Тиждень фокусу — 7€', 'subscribe_week')],
    [Markup.button.callback('🔹 Місяць дії — 30€', 'subscribe_month')],
    [Markup.button.callback('🔹 Рік трансформації — 300€', 'subscribe_year')],
    [Markup.button.callback('« Назад до меню', 'main_menu')]
  ]);

const renewalKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Поновити тиждень — 7€', 'renew_week'),
      Markup.button.callback('🔄 Поновити місяць — 30€', 'renew_month')
    ],
    [Markup.button.callback('🔄 Поновити рік — 300€', 'renew_year')],
    [Markup.button.callback('💬 Зв\'язатися з підтримкою', 'contact_support')]
  ]);

export default {
  mainMenuKeyboard,
  supportKeyboard,
  continueAnswersKeyboard,
  aiMentorStartKeyboard,
  aiMentorControlKeyboard,
  wheelBalanceCompleteKeyboard,
  skipKeyboard,
  subscriptionKeyboard,
  renewalKeyboard
};