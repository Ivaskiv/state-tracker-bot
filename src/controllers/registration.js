import { Scenes } from 'telegraf';
import User from '../models/user.js';
import config from '../config.js';

// Сцена для реєстрації користувача
const registerScene = new Scenes.BaseScene('register');

// Вхід у сцену реєстрації
registerScene.enter(async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    // Перевірка, чи вже існує користувач
    const existingUser = await User.findOne({ telegramId: userId });
    
    if (existingUser) {
      await ctx.reply(
        `Вітаю знову! Ви вже зареєстровані. Ваші поточні налаштування:\n` +
        `Частота опитувань: ${getFrequencyText(existingUser.pollFrequency)}\n` +
        `Час опитувань: ${existingUser.pollStartTime}:00 - ${existingUser.pollEndTime}:00`
      );
      
      await ctx.reply('Бажаєте змінити налаштування?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Так', callback_data: 'change_settings' }],
            [{ text: 'Ні', callback_data: 'keep_settings' }]
          ]
        }
      });
    } else {
      await ctx.reply(
        `Вітаю! Я бот для відстеження емоційного стану. Я буду надсилати вам опитування та формувати звіти на основі ваших відповідей.`
      );
      
      // Перехід до вибору частоти опитувань
      ctx.scene.enter('frequency');
    }
  } catch (error) {
    console.error('Error during registration:', error);
    await ctx.reply('Упс, сталася помилка під час реєстрації. Спробуйте знову пізніше.');
    ctx.scene.leave();
  }
});

// Обробка дії зміни налаштувань
registerScene.action('change_settings', (ctx) => {
  ctx.answerCbQuery();
  ctx.scene.enter('frequency');
});

// Обробка дії залишити налаштування без змін
registerScene.action('keep_settings', async (ctx) => {
  ctx.answerCbQuery();
  await ctx.reply('Чудово! Ваші налаштування залишаються без змін.');
  ctx.scene.leave();
});

// Сцена для вибору частоти опитувань
const frequencyScene = new Scenes.BaseScene('frequency');

frequencyScene.enter(async (ctx) => {
  await ctx.reply('Як часто ви хочете отримувати опитування?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '15 хвилин', callback_data: '15' }],
        [{ text: '30 хвилин', callback_data: '30' }],
        [{ text: '1 година', callback_data: '60' }],
        [{ text: '2 години', callback_data: '120' }],
        [{ text: 'Вказати власну частоту', callback_data: 'custom' }]
      ]
    }
  });
});

// Обробка вибору частоти опитувань
frequencyScene.action(['15', '30', '60', '120'], async (ctx) => {
  const frequency = ctx.callbackQuery.data;
  ctx.answerCbQuery();
  
  // Зберігаємо вибрану частоту в сесії
  ctx.session.frequency = frequency;
  
  // Підтвердження вибору
  await ctx.reply(`Ви обрали частоту опитувань: ${frequency} хвилин. Підтвердьте вибір?`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Підтвердити', callback_data: 'confirm' }],
        [{ text: 'Скасувати', callback_data: 'cancel' }]
      ]
    }
  });
});

// Обробка власної частоти
frequencyScene.action('custom', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Введіть власну частоту в хвилинах (від 5 до 240):');
  ctx.scene.enter('custom_frequency');
});

// Сцена для введення власної частоти
const customFrequencyScene = new Scenes.BaseScene('custom_frequency');

customFrequencyScene.on('text', async (ctx) => {
  const userInput = parseInt(ctx.message.text);

  if (userInput >= 5 && userInput <= 240) {
    // Зберігаємо введену частоту
    ctx.session.frequency = userInput;
    await ctx.reply(`Ваша частота опитувань встановлена на ${userInput} хвилин. Підтвердьте вибір?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Підтвердити', callback_data: 'confirm' }],
          [{ text: 'Скасувати', callback_data: 'cancel' }]
        ]
      }
    });
    ctx.scene.leave();
  } else {
    await ctx.reply('Невірний введений час. Будь ласка, введіть число від 5 до 240 хвилин.');
  }
});

// Підтвердження вибору частоти
frequencyScene.action('confirm', async (ctx) => {
  const frequency = ctx.session.frequency;
  ctx.answerCbQuery();
  
  // Перехід до вибору часу опитувань
  await ctx.reply(`Частота опитувань підтверджена: ${frequency} хвилин.`);
  ctx.scene.enter('time');
});

// Скасування вибору частоти
frequencyScene.action('cancel', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Вибір скасовано. Ви можете обрати частоту знову.');
  ctx.scene.enter('frequency');
});

// Сцена для вибору часу опитувань
const timeScene = new Scenes.BaseScene('time');

timeScene.enter(async (ctx) => {
  let message = 'Оберіть період часу, коли ви бажаєте отримувати опитування:';
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '6:00 - 22:00', callback_data: '6_22' }],
        [{ text: '8:00 - 22:00', callback_data: '8_22' }],
        [{ text: '8:00 - 20:00', callback_data: '8_20' }],
        [{ text: '9:00 - 21:00', callback_data: '9_21' }]
      ]
    }
  });
});

// Обробка вибору часу опитувань
timeScene.action(['6_22', '8_22', '8_20', '9_21'], async (ctx) => {
  const timeRange = ctx.callbackQuery.data;
  ctx.answerCbQuery();
  
  // Розбір обраного періоду часу
  const [startTime, endTime] = timeRange.split('_').map(Number);
  
  try {
    // Збереження налаштувань користувача
    const userId = ctx.from.id;
    const username = ctx.from.username || '';
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    
    // Створення або оновлення користувача в базі
    await User.findOneAndUpdate(
      { telegramId: userId },
      {
        telegramId: userId,
        username,
        firstName,
        lastName,
        pollFrequency: ctx.session.frequency,
        pollStartTime: startTime,
        pollEndTime: endTime,
        created: new Date(),
        lastInteraction: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Підтвердження налаштувань
    await ctx.reply(
      `Чудово! Ваші налаштування збережено:\n` +
      `Частота опитувань: ${getFrequencyText(ctx.session.frequency)}\n` +
      `Час опитувань: ${startTime}:00 - ${endTime}:00\n\n` +
      `Для проходження опитування зараз, використайте команду /poll\n` +
      `Для перегляду всіх команд, використайте /help`
    );
    
    // Завершення сцени
    ctx.scene.leave();
  } catch (error) {
    console.error('Error saving user settings:', error);
    await ctx.reply('Упс, сталася помилка під час збереження налаштувань. Спробуйте знову пізніше.');
    ctx.scene.leave();
  }
});

// Допоміжна функція для переведення частоти в людсько-зрозумілий формат
function getFrequencyText(frequency) {
  switch (frequency) {
    case '15':
      return '15 хвилин';
    case '30':
      return '30 хвилин';
    case '60':
      return '1 година';
    case '120':
      return '2 години';
    default:
      return `${frequency} хвилин`;
  }
}

export { registerScene, frequencyScene, timeScene, customFrequencyScene };
