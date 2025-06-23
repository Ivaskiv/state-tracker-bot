import { Scenes, Markup } from 'telegraf';
import { config } from '../config/config.js';
import { createUser, updateUser } from '../utils/airtable.js';
import { setupUserSchedule } from '../utils/scheduler.js';

const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  await ctx.reply('Введіть ваше ім’я:');
  ctx.scene.state = {};
});

registerScene.on('text', async (ctx) => {
  if (!ctx.scene.state.name) {
    ctx.scene.state.name = ctx.message.text;
    await ctx.reply('Введіть ваш email:');
  } else if (!ctx.scene.state.email) {
    const email = ctx.message.text;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.reply('Невірний формат email. Спробуйте ще раз.');
    }
    ctx.scene.state.email = email;

    const userId = ctx.from.id;
    await updateUser(userId.toString(), {
      Name: ctx.scene.state.name,
      Email: email,
      Status: 'Registered',
    });

    await ctx.reply('Оберіть розклад:', {
      reply_markup: {
        inline_keyboard: config.keyboard.frequencyButtons.map(button => [
          Markup.button.callback(button.text, button.callback_data),
        ]),
      },
    });
    ctx.scene.enter('frequency');
  }
});

const frequencyScene = new Scenes.BaseScene('frequency');

frequencyScene.enter(async (ctx) => {
  await ctx.reply('Обери розклад:', {
    reply_markup: {
      inline_keyboard: config.keyboard.frequencyButtons.map(button => [
        Markup.button.callback(button.text, button.callback_data),
      ]),
    },
  });
});

frequencyScene.action(/^freq_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const schedule = ctx.match[1];

  // Визначаємо наступне нагадування на основі розкладу
  const now = new Date();
  let nextTime = new Date(now);
  if (schedule === 'Once') {
    nextTime.setHours(9, 0, 0, 0);
  } else if (schedule === 'Twice') {
    nextTime.setHours(now.getHours() < 9 ? 9 : 18, 0, 0, 0);
  } else if (schedule === 'ThreeTimes') {
    nextTime.setHours(now.getHours() < 9 ? 9 : now.getHours() < 15 ? 15 : 18, 0, 0, 0);
  } else if (schedule === 'FourTimes') {
    nextTime.setHours(now.getHours() < 9 ? 9 : now.getHours() < 12 ? 12 : now.getHours() < 15 ? 15 : 18, 0, 0, 0);
  } else if (schedule === 'Hourly') {
    nextTime.setHours(now.getHours() + 1, 0, 0, 0);
  }
  if (nextTime <= now) {
    nextTime.setDate(nextTime.getDate() + 1);
  }

  // Зберігаємо розклад і наступне нагадування в Airtable
  try {
    await updateUser(userId.toString(), {
      Schedule: schedule,
      NextReminder: nextTime.toISOString(),
    });
  } catch (error) {
    console.error('Помилка збереження розкладу в Airtable:', error);
    await ctx.reply(config.errorMessage);
    return;
  }

  // Формуємо текст підтвердження
  const reminderText = config.frequencyOptions[schedule];
  const firstReminder = nextTime.toDateString() === now.toDateString()
    ? `сьогодні о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `вже завтра о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  await ctx.reply(
    `Ти обрав ${reminderText}. Перше нагадування буде ${firstReminder}.\n\n` +
    `Ось підтримуюча фраза для тебе:\n${await getRandomPhrase(userId)}`
  );

  // Налаштовуємо розклад для користувача
  await setupUserSchedule(ctx.bot, { telegramId: userId, schedule });
  ctx.scene.leave();
});

export { registerScene, frequencyScene };