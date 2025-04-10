// src/bot.js
import dotenv from 'dotenv';
import { Telegraf, Scenes, session } from 'telegraf';
import mongoose from 'mongoose';
import cron from 'node-cron';

// Імпорт контролерів
import * as registration from './controllers/registration.js';
import * as polling from './controllers/polling.js';
import * as reporting from './controllers/reporting.js';

// Імпорт сервісів
import * as scheduler from './utils/scheduler.js';

// Підключення до бази даних
dotenv.config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Ініціалізація бота
const bot = new Telegraf(process.env.BOT_TOKEN);

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
bot.command('start', (ctx) => ctx.scene.enter('register'));

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

// Налаштування розкладу (запускається при старті бота)
scheduler.initScheduler(bot);

// Запуск бота
bot.launch().then(() => {
  console.log('Bot started');
}).catch(err => {
  console.error('Error starting bot:', err);
});

// Обробка зупинки
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Файл models/user.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    enum: ['hourly', '2hours', 'morning_evening'],
    default: 'morning_evening'
  },
  startTime: {
    type: Number,
    default: 9,
    min: 0,
    max: 23
  },
  endTime: {
    type: Number,
    default: 21,
    min: 0,
    max: 23
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);
export default User;