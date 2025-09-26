// src/controllers/botController.js - МОДУЛЬНИЙ ТА ОПТИМІЗОВАНИЙ

import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

// Імпорти модулів
import startHandler from './handlers/startHandler.js';
import textHandler from './handlers/textHandler.js'; 
import callbackHandler from './handlers/callbackHandler.js';
import menuHandler from './handlers/menuHandler.js';
import sessionHandler from './handlers/sessionHandler.js';

const botController = (bot) => {
  console.log('[botController] ✅ Ініціалізація модульного контролера...');

  // /start команда
  bot.start(async (ctx) => {
    await startHandler.handle(ctx, userService);
  });

  // Текстові повідомлення
  bot.on('text', async (ctx) => {
    await textHandler.handle(ctx, userService);
  });

  // Callback queries
  bot.on('callback_query', async (ctx) => {
    await callbackHandler.handle(ctx, userService);
  });

  // Глобальна обробка помилок
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Глобальна помилка:', err);
    
    if (ctx?.reply) {
      try {
        await ctx.reply(
          '❌ Виникла технічна помилка. Спробуй /start або зверніся до підтримки.',
          keyboards.mainMenuKeyboard()
        );
      } catch (replyError) {
        console.error('❌ Не вдалося надіслати повідомлення про помилку:', replyError);
      }
    }
  });

  console.log('✅ [botController] Модульний контролер готовий');
  return { bot };
};

export default botController;