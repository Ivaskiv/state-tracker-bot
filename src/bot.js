import { Telegraf } from 'telegraf';
import { handleSettingsCommand, handleChangeTime, handleChangeWelcomeMessage } from './controllers/configController.js';
import { loadConfig, saveConfig } from './config/settings.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('settings', handleSettingsCommand);

bot.action('change_time', handleChangeTime);
bot.action('change_welcome', handleChangeWelcomeMessage);

// Обробка текстових повідомлень
bot.on('text', async (ctx) => {
  const config = loadConfig();
  const userId = ctx.from.id;

  if (ctx.session.action === 'change_time') {
    const [startTime, endTime] = ctx.message.text.split(' ');
    if (startTime && endTime) {
      config.startTime = startTime;
      config.endTime = endTime;
      saveConfig(config);
      await ctx.reply(`Час роботи бота змінено на: ${startTime} - ${endTime}`);
    } else {
      await ctx.reply('Невірний формат. Введіть час у форматі: ЧЧ:ММ ЧЧ:ММ');
    }
    ctx.session.action = null;
  } else if (ctx.session.action === 'change_welcome') {
    config.welcomeMessage = ctx.message.text;
    saveConfig(config);
    await ctx.reply(`Привітальне повідомлення змінено на: ${ctx.message.text}`);
    ctx.session.action = null;
  }
});

bot.launch();
