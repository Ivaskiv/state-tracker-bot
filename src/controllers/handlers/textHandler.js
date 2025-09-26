// src/controllers/handlers/textHandler.js - ОБРОБКА ТЕКСТОВИХ КОМАНД

import keyboards from '../../utils/keyboards.js';
import { handleRegistrationStep } from '../../auth/modules/auth.js';
import { aiMentorSession } from '../../aiMentor/session.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../wheelBalanceController.js';
import menuHandler from './menuHandler.js';
import sessionHandler from './sessionHandler.js';

const handle = async (ctx, userService) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  if (!text) return;
  
  console.log(`💬 [textHandler] Текст від ${tgId}: "${text.substring(0, 30)}..."`);

  try {
    // 1. ОНБОРДИНГ МАЄ НАЙВИЩИЙ ПРІОРИТЕТ
    const isOnboarding = await handleRegistrationStep(ctx);
    if (isOnboarding) return;

    // 2. ШВИДКЕ ОТРИМАННЯ КОРИСТУВАЧА
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
    } catch (error) {
      console.warn('[textHandler] База недоступна:', error.message);
      await ctx.reply('⚠️ Тимчасові проблеми. Спробуй /start', keyboards.mainMenuKeyboard());
      return;
    }

    if (!user || !user.UserRegistered) {
      await ctx.reply('Спочатку зареєструйся /start');
      return;
    }

    // 3. АКТИВНІ СЕСІЇ
    const step = user.Answer_Step;
    
    // AI Наставник
    if (aiMentorSession.isActive(tgId)) {
      await aiMentorController.handleAIMentorQuestion(ctx, text);
      return;
    }
    
    // Колесо балансу
    if (step === 'WheelBalance') {
      await wheelBalanceController.handleWheelNoteText(ctx);
      return;
    }
    
    // Ранкові/вечірні питання
    if (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'))) {
      await handleDailyQuestions(ctx, text, step);
      return;
    }

    // 4. ПЕРЕВІРКА БЛОКУВАННЯ СЕСІЙ
    if (await sessionHandler.isActiveSession(tgId)) {
      await sessionHandler.handleBlockedMenu(ctx);
      return;
    }

    // 5. ОБРОБКА КОМАНД МЕНЮ
    const hasAccess = userService.hasActiveAccess(user);
    await menuHandler.handleCommand(ctx, user, text, hasAccess);

  } catch (error) {
    console.error('[textHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
  }
};

// Обробка щоденних питань
const handleDailyQuestions = async (ctx, text, step) => {
  try {
    const dailyController = await import('../dailyQuestionsController.js');
    
    if (step.startsWith('Q_m_')) {
      await dailyController.default.handleMorningAnswer(ctx, text);
    } else if (step.startsWith('Q_e_')) {
      await dailyController.default.handleEveningAnswer(ctx, text);
    }
  } catch (error) {
    console.error('[handleDailyQuestions] Помилка:', error);
    await ctx.reply('❌ Помилка обробки питання. Спробуй ще раз.');
  }
};

export default { handle };