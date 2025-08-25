// src/utils/keyboards.js
import { Markup } from 'telegraf';

const mainMenuKeyboard = () => {
  return Markup.keyboard([
    ["🌞 Ранкові питання", "🌙 Вечірні питання"],
    ["💎 Афірмація", "📊 Мій прогрес"],
    ["💰 Підписка", "❓ Допомога"],
    ["📋 Інструкції", "📞 Зв'язок з нами"]
  ]).resize();
};

const supportKeyboard = () => {
  console.log('supportKeyboard викликано');
  return Markup.inlineKeyboard([
    [Markup.button.url('📱 Telegram підтримка ментора', 'https://t.me/Nadya2316')],
    [Markup.button.url('🔧 Техпідтримка бота', 'https://t.me/vira_333')]  ]);
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
  skipKeyboard,
  subscriptionKeyboard
};
