import { Telegraf, Markup } from 'telegraf';
import User from '../models/user.js';
import Record from '../models/record.js';
import * as analytics from '../services/analytics.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import config from '../config/defaultConfig.json';  // Імпортуємо налаштування

// === Функція для налаштування звітів ===
async function setupReportSettings(ctx) {
  const telegramId = ctx.from.id;
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(config.messages.welcomeMessage);  // Використовуємо повідомлення з конфігурації

    // Створюємо клавіатуру з кнопок із конфігураційного файлу
    const keyboard = Markup.inlineKeyboard(config.keyboard.reportSettings.map(button => 
      [Markup.button.callback(button.label, button.action)]
    ));

    await ctx.reply(config.messages.reportSettingsMessage, keyboard);
  } catch (err) {
    console.error('Setup error:', err);
    await ctx.reply(config.messages.setupError);  // Використовуємо повідомлення з конфігурації
  }
}

// === Обробка налаштувань звітів ===
async function handleReportSettings(ctx) {
  const telegramId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply(config.messages.welcomeMessage);  // Використовуємо повідомлення з конфігурації

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
    await ctx.reply(config.messages.setupError);  // Використовуємо повідомлення з конфігурації
  }
}

// Функція для зміни повідомлень
async function changeMessage(ctx, messageKey) {
  const telegramId = ctx.from.id;
  
  if (!config.admins.includes(telegramId)) {
    return ctx.reply("Ви не маєте прав на зміну повідомлень.");
  }

  const currentMessage = config.messages[messageKey];
  await ctx.reply(`${config.messages.changeMessagePrompt} ${currentMessage}`);

  // Очікуємо на новий текст від адміністратора
  ctx.scene.enter('editMessage', { messageKey });
}

// Функція для збереження нового повідомлення
async function saveNewMessage(ctx, newMessage, messageKey) {
  const telegramId = ctx.from.id;

  if (!config.admins.includes(telegramId)) {
    return ctx.reply("Ви не маєте прав на зміну повідомлень.");
  }

  // Оновлюємо повідомлення в конфігурації
  config.messages[messageKey] = newMessage;

  // Зберігаємо зміни в файл конфігурації
  await fs.promises.writeFile('./config/defaultConfig.json', JSON.stringify(config, null, 2));

  await ctx.reply(`${config.messages.changeMessageSuccess} "${newMessage}"`);
}

export {
  setupReportSettings,
  handleReportSettings,
  changeMessage,
  saveNewMessage
};
