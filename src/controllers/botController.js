// src/controllers/botController.js - ВИПРАВЛЕНО

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

// ✅ ВИПРАВЛЕНО: функція отримання активної сесії
const getActiveSessionInfo = async (tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    console.log(`🔍 [bot] Перевірка сесії для ${tgId}, step: ${step}`);
    
    // Перевірка колеса балансу
    const wheelActive = await wheelBalanceService.isWheelActive(tgId);
    if (wheelActive) {
      return {
        type: 'wheel',
        active: true,
        message: '🎯 Колесо балансу в процесі! Завершіть спочатку.',
        step: 'wheel_balance'
      };
    }
    
    // Перевірка питань
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
    
    // Перевірка AI наставника
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
  logger.info('[botController] ✅ Ініціалізація bot controller...');

  // ✅ /start КОМАНДА
  bot.start(async (ctx) => {
    console.log(`🚀 [bot] /start від ${ctx.from.id}`);
    await handleStart(ctx);
  });

  // ✅ /menu КОМАНДА  
  bot.command('menu', async (ctx) => {
    try {
      const tgId = ctx.from.id;
      console.log(`🏠 [bot] /menu від ${tgId}`);
      
      // Очищуємо всі активні сесії
      await wheelBalanceService.cancelActiveWheel(tgId);
      aiMentorSession.end(tgId);
      cancelPendingReminders(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      if (ctx.session) {
        ctx.session.step = undefined;
        ctx.session.temp = {};
        ctx.session.wheel = undefined;
      }

      await typing(ctx);
      await ctx.reply('🔄 Скасовано всі активні сесії...', keyboards.removeKeyboard());
      
      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 800);
      
    } catch (error) {
      console.error('❌ [bot] Помилка /menu:', error);
      await handleError(ctx, error);
    }
  });

  // ✅ ОБРОБКА ТЕКСТОВИХ ПОВІДОМЛЕНЬ
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      console.log(`💬 [bot] ТЕКСТ від ${tgId}: "${text}"`);

      // 1. Онбординг має найвищий пріоритет
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        console.log(`✅ [bot] Оброблено крок онбордингу для ${tgId}`);
        return;
      }

      // 2. Перевіряємо чи користувач існує
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        console.log(`❌ [bot] Користувача ${tgId} не знайдено`);
        await typing(ctx);
        return ctx.reply('Натисніть /start для реєстрації', keyboards.mainMenuKeyboard());
      }

      console.log(`👤 [bot] Користувач ${tgId}: step=${user.Answer_Step}, status=${user.Status}`);

      // 3. Перевіряємо активні сесії
      const sessionInfo = await getActiveSessionInfo(tgId);
      
      if (sessionInfo.active) {
        console.log(`🔒 [bot] Активна сесія ${sessionInfo.type} для ${tgId}`);
        
        // Команди виходу
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
          setTimeout(async () => {
            await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
          }, 1000);
          return;
        }

        // Обробка активних сесій
        if (sessionInfo.type === 'wheel') {
          // Колесо балансу - перевіряємо числові оцінки
          const maybeScore = parseInt(text, 10);
          if (!isNaN(maybeScore) && maybeScore >= 0 && maybeScore <= 10) {
            await wheelBalanceService.processWheelAnswer(tgId, maybeScore, ctx);
            return;
          }
          
          // Перевіряємо чи очікуємо нотатку
          if (wheelBalanceService.isAwaitingNote(ctx)) {
            if (text.length < 10) {
              await typing(ctx);
              await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень).', wheelBalanceService.buildExitKeyboard());
              return;
            }
            await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
            return;
          }
          
          await blockMenuDuringSession(ctx, sessionInfo);
          return;
        }

        if (sessionInfo.type === 'questions') {
          const answered = await handleQuestionAnswer(ctx, user, text);
          if (answered) return;
          
          await blockMenuDuringSession(ctx, sessionInfo);
          return;
        }

        if (sessionInfo.type === 'ai') {
          await aiMentorController.handleAIMentorQuestion(ctx, text);
          return;
        }

        await blockMenuDuringSession(ctx, sessionInfo);
        return;
      }

      // 4. Перевіряємо реєстрацію
      const isRegistered = user['UserRegistered'] === true && user['Status'] === 'Registered User';
      if (!isRegistered) {
        console.log(`⚠️ [bot] Користувач ${tgId} не завершив реєстрацію`);
        await typing(ctx);
        return ctx.reply('Завершіть реєстрацію спочатку /start');
      }

      // 5. Перевіряємо підписку
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

      // 6. Обробка специфічних команд
      if (text === '🎯 Колесо балансу') {
        console.log(`✅ [bot] КОМАНДА КОЛЕСО для ${tgId}`);
        await wheelBalanceController.handleWheelBalance(ctx);
        return;
      }
      
      if (text === '🤖 AI наставник') {
        console.log(`✅ [bot] КОМАНДА AI для ${tgId}`);
        await aiMentorController.handleAIMentorRequest(ctx);
        return;
      }
      
      if (text === '🏠 Меню' || text === '📊 Меню') {
        await typing(ctx);
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        return;
      }

      // 7. Загальна обробка меню
      await handleMenuCommands(ctx, user, text, bot);

    } catch (error) {
      console.error('❌ [bot] Критична помилка в text хендлері:', error);
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
      console.log(`📱 [bot] Callback: ${data} від ${tgId}`);

      // 1. Онбординг callback-и (найвищий пріоритет)
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) {
        console.log(`✅ [bot] Оброблено онбординг callback для ${tgId}`);
        return;
      }

      // 2. Перевірка реєстрації
      const user = await userService.getUserByTelegramId(tgId);
      const isRegistered = user && user['UserRegistered'] === true && user['Status'] === 'Registered User';
      
      if (!isRegistered) {
        console.log(`⚠️ [bot] Користувач ${tgId} не завершив реєстрацію для callback ${data}`);
        await ctx.answerCbQuery('Завершіть реєстрацію спочатку');
        return;
      }

      // 3. Перевірка підписки
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        'subscription_info', 'contact_support', 'subscription_plans',
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'
      ];

      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // 4. Системні callback-и
      if (data === 'continue_answers') {
        const sessionInfo = await getActiveSessionInfo(tgId);
        if (sessionInfo.active) {
          await ctx.answerCbQuery('Продовжуємо');
          
          if (sessionInfo.type === 'wheel') {
            await wheelBalanceController.handleWheelCallback(ctx);
          } else if (sessionInfo.type === 'questions') {
            const user = await userService.getUserByTelegramId(tgId);
            await handleQuestionAnswer(ctx, user, null);
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
          await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        }, 800);
        return;
      }

      // 5. Специфічні callback-и
      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      if (['ai_continue', 'ai_exit'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data.startsWith('wheel_') || ['wheel_exit', 'wheel_retry'].includes(data)) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      if ([
        'subscription_info', 'subscription_plans', 'subscribe_week',
        'subscribe_month', 'subscribe_year', 'renew_subscription',
        'sync_subscription', 'contact_support'
      ].includes(data)) {
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

      console.log(`❓ [bot] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');

    } catch (error) {
      console.error(`❌ [bot] Помилка callback ${data}:`, error);
      await handleError(ctx, error);
      try { 
        await ctx.answerCbQuery('Помилка обробки'); 
      } catch {}
    }
  });

  console.log('✅ [botController] Bot controller ініціалізовано успішно');
  return { bot };
};

export default botController;