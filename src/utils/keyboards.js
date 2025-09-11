// src/utils/keyboards.js
import { Markup } from 'telegraf';

export const BUTTONS = Object.freeze({
  WEEKLY_REPORT: '📈 Щотижневий звіт',
  MONTHLY_REPORT: '📈 Щомісячний звіт',
  AI_ASSISTANT: '🤖 AI наставник',
  AFFIRMATION: '💎 Афірмація',
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

// Головне меню (симетричне)
export const mainMenuKeyboard = () => {
  return {
    reply_markup: {
      keyboard: [
        ["📈 Щотижневий звіт", "📈 Щомісячний звіт"],    
        ["🤖 AI наставник", "💎 Афірмація"],
        ["📊 Мій прогрес", "💰 Підписка"],
        ["❓ Допомога", "📝 Інструкції"], // повертаємо оригінальну іконку
        ["📞 Зв'язок з нами", 'ℹ️ Профіль'] // симетрично
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
};

// Клавіатура для продовження відповідей
export const continueAnswersKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Продовжити відповіді', 'continue_answers')],
      [Markup.button.callback('⏭️ Пропустити сесію', 'skip_session')]
    ]).reply_markup
  };
};

// Клавіатура підтримки
const supportKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📱 Telegram ментора', 'https://t.me/Nadya2316')],
      [Markup.button.url('🔧 Техпідтримка', 'https://t.me/vira_333')]
    ]).reply_markup
  };
};

// Клавіатура для пропуску
const skipKeyboard = () =>
  Markup.keyboard([
    ['⏭️ Пропустити'],
    ['🏠 Головне меню']
  ]).resize();

// Клавіатура вибору плану підписки
const subscriptionKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('🔹 Тиждень фокусу — 7€', 'subscribe_week')],
    [Markup.button.callback('🔹 Місяць дії — 30€', 'subscribe_month')],
    [Markup.button.callback('🔹 Рік трансформації — 300€', 'subscribe_year')],
    [Markup.button.callback('« Назад до меню', 'main_menu')]
  ]);

// Клавіатура поновлення підписки (для нагадувань)
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
  skipKeyboard,
  subscriptionKeyboard,
  renewalKeyboard
};