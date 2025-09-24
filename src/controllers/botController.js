// src/controllers/botController.js - ВИПРАВЛЕНО: правильна логіка обробки

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';
import { ANSWER_STEPS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';
import subscriptionController from './subscriptionController.js';
import typing from '../utils/typing.js';
import logger from '../utils/logger.js';

/**
 * Основний контролер бота - налаштовує всі handlers
 */
const botController = (bot) => {
  console.log('[botController] ✅ Початок ініціалізації bot controller...');

  // ===== КОМАНДИ =====
  
  bot.start(async (ctx) => {
    console.log(`🚀 [bot] /start від користувача ${ctx.from.id}`);
    await handleStart(ctx);
  });

  bot.command('menu', async (ctx) => {
    const tgId = ctx.from.id;
    console.log(`🏠 [bot] /menu від ${tgId}`);
    
    try {
      // Очищуємо всі активні стани
      await clearAllActiveSessions(tgId, ctx);
      
      await typing(ctx);
      await ctx.reply('🔄 Всі активні сесії скасовано...', keyboards.removeKeyboard());
      
      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 800);
      
    } catch (error) {
      console.error('❌ [bot] Помилка /menu:', error);
      await ctx.reply('Помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  // ===== ОБРОБКА ТЕКСТОВИХ ПОВІДОМЛЕНЬ =====
  
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    
    if (!text) return;

    try {
      console.log(`💬 [bot] Текст від ${tgId}: "${text}"`);

      // 1. НАЙВИЩИЙ ПРІОРИТЕТ: Онбординг (ПЕРЕД перевіркою користувача!)
      const isOnboardingStep = await handleRegistrationStep(ctx);
      if (isOnboardingStep) {
        console.log(`✅ [bot] Оброблено онбординг крок для ${tgId}`);
        return;
      }

      // 2. Перевіряємо чи користувач існує і зареєстрований (ПІСЛЯ онбордингу)
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        console.log(`❌ [bot] Користувач ${tgId} не знайдено - направляємо на /start`);
        await typing(ctx);
        return ctx.reply('Натисніть /start для реєстрації', keyboards.mainMenuKeyboard());
      }

      const isRegistered = user['UserRegistered'] === true && user['Status'] === 'Registered User';
      if (!isRegistered) {
        console.log(`⚠️ [bot] Користувач ${tgId} не завершив реєстрацію - направляємо на /start`);
        await typing(ctx);
        return ctx.reply('Завершіть реєстрацію /start', keyboards.mainMenuKeyboard());
      }

      console.log(`👤 [bot] Користувач ${tgId}: step=${user.Answer_Step}, status=${user.Status}`);

      // 3. Перевіряємо активні сесії
      const sessionInfo = await getActiveSessionInfo(tgId, user, ctx);
      
      if (sessionInfo.active) {
        console.log(`🔒 [bot] Активна сесія ${sessionInfo.type} для ${tgId}`);
        
        // Команди виходу з сесії
        if (isExitCommand(text)) {
          await clearAllActiveSessions(tgId, ctx);
          await typing(ctx);
          await ctx.reply('🚪 Сесію скасовано. Повертаємося до меню.');
          
          setTimeout(async () => {
            await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
          }, 1000);
          return;
        }

        // Обробка активних сесій
        const handled = await handleActiveSession(ctx, user, text, sessionInfo);
        if (handled) return;

        // Якщо не вдалося обробити - показуємо блокування
        await blockMenuDuringSession(ctx, sessionInfo);
        return;
      }

      // 4. Перевіряємо підписку (крім дозволених команд)
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        '💰 Підписка', '📞 Зв\'язок з нами', '❓ Допомога', '📝 Інструкції',
        '🏠 Меню', '📊 Меню'
      ];
      
      if (!subscriptionStatus.active && !allowedForInactive.includes(text)) {
        await typing(ctx);
        await ctx.reply(
          '❌ Твоя підписка закінчилася або неактивна.\n\n💰 Активуй підписку для доступу до всіх функцій.',
          keyboards.subscriptionKeyboard()
        );
        return;
      }

      // 5. Обробка специфічних команд меню
      if (text === '🎯 Колесо балансу') {
        console.log(`✅ [bot] Команда КОЛЕСО для ${tgId}`);
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        return;
      }
      
      if (text === '🤖 AI наставник') {
        console.log(`✅ [bot] Команда AI для ${tgId}`);
        await aiMentorController.handleAIMentorRequest(ctx);
        return;
      }
      
      if (text === '🏠 Меню' || text === '📊 Меню') {
        await typing(ctx);
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        return;
      }

      // 6. Загальна обробка меню
      await handleMenuCommands(ctx, user, text, bot);

    } catch (error) {
      console.error('❌ [bot] Критична помилка в text handler:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка. Спробуй ще раз або скористайся меню.');
    }
  });

  // ===== ОБРОБКА CALLBACK QUERIES =====
  
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    try {
      console.log(`📱 [bot] Callback: ${data} від ${tgId}`);

      // 1. Онбординг callback (найвищий пріоритет)
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) {
        console.log(`✅ [bot] Оброблено онбординг callback для ${tgId}`);
        return;
      }

      // 2. Системні callback
      if (data === 'continue_answers') {
        await handleContinueAnswers(ctx);
        return;
      }

      if (data === 'skip_session') {
        await handleSkipSession(ctx);
        return;
      }

      if (data === 'main_menu') {
        await handleMainMenu(ctx);
        return;
      }

      if (data === 'dismiss_reminder') {
        await ctx.answerCbQuery('Нагадування відхилено');
        try {
          await ctx.deleteMessage();
        } catch {}
        return;
      }

      // 3. Перевірка реєстрації для інших callback
      const user = await userService.getUserByTelegramId(tgId);
      const isRegistered = user && user['UserRegistered'] === true && user['Status'] === 'Registered User';
      
      if (!isRegistered) {
        console.log(`⚠️ [bot] Користувач ${tgId} не завершив реєстрацію для callback ${data}`);
        await ctx.answerCbQuery('Завершіть реєстрацію спочатку');
        return;
      }

      // 4. Перевірка підписки
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      const allowedForInactive = [
        'subscription_info', 'contact_support', 'subscription_plans',
        'subscribe_week', 'subscribe_month', 'subscribe_year', 'sync_subscription'
      ];

      if (!subscriptionStatus.active && !allowedForInactive.includes(data)) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // 5. Специфічні callback за типами
      if (['restart_morning', 'restart_evening', 'cancel_restart'].includes(data)) {
        await handleRestartCallback(ctx);
        return;
      }

      if (['ai_continue', 'ai_exit', 'ai_start_question'].includes(data)) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data.startsWith('wheel_') || ['wheel_exit', 'wheel_retry', 'wheel_start', 'wheel_continue', 'wheel_restart', 'wheel_info', 'wheel_stats'].includes(data)) {
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

      // 6. Невідомий callback
      console.log(`❓ [bot] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');

    } catch (error) {
      console.error(`❌ [bot] Помилка callback ${data}:`, error);
      try { 
        await ctx.answerCbQuery('Помилка обробки'); 
      } catch {}
    }
  });

  console.log('✅ [botController] Bot controller ініціалізовано успішно');
  return { bot };
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

/**
 * Отримання інформації про активні сесії
 */
const getActiveSessionInfo = async (tgId, user, ctx) => {
  try {
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

/**
 * Обробка активних сесій
 */
const handleActiveSession = async (ctx, user, text, sessionInfo) => {
  try {
    if (sessionInfo.type === 'wheel') {
      // Колесо балансу - перевіряємо числові оцінки
      const maybeScore = parseInt(text, 10);
      if (!isNaN(maybeScore) && maybeScore >= 0 && maybeScore <= 10) {
        await wheelBalanceService.processWheelAnswer(ctx.from.id, maybeScore, ctx);
        return true;
      }
      
      // Перевіряємо чи очікуємо нотатку
      if (wheelBalanceService.isAwaitingNote(ctx)) {
        if (text.length < 10) {
          await typing(ctx);
          await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень).', 
            wheelBalanceService.buildExitKeyboard());
          return true;
        }
        await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
        return true;
      }
      
      return false; // Не змогли обробити
    }

    if (sessionInfo.type === 'questions') {
      return await handleQuestionAnswer(ctx, user, text);
    }

    if (sessionInfo.type === 'ai') {
      await aiMentorController.handleAIMentorQuestion(ctx, text);
      return true;
    }

    return false;
    
  } catch (error) {
    console.error('❌ [bot] Помилка обробки активної сесії:', error);
    return false;
  }
};

/**
 * Блокування меню під час активних сесій
 */
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

/**
 * Очищення всіх активних сесій
 */
const clearAllActiveSessions = async (tgId, ctx) => {
  try {
    // Очищуємо колесо балансу
    await wheelBalanceService.cancelActiveWheel(tgId);
    
    // Очищуємо AI наставника
    aiMentorSession.end(tgId);
    
    // Очищуємо стан користувача
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    // Очищуємо сесію
    if (ctx.session) {
      ctx.session.step = undefined;
      ctx.session.temp = {};
      ctx.session.wheel = undefined;
      ctx.session.ai = undefined;
    }
    
    console.log(`🧹 [bot] Всі сесії очищено для ${tgId}`);
  } catch (error) {
    console.error(`❌ [bot] Помилка очищення сесій для ${tgId}:`, error);
  }
};

/**
 * Перевірка чи це команда виходу
 */
const isExitCommand = (text) => {
  const exitCommands = [
    'вихід', 'exit', 'стоп', 'stop', 'відмінити', 'cancel',
    '🚪 Вийти із сесії', '/menu', 'меню', 'menu'
  ];
  return exitCommands.some(cmd => text.toLowerCase().includes(cmd.toLowerCase()));
};

/**
 * Обробка callback "continue_answers"
 */
const handleContinueAnswers = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const sessionInfo = await getActiveSessionInfo(tgId, user, ctx);
    
    if (sessionInfo.active) {
      await ctx.answerCbQuery('Продовжуємо');
      
      if (sessionInfo.type === 'wheel') {
        await wheelBalanceController.handleWheelCallback(ctx);
      } else if (sessionInfo.type === 'questions') {
        await handleQuestionAnswer(ctx, user, null);
      } else if (sessionInfo.type === 'ai') {
        await aiMentorController.handleAIMentorCallback(ctx);
      }
    } else {
      await ctx.editMessageText('Немає активних сесій');
      await ctx.answerCbQuery('Немає активних сесій');
    }
  } catch (error) {
    console.error('❌ [bot] Помилка continue_answers:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

/**
 * Обробка callback "skip_session"
 */
const handleSkipSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    await clearAllActiveSessions(tgId, ctx);
    
    await ctx.editMessageText('🚪 Сесію завершено. Повертаємося до меню.');
    await ctx.answerCbQuery('Сесію завершено');
    
    setTimeout(async () => {
      await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
    }, 800);
  } catch (error) {
    console.error('❌ [bot] Помилка skip_session:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

/**
 * Обробка callback "main_menu"
 */
const handleMainMenu = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    await clearAllActiveSessions(tgId, ctx);
    
    await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Повернення до меню');
  } catch (error) {
    console.error('❌ [bot] Помилка main_menu:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

export default botController;