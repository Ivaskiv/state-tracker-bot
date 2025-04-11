import { Markup } from 'telegraf';
import { loadConfig } from './settings.js';

// Команда для зміни налаштувань
export async function handleSettingsCommand(ctx) {
  const config = loadConfig();
  if (config.admins.includes(ctx.from.id)) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Змінити час роботи бота', 'change_time')],
      [Markup.button.callback('Змінити привітальне повідомлення', 'change_welcome')],
      [Markup.button.callback('Додати адміністратора', 'add_admin')],
      [Markup.button.callback('Видалити адміністратора', 'remove_admin')]
    ]);
    await ctx.reply('Оберіть, що хочете змінити:', keyboard);
  } else {
    await ctx.reply('У вас немає доступу до налаштувань.');
  }
}


// Обробка зміни часу роботи бота
export async function handleChangeTime(ctx) {
  const config = loadConfig();
  ctx.session.action = 'change_time';
  await ctx.reply('Введіть новий час початку (формат: ЧЧ:ММ):');
}

// Логіка зміни привітального повідомлення
export async function handleChangeWelcomeMessage(ctx) {
  const config = loadConfig();
  ctx.session.action = 'change_welcome';
  await ctx.reply('Введіть нове привітальне повідомлення:');
}
