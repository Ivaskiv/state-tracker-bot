// src/controllers/botController.js - FIXED VERSION

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import { clearUserReminders } from '../middleware/pendingFlow.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { ANSWER_STEPS} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { isActiveSubscription } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';

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
      
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const welcomeMessage = subscriptionStatus.active 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\n❌ Твоя підписка закінчилася.\n\nДля користування aiMentor потрібна активна підписка.\n\n📞 Зв'яжіться з підтримкою: nadyastarway@gmail.com`;
        
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
      
      // Спочатку видаляємо стару клавіатуру, потім надсилаємо нову
      await ctx.reply('🔄 Оновлення меню...', keyboards.removeKeyboard());
      await new Promise(r => setTimeout(r, 500)); // Невелика затримка
      await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
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

      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      if (!subscriptionStatus.active && text !== '💰 Підписка' && text !== '📞 Зв\'язок з нами') {
        await ctx.reply(
          '❌ Твоя підписка закінчилася.\n\nЩоб користуватися всіма функціями бота, оформи або продовжи підписку.\n\n📞 Зв\'яжіться з підтримкою: nadyastarway@gmail.com',
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveQuestions = step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'));
      const isActiveAI = aiMentorSession.isActive(String(tgId));

      console.log(`[botController] 📋 ДІАГНОСТИКА для ${tgId}: "${text}", step: "${step}", AI: ${isActiveAI}, Wheel: ${isActiveWheel}, Questions: ${isActiveQuestions}`);

      // AI наставник
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

      // Колесо балансу
      if (isActiveWheel) {
        logger.info(`🎯 [botController] Обробка колеса балансу для ${tgId}: "${text}"`);
        await wheelBalanceController.handleWheelBalanceAnswer(ctx, text);
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
    const tgId = ctx.from.id;

    console.log(`[botController] 📱 Callback: ${data} від ${tgId}`);

    try {
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      if (!subscriptionStatus.active && !data.includes('subscription') && !data.includes('support')) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // ✅ ОБРОБКА CALLBACK ДЛЯ ПРОДОВЖЕННЯ/ПРОПУСКУ СЕСІЙ
      if (data === 'continue_answers' || data === 'skip_session') {
        const user = await userService.getUserByTelegramId(tgId);
        const step = user?.Answer_Step || '';
        
        if (data === 'continue_answers') {
          // Визначаємо тип активної сесії та продовжуємо
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
          // Завершуємо всі активні сесії
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

      // Обробка рестарту сесій
      if (data === 'restart_morning' || data === 'restart_evening' || data === 'cancel_restart') {
        await handleRestartCallback(ctx);
        return;
      }

      if (data === 'ai_continue' || data === 'ai_exit') {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // Колесо балансу callback
      if (data.startsWith('wheel_score_') || data === 'wheel_exit') {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      if (data === 'wheel_retry' || data === 'wheel_start_new' || data === 'wheel_to_menu') {
        await wheelBalanceController.handleWheelRetryCallback(ctx);
        return;
      }

      // Підписка та підтримка
      if (data === 'subscription_info') {
        await ctx.reply('💰 Підписка\n\nДля оформлення або продовження підписки зв\'яжіться з підтримкою:\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Інформація про підписку');
        return;
      }

      if (data === 'contact_support') {
        await ctx.reply('📞 Підтримка\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316\n\nОпишіть свою ситуацію, і ми допоможемо!', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Контакти підтримки');
        return;
      }

      console.log(`[botController] ❓ Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
      
    } catch (error) {
      await handleError(ctx, error);
      await ctx.answerCbQuery('Помилка обробки');
    }
  });

  return { bot };
};

export default botController;