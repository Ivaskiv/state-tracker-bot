// telegram-bot.js
import { Telegraf } from 'telegraf';
import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const supportPhrases = ['Ти не слабкий(а). Ти просто забув(ла), хто ти. Згадай.', 'Ти вже маєш силу. Час перестати її ховати.', 'Те, у що ти віриш про себе — або будує тебе, або знищує. Вибирай.'];
const microFormulas = ['Твій стан — твій всесвіт. Хочеш змінити життя — змінюй себе.', 'Ти — не вчора. Ти — вибір сьогодні.'];
const affirmations = ['Я обираю свій стан. Я обираю свою силу.', 'Я довіряю собі і своєму шляху.'];
const dailyQuotes = ['Ти або віриш у свою силу — або служиш своїм страхам.', 'Кожна твоя дія — це крок до нового себе. Обирай уважно.'];
const tasks = ['Запиши одну фразу, яка підніме тебе.', 'Зроби сьогодні щось маленьке, що дає тобі ресурс.'];

const manifest = `Тут ми не шукаємо виправдань...`;

const userStates = new Map();

bot.start((ctx) => {
  ctx.reply(manifest);
  ctx.reply('Напиши /set_schedule, щоб обрати розклад.');
});

bot.command('set_schedule', (ctx) => {
  ctx.reply('Обери розклад:\n1. Once - Раз на день о 9:00\n2. Twice - Двічі о 9:00 та 18:00\n3. ThreeTimes - Тричі о 9:00, 15:00, 18:00\n4. FourTimes - Чотири рази о 9:00, 12:00, 15:00, 18:00\n5. Hourly - Щогодини з 9:00 до 21:00');
  userStates.set(ctx.from.id, { step: 'schedule' });
});

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId) || {};
  const text = ctx.message.text;

  if (userState.step === 'schedule') {
    const schedule = text === '1' ? 'Once' : text === '2' ? 'Twice' : text === '3' ? 'ThreeTimes' : text === '4' ? 'FourTimes' : text === '5' ? 'Hourly' : null;
    if (schedule) {
      const now = new Date();
      let nextTime = new Date(now);
      if (schedule === 'Once') nextTime.setHours(9, 0, 0, 0);
      else if (schedule === 'Twice') nextTime.setHours(now.getHours() < 9 ? 9 : 18, 0, 0, 0);
      else if (schedule === 'ThreeTimes') nextTime.setHours(now.getHours() < 9 ? 9 : now.getHours() < 15 ? 15 : 18, 0, 0, 0);
      else if (schedule === 'FourTimes') nextTime.setHours(now.getHours() < 9 ? 9 : now.getHours() < 12 ? 12 : now.getHours() < 15 ? 15 : 18, 0, 0, 0);
      else if (schedule === 'Hourly') nextTime.setHours(now.getHours() + 1, 0, 0, 0);
      if (nextTime <= now) nextTime.setDate(nextTime.getDate() + 1);

      base('Users').create({
        tg_user_id: userId.toString(),
        Name: ctx.from.first_name,
        Schedule: schedule,
        NextReminder: nextTime.toISOString(),
      }, (err, record) => {
        if (err) ctx.reply('Помилка збереження.');
        else {
          const reminderText = schedule === 'Once' ? 'Раз на день о 9:00' : schedule === 'Twice' ? 'Двічі на день о 9:00 та о 18:00' : schedule === 'ThreeTimes' ? 'Тричі на день о 9:00, 15:00, 18:00' : schedule === 'FourTimes' ? 'Чотири рази на день о 9:00, 12:00, 15:00, 18:00' : 'Щогодини з 9:00 до 21:00';
          const firstReminder = nextTime.toDateString() === new Date().toDateString() ? `сьогодні о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `вже завтра о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          ctx.reply(`Ти зареєстрований як ${ctx.from.first_name}. Ви обрали ${schedule}, тому будете отримувати нагадування:\n${reminderText}.\nОчікуйте перше нагадування ${firstReminder}.`);
        }
      });
      userStates.delete(userId);
    } else {
      ctx.reply('Невірний вибір. Спробуй 1-5.');
    }
  }
});

bot.launch();
console.log('Бот Надя запущено!');
