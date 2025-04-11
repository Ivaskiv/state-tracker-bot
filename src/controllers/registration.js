import { Scenes, Markup } from 'telegraf';
import User from '../models/user.js';
import { loadConfig } from '../utils/configUtils.js';

// Функція для завантаження налаштувань частоти
const getFrequencyText = (frequency) => {
  switch (frequency) {
    case '15': return '15 хвилин';
    case '30': return '30 хвилин';
    case '60': return '1 година';
    case '120': return '2 години';
    default: return `${frequency} хвилин`;
  }
};

// Сцена для реєстрації користувача
const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  const userId = ctx.from.id;
  const config = loadConfig();

  // Реєстрація або перевірка існуючого користувача
  let user = await User.findOne({ telegramId: userId });
  if (!user) {
    user = new User({
      telegramId: userId,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    });
    await user.save();
  }

  // Привітальне повідомлення для нового або існуючого користувача
  if (user.telegramId === userId) {
    await ctx.reply(`Вітаємо, ${user.firstName}! Ваші поточні налаштування:\nЧастота опитувань: ${getFrequencyText(user.pollFrequency)}\nЧас: ${user.pollStartTime}:00 - ${user.pollEndTime}:00 🕒`);
    await ctx.reply('Бажаєте змінити налаштування?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Так, змінити налаштування 🔧', callback_data: 'change_settings' }],
          [{ text: 'Ні, залишити без змін ✅', callback_data: 'keep_settings' }],
        ],
      },
    });
  }
});

// Обробка вибору зміни налаштувань
registerScene.action('change_settings', (ctx) => {
  ctx.answerCbQuery();
  ctx.scene.enter('frequency');
});

// Обробка залишення налаштувань без змін
registerScene.action('keep_settings', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Чудово! Ваші налаштування залишаються без змін.');
  ctx.scene.leave();
});

// Основне меню
const sendMainMenu = async (ctx) => {
  const mainMenu = Markup.inlineKeyboard([
    [Markup.button.callback('Почати реєстрацію', 'start_registration')],
    [Markup.button.callback('Переглянути налаштування', 'view_settings')],
    [Markup.button.callback('Допомога', 'help')],
    [Markup.button.callback('Очистити чат', 'clear_chat')]
  ]);
  await ctx.reply('Оберіть дію:', mainMenu);
};

export { registerScene, sendMainMenu };
