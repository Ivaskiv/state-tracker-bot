import { Scenes } from 'telegraf';
import User from '../models/user.js';
import config from '../config.js';

// Спільні функції
const getFrequencyText = (frequency) => {
  switch (frequency) {
    case '15': return '15 хвилин';
    case '30': return '30 хвилин';
    case '60': return '1 година';
    case '120': return '2 години';
    default: return `${frequency} хвилин`;
  }
};

// Обробка реєстрації користувача
const registerUser = async (ctx, userId) => {
  const existingUser = await User.findOne({ telegramId: userId });
  if (existingUser) {
    return existingUser;
  }

  const newUser = new User({
    telegramId: userId,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    username: ctx.from.username,
  });

  await newUser.save();
  return newUser;
};

// Обробка помилок
const handleError = async (ctx, error) => {
  console.error(error);
  await ctx.reply('Упс, сталася помилка. Спробуйте знову пізніше.');
  ctx.scene.leave();
};

// Сцена реєстрації користувача
const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  const userId = ctx.from.id;

  try {
    const user = await registerUser(ctx, userId);
    
    if (user) {
      if (user.telegramId === userId) {
        // Якщо користувач існує, виводимо налаштування
        await ctx.reply(
          `Вітаю знову! Ваші поточні налаштування:\n` +
          `Частота опитувань: ${getFrequencyText(user.pollFrequency)}\n` +
          `Час опитувань: ${user.pollStartTime}:00 - ${user.pollEndTime}:00 🕒`
        );
        // Запит на зміну налаштувань
        await ctx.reply('Бажаєте змінити налаштування?', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Так, змінити налаштування 🔧', callback_data: 'change_settings' }],
              [{ text: 'Ні, залишити без змін ✅', callback_data: 'keep_settings' }],
            ],
          },
        });
      } else {
        // Якщо нового користувача створено
        await ctx.reply(
          `Вітаю! Я бот для відстеження емоційного стану. Я буду надсилати вам опитування та формувати звіти на основі ваших відповідей 😊`
        );
        // Перехід до вибору частоти опитувань
        ctx.scene.enter('frequency');
      }
    }
  } catch (error) {
    handleError(ctx, error);
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
        [{ text: '15 хвилин ⏱️', callback_data: '15' }],
        [{ text: '30 хвилин ⏱️', callback_data: '30' }],
        [{ text: '1 година 🕒', callback_data: '60' }],
        [{ text: '2 години ⏳', callback_data: '120' }],
        [{ text: 'Вказати власну частоту 📝', callback_data: 'custom' }],
      ],
    },
  });
});

// Обробка вибору частоти опитувань
frequencyScene.action(['15', '30', '60', '120'], async (ctx) => {
  const frequency = ctx.callbackQuery.data;
  ctx.answerCbQuery();
  
  // Зберігаємо вибрану частоту в сесії
  ctx.session.frequency = frequency;

  // Підтвердження вибору
  await ctx.reply(`Ви обрали частоту опитувань: ${getFrequencyText(frequency)}. Підтвердьте вибір?`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Підтвердити ✅', callback_data: 'confirm' }],
        [{ text: 'Скасувати ❌', callback_data: 'cancel' }],
      ],
    },
  });
});

// Обробка власної частоти
frequencyScene.action('custom', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('Введіть власну частоту в хвилинах (від 5 до 240)⏳:');
  ctx.scene.enter('custom_frequency');
});

// Сцена для введення власної частоти
const customFrequencyScene = new Scenes.BaseScene('custom_frequency');

customFrequencyScene.on('text', async (ctx) => {
  const userInput = parseInt(ctx.message.text);

  if (userInput >= 5 && userInput <= 240) {
    ctx.session.frequency = userInput;
    await ctx.reply(`Ваша частота опитувань встановлена на ${userInput} хвилин. Підтвердьте вибір?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Підтвердити', callback_data: 'confirm' }],
          [{ text: 'Скасувати', callback_data: 'cancel' }],
        ],
      },
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
  
  await ctx.reply(`Частота опитувань підтверджена: ${getFrequencyText(frequency)}.`);
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
  const message = 'Оберіть період часу, коли ви бажаєте отримувати опитування:';
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '6:00 - 22:00 🌅🌙', callback_data: '6_22' }],
        [{ text: '8:00 - 22:00 🕗', callback_data: '8_22' }],
        [{ text: '8:00 - 20:00 🕖', callback_data: '8_20' }],
        [{ text: '9:00 - 21:00 🕘', callback_data: '9_21' }],
      ],
    },
  });
});

// Обробка вибору часу опитувань
timeScene.action(['6_22', '8_22', '8_20', '9_21'], async (ctx) => {
  const timeRange = ctx.callbackQuery.data;
  ctx.answerCbQuery();
  
  const [startTime, endTime] = timeRange.split('_').map(Number);
  const userId = ctx.from.id;
  const { username, first_name, last_name } = ctx.from;

  try {
    await User.findOneAndUpdate(
      { telegramId: userId },
      {
        telegramId: userId,
        username: username || '',
        firstName: first_name || '',
        lastName: last_name || '',
        pollFrequency: ctx.session.frequency,
        pollStartTime: startTime,
        pollEndTime: endTime,
        created: new Date(),
        lastInteraction: new Date(),
      },
      { upsert: true, new: true }
    );

    await ctx.reply(
      `Чудово! Ваші налаштування збережено ✅:\n` +
      `Частота опитувань: ${getFrequencyText(ctx.session.frequency)}\n` +
      `Час опитувань: ${startTime}:00 - ${endTime}:00 🕒\n\n` +
      `Для проходження опитування зараз, використайте команду /poll 📝\n` +
      `Для перегляду всіх команд, використайте /help 📚`
    );

    ctx.scene.leave();
  } catch (error) {
    handleError(ctx, error);
  }
});

export { registerScene, frequencyScene, timeScene, customFrequencyScene };
