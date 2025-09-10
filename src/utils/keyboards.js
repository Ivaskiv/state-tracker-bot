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
  INSTRUCTIONS: '📊 Інструкції',
  CONTACT: '📞 Зв\'язок з нами',
  PROFILE: 'ℹ️ Профіль',                // симетрія до CONTACT
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
        ["📊 Мій прогрес", "💰 Підписка"],
        ["❓ Допомога", "📝 Інструкції"],
        ["📞 Зв'язок з нами", 'ℹ️ Профіль']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
};

export const continueAnswersKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('✅ Продовжити відповіді', 'continue_answers')],
      [Markup.button.callback('⏭️ Пропустити сесію', 'skip_session')]
    ]).reply_markup
  };
};

const supportKeyboard = () => {
  return {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.url('📱 Telegram підтримка ментора', 'https://t.me/Nadya2316')],
      [Markup.button.url('🔧 Техпідтримка бота', 'https://t.me/vira_333')]
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
    [Markup.button.callback('« Назад', 'main_menu')]
  ]);

export default {
  mainMenuKeyboard,
  supportKeyboard,
  continueAnswersKeyboard,
  skipKeyboard,
  subscriptionKeyboard
};
