// src/controllers/botController.js - ВИПРАВЛЕНО ПОДВІЙНИЙ ВИКЛИК

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import { clearUserReminders } from '../middleware/pendingFlow.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { handleMenuCommands } from './menuHandlers.js';
import { handleQuestionAnswer } from './sessionHandlers.js';
import { ANSWER_STEPS} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { isActiveSubscription } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';

const WHEEL_STEP = 'WheelBalance';

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  bot.use(globalTypingMiddleware());

  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    try {
      let user = await userService.getUserByTelegramId(tgId);
      
      if (!user) {
        user = await userService.createUser({
          tgId,
          name,
          email: ctx.from.username ? `${ctx.from.username}@telegram.user` : null,
        });
        
        await ctx.reply(`🌟 Вітаю в aiMentor, ${name}!\n\nГотова допомогти тобі відстежувати прогрес та досягати цілей! ✨`);
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const welcomeMessage = isActiveSubscription(user) 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\nДля користування aiMentor потрібна активна підписка.`;
        
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.command('menu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');
      
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      clearUserReminders(ctx.from.id);
      await ctx.reply('🔄 Меню оновлено!', keyboards.mainMenuKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message.text?.trim();
    if (!text) return;

    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Натисніть /start', keyboards.mainMenuKeyboard());

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveAI = aiMentorSession.isActive(tgId);
      const isActiveQuestions = step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'));

      // ✅ КОЛЕСО БАЛАНСУ - ТІЛЬКИ ОДИН ВИКЛИК
      if (isActiveWheel) {
        logger.info(`🎯 [botController] Обробка колеса балансу для ${tgId}: "${text}"`);
        await wheelBalanceController.handleWheelBalanceAnswer(ctx, text);
        return; // ✅ ВАЖЛИВО: завершуємо обробку тут
      }

      // AI наставник
      if (isActiveAI) {
        if (text.includes('вихід') || text.includes('exit')) {
          aiMentorSession.end(tgId);
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // Ранкові/вечірні питання
      if (isActiveQuestions) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      // Команди меню
      await handleMenuCommands(ctx, user, text, bot);
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    try {
      if (data === 'skip_session') {
        aiMentorSession.end(ctx.from.id);
        await completeSession(ctx.from.id, ctx, '✅ Сесію пропущено.');
        await ctx.answerCbQuery();
        return;
      }

      if (data === 'ai_continue' || data === 'ai_exit') {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data === 'wheel_retry' || data === 'wheel_exit') {
        await wheelBalanceController.handleWheelRetryCallback(ctx);
        return;
      }

      await ctx.answerCbQuery();
    } catch (error) {
      await handleError(ctx, error);
      await ctx.answerCbQuery();
    }
  });

  return { bot };
};

export default botController;