// src/controllers/handlers/sessionHandler.js - УПРАВЛІННЯ СЕСІЯМИ

import { aiMentorSession } from '../../aiMentor/session.js';

// Перевірка активних сесій
const isActiveSession = async (tgId) => {
  try {
    const userService = await import('../../services/userService.js');
    const user = await userService.default.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    return (
      aiMentorSession.isActive(tgId) ||
      step === 'WheelBalance' ||
      (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_')))
    );
  } catch (error) {
    console.error('[isActiveSession] Помилка:', error);
    return false;
  }
};

// Блокування меню під час сесій
const handleBlockedMenu = async (ctx) => {
  const tgId = ctx.from.id;
  let sessionType = 'сесія';
  
  try {
    const userService = await import('../../services/userService.js');
    const user = await userService.default.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    if (aiMentorSession.isActive(tgId)) {
      sessionType = 'AI наставник';
    } else if (step === 'WheelBalance') {
      sessionType = 'колесо балансу';
    } else if (step && step.startsWith('Q_m_')) {
      sessionType = 'ранкова рефлексія';
    } else if (step && step.startsWith('Q_e_')) {
      sessionType = 'вечірня рефлексія';
    }
  } catch (error) {
    console.error('[handleBlockedMenu] Помилка:', error);
  }

  const message = 
    `⚠️ Зараз іде ${sessionType}\n\n` +
    `Завершимо поточну сесію?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔁 Продовжити', callback_data: 'continue_session' }],
        [{ text: '🚪 Вийти із сесії', callback_data: 'exit_session' }]
      ]
    }
  });
};

// Обробка контролю сесій
const handleSessionControl = async (ctx, data) => {
  const tgId = ctx.from.id;
  
  try {
    const userService = await import('../../services/userService.js');
    const user = await userService.default.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;

    if (data === 'continue_session') {
      if (aiMentorSession.isActive(tgId)) {
        const keyboards = await import('../../utils/keyboards.js');
        await ctx.reply('💬 Продовжуємо діалог з AI наставником. Напиши своє питання!', keyboards.default.aiMentorControlKeyboard());
      } else if (step === 'WheelBalance') {
        await ctx.reply('🎯 Продовжуємо колесо балансу...');
      } else if (step && step.startsWith('Q_m_')) {
        const dailyController = await import('../dailyQuestionsController.js');
        const questionNumber = parseInt(step.split('_')[2]);
        await dailyController.default.askMorningQuestion(ctx, questionNumber);
      } else if (step && step.startsWith('Q_e_')) {
        const dailyController = await import('../dailyQuestionsController.js');
        const questionNumber = parseInt(step.split('_')[2]);
        await dailyController.default.askEveningQuestion(ctx, questionNumber);
      }
      
    } else if (data === 'exit_session') {
      if (aiMentorSession.isActive(tgId)) {
        aiMentorSession.end(tgId);
      }
      
      await userService.default.updateUserActivity(tgId);
      const keyboards = await import('../../utils/keyboards.js');
      await ctx.reply('🏠 Повернулися до головного меню', keyboards.default.mainMenuKeyboard());
    }
    
  } catch (error) {
    console.error('[handleSessionControl] Помилка:', error);
    const keyboards = await import('../../utils/keyboards.js');
    await ctx.reply('❌ Помилка. Повертаємося до меню.', keyboards.default.mainMenuKeyboard());
  }
};

export default { 
  isActiveSession,
  handleBlockedMenu,
  handleSessionControl
};