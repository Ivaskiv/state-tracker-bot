import { Scenes } from 'telegraf';
import User from '../models/user.js';
import { registration, getFrequencyText } from '../utils/templates.js';
import * as scheduler from '../utils/scheduler.js';

// Створення сцени для налаштувань
const settingsScene = new Scenes.BaseScene('settings');

// Вхід у сцену налаштувань
settingsScene.enter(async (ctx) => {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      await ctx.reply('🚨 Спочатку потрібно зареєструватися. Використовуйте команду /start.');
      return ctx.scene.leave();
    }

    const userSettings = {
      name: user.name,
      frequency: getFrequencyText(user.frequency),
      time: `${user.startTime}:00 - ${user.endTime}:00`
    };

    await ctx.reply(
      `🔧 Твої поточні налаштування:\n` +
      `👤 Ім'я: ${userSettings.name}\n` +
      `📅 Частота опитувань: ${userSettings.frequency}\n` +
      `⏰ Час: ${userSettings.time}\n\n` +
      '🔄 Що ти хочеш змінити? ',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Змінити ім\'я', callback_data: 'change_name' }],
            [{ text: '📅 Змінити частоту опитувань', callback_data: 'change_frequency' }],
            [{ text: '⏰ Змінити час опитувань', callback_data: 'change_time' }],
            [{ text: '❌ Скасувати', callback_data: 'cancel_settings' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Помилка при отриманні даних користувача:', error);
    await ctx.reply('😞 Сталася помилка. Спробуйте пізніше.');
    return ctx.scene.leave();
  }
});

// Обробка кнопки "Скасувати"
settingsScene.action('cancel_settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🚪 Налаштування скасовано. Ти повернувся в головне меню.');
  return ctx.scene.leave();
});

// Зміна імені
settingsScene.action('change_name', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✍️ Введи своє нове ім\'я:');
  ctx.scene.state.action = 'name';
});

settingsScene.action('change_frequency', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('⚙️ Вибери нову частоту опитувань:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔸 Рідко (1-2 рази на день)', callback_data: 'freq_low' }],
        [{ text: '🔹 Середньо (3-4 рази на день)', callback_data: 'freq_medium' }],
        [{ text: '🔶 Часто (5-6 разів на день)', callback_data: 'freq_high' }]
      ]
    }
  });
});

settingsScene.action(/freq_(low|medium|high)/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = ctx.from.id;
  
  try {
    const frequencyMap = {
      freq_low: 'low',
      freq_medium: 'medium',
      freq_high: 'high'
    };
    
    const frequency = frequencyMap[ctx.match[0]];
    const user = await User.findOneAndUpdate(
      { telegramId },
      { frequency },
      { new: true }
    );
    
    // Оновлюємо розклад опитувань
    scheduler.rescheduleUserPolls(user);
    
    await ctx.reply(`✅ Частоту опитувань змінено на "${getFrequencyText(frequency)}"`);
    await ctx.scene.leave();
    await ctx.reply('✅ Налаштування оновлено. Використовуйте /settings щоб змінити інші параметри.');
  } catch (error) {
    console.error('Помилка при оновленні частоти опитувань:', error);
    await ctx.reply('😞 Сталася помилка. Спробуйте пізніше.');
    return ctx.scene.leave();
  }
});

settingsScene.action('change_time', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '⏰ Вкажи час, коли ти хочеш отримувати опитування.\n' +
    '🕒 Формат: "початок кінець" (наприклад, "9 22" для періоду з 9:00 до 22:00)'
  );
  ctx.scene.state.action = 'time';
});

// Обробка текстових повідомлень
settingsScene.on('text', async (ctx) => {
  const telegramId = ctx.from.id;
  const action = ctx.scene.state.action;
  
  if (!action) {
    return ctx.reply('❓ Спочатку вибери, що ти хочеш змінити, або використовуй /cancel для виходу.');
  }
  
  try {
    let updateData = {};
    
    if (action === 'name') {
      const name = ctx.message.text.trim();
      
      if (name.length < 2 || name.length > 50) {
        return ctx.reply('⚠️ Ім\'я повинно містити від 2 до 50 символів. Спробуй ще раз:');
      }
      
      updateData = { name };
      
    } else if (action === 'time') {
      const timePattern = /^(\d{1,2})\s+(\d{1,2})$/;
      const match = ctx.message.text.match(timePattern);
      
      if (!match) {
        return ctx.reply(
          '❌ Невірний формат. Введи два числа через пробіл.\n' +
          'Наприклад: "9 22" для періоду з 9:00 до 22:00'
        );
      }
      
      const startTime = parseInt(match[1], 10);
      const endTime = parseInt(match[2], 10);
      
      if (startTime < 0 || startTime > 23 || endTime < 0 || endTime > 23) {
        return ctx.reply('⚠️ Час повинен бути в межах від 0 до 23. Спробуй ще раз:');
      }
      
      if (startTime >= endTime) {
        return ctx.reply('⚠️ Час початку повинен бути менше часу кінця. Спробуй ще раз:');
      }
      
      updateData = { startTime, endTime };
    }
    
    const user = await User.findOneAndUpdate(
      { telegramId },
      updateData,
      { new: true }
    );
    
    // Оновлюємо розклад опитувань
    scheduler.rescheduleUserPolls(user);
    
    await ctx.reply('✅ Налаштування успішно оновлено!');
    await ctx.scene.leave();
    await ctx.reply('✅ Використовуйте /settings щоб змінити інші параметри.');
    
  } catch (error) {
    console.error('Помилка при оновленні налаштувань:', error);
    await ctx.reply('😞 Сталася помилка. Спробуйте пізніше.');
    return ctx.scene.leave();
  }
});

// Обробка команди виходу
settingsScene.command('cancel', (ctx) => {
  ctx.reply('❌ Налаштування скасовано.');
  return ctx.scene.leave();
});

export default settingsScene;
