// src/controllers/botController.js - ГОЛОВНИЙ РОУТИНГ

import registerStartHandlers, {
  handleText as startText,
  handleCallback as startCb
} from './handlers/startHandler.js';

import textHandler from './handlers/textHandler.js';
import callbackHandler from './handlers/callbackHandler.js';
import keyboards from '../utils/keyboards.js';
import profileController from './flows/profileController.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація...');

  // ===== MIDDLEWARE ЛОГУВАННЯ =====
  bot.use(async (ctx, next) => {
    const type = ctx.updateType;
    const from = ctx.from?.id;
    console.log(`➡️ ${type} від ${from}`);
    try {
      await next();
    } catch (error) {
      console.error('💥 Middleware error:', error);
      try { await ctx.reply('❌ Виникла помилка. Спробуй /start'); } catch {}
    }
  });
bot.hears('📊 Мій прогрес', async (ctx) => {
  await profileController.showProfile(ctx);
});
  // ===== /START =====
  // ✅ Реєструємо хендлер команди /start через дефолт-експорт
  registerStartHandlers(bot);

  // ===== ТЕКСТ =====
bot.on('text', async (ctx) => {
  try {
    const handled = await textHandler.handle(ctx);
    if (!handled) {
      await ctx.reply('❌ Невідома команда', keyboards.mainMenuKeyboard());
    }
  } catch (error) {
    console.error('💥 Middleware error:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
  }
});
// ===== CALLBACK =====
  bot.on('callback_query', async (ctx, next) => {
    // Спочатку онбординг
    if (await startCb(ctx)) return;
    // Потім — глобальні callback-и
    if (await callbackHandler.handle(ctx)) return;
    return next();
  });

  // ===== ГЛОБАЛЬНІ ПОМИЛКИ =====
  bot.catch(async (err, ctx) => {
    console.error('❌ Global error:', err);
    if (ctx?.reply) {
      try {
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
      } catch {}
    }
  });

  console.log('✅ [botController] Готовий');
  return { bot };
};

export default botController;
