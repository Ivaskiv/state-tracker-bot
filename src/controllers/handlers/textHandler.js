// src/controllers/handlers/textHandler.js - ОНОВЛЕНО

import startHandler from './startHandler.js';
import userService from '../../services/userService.js';
import mainFlowController from '../flows/mainFlowController.js';
import dailyController from '../flows/dailyController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import subscriptionController from '../subscriptionController.js';
import { aiMentorSession } from '../../aiMentor/session.js';
import keyboards from '../../utils/keyboards.js';

export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return;
  
  console.log(`[textHandler] "${text}" від ${tgId}`);
  
  try {
    // 1. ОНБОРДИНГ
    if (await startHandler.handleText(ctx)) return;
    
    // 2. ОТРИМАННЯ КОРИСТУВАЧА
    const user = await userService.getUserByTgId(tgId);
    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start');
      return;
    }
    
        const step = user.Answer_Step;
    
    // 3. AI НАСТАВНИК (якщо активний)
    if (aiMentorSession.isActive?.(tgId)) {
      await aiMentorController.handleAIMentorQuestion(ctx, text);
      return;
    }
    
    // 4. КОЛЕСО БАЛАНСУ
    if (step === 'WheelBalance') {
      await wheelController.handleText(ctx, text);
      return;
    }
    
    // 5. ЩОДЕННІ ПИТАННЯ
    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      await dailyController.handleText(ctx, text, step);
      return;
    }
    
    // 6. КОМАНДИ МЕНЮ
    const hasAccess = userService.hasActiveAccess(user);
    
    // ✅ ВИПРАВЛЕННЯ: ОБРОБКА КНОПКИ "ПІДПИСКА"
    if (text === '💰 Підписка') {
      await subscriptionController.handleSubscriptionInfo(ctx);
      return;
    }
    
    await mainFlowController.handleText(ctx, text, user, hasAccess);
    
  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
  }
};

export default { handle };