import { Markup } from 'telegraf';
import User from '../models/user.js';
import fs from 'fs';
import { configData } from '../config/configData.js';

// Функція для відправки щоденного звіту
export async function sendDailyReport(ctx) {
  const telegramId = ctx.from.id;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(configData.messages.welcomeMessage);
    
    // Тут має бути логіка генерації щоденного звіту
    await ctx.reply('Ваш щоденний звіт: [дані звіту будуть тут]');
  } catch (err) {
    console.error('Daily report error:', err);
    await ctx.reply('Сталася помилка при формуванні звіту. Спробуйте пізніше.');
  }
}

// Функція для відправки тижневого звіту
export async function sendWeeklyReport(ctx) {
  const telegramId = ctx.from.id;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(configData.messages.welcomeMessage);
    
    // Тут має бути логіка генерації тижневого звіту
    await ctx.reply('Ваш тижневий звіт: [дані звіту будуть тут]');
  } catch (err) {
    console.error('Weekly report error:', err);
    await ctx.reply('Сталася помилка при формуванні звіту. Спробуйте пізніше.');
  }
}

// === Функція для налаштування звітів ===
export async function setupReportSettings(ctx) {
  const telegramId = ctx.from.id;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(configData.messages.welcomeMessage);

    // Створюємо клавіатуру з кнопок із конфігураційного файлу
    const keyboard = Markup.inlineKeyboard(configData.keyboard.reportSettings.map(button => 
      [Markup.button.callback(button.label, button.action)]
    ));

    await ctx.reply(configData.messages.reportSettingsMessage, keyboard);
  } catch (err) {
    console.error('Setup error:', err);
    await ctx.reply('Сталася помилка при взаємодії з базою даних. Спробуйте пізніше.');
  }
}

// === Обробка налаштувань звітів ===
export async function handleReportSettings(ctx) {
  const telegramId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(configData.messages.welcomeMessage);

    if (['daily', 'weekly', 'monthly'].includes(data)) {
      user.reportPeriod = data;
      await ctx.reply(`Період звітів встановлено: ${data}`);
    } else if (['telegram', 'email'].includes(data)) {
      user.reportChannel = data;
      await ctx.reply(`Канал для звітів встановлено: ${data === 'telegram' ? 'Telegram' : 'Email'}`);
    } else if (data === 'changeMessage') {
      await changeMessage(ctx, 'daily');  // Це лише для прикладу, адмін може змінити будь-яке повідомлення
    }
    await user.save();
  } catch (err) {
    console.error('Handle settings error:', err);
    await ctx.reply(configData.messages.setupError || 'Сталася помилка. Спробуйте пізніше.');
  }
}

// Функція для зміни повідомлень
export async function changeMessage(ctx, messageKey) {
  const telegramId = ctx.from.id;
  
  if (!configData.admins.includes(telegramId)) {
    return ctx.reply("Ви не маєте прав на зміну повідомлень.");
  }

  const currentMessage = configData.messages[messageKey];
  await ctx.reply(`Поточне повідомлення: ${currentMessage}. Введіть новий текст:`);

  // Очікуємо на новий текст від адміністратора
  ctx.scene.enter('editMessage', { messageKey });
}

// Функція для збереження нового повідомлення
export async function saveNewMessage(ctx, newMessage, messageKey) {
  const telegramId = ctx.from.id;

  if (!configData.admins.includes(telegramId)) {
    return ctx.reply("Ви не маєте прав на зміну повідомлень.");
  }

  // Оновлюємо повідомлення в конфігурації
  configData.messages[messageKey] = newMessage;

  // Зберігаємо зміни в файл конфігурації
  const configString = `export const configData = ${JSON.stringify(configData, null, 2)};`;
  await fs.promises.writeFile('./config/configData.js', configString, 'utf8');

  await ctx.reply(`Повідомлення успішно змінено на: "${newMessage}"`);
}
// import {  Markup } from 'telegraf';
// import User from '../models/user.js';
// import fs from 'fs';
// import config from '../config/config.js';

// // === Функція для налаштування звітів ===
// async function setupReportSettings(ctx) {
//   const telegramId = ctx.from.id;
//   try {
//     const user = await User.findOne({ telegramId });
//     if (!user) return ctx.reply(config.messages.welcomeMessage);  // Використовуємо повідомлення з конфігурації

//     // Створюємо клавіатуру з кнопок із конфігураційного файлу
//     const keyboard = Markup.inlineKeyboard(config.keyboard.reportSettings.map(button => 
//       [Markup.button.callback(button.label, button.action)]
//     ));

//     await ctx.reply(config.messages.reportSettingsMessage, keyboard);
//   } catch (err) {
//     console.error('Setup error:', err);
//     await ctx.reply('Сталася помилка при взаємодії з базою даних. Спробуйте пізніше.');
//   }
// }

// // === Обробка налаштувань звітів ===
// async function handleReportSettings(ctx) {
//   const telegramId = ctx.from.id;
//   const data = ctx.callbackQuery.data;

//   try {
//     const user = await User.findOne({ telegramId });
//     if (!user) return ctx.reply(config.messages.welcomeMessage);  // Використовуємо повідомлення з конфігурації

//     if (['daily', 'weekly', 'monthly'].includes(data)) {
//       user.reportPeriod = data;
//       await ctx.reply(`Період звітів встановлено: ${data}`);
//     } else if (['telegram', 'email'].includes(data)) {
//       user.reportChannel = data;
//       await ctx.reply(`Канал для звітів встановлено: ${data === 'telegram' ? 'Telegram' : 'Email'}`);
//     } else if (data === 'changeMessage') {
//       await changeMessage(ctx, 'daily');  // Це лише для прикладу, адмін може змінити будь-яке повідомлення
//     }
//     await user.save();
//   } catch (err) {
//     console.error('Handle settings error:', err);
//     await ctx.reply(config.messages.setupError);  // Використовуємо повідомлення з конфігурації
//   }
// }

// // Функція для зміни повідомлень
// async function changeMessage(ctx, messageKey) {
//   const telegramId = ctx.from.id;
  
//   if (!config.admins.includes(telegramId)) {
//     return ctx.reply("Ви не маєте прав на зміну повідомлень.");
//   }

//   const currentMessage = config.messages[messageKey];
//   await ctx.reply(`${config.messages.changeMessagePrompt} ${currentMessage}`);

//   // Очікуємо на новий текст від адміністратора
//   ctx.scene.enter('editMessage', { messageKey });
// }

// // Функція для збереження нового повідомлення
// async function saveNewMessage(ctx, newMessage, messageKey) {
//   const telegramId = ctx.from.id;

//   if (!config.admins.includes(telegramId)) {
//     return ctx.reply("Ви не маєте прав на зміну повідомлень.");
//   }

//   // Оновлюємо повідомлення в конфігурації
//   config.messages[messageKey] = newMessage;

//   // Зберігаємо зміни в файл конфігурації
//   await fs.promises.writeFile('./config/defaultconfigData.json', JSON.stringify(config, null, 2));

//   await ctx.reply(`${config.messages.changeMessageSuccess} "${newMessage}"`);
// }

// export {
//   setupReportSettings,
//   handleReportSettings,
//   changeMessage,
//   saveNewMessage
// };
