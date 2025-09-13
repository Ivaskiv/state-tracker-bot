// src/controllers/wheelBalanceController.js - ВИПРАВЛЕНО КРИТИЧНІ ПОМИЛКИ

import userService from '../auth/services/userService.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS, LIFE_SPHERES } from '../config/constants.js';
import { isActiveSubscription, restrictAccessMessage } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

const WHEEL_STEP = 'WheelBalance';

const handleWheelBalanceRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    logger.info(`🎯 [WHEEL CONTROLLER] ========== ПОЧАТОК ЗАПИТУ ==========`);
    logger.info(`🎯 [WHEEL CONTROLLER] Користувач: ${tgId}`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      logger.info(`❌ [WHEEL CONTROLLER] Користувача ${tgId} НЕ ЗНАЙДЕНО в БД`);
      await ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
      return;
    }

    logger.info(`✅ [WHEEL CONTROLLER] Користувач знайдений:`, {
      name: user['User Name'],
      subscription: user['Active_Subscription_Status'],
      answerStep: user['Answer_Step'],
    });

    const isActive = isActiveSubscription(user);
    logger.info(`🎯 [WHEEL CONTROLLER] Підписка активна: ${isActive}`);
    
    if (!isActive) {
      logger.info(`❌ [WHEEL CONTROLLER] Доступ ЗАБОРОНЕНО - немає активної підписки`);
      await restrictAccessMessage('🎯 Колесо балансу', ctx);
      return;
    }

    await userService.updateUserStep(tgId, WHEEL_STEP);
    logger.info(`✅ [WHEEL CONTROLLER] Встановлено крок: ${WHEEL_STEP}`);

    logger.info(`🎯 [WHEEL CONTROLLER] Пошук активного колеса`);
    let activeWheel = await wheelBalanceService.getActiveWheel(tgId);

    if (activeWheel) {
      logger.info(`✅ [WHEEL CONTROLLER] Знайдено активне колесо:`, {
        id: activeWheel.id,
        step: activeWheel.fields.Step,
        status: activeWheel.fields.Status
      });

      const currentStep = Number.isInteger(activeWheel.fields.Step) ? activeWheel.fields.Step : 0;
      const sphereName = LIFE_SPHERES[currentStep] || LIFE_SPHERES[0] || 'Невідома сфера';

      logger.info(`🎯 [WHEEL CONTROLLER] Поточна сфера: ${currentStep} (${sphereName})`);

      const continueMessage = `🎯 У тебе є незавершене колесо балансу!\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`;
      await ctx.reply(continueMessage);
      logger.info(`✅ [WHEEL CONTROLLER] Виведено промпт для продовження`);
      return;
    }

    logger.info(`🎯 [WHEEL CONTROLLER] Активне колесо не знайдено, створюємо нове`);
    
    try {
      const wheelData = await wheelBalanceService.startWheelBalance(tgId);
      
      if (!wheelData) {
        logger.error(`❌ [WHEEL CONTROLLER] startWheelBalance повернув null для ${tgId}`);
        await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
        return;
      }

      logger.info(`🎯 [WHEEL CONTROLLER] Відправка першого питання`);
      await ctx.reply(wheelData.message);
      
      logger.info(`✅ [WHEEL CONTROLLER] ========== КОЛЕСО УСПІШНО ЗАПУЩЕНО ==========`);
      
    } catch (wheelError) {
      logger.error(`❌ [WHEEL CONTROLLER] Помилка wheelBalanceService:`, wheelError);
      await ctx.reply('❌ Помилка створення колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
    }
    
  } catch (error) {
    logger.error(`❌ [WHEEL CONTROLLER] Критична помилка:`, error);
    await handleError(ctx, error, '❌ Помилка колеса балансу. Спробуйте пізніше.');
  }
};

// src/controllers/wheelBalanceController.js - ПРОДОВЖЕННЯ

