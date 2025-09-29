// src/controllers/handlers/callbackHandler.js - CALLBACK З АНТІ-СПАМОМ

import antiSpam from '../../utils/antiSpam.js';
import startHandler from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import keyboards from '../../utils/keyboards.js';

export const handle = async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery?.data;
  
  console.log(`[callbackHandler] ${data} від ${userId}`);
  
  // Анті-спам
  if (antiSpam.isSpam(userId, data)) {
    await ctx.answerCbQuery('⏳ Зачекай трохи');
    return;
  }
  
  // Завжди відповідаємо на callback
  await ctx.answerCbQuery().catch(() => {});
  
  try {
    // 1. ОНБОРДИНГ
    if (await startHandler.handleCallback(ctx)) return;
    
    // 2. ПІДПИСКИ
    if (data.startsWith('subscription_') || data.startsWith('subscribe_') || 
        data === 'activate_trial' || data === 'sync_subscription' || 
        data === 'contact_support' || data.startsWith('plan_')) {
      await subscriptionController.handleCallback(ctx);
      return;
    }
    
    // 3. КОЛЕСО БАЛАНСУ
    if (data.startsWith('wheel_')) {
      await wheelController.handleCallback(ctx, data);
      return;
    }
    
    // 4. AI НАСТАВНИК
    if (data.startsWith('ai_')) {
      await aiMentorController.handleAIMentorCallback(ctx);
      return;
    }
    
    // 5. ЩОДЕННІ СЕСІЇ
    if (data.includes('morning') || data.includes('evening')) {
      await dailyController.handleCallback(ctx, data);
      return;
    }
    
    // 6. ГОЛОВНЕ МЕНЮ
    if (data === 'main_menu') {
      await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      return;
    }
    
    console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
    
  } catch (error) {
    console.error('[callbackHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
  }
};

export default { handle };