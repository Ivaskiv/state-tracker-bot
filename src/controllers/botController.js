// src/controllers/botController.js - ВИПРАВЛЕНО СИНТАКСИС ІМПОРТІВ

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import { cancelPendingReminders } from '../middleware/pendingFlow.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';
import subscriptionController from './subscriptionController.js';

const WHEEL_STEP = 'WheelBalance';

const isActiveQuestionsStep = (step) => Boolean(step && (step.startsWith('Q_m_') || step.startsWith('Q_e_')));
const isActiveAIStep = (step) => Boolean(step && (step === 'AI_ACTIVE' || step?.startsWith('AI_')));
const isOnboardingStep = (step) => Boolean(step && step.startsWith('ob_'));

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  bot.use(globalTypingMiddleware());

  // ✅ /start КОМАНДА
  bot.start(async (ctx) => {
    await handleStart(ctx);
  });

  // ✅ /menu КОМАНДА
  bot.command('menu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
      }

      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      cancelPendingReminders(ctx.from.id);

      await ctx.reply('🔄 Оновлення меню...', keyboards.removeKeyboard());
      await new Promise((r) => setTimeout(r, 500));
      await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  // ✅ /updatemenu КОМАНДА
  bot.command('updatemenu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
      }

      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      cancelPendingReminders(ctx.from.id);

      await ctx.reply('🔄 Оновлюємо меню...', keyboards.removeKeyboard());
      await new Promise((r) => setTimeout(r, 1000));
      await ctx.reply('✅ Меню оновлено!', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await ctx.reply('❌ Помилка оновлення');
    }
  });

  // ✅ ОБРОБКА ТЕКСТОВИХ ПОВІДОМЛЕНЬ
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      // 0) Якщо чекаємо «нотатку після оцінки» — обробляємо її першою.
    const noteHandled = await wheelBalanceController.handleWheelNoteText(ctx);
    if (noteHandled) return;

      // ✅ 1. ПЕРША ПРІОРИТЕТ: онбординг
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        logger.info(`[botController] ✅ Оброблено крок онбордингу для ${tgId}`);
        return;
      }

      // ✅ 2. ОТРИМУЄМО КОРИСТУВАЧА
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        logger.warn(`[botController] ❌ Користувача ${tgId} не знайдено`);
        return ctx.reply('Натисніть /start для реєстрації', keyboards.mainMenuKeyboard());
      }

      const step = user.Answer_Step;
      const sessionStep = ctx.session?.step;

      // ✅ 3. ПЕРЕВІРЯЄМО ЧИ В ОНБОРДИНГУ
      if (isOnboardingStep(step) || isOnboardingStep(sessionStep)) {
        logger.info(`[botController] 🔄 Користувач ${tgId} в онбордингу, step: ${step || sessionStep}`);
        return; // онбординг вже оброблено вище
      }

      // ✅ 4. ТІЛЬКИ ПІСЛЯ ОНБОРДИНГУ перевіряємо підписку
      const isRegistered = user['UserRegistered'] === true && user['Status'] === 'Registered User';
      if (!isRegistered) {
        logger.info(`[botController] ⚠️ Користувач ${tgId} не завершив реєстрацію`);
        return ctx.reply('Завершіть реєстрацію спочатку /start');
      }

      // ✅ 5. ПЕРЕВІРКА ПІДПИСКИ (з винятками)
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = ['💰 Підписка', '📞 Зв\'язок з нами', '❓ Допомога', '📝 Інструкції'];
      
      if (!subscriptionStatus.active && !allowedForInactive.includes(text)) {
        await ctx.reply(
          '❌ Твоя підписка закінчилася або неактивна.\n\nЩоб користуватися всіма функціями бота, активуй підписку.\n\n📞 Зв\'яжіся з підтримкою: nadyastarway@gmail.com',
          keyboards.subscriptionKeyboard()
        );
        return;
      }

      // ✅ 6. ОБРОБКА АКТИВНИХ СЕСІЙ
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveQA = isActiveQuestionsStep(step);
      const isActiveAI = isActiveAIStep(step);

      // AI MENTOR активний
      if (isActiveAI) {
        if (text.includes('вихід') || text === '🚪 Вийти із сесії') {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }

        if (text === '💎 Афірмація') {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);
          await handleMenuCommands(ctx, user, text, bot);
          return;
        }

        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // КОЛЕСО БАЛАНСУ активне
      if (isActiveWheel) {
        const score = parseInt(text, 10);
        if (!Number.isNaN(score) && score >= 0 && score <= 10) {
          await wheelBalanceController.handleWheelBalanceAnswer(ctx, score);
        } else {
          await ctx.reply('❌ Введи число від 0 до 10 або використай кнопки:', keyboards.wheelScoreInlineKeyboard());
        }
        return;
      }

      // ПИТАННЯ-ВІДПОВІДІ активні
      if (isActiveQA) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      // ✅ 7. СТАНДАРТНІ КОМАНДИ МЕНЮ
      await handleMenuCommands(ctx, user, text, bot);

    } catch (error) {
      await handleError(ctx, error);
    }
  });

  // ✅ ОБРОБКА CALLBACK ЗАПИТІВ
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    try {
      logger.info(`[botController] 📱 Callback: ${data} від ${tgId}`);

      // ✅ 1. ПЕРША ПРІОРИТЕТ: онбординг callback-и
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) {
        logger.info(`[botController] ✅ Оброблено онбординг callback для ${tgId}`);
        return;
      }

      // ✅ 2. ПЕРЕВІРЯЄМО ЧИ В ОНБОРДИНГУ ЗА СЕСІЄЮ
      if (ctx.session?.step && isOnboardingStep(ctx.session.step)) {
        logger.info(`[botController] ❌ Онбординг callback НЕ оброблено, step: ${ctx.session.step}, data: ${data}`);
        await ctx.answerCbQuery('Невідома команда онбордингу');
        return;
      }

      // ✅ 3. ПЕРЕВІРЯЄМО ЧИ КОРИСТУВАЧ ЗАРЕЄСТРОВАНИЙ
      const user = await userService.getUserByTelegramId(tgId);
      const isRegistered = user && user['UserRegistered'] === true && user['Status'] === 'Registered User';
      
      if (!isRegistered) {
        logger.info(`[botController] ⚠️ Користувач ${tgId} не завершив реєстрацію для callback ${data}`);
        await ctx.answerCbQuery('Завершіть реєстрацію спочатку');
        return;
      }

      // ✅ 4. ТІЛЬКИ ПІСЛЯ ПЕРЕВІРКИ РЕЄСТРАЦІЇ - перевіряємо підписку
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        'subscription_info', 'contact_support', 'subscription_plans',
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'
      ];

      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // ✅ 5. ОБРОБКА СИСТЕМНИХ CALLBACK-ІВ
      if (data === 'continue_answers' || data === 'skip_session') {
        const step = user?.Answer_Step || '';

        if (data === 'continue_answers') {
          if (step.startsWith('Q_m_')) {
            const questionNum = parseInt(step.split('_')[2], 10);
            const currentQuestion = `${questionNum}️⃣/${MORNING_QUESTIONS.length} ${MORNING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌞 РАНКОВІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step.startsWith('Q_e_')) {
            const questionNum = parseInt(step.split('_')[2], 10);
            const currentQuestion = `${questionNum}️⃣/${EVENING_QUESTIONS.length} ${EVENING_QUESTIONS[questionNum - 1]}`;
            await ctx.editMessageText(`🌙 ВЕЧІРНІ ПИТАННЯ\n\n${currentQuestion}`);
          } else if (step === WHEEL_STEP) {
            await ctx.editMessageText('🎯 Продовжуємо колесо балансу...');
            await wheelBalanceController.handleWheelBalanceRequest(ctx);
          } else if (isActiveAIStep(step)) {
            await ctx.editMessageText('🤖 AI-наставник активний. Задавай питання!');
          } else {
            await ctx.editMessageText('Немає активних сесій');
          }
          await ctx.answerCbQuery('Продовжуємо');
          return;
        }

        if (data === 'skip_session') {
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);

          await ctx.editMessageText('🚪 Сесію завершено. Повертаємося до меню.');
          await ctx.answerCbQuery('Сесію завершено');
          await new Promise((r) => setTimeout(r, 800));
          await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
          return;
        }
      }

      // ✅ 6. ОБРОБКА РЕСТАРТУ СЕСІЙ
      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      // ✅ 7. AI НАСТАВНИК CALLBACK-И
      if (['ai_continue', 'ai_exit'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // ✅ 8. КОЛЕСО БАЛАНСУ CALLBACK-И
      if (
        data.startsWith('wheel_score_') ||
        data === 'wheel_exit' ||
        data === 'wheel_retry' ||
        data === 'wheel_start_new' ||
        data === 'wheel_to_menu' ||
        data === 'wheel_continue' ||
        data === 'wheel_restart' ||
        data === 'wheel_cancel' ||
        data === 'wheel_start'
      ) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      // ✅ 9. ПІДПИСКА CALLBACK-И
      if (
        [
          'subscription_info',
          'subscription_plans',
          'subscribe_week',
          'subscribe_month',
          'subscribe_year',
          'renew_subscription',
          'sync_subscription',
          'contact_support',
          'renew_week',
          'renew_month',
          'renew_year'
        ].includes(data)
      ) {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      // ✅ 10. ГОЛОВНЕ МЕНЮ CALLBACK-И
      if (data === 'main_menu') {
        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Повернення до меню');
        return;
      }

      // ✅ 11. НЕВІДОМІ CALLBACK-И
      logger.warn(`[botController] ❓ Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');

    } catch (error) {
      logger.error(`[botController] ❌ Помилка callback ${data}:`, error);
      await handleError(ctx, error);
      try { 
        await ctx.answerCbQuery('Помилка обробки'); 
      } catch {}
    }
  });

  return { bot };
};

export default botController;