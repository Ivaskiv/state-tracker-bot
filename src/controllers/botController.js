// src/controllers/botController.js
import { startQuestions, handleAnswer, skipQuestion } from '../handlers/questionHandler.js';

export default function botController(bot) {
  bot.start(async (ctx) => {
    ctx.session.userName = ctx.from.first_name;
    await ctx.reply(`Привіт, ${ctx.session.userName}! 🌱`);
    await ctx.reply('Вибери: /morning або /evening для щоденника');
  });

  bot.command('morning', async (ctx) => startQuestions(ctx, 'morning'));
  bot.command('evening', async (ctx) => startQuestions(ctx, 'evening'));
  bot.command('skip', async (ctx) => skipQuestion(ctx));

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return; // пропускаємо команди
    await handleAnswer(ctx, text);
  });
}
