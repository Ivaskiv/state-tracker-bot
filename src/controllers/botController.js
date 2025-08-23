import { Telegraf } from 'telegraf';
import { createUser, findUserByTGId } from '../services/userService.js';
import { sendNextQuestion, handleAnswer } from '../services/reminderService.js';

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start(async (ctx) => {
  const tgId = ctx.from.id.toString();
  let user = await findUserByTGId(tgId);
  if (!user) {
    user = await createUser({ tgId, name: ctx.from.first_name });
  }
  await ctx.reply(`Привіт, ${user['User Name']}! Готові до сьогоднішньої сесії? 🌱`);
});

// будь-яке текстове повідомлення = відповідь
bot.on('text', async (ctx) => {
  await handleAnswer(ctx);
});
