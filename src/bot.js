import { Telegraf } from 'telegraf';
import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Бібліотеки
const states = ['Ресурсний', 'Нейтральний', 'Напружений', 'Виснажений', 'Тривожний', 'Панічний', 'Спустошений', 'Інший'];
const emotions = ['Радість', 'Гнів', 'Спокій', 'Сум', 'Страх', 'Вдячність', 'Невпевненість', 'Захоплення', 'Інший'];
const feelings = ['Любов', 'Провина', 'Самотність', 'Прийняття', 'Сором', 'Надія', 'Невпевненість', 'Інший'];
const actions = ['Працював(ла)', 'Їв(ла)', 'Був(ла) в соцмережах', 'Спілкувався(лася)', 'Рухався(лася)', 'Відпочивав(ла)', 'Медитував(ла)', 'Інший'];
const supportPhrases = ['Ти не слабкий(а). Ти просто забув(ла), хто ти. Згадай.', 'Ти вже маєш силу. Час перестати її ховати.', 'Те, у що ти віриш про себе — або будує тебе, або знищує. Вибирай.'];
const microFormulas = ['Твій стан — твій всесвіт. Хочеш змінити життя — змінюй себе.', 'Ти — не вчора. Ти — вибір сьогодні.'];
const affirmations = ['Я обираю свій стан. Я обираю свою силу.', 'Я довіряю собі і своєму шляху.'];
const dailyQuotes = ['Ти або віриш у свою силу — або служиш своїм страхам.', 'Кожна твоя дія — це крок до нового себе. Обирай уважно.'];
const tasks = ['Запиши одну фразу, яка підніме тебе.', 'Зроби сьогодні щось маленьке, що дає тобі ресурс.'];

// Маніфест
const manifest = `Тут ми не шукаємо виправдань...\n[весь маніфест з вашого запиту]`;

// Стан користувача
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
        tg_id: userId.toString(),
        name: ctx.from.first_name,
        schedule,
        next_reminder: nextTime.toISOString(),
      }, (err, record) => {
        if (err) ctx.reply('Помилка збереження.');
        else {
          const reminderText = schedule === 'Once' ? 'Раз на день о 9:00' : schedule === 'Twice' ? 'Двічі на день о 9:00 та о 18:00' : schedule === 'ThreeTimes' ? 'Тричі на день о 9:00, 15:00, 18:00' : schedule === 'FourTimes' ? 'Чотири рази на день о 9:00, 12:00, 15:00, 18:00' : 'Щогодини з 9:00 до 21:00';
          const firstReminder = nextTime.toDateString() === new Date().toDateString() ? `сьогодні о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `вже завтра о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          ctx.reply(`Ти зареєстрований як ${ctx.from.first_name}. Ви обрали ${schedule}, тому будете отримувати нагадування:\n${reminderText}.\nОчікуйте перше нагадування ${firstReminder}.`);
        }
      });
      userStates.delete(userId);
      setReminder(userId, schedule);
    } else {
      ctx.reply('Невірний вибір. Спробуй 1-5.');
    }
  } else if (userState.step === 'response') {
    const [state, emotion, feeling, action] = text.split('\n').map(s => s.trim());
    base('Users').update([{ id: userState.recordId, fields: { last_state: state, last_emotion: emotion, last_feeling: feeling, last_action: action } }], (err) => {
      if (err) ctx.reply('Помилка оновлення.');
      else {
        if (['Напружений', 'Виснажений', 'Тривожний', 'Панічний', 'Спустошений'].includes(state)) {
          ctx.reply(supportPhrases[Math.floor(Math.random() * supportPhrases.length)]);
        }
        ctx.reply(microFormulas[Math.floor(Math.random() * microFormulas.length)]);
        ctx.reply(affirmations[Math.floor(Math.random() * affirmations.length)]);
      }
    });
    userStates.delete(userId);
    setReminder(userId, userState.schedule);
  } else if (text === '/support') {
    ctx.reply(supportPhrases[Math.floor(Math.random() * supportPhrases.length)]);
    ctx.reply(microFormulas[Math.floor(Math.random() * microFormulas.length)]);
    ctx.reply(affirmations[Math.floor(Math.random() * affirmations.length)]);
  }
});

