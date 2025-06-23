import { Telegraf, Scenes } from 'telegraf';
import dotenv from 'dotenv';
import { registerScene, frequencyScene } from './scenes/registration.js';
import { createThemeScene } from './scenes/createTheme.js';
import { initScheduler } from './utils/scheduler.js';
import { getUserByTgId, createUser } from './utils/airtable.js';
import { config } from './config/config.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const stage = new Scenes.Stage([registerScene, frequencyScene, createThemeScene]);

bot.use(stage.middleware());

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = await getUserByTgId(userId);

  if (!user) {
    // Створюємо нового користувача, якщо його немає в Airtable
    try {
      await createUser({
        tg_user_id: userId,
        Name: ctx.from.first_name || 'Unknown',
        Status: 'New User',
      });
      console.log(`Новий користувач створено в Airtable: ${userId}`);
    } catch (error) {
      console.error('Помилка створення користувача в Airtable:', error);
      await ctx.reply(config.errorMessage);
      return;
    }
    await ctx.reply(config.welcomeMessage);
    ctx.scene.enter('register');
  } else if (user.fields.Status === 'New User') {
    await ctx.reply(config.welcomeMessage);
    ctx.scene.enter('register');
  } else {
    await ctx.reply(`Вітаємо, ${user.fields.Name}! Ви вже зареєстровані. Використовуйте /set_schedule для зміни розкладу.`);
  }
});

bot.command('set_schedule', async (ctx) => {
  ctx.scene.enter('frequency');
});

bot.command('create_theme', async (ctx) => {
  if (!config.admins.includes(ctx.from.id)) {
    return ctx.reply('У вас немає прав для створення тем.');
  }
  ctx.scene.enter('createTheme');
});

bot.launch()
  .then(() => {
    console.log('Бот Надя запущено!');
    initScheduler(bot);
  })
  .catch(err => console.error('Помилка запуску бота:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));