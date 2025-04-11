import dotenv from 'dotenv';
import TelegrafPkg from 'telegraf';
import mongoose from 'mongoose';
import { Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';

// Імпорт контролерів
import * as polling from './controllers/polling.js';
import * as reporting from './controllers/reporting.js';
import * as registration from './controllers/registration.js'; 

// Імпорт сервісів
import * as scheduler from './utils/scheduler.js';
import User from './models/user.js';
import { configData } from './config/configData.js';
import { getFrequencyText } from './utils/templates.js';

const { Telegraf, Scenes, session } = TelegrafPkg;

// Підключення до бази даних
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Ініціалізація бота
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID; // ID адміна

// Головне меню
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('Почати реєстрацію', 'start_registration')],
  [Markup.button.callback('Переглянути налаштування', 'view_settings')],
  [Markup.button.callback('Допомога', 'help')],
  [Markup.button.callback('Очистити чат', 'clear_chat')]
]);

// Функція для відправки головного меню
const sendMainMenu = async (ctx) => {
  await ctx.reply('Оберіть дію:', mainMenu);
};

// Ініціалізація сцен для реєстрації
const stage = new Scenes.Stage([
  registration.registerScene,  // Ваша сцена реєстрації
  registration.frequencyScene,  // Сцена для частоти
  registration.timeScene        // Сцена для часу
]);

// Налаштування сесій і сцен
bot.use(session());
bot.use(stage.middleware());  // Додаємо middleware для сцен

// Обробка команди /start
bot.command('start', async (ctx) => {
  console.log('Received /start command');
  let user = await User.findOne({ telegramId: ctx.from.id });
  if (!user) {
    console.log('Creating new user...');
    user = new User({
      telegramId: ctx.from.id,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      username: ctx.from.username,
    });
    await user.save();
  }
  console.log('Sending welcome message...');
  await ctx.reply('Ласкаво просимо! Ви зареєстровані.');
  sendMainMenu(ctx);
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
  sendMainMenu(ctx);
});

// Перевірка прав адміна
const isAdmin = (ctx) => ctx.from.id === ADMIN_ID;

// Адмін панель
bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ У вас немає доступу до адмін-панелі.');
  }
  await ctx.reply('🔧 Адмін-панель', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛠 Змінити старт/енд час для всіх', callback_data: 'change_time_all' }],
        [{ text: '📤 Експортувати налаштування', callback_data: 'export_config' }],
        [{ text: '➕ Додати адміна', callback_data: 'add_admin' }]
      ]
    }
  });
});

// Зміна часу для всіх користувачів
bot.action('change_time_all', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ У вас немає доступу до цієї функції.');
  }
  await ctx.reply('⏰ Введіть нові проміжки часу для бота (формат: "початок кінець", наприклад "09:00 18:00")');
  ctx.scene.state.action = 'time_all';
});

// Експорт налаштувань
bot.action('export_config', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ У вас немає доступу до цієї функції.');
  }
  const config = await configData();
  const configJson = JSON.stringify(config, null, 2);
  fs.writeFileSync(path.resolve(__dirname, './exported_configData.json'), configJson);
  await ctx.replyWithDocument({ source: path.resolve(__dirname, './exported_configData.json') });
});

// Додавання адміна
bot.action('add_admin', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ У вас немає доступу до цієї функції.');
  }
  await ctx.reply('📢 Введіть ID користувача, якого ви хочете додати адміном:');
  ctx.scene.state.action = 'add_admin';
});

// Опитування
bot.command('poll', polling.startPoll);
bot.action(/state_(.+)/, polling.handleStateResponse);
bot.action(/emotion_(.+)/, polling.handleEmotionResponse);
bot.action(/feeling_(.+)/, polling.handleFeelingResponse);
bot.action(/action_(.+)/, polling.handleActionResponse);

// Звіти
bot.command('report', reporting.sendDailyReport);
bot.command('weekly', reporting.sendWeeklyReport);

// Команда /restart
bot.command('restart', async (ctx) => {
  await ctx.reply('Ви хочете скинути всі налаштування та почати з початку? Ця дія незворотна.', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Так, скинути', 'confirm_restart')],
      [Markup.button.callback('Ні, залишити все як є', 'cancel_restart')]
    ])
  );
});

bot.action('confirm_restart', (ctx) => {
  ctx.answerCbQuery(); 
  ctx.session = null;
  ctx.reply('Ваші налаштування були скинуті. Ви можете почати знову.');
  sendMainMenu(ctx);
  ctx.scene.enter('register');
});

bot.action('cancel_restart', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Скидання сесії скасовано. Ваші налаштування збережено.');
  sendMainMenu(ctx);
});

// Очищення чату
bot.action('clear_chat', async (ctx) => {
  ctx.deleteMessage();
  await ctx.reply('Чат очищено! Ось кнопка для початку:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Старт', callback_data: 'start_again' }],
      ],
    },
  });
});

bot.action('start_again', (ctx) => {
  sendMainMenu(ctx);
});

// Перегляд налаштувань
bot.action('view_settings', async (ctx) => {
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

// Налаштування розкладу
scheduler.initScheduler(bot);

// Запуск бота
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Обробка зупинки
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
