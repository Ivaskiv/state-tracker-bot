// src/controllers/botController.js - ДОДАНО SESSION MIDDLEWARE

import { session } from 'telegraf'; // ДОДАНО
import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import { clearUserReminders } from '../middleware/pendingFlow.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { handleStart, handleRegistrationStep } from '../auth/modules/auth.js';
import { ANSWER_STEPS} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { isActiveSubscription } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';
import subscriptionController from './subscriptionController.js';

const WHEEL_STEP = 'WheelBalance';

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  // ДОДАНО: session middleware для збереження стану реєстрації
  bot.use(session());
  bot.use(globalTypingMiddleware());

  bot.start(async (ctx) => {
    await handleStart(ctx);
  });

  bot.command('menu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');
      
      // ВИПРАВЛЕНО: очищуємо сесію при переході в меню
      ctx.session = {};
      
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      clearUserReminders(ctx.from.id);
      
      await ctx.reply('🔄 Оновлення меню...', keyboards.removeKeyboard());
      await new Promise(r => setTimeout(r, 500));
      await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.command('updatemenu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');
      
      ctx.session = {}; // Очищуємо сесію
      
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      clearUserReminders(ctx.from.id);
      
      await ctx.reply('🔄 Оновлюємо меню...', keyboards.removeKeyboard());
      await new Promise(r => setTimeout(r, 1000));
      await ctx.reply('✅ Меню оновлено!', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await ctx.reply('❌ Помилка оновлення');
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message.text?.trim();
    if (!text) return;

    try {
      // ВИПРАВЛЕНО: перевіряємо реєстрацію ПЕРШОЮ
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        console.log(`[botController] ✅ Оброблено крок реєстрації для ${tgId}`);
        return;
      }

      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        console.log(`[botController] ❌ Користувача ${tgId} не знайдено після реєстрації`);
        return ctx.reply('Натисніть /start', keyboards.mainMenuKeyboard());
      }

      // Перевірка підписки для всіх функцій крім підписки/підтримки
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = ['💰 Підписка', '📞 Зв\'язок з нами', '❓ Допомога'];
      
      if (!subscriptionStatus.active && !allowedForInactive.includes(text)) {
        await ctx.reply(
          '❌ Твоя підписка закінчилася.\n\nЩоб користуватися всіма функціями бота, оформи або продовжи підписку.\n\n📞 Зв\'яжіся з підтримкою: nadyastarway@gmail.com',
          keyboards.subscriptionKeyboard()
        );
        return;
      }

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveQuestions = step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'));
      const isActiveAI = aiMentorSession.isActive(String(tgId));

      if (isActiveAI) {
        if (text.includes('вихід') || text === '🚪 Вийти із сесії') {
          aiMentorSession.end(String(tgId));
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }
        
        if (text === '💎 Афірмація') {
          aiMentorSession.end(String(tgId));
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          await handleMenuCommands(ctx, user, text, bot);
          return;
        }
        
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      if (isActiveWheel) {
        const score = parseInt(text);
        if (!isNaN(score) && score >= 0 && score <= 10) {
          await wheelBalanceController.handleWheelBalanceAnswer(ctx, score);
        } else {
          await ctx.reply('❌ Введи число від 0 до 10 або використай кнопки:', keyboards.wheelScoreInlineKeyboard());
        }
        return;
      }

      if (isActiveQuestions) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      await handleMenuCommands(ctx, user, text, bot);
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    try {
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      const allowedForInactive = ['subscription_info', 'contact_support', 'subscription_plans', 
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'];
      
      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      if (data === 'continue_answers' || data === 'skip_session') {
        const user = await userService.getUserByTelegramId(tgId);
        const step = user?.Answer_Step || '';
        
        if (data === 'continue_answers') {
          if (step.startsWith('Q_m_')) {
            const questionNum = parseInt(step.split('_')[2]);
            const { MORNING_QUESTIONS } = await import('../config/constants.js');
            const currentQuestion = `${questionNum}️⃣/6 ${MORNING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌞 РАНКОВІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step.startsWith('Q_e_')) {
            const questionNum = parseInt(step.split('_')[2]);
            const { EVENING_QUESTIONS } = await import('../config/constants.js');
            const currentQuestion = `${questionNum}️⃣/5 ${EVENING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌙 ВЕЧІРНІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step === 'WheelBalance') {
            await ctx.editMessageText('🎯 Продовжуємо колесо балансу...');
            await wheelBalanceController.handleWheelBalanceRequest(ctx);
          } else if (aiMentorSession.isActive(String(tgId))) {
            await ctx.editMessageText('🤖 AI-наставник активний. Задавай питання!');
          } else {
            await ctx.editMessageText('Немає активних сесій');
          }
          await ctx.answerCbQuery('Продовжуємо');
        } else if (data === 'skip_session') {
          if (aiMentorSession.isActive(tgId)) {
            aiMentorSession.end(tgId);
          }
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          clearUserReminders(tgId);
          
          await ctx.editMessageText('🚪 Сесію завершено. Повертаємося до меню.');
          await ctx.answerCbQuery('Сесію завершено');
          await new Promise(r => setTimeout(r, 1000));
          await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
        }
        return;
      }

      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      if (['ai_continue', 'ai_exit'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data.startsWith('wheel_score_') || data === 'wheel_exit' || 
          data === 'wheel_retry' || data === 'wheel_start_new' || data === 'wheel_to_menu') {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      if (['subscription_info', 'subscription_plans', 'subscribe_week', 'subscribe_month', 
           'subscribe_year', 'renew_subscription', 'sync_subscription', 'contact_support'].includes(data)) {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      await ctx.answerCbQuery('Команда не розпізнана');
      
    } catch (error) {
      await handleError(ctx, error);
      await ctx.answerCbQuery('Помилка обробки');
    }
  });

  return { bot };
};

export default botController;