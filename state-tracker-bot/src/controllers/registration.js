// Файл controllers/registration.js
import { Scenes } from 'telegraf';
import User from '../models/user.js';
import * as scheduler from '../utils/scheduler.js';

// Сцена реєстрації для запиту імені
const registerScene = new Scenes.BaseScene('register');
registerScene.enter(async (ctx) => {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (user) {
      await ctx.reply(`З поверненням, ${user.name}! Я радий бачити тебе знову.`);
      return ctx.scene.leave();
    }
    
    await ctx.reply('Привіт! Я бот для відстеження твого емоційного стану. Як мені до тебе звертатися?');
  } catch (err) {
    console.error('Error checking user:', err);
    await ctx.reply('Вибачте, сталася помилка. Спробуйте знову пізніше.');
    return ctx.scene.leave();
  }
});

registerScene.on('text', async (ctx) => {
  const name = ctx.message.text.trim();
  
  if (name.length < 2) {
    return ctx.reply('Ім\'я має містити принаймні 2 символи. Спробуйте ще раз.');
  }
  
  ctx.session.registration = {
    name,
    telegramId: ctx.from.id
  };
  
  await ctx.reply(`Приємно познайомитись, ${name}! Тепер налаштуймо частоту опитувань.`);
  return ctx.scene.enter('frequency');
});

// Сцена для вибору частоти опитувань
const frequencyScene = new Scenes.BaseScene('frequency');
frequencyScene.enter(async (ctx) => {
  await ctx.reply(
    'Як часто ти хочеш отримувати нагадування про перевірку стану?',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Щогодини', callback_data: 'freq_hourly' }],
          [{ text: 'Кожні 2 години', callback_data: 'freq_2hours' }],
          [{ text: 'Зранку та ввечері', callback_data: 'freq_morning_evening' }]
        ]
      }
    }
  );
});

frequencyScene.action(/freq_(.+)/, async (ctx) => {
  const frequency = ctx.match[1];
  ctx.session.registration.frequency = frequency;
  
  await ctx.reply(`Чудово! Частота встановлена: ${getFrequencyText(frequency)}`);
  return ctx.scene.enter('time');
});

// Сцена для вибору часу опитувань
const timeScene = new Scenes.BaseScene('time');
timeScene.enter(async (ctx) => {
  await ctx.reply(
    'Вкажи, о котрій годині ти хочеш починати та закінчувати отримувати опитування?\n' +
    'Напиши у форматі "початок-кінець", наприклад "9-21"'
  );
});

timeScene.on('text', async (ctx) => {
  const timeRange = ctx.message.text.trim();
  const match = timeRange.match(/^(\d{1,2})-(\d{1,2})$/);
  
  if (!match) {
    return ctx.reply('Неправильний формат. Використовуйте формат "9-21".');
  }
  
  const startTime = parseInt(match[1]);
  const endTime = parseInt(match[2]);
  
  if (startTime < 0 || startTime > 23 || endTime < 0 || endTime > 23) {
    return ctx.reply('Години мають бути між 0 та 23.');
  }
  
  if (startTime >= endTime) {
    return ctx.reply('Час початку має бути меншим за час закінчення.');
  }
  
  ctx.session.registration.startTime = startTime;
  ctx.session.registration.endTime = endTime;
  
  try {
    const newUser = new User({
      telegramId: ctx.session.registration.telegramId,
      name: ctx.session.registration.name,
      frequency: ctx.session.registration.frequency,
      startTime,
      endTime
    });
    
    await newUser.save();
    
    // Налаштовуємо розклад опитувань
    await scheduler.setupUserSchedule(ctx.telegram, newUser);
    
    await ctx.reply(
      `Реєстрацію завершено! Ось твої налаштування:\n` +
      `- Ім'я: ${newUser.name}\n` +
      `- Частота опитувань: ${getFrequencyText(newUser.frequency)}\n` +
      `- Час: з ${startTime}:00 до ${endTime}:00\n\n` +
      `Використовуй /help, щоб дізнатися більше про мої можливості.`
    );
    
    return ctx.scene.leave();
  } catch (err) {
    console.error('Error saving user:', err);
    await ctx.reply('Вибачте, сталася помилка при збереженні даних. Спробуйте знову.');
    return ctx.scene.leave();
  }
});

// Допоміжна функція для відображення тексту частоти
function getFrequencyText(frequency) {
  switch (frequency) {
    case 'hourly': return 'Щогодини';
    case '2hours': return 'Кожні 2 години';
    case 'morning_evening': return 'Зранку та ввечері';
    default: return 'Невідомо';
  }
}

export {
  registerScene,
  frequencyScene,
  timeScene
};

