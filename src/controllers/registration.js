import { Scenes } from 'telegraf';
import { configData } from '../config/configData.js'; 
import User from '../models/user.js';

const registerScene = new Scenes.BaseScene('register');

registerScene.enter(async (ctx) => {
  try {
    const userId = ctx.from.id;

    let user = await User.findOne({ telegramId: userId });
    if (!user) {
      user = new User({
        telegramId: userId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      });
      await user.save();
      console.log(`Створено нового користувача: ${userId}`);
    }

    if (!configData || !configData.frequencyOptions) {
      console.error('Помилка: configData або frequencyOptions не визначені');
      await ctx.reply('Виникла помилка з налаштуваннями. Зверніться до адміністратора.');
      return ctx.scene.leave();
    }

    const frequencyText = (user.pollFrequency !== undefined && configData.frequencyOptions[user.pollFrequency]) 
      ? configData.frequencyOptions[user.pollFrequency] 
      : "Не налаштовано";
    
    let reportText = "Не налаштовано";
    if (configData.reportSettings && configData.reportSettings.reportTypes && 
        Array.isArray(configData.reportSettings.reportTypes)) {
      reportText = configData.reportSettings.reportTypes
        .map(report => report.label)
        .join(", ");
    }

    await ctx.reply(
      `Вітаємо, ${user.firstName || 'користувач'}! Ваші поточні налаштування:\n` +
      `Частота опитувань: ${frequencyText}\n` +
      `Доступні типи звітів: ${reportText}`
    );

    await ctx.reply('Бажаєте змінити налаштування?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Так, змінити налаштування 🔧', callback_data: 'change_settings' }],
          [{ text: 'Ні, залишити без змін ✅', callback_data: 'keep_settings' }],
        ],
      },
    });
  } catch (error) {
    console.error('Помилка в сцені реєстрації:', error);
    await ctx.reply('Виникла помилка. Спробуйте ще раз пізніше або зверніться до адміністратора.');
    ctx.scene.leave();
  }
});

registerScene.action('change_settings', (ctx) => {
  try {
    ctx.answerCbQuery();
    ctx.scene.enter('frequency');
  } catch (error) {
    console.error('Помилка при зміні налаштувань:', error);
    ctx.reply('Виникла помилка. Спробуйте ще раз.');
    ctx.scene.leave();
  }
});

registerScene.action('keep_settings', (ctx) => {
  try {
    ctx.answerCbQuery();
    ctx.reply('Чудово! Ваші налаштування залишаються без змін.');
    ctx.scene.leave();
  } catch (error) {
    console.error('Помилка при збереженні налаштувань:', error);
    ctx.reply('Виникла помилка. Спробуйте ще раз.');
    ctx.scene.leave();
  }
});

const frequencyScene = new Scenes.BaseScene('frequency');

frequencyScene.enter(async (ctx) => {
  try {
    if (!configData || !configData.frequencyOptions || !Array.isArray(configData.frequencyOptions)) {
      console.error('Помилка: опції частоти не визначені');
      await ctx.reply('Виникла помилка з налаштуваннями частоти. Зверніться до адміністратора.');
      return ctx.scene.leave();
    }

    const frequencyButtons = configData.frequencyOptions.map((option, index) => {
      return [{ text: option, callback_data: `freq_${index}` }];
    });

    await ctx.reply('Оберіть частоту опитувань:', {
      reply_markup: {
        inline_keyboard: frequencyButtons,
      },
    });
  } catch (error) {
    console.error('Помилка в сцені частоти:', error);
    await ctx.reply('Виникла помилка. Спробуйте ще раз пізніше.');
    ctx.scene.leave();
  }
});

frequencyScene.action(/^freq_(\d+)$/, async (ctx) => {
  try {
    const frequencyIndex = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    await User.findOneAndUpdate(
      { telegramId: userId }, 
      { pollFrequency: frequencyIndex }
    );

    const frequencyText = configData.frequencyOptions[frequencyIndex];
    await ctx.reply(`Частота опитувань встановлена: ${frequencyText}`);
    
    ctx.scene.enter('time');
  } catch (error) {
    console.error('Помилка при збереженні частоти:', error);
    await ctx.reply('Виникла помилка при збереженні. Спробуйте ще раз.');
    ctx.scene.leave();
  }
});

frequencyScene.on('text', (ctx) => {
  ctx.reply('Будь ласка, використовуйте кнопки для вибору частоти.');
});

const timeScene = new Scenes.BaseScene('time');

timeScene.enter(async (ctx) => {
  try {
    await ctx.reply('Введіть час початку та закінчення опитування (наприклад: 09:00 18:00):');
  } catch (error) {
    console.error('Помилка в сцені часу:', error);
    await ctx.reply('Виникла помилка. Спробуйте ще раз пізніше.');
    ctx.scene.leave();
  }
});

timeScene.on('text', async (ctx) => {
  try {
    const timeInput = ctx.message.text;
    const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])\s+([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    
    if (!timePattern.test(timeInput)) {
      return ctx.reply('Неправильний формат часу. Спробуйте ще раз (наприклад: 09:00 18:00):');
    }
    
    const [startTime, endTime] = timeInput.split(' ');
    const userId = ctx.from.id;

    await User.findOneAndUpdate(
      { telegramId: userId },
      { 
        pollStartTime: startTime,
        pollEndTime: endTime
      }
    );

    await ctx.reply(`Час опитування встановлено: ${startTime} - ${endTime}`);
    await ctx.reply('Налаштування збережено успішно! ✅');
    
    ctx.scene.leave();
  } catch (error) {
    console.error('Помилка при збереженні часу:', error);
    await ctx.reply('Виникла помилка при збереженні. Спробуйте ще раз.');
    ctx.scene.leave();
  }
});

export { registerScene, frequencyScene, timeScene };
