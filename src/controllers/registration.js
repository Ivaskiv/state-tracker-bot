import { Scenes, Markup } from 'telegraf';
import User from '../models/user.js';
import { configData } from '../config/configData.js';

// Функція для завантаження налаштувань частоти
const getFrequencyText = (frequency) => {
  return configData.frequencyOptions[frequency] || `${frequency} хвилин`;
};

// Сцена для реєстрації користувача
const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  const userId = ctx.from.id;

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

// Сцена для вибору частоти опитувань
const frequencyScene = new Scenes.BaseScene('frequency');
frequencyScene.enter((ctx) => {
  ctx.reply('Оберіть частоту опитувань:');
});
frequencyScene.on('text', (ctx) => ctx.reply('Частота: ' + ctx.message.text));

// Сцена для вибору часу опитувань
const timeScene = new Scenes.BaseScene('time');
timeScene.enter((ctx) => {
  ctx.reply('Введіть час початку та закінчення опитування (наприклад: 09:00 18:00):');
});
timeScene.on('text', (ctx) => ctx.reply('Час: ' + ctx.message.text));

export { registerScene, frequencyScene, timeScene };
