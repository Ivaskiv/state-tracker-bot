// src/controllers/botController.js - ГОЛОВНИЙ РОУТИНГ

import startHandler from './handlers/startHandler.js';
import textHandler from './handlers/textHandler.js';
import callbackHandler from './handlers/callbackHandler.js';
import keyboards from '../utils/keyboards.js';

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
      try {
        await ctx.reply('❌ Виникла помилка. Спробуй /start');
      } catch {}
    }
  });
  
  // ===== /START =====
  bot.start(async (ctx) => {
    await startHandler.handle(ctx);
  });
  
  // ===== ТЕКСТ =====
  bot.on('text', async (ctx) => {
    // Ігноруємо команди
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;
    await textHandler.handle(ctx);
  });
  
  // ===== CALLBACK =====
  bot.on('callback_query', async (ctx) => {
    await callbackHandler.handle(ctx);
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