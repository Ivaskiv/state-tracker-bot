import reflectionHandler from '../handlers/reflectionHandler.js';
import userService from '../services/userService.js';
import { MESSAGES } from '../utils/messages.js';
import { mainMenuKeyboard, subscriptionKeyboard } from '../utils/keyboards.js';

// Приклад хендлера старту
export default function setupBot(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const user = await userService.getUserByTelegramId(telegramId);

    if (user) {
      const hasActiveSubscription = await userService.hasActiveSubscription(telegramId);
      if (hasActiveSubscription) {
        await ctx.reply(MESSAGES.ALREADY_REGISTERED, mainMenuKeyboard());
      } else {
        await ctx.reply(MESSAGES.SUBSCRIPTION_INFO, subscriptionKeyboard());
      }
    } else {
      await ctx.reply(MESSAGES.WELCOME);
      ctx.session.step = 'registration_name';
    }
  });

  bot.hears('📝 Ранкові питання', async (ctx) => {
    await reflectionHandler.startMorningQuestions(ctx);
  });

  bot.hears('🌙 Вечірні питання', async (ctx) => {
    await reflectionHandler.startEveningQuestions(ctx);
  });
}
