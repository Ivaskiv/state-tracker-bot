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
import typing from '../../utils/typing.js';

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
    
    // 3. ПЕРЕВІРКА АКТИВНИХ СЕСІЙ
    const step = user.Answer_Step;
    
    // ✅ БЛОКУВАННЯ МЕНЮ ПІД ЧАС АКТИВНИХ СЕСІЙ
   const isInSession = 
      aiMentorSession.isActive?.(tgId) ||
      step === 'WheelBalance' ||
      step?.startsWith('Q_m_') ||
      step?.startsWith('Q_e_');
    
    if (isInSession && text !== '/start') {
      let sessionName = 'сесія';
      let exitCallback = 'exit_session';
      
      if (aiMentorSession.isActive?.(tgId)) {
        sessionName = 'AI наставник';
        exitCallback = 'ai_exit';
      } else if (step === 'WheelBalance') {
        sessionName = 'колесо балансу';
        exitCallback = 'wheel_exit';
      } else if (step?.startsWith('Q_m_')) {
        sessionName = 'ранкова рефлексія';
        exitCallback = 'exit_morning';
      } else if (step?.startsWith('Q_e_')) {
        sessionName = 'вечірня рефлексія';
        exitCallback = 'exit_evening';
      }
      
      await ctx.reply(
        `⚠️ Зараз активна ${sessionName}\n\n` +
        `Щоб перейти до головного меню, спочатку завершіть поточну сесію.\n\n` +
        `Що робимо?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁 Продовжити сесію', callback_data: 'continue_session' }],
              [{ text: '🚪 Завершити сесію', callback_data: exitCallback }]
            ]
          }
        }
      );
      return;
    }
    
    // 4. AI НАСТАВНИК (якщо активний)
    if (aiMentorSession.isActive?.(tgId)) {
      await aiMentorController.handleAIMentorQuestion(ctx, text);
      return;
    }
    
    // 5. КОЛЕСО БАЛАНСУ
    if (step === 'WheelBalance') {
      await wheelController.handleText(ctx, text);
      return;
    }
    
    // 6. ЩОДЕННІ ПИТАННЯ
    if (step?.startsWith('Q_m_') || step?.startsWith('Q_e_')) {
      await dailyController.handleText(ctx, text, step);
      return;
    }
    
    // 7. КОМАНДИ МЕНЮ
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