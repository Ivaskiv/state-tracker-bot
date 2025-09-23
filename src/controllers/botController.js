// src/controllers/botController.js - ВИПРАВЛЕНО ЛОГІКУ БЛОКУВАННЯ ТА СЕСІЙ

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { cancelPendingReminders } from '../middleware/pendingFlow.js';
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';
import { ANSWER_STEPS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { handleError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';
import subscriptionController from './subscriptionController.js';
import typing from '../utils/typing.js';

// ✅ ЦЕНТРАЛІЗОВАНА ФУНКЦІЯ ПЕРЕВІРКИ АКТИВНОЇ СЕСІЇ
const getActiveSessionInfo = async (tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    // 1. Перевірка активного колеса
    const wheelActive = await wheelBalanceService.isWheelActive(tgId);
    if (wheelActive) {
      return {
        type: 'wheel',
        active: true,
        message: '🎯 Колесо балансу в процесі! Завершіть спочатку.',
        step: 'wheel_balance'
      };
    }
    
    // 2. Перевірка активних питань-відповідей
    if (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'))) {
      const sessionType = step.startsWith('Q_m_') ? 'ранкові' : 'вечірні';
      return {
        type: 'questions',
        active: true,
        sessionType,
        message: `📝 ${sessionType} питання в процесі! Завершіть спочатку.`,
        step
      };
    }
    
    // 3. Перевірка AI ментора
    if (aiMentorSession.isActive(tgId)) {
      return {
        type: 'ai',
        active: true,
        message: '🤖 AI-наставник активний! Завершіть діалог спочатку.',
        step: 'ai_mentor'
      };
    }
    
    return { active: false, type: null };
    
  } catch (error) {
    console.error('❌ [bot] Помилка перевірки активної сесії:', error);
    return { active: false, type: null };
  }
};

// ✅ БЛОКУВАННЯ МЕНЮ ПІД ЧАС АКТИВНИХ СЕСІЙ
const blockMenuDuringSession = async (ctx, sessionInfo) => {
  await typing(ctx);
  await ctx.reply(
    `⚠️ ${sessionInfo.message}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔁 Продовжити', callback_data: 'continue_answers' }],
          [{ text: '🚪 Вийти із сесії', callback_data: 'skip_session' }]
        ]
      }
    }
  );
};

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  // ✅ /start КОМАНДА
  bot.start(async (ctx) => {
    await handleStart(ctx);
  });

  // ✅ /menu КОМАНДА - ЗАВЖДИ СКАСОВУЄ ВСІ АКТИВНІ СЕСІЇ
  bot.command('menu', async (ctx) => {
    try {
      const tgId = ctx.from.id;
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Натисніть /start');

      // ✅ СКАСУВАННЯ ВСІХ АКТИВНИХ СЕСІЙ
      await wheelBalanceService.cancelActiveWheel(tgId);
      aiMentorSession.end(tgId);
      cancelPendingReminders(tgId);

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
        ctx.session.wheel = undefined;
      }

      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      await typing(ctx);
      await ctx.reply('🔄 Скасовано всі активні сесії...', keyboards.removeKeyboard());
      await new Promise(r => setTimeout(r, 800));
      await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  // ✅ ОБРОБКА ТЕКСТОВИХ ПОВІДОМЛЕНЬ
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      // ✅ ПЕРША ПРІОРИТЕТ: онбординг
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        logger.info(`[botController] ✅ Оброблено крок онбордингу для ${tgId}`);
        return;
      }

      // ✅ ДРУГА ПРІОРИТЕТ: отримуємо користувача
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        logger.warn(`[botController] ❌ Користувача ${tgId} не знайдено`);
        await typing(ctx);
        return ctx.reply('Натисніть /start для реєстрації', keyboards.mainMenuKeyboard());
      }

      // ✅ ТРЕТЯ ПРІОРИТЕТ: перевірка активної сесії
      const sessionInfo = await getActiveSessionInfo(tgId);

      if (sessionInfo.active) {
        console.log(`🔒 [bot] Активна сесія ${sessionInfo.type} для ${tgId}`);
        
        // Обробка команд виходу
        if (text.includes('вихід') || text === '🚪 Вийти із сесії' || text === '/menu') {
          await wheelBalanceService.cancelActiveWheel(tgId);
          aiMentorSession.end(tgId);
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          cancelPendingReminders(tgId);
          
          if (ctx.session) {
            ctx.session.wheel = undefined;
            ctx.session.step = undefined;
          }
          
          await typing(ctx);
          await ctx.reply('🚪 Сесію скасовано. Повертаємося до меню.');
          await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
          return;
        }

        // Обробка відповідей відповідно до типу сесії
        if (sessionInfo.type === 'wheel') {
          const maybeScore = parseInt(text, 10);
          if (!isNaN(maybeScore) && maybeScore >= 0 && maybeScore <= 10) {
            await wheelBalanceService.processWheelAnswer(tgId, maybeScore, ctx);
            return;
          }
          
          // Перевірка чи чекаємо нотатку
          if (wheelBalanceService.isAwaitingNote(ctx)) {
            if (text.length < 10) {
              await typing(ctx);
              await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень).', wheelBalanceService.buildExitKeyboard());
              return;
            }
            await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
            return;
          }
          
          // Якщо введено щось інше під час колеса
          await blockMenuDuringSession(ctx, sessionInfo);
          return;
        }

        if (sessionInfo.type === 'questions') {
          // Обробка відповідей на питання
          const answered = await handleQuestionAnswer(ctx, user, text);
          if (answered) return;
          
          // Якщо не оброблено - блокуємо меню
          await blockMenuDuringSession(ctx, sessionInfo);
          return;
        }

        if (sessionInfo.type === 'ai') {
          await aiMentorController.handleAIMentorQuestion(ctx, text);
          return;
        }

        // Якщо нічого не спрацювало - блокуємо меню
        await blockMenuDuringSession(ctx, sessionInfo);
        return;
      }

      // ✅ ЧЕТВЕРТА ПРІОРИТЕТ: перевірка реєстрації
      const isRegistered = user['UserRegistered'] === true && user['Status'] === 'Registered User';
      if (!isRegistered) {
        logger.info(`[botController] ⚠️ Користувач ${tgId} не завершив реєстрацію`);
        await typing(ctx);
        return ctx.reply('Завершіть реєстрацію спочатку /start');
      }

      // ✅ П'ЯТА ПРІОРИТЕТ: перевірка підписки (з винятками)
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = ['💰 Підписка', '📞 Зв\'язок з нами', '❓ Допомога', '📝 Інструкції'];
      
      if (!subscriptionStatus.active && !allowedForInactive.includes(text)) {
        await typing(ctx);
        await ctx.reply(
          '❌ Твоя підписка закінчилася або неактивна.\n\n💰 Активуй підписку для доступу до всіх функцій.',
          keyboards.subscriptionKeyboard()
        );
        return;
      }

      // ✅ ШОСТА ПРІОРИТЕТ: обробка команд меню
      if (text === '🎯 Колесо балансу') {
        await wheelBalanceController.handleWheelBalance(ctx);
        return;
      }
      
      if (text === '🏠 Меню' || text === '📊 Меню') {
        await typing(ctx);
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        return;
      }

      // ✅ СТАНДАРТНІ КОМАНДИ МЕНЮ
      await handleMenuCommands(ctx, user, text, bot);

    } catch (error) {
      console.error('❌ [bot] Помилка в text хендлері:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка. Спробуй ще раз або скористайся меню 📊');
      await handleError(ctx, error);
    }
  });

  // ✅ ОБРОБКА CALLBACK ЗАПИТІВ
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    try {
      logger.info(`[botController] 📱 Callback: ${data} від ${tgId}`);

      // ✅ ПЕРША ПРІОРИТЕТ: онбординг callback-и
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) {
        logger.info(`[botController] ✅ Оброблено онбординг callback для ${tgId}`);
        return;
      }

      // ✅ ДРУГА ПРІОРИТЕТ: перевірка реєстрації
      const user = await userService.getUserByTelegramId(tgId);
      const isRegistered = user && user['UserRegistered'] === true && user['Status'] === 'Registered User';
      
      if (!isRegistered) {
        logger.info(`[botController] ⚠️ Користувач ${tgId} не завершив реєстрацію для callback ${data}`);
        await ctx.answerCbQuery('Завершіть реєстрацію спочатку');
        return;
      }

      // ✅ ТРЕТЯ ПРІОРИТЕТ: перевірка підписки
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        'subscription_info', 'contact_support', 'subscription_plans',
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'
      ];

      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // ✅ ЧЕТВЕРТА ПРІОРИТЕТ: системні callback-и (завжди працюють)
      if (data === 'continue_answers') {
        const sessionInfo = await getActiveSessionInfo(tgId);
        if (sessionInfo.active) {
          await ctx.answerCbQuery('Продовжуємо');
          
          if (sessionInfo.type === 'wheel') {
            await wheelBalanceController.handleWheelCallback(ctx);
          } else if (sessionInfo.type === 'questions') {
            // Показуємо поточне питання
            const step = sessionInfo.step;
            const user = await userService.getUserByTelegramId(tgId);
            await handleQuestionAnswer(ctx, user, null); // null = показати поточне питання
          } else if (sessionInfo.type === 'ai') {
            await aiMentorController.handleAIMentorCallback(ctx);
          }
        } else {
          await ctx.editMessageText('Немає активних сесій');
          await ctx.answerCbQuery('Немає активних сесій');
        }
        return;
      }

      if (data === 'skip_session') {
        await wheelBalanceService.cancelActiveWheel(tgId);
        aiMentorSession.end(tgId);
        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        cancelPendingReminders(tgId);

        if (ctx.session) {
          ctx.session.wheel = undefined;
          ctx.session.step = undefined;
        }

        await ctx.editMessageText('🚪 Сесію завершено. Повертаємося до меню.');
        await ctx.answerCbQuery('Сесію завершено');
        
        setTimeout(async () => {
          await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
        }, 800);
        return;
      }

      // ✅ РЕШТА CALLBACK-ІВ
      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      if (['ai_continue', 'ai_exit'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (
        data.startsWith('wheel_score_') ||
        data === 'wheel_exit' ||
        data === 'wheel_retry' ||
        data === 'wheel_start_new' ||
        data === 'wheel_to_menu' ||
        data === 'wheel_continue' ||
        data === 'wheel_restart' ||
        data === 'wheel_cancel' ||
        data === 'wheel_start' ||
        data === 'wheel_info' ||
        data === 'wheel_stats'
      ) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

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

      if (data === 'main_menu') {
        await wheelBalanceService.cancelActiveWheel(tgId);
        aiMentorSession.end(tgId);
        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        cancelPendingReminders(tgId);
        
        if (ctx.session) {
          ctx.session.wheel = undefined;
          ctx.session.step = undefined;
        }
        
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Повернення до меню');
        return;
      }

      if (data === 'dismiss_reminder') {
        await ctx.answerCbQuery('Нагадування відхилено');
        try {
          await ctx.deleteMessage();
        } catch {}
        return;
      }

      // ✅ НЕВІДОМІ CALLBACK-И
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