const handleWheelBalanceAnswer = async (ctx, answer) => {
  try {
    const tgId = ctx.from.id;
    logger.info(`🎯 [WHEEL CONTROLLER] ========== ОБРОБКА ВІДПОВІДІ ==========`);
    logger.info(`🎯 [WHEEL CONTROLLER] Користувач: ${tgId}`);
    logger.info(`🎯 [WHEEL CONTROLLER] Відповідь: "${answer}"`);

    const user = await userService.getUserByTelegramId(tgId);
    const hasAccess = isActiveSubscription(user);
    
    if (!hasAccess) {
      logger.info(`❌ [WHEEL CONTROLLER] Немає доступу для ${tgId}`);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await restrictAccessMessage('🎯 Колесо балансу', ctx);
      return;
    }

    logger.info(`🎯 [WHEEL CONTROLLER] Викликаємо wheelBalanceService.processWheelAnswer`);
    
    try {
      const result = await wheelBalanceService.processWheelAnswer(tgId, answer);

      if (result?.error) {
        logger.info(`❌ [WHEEL CONTROLLER] Помилка від сервісу: ${result.message}`);
        
        if (result.message.includes('введи число від 1 до 10')) {
          const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
          if (activeWheel) {
            const currentStep = Number.isInteger(activeWheel.fields.Step) ? activeWheel.fields.Step : 0;
            const sphereName = LIFE_SPHERES[currentStep] || LIFE_SPHERES[0];
            
            const errorMessage = `❌ ${result.message}\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`;
            await ctx.reply(errorMessage);
          } else {
            await ctx.reply(result.message, keyboards.mainMenuKeyboard());
          }
        } else if (result.message.includes('Активне колесо не знайдено')) {
          logger.warn(`❌ [WHEEL CONTROLLER] Активне колесо втрачено, створюємо нове`);
          
          const wheelData = await wheelBalanceService.startWheelBalance(tgId);
          if (wheelData) {
            await ctx.reply(wheelData.message);
          } else {
            await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
          }
        } else {
          await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        }
        return;
      }

      logger.info(`✅ [WHEEL CONTROLLER] Успішний результат від сервісу`);
      logger.info(`🎯 [WHEEL CONTROLLER] Завершено: ${result?.completed ? 'ТАК' : 'НІ'}`);

      const keyboardToUse = result?.completed ? keyboards.wheelBalanceCompleteKeyboard() : undefined;
      await ctx.reply(result.message, keyboardToUse);

      if (result?.completed) {
        logger.info(`✅ [WHEEL CONTROLLER] Колесо завершено для ${tgId}`);
        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        logger.info(`✅ [WHEEL CONTROLLER] Встановлено крок: ${ANSWER_STEPS.COMPLETED}`);
      }

      logger.info(`✅ [WHEEL CONTROLLER] ========== ВІДПОВІДЬ УСПІШНО ОБРОБЛЕНА ==========`);

    } catch (serviceError) {
      logger.error(`❌ [WHEEL CONTROLLER] Помилка wheelBalanceService.processWheelAnswer:`, serviceError);
      await ctx.reply('❌ Помилка при обробці відповіді. Спробуйте ще раз.');
    }

  } catch (error) {
    logger.error(`❌ [WHEEL CONTROLLER] Критична помилка при обробці відповіді:`, error);
    await handleError(ctx, error, '❌ Помилка при обробці відповіді. Спробуйте ще раз.');
  }
};

const checkMonthlyWheelNeed = async (bot) => {
  try {
    logger.info(`🎯 [WHEEL CONTROLLER] ========== ЩОМІСЯЧНА ПЕРЕВІРКА ==========`);

    const users = await userService.getActiveUsers();
    logger.info(`🎯 [WHEEL CONTROLLER] Знайдено активних користувачів: ${users.length}`);

    for (const user of users) {
      const tgId = user['TG_id'];
      logger.info(`🎯 [WHEEL CONTROLLER] Перевіряємо користувача: ${tgId}`);

      const needsWheel = await wheelBalanceService.needsWheelBalance(tgId);

      if (needsWheel) {
        logger.info(`✅ [WHEEL CONTROLLER] Користувач ${tgId} потребує колесо`);

        const message =
          `📊 Час для оновлення твого колеса балансу!\n\n` +
          `Минув місяць з останньої оцінки. Подивимося, як змінився твій життєвий баланс ✨\n\n` +
          `Натисни "🎯 Колесо балансу" для початку.`;

        try {
          await bot.telegram.sendMessage(tgId, message, keyboards.mainMenuKeyboard());
          logger.info(`✅ [WHEEL CONTROLLER] Нагадування надіслано користувачу ${tgId}`);
        } catch (sendError) {
          logger.error(`❌ [WHEEL CONTROLLER] Помилка відправки нагадування для ${tgId}:`, sendError);
        }

        await new Promise((r) => setTimeout(r, 500));
      } else {
        logger.info(`⏭️ [WHEEL CONTROLLER] Користувач ${tgId} не потребує колесо`);
      }
    }

    logger.info(`✅ [WHEEL CONTROLLER] ========== ЩОМІСЯЧНА ПЕРЕВІРКА ЗАВЕРШЕНА ==========`);
  } catch (error) {
    logger.error(`❌ [WHEEL CONTROLLER] Помилка щомісячної перевірки:`, error);
  }
};

// Обробка callback для повторного проходження
const handleWheelRetryCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  try {
    if (data === 'wheel_retry') {
      await userService.updateUserStep(tgId, WHEEL_STEP);
      const wheelData = await wheelBalanceService.startWheelBalance(tgId);
      
      if (wheelData) {
        await ctx.reply(wheelData.message);
        await ctx.answerCbQuery('Запускаємо нове колесо!');
      } else {
        await ctx.reply('❌ Помилка запуску. Спробуй пізніше.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Помилка');
      }
      
    } else if (data === 'wheel_exit') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply('Повертаємося до головного меню', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Вихід');
    }
  } catch (error) {
    logger.error('[WHEEL CONTROLLER] Помилка callback:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

// НОВИЙ CALLBACK ДЛЯ МЕНЮ КОЛЕСА
const handleWheelMenuCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  try {
    if (data === 'wheel_start_new') {
      await userService.updateUserStep(tgId, WHEEL_STEP);
      const wheelData = await wheelBalanceService.startWheelBalance(tgId);
      
      if (wheelData) {
        await ctx.reply(wheelData.message);
        await ctx.answerCbQuery('Запускаємо нове колесо!');
      } else {
        await ctx.reply('❌ Помилка запуску. Спробуй пізніше.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Помилка');
      }
    } else if (data === 'wheel_to_menu') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply('Повертаємося до головного меню', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Повертаємося до меню');
    }
  } catch (error) {
    logger.error('[WHEEL CONTROLLER] Помилка menu callback:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

export default {
  handleWheelBalanceRequest,
  handleWheelBalanceAnswer,
  checkMonthlyWheelNeed,
  handleWheelRetryCallback,
  handleWheelMenuCallback // ДОДАНО НОВИЙ МЕТОД
};