import dotenv from 'dotenv';
import { Telegraf, Scenes, session } from 'telegraf';
import mongoose from 'mongoose';
import { Markup } from 'telegraf';

// Імпорт контролерів
import * as polling from './controllers/polling.js';
import * as reporting from './controllers/reporting.js';
import * as registration from './controllers/registration.js'; 

// Імпорт сервісів
import * as scheduler from './utils/scheduler.js';

// Підключення до бази даних
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Ініціалізація бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Головне меню
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('Почати реєстрацію', 'start_registration')],
  [Markup.button.callback('Переглянути налаштування', 'view_settings')],
  [Markup.button.callback('Допомога', 'help')]
]);

// Функція для відправки головного меню
const sendMainMenu = async (ctx) => {
  await ctx.reply('Оберіть дію:', mainMenu);
};

// Налаштування сцен для реєстрації
const stage = new Scenes.Stage([
  registration.registerScene,
  registration.frequencyScene,
  registration.timeScene
]);

// Налаштування сесій і сцен
bot.use(session());
bot.use(stage.middleware());

// Обробка команди /start
bot.command('start', (ctx) => {
  ctx.scene.enter('register');
  sendMainMenu(ctx); // Показуємо головне меню після запуску
});

// Обробка команди /help
bot.command('help', async (ctx) => {
  await ctx.reply(
    'Я допоможу відстежувати твій емоційний стан. Доступні команди:\n' +
    '/start - Почати або перезапустити бота\n' +
    '/poll - Пройти опитування прямо зараз\n' +
    '/settings - Змінити налаштування опитувань\n' +
    '/report - Отримати звіт за сьогодні\n' +
    '/weekly - Отримати тижневий звіт'
  );
  sendMainMenu(ctx); // Показуємо головне меню після допомоги
});

// Налаштування команд і callbackів опитування
bot.command('poll', polling.startPoll);
bot.action(/state_(.+)/, polling.handleStateResponse);
bot.action(/emotion_(.+)/, polling.handleEmotionResponse);
bot.action(/feeling_(.+)/, polling.handleFeelingResponse);
bot.action(/action_(.+)/, polling.handleActionResponse);

// Команди для звітів
bot.command('report', reporting.sendDailyReport);
bot.command('weekly', reporting.sendWeeklyReport);

//! Команда /restart
bot.command('restart', async (ctx) => {
  // Підтвердження від користувача перед очищенням сесії
  await ctx.reply('Ви хочете скинути всі налаштування та почати з початку? Ця дія незворотна.', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Так, скинути', 'confirm_restart')],
      [Markup.button.callback('Ні, залишити все як є', 'cancel_restart')]
    ])
  );
});

// Підтвердження скидання сесії
bot.action('confirm_restart', (ctx) => {
  ctx.answerCbQuery(); // Закриває попап

  // Очищення сесії
  ctx.session = null;
  
  // Повідомлення про скидання
  ctx.reply('Ваші налаштування були скинуті. Ви можете почати знову.');

  // Відправляємо головне меню
  sendMainMenu(ctx);

  // Можна також перевести на сцену реєстрації або залишити на головному меню
  ctx.scene.enter('register');
});

// Відміна скидання сесії
bot.action('cancel_restart', (ctx) => {
  ctx.answerCbQuery(); // Закриває попап

  // Повідомлення про скасування скидання
  ctx.reply('Скидання сесії скасовано. Ваші налаштування збережено.');

  // Відправляємо головне меню
  sendMainMenu(ctx);
});

// Обробка команд для меню (це можна додати в окремі частини коду або сцену):
bot.action('start_registration', async (ctx) => {
  // Переходимо до сцени реєстрації
  ctx.scene.enter('register');
});

bot.action('view_settings', async (ctx) => {
  // Тут можна додати код для перегляду налаштувань
  const user = await User.findOne({ telegramId: ctx.from.id });
  if (user) {
    await ctx.reply(`Ваші поточні налаштування:\n` +
      `Частота опитувань: ${getFrequencyText(user.pollFrequency)}\n` +
      `Час опитувань: ${user.pollStartTime}:00 - ${user.pollEndTime}:00`
    );
  } else {
    await ctx.reply('Ви ще не зареєстровані.');
  }
});

bot.action('help', (ctx) => {
  ctx.reply('Я допоможу відстежувати ваш емоційний стан. Доступні команди:\n' +
    '/start - Почати або перезапустити бота\n' +
    '/poll - Пройти опитування\n' +
    '/settings - Змінити налаштування опитувань\n' +
    '/report - Отримати звіт за сьогодні\n' +
    '/weekly - Отримати тижневий звіт');
  sendMainMenu(ctx); // Відправляємо головне меню
});

// Налаштування розкладу (запускається при старті бота)
scheduler.initScheduler(bot);

// Запуск бота
bot.launch()
  .then(() => console.log('Bot started'))
  .catch(err => console.error('Error starting bot:', err));

// Обробка зупинки
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