function setReminder(userId, schedule) {
  base('Users').find('recXXXXX', (err, record) => { // Заміни на реальний record ID
    if (err) return;
    const now = new Date();
    let nextTime = new Date(now);
    if (schedule === 'Once' && now.getHours() >= 9) nextTime.setDate(now.getDate() + 1);
    nextTime.setHours(schedule === 'Once' ? 9 : schedule === 'Twice' ? (now.getHours() < 9 ? 9 : 18) : schedule === 'ThreeTimes' ? (now.getHours() < 9 ? 9 : now.getHours() < 15 ? 15 : 18) : schedule === 'FourTimes' ? (now.getHours() < 9 ? 9 : now.getHours() < 12 ? 12 : now.getHours() < 15 ? 15 : 18) : now.getHours() + 1, 0, 0, 0);
    if (nextTime <= now) nextTime.setDate(nextTime.getDate() + 1);
    if (schedule === 'Hourly' && nextTime.getHours() >= 21) nextTime.setDate(nextTime.getDate() + 1, 9, 0, 0, 0);
    base('Users').update([{ id: record.id, fields: { next_reminder: nextTime.toISOString() } }], () => {
      if (now.getHours() >= 9 && now.getHours() < 21) {
        setTimeout(() => sendReminder(userId, schedule), nextTime - now);
      }
    });
  });
}

function sendReminder(userId, schedule) {
  base('Users').find('recXXXXX', (err, record) => { // Заміни на реальний record ID
    if (err) return;
    const nextTime = new Date(record.get('next_reminder'));
    const reminderText = schedule === 'Once' ? 'Раз на день о 9:00' : schedule === 'Twice' ? 'Двічі на день о 9:00 та о 18:00' : schedule === 'ThreeTimes' ? 'Тричі на день о 9:00, 15:00, 18:00' : schedule === 'FourTimes' ? 'Чотири рази на день о 9:00, 12:00, 15:00, 18:00' : 'Щогодини з 9:00 до 21:00';
    const firstReminder = nextTime.toDateString() === new Date().toDateString() ? `сьогодні о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `вже завтра о ${nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    bot.telegram.sendMessage(userId, `Ви обрали ${schedule}, тому будете отримувати нагадування:\n${reminderText}.\nОчікуйте перше нагадування ${firstReminder}.`);
    bot.telegram.sendMessage(userId, 'Зупинись. Як ти зараз почуваєшся?\nСтан:\nЕмоція:\nПочуття:\nДія:');
    userStates.set(userId, { step: 'response', schedule, recordId: record.id });
  });
}

// Щоденний підсумок (22:00)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 22 && now.getMinutes() === 0) {
    base('Users').select().eachPage((records) => {
      records.forEach(record => {
        const summary = `Щоденний звіт: Переважав ${record.get('last_state') || 'невідомо'}, емоція ${record.get('last_emotion') || 'невідомо'}.`;
        base('Users').update([{ id: record.id, fields: { daily_summary: summary } }], () => {
          bot.telegram.sendMessage(record.get('tg_id'), summary);
        });
        bot.telegram.sendMessage(record.get('tg_id'), supportPhrases[Math.floor(Math.random() * supportPhrases.length)]);
      });
    });
  }
}, 60000); // Кожну хвилину перевіряємо

// Тижневий звіт (неділя 23:00)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 23 && now.getMinutes() === 0 && now.getDay() === 0) {
    base('Users').select().eachPage((records) => {
      records.forEach(record => {
        const summary = `Тижневий звіт: Переважав ${record.get('last_state') || 'невідомо'}.`;
        base('Users').update([{ id: record.id, fields: { weekly_summary: summary } }], () => {
          bot.telegram.sendMessage(record.get('tg_id'), summary);
        });
      });
    });
  }
}, 60000); // Кожну хвилину перевіряємо

// Щомісячний звіт (1-е число 23:00)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 23 && now.getMinutes() === 0 && now.getDate() === 1) {
    base('Users').select().eachPage((records) => {
      records.forEach(record => {
        const summary = `Щомісячний звіт: Переважав ${record.get('last_state') || 'невідомо'}.`;
        base('Users').update([{ id: record.id, fields: { monthly_summary: summary } }], () => {
          bot.telegram.sendMessage(record.get('tg_id'), summary);
        });
      });
    });
  }
}, 60000); // Кожну хвилину перевіряємо

// Щоранку (8:00)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 8 && now.getMinutes() === 0) {
    base('Users').select().eachPage((records) => {
      records.forEach(record => {
        bot.telegram.sendMessage(record.get('tg_id'), dailyQuotes[Math.floor(Math.random() * dailyQuotes.length)]);
        setTimeout(() => {
          bot.telegram.sendMessage(record.get('tg_id'), tasks[Math.floor(Math.random() * tasks.length)]);
        }, 10000); // 10 секунд пауза
      });
    });
  }
}, 60000); // Кожну хвилину перевіряємо

// Запуск бота
bot.launch();
console.log('Бот Надя запущено!');