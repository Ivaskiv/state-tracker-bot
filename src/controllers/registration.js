import { Scenes, Markup } from 'telegraf';
import { updateUser } from '../utils/airtable.js';
import { setupUserSchedule } from '../utils/scheduler.js';
import config from '../config/config.js';

const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  await ctx.reply('Вітаємо! Введіть ваше ім’я:');
  ctx.scene.state = {};
});

registerScene.on('text', async (ctx) => {
  if (!ctx.scene.state.name) {
    ctx.scene.state.name = ctx.message.text;
    await ctx.reply('Тепер введіть ваш email:');
  } else if (!ctx.scene.state.email) {
    const email = ctx.message.text;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.reply('Невірний формат email. Спробуйте ще раз.');
    }
    ctx.scene.state.email = email;

    const userId = ctx.from.id.toString();
    try {
      await updateUser(userId, {
        name: ctx.scene.state.name,
        email: ctx.scene.state.email,
        Status: 'Registered',
      });
      console.log(`Користувач оновлено в Airtable: ${userId}, name: ${ctx.scene.state.name}, email: ${ctx.scene.state.email}`);
    } catch (error) {
      console.error('Помилка оновлення користувача в Airtable:', error);
      await ctx.reply(config.errorMessage);
      return;
    }

    await ctx.reply('Обери розклад:', {
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

  const reminderText = config.frequencyOptions[schedule];
  const firstReminder = nextTime.toDateString() === now.toDateString()
    ? `сьогодні о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `вже завтра о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  await ctx.reply(
    `Ти обрав ${reminderText}. Перше нагадування буде ${firstReminder}.`
  );

  await setupUserSchedule(ctx.bot, { telegramId: userId, schedule });
  ctx.scene.leave();
});

export { registerScene, frequencyScene };