// src/controllers/wheelBalanceController.js
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
    logger.info(`🎯 [WHEEL CONTROLLER] Ім'я: ${ctx.from.first_name || 'Невідоме'}`);
    logger.info(`🎯 [WHEEL CONTROLLER] Username: ${ctx.from.username || 'Немає'}`);

    logger.info(`🎯 [WHEEL CONTROLLER] Крок 1: Отримання користувача з БД`);
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

    logger.info(`🎯 [WHEEL CONTROLLER] Крок 2: Перевірка підписки`);
    const isActive = isActiveSubscription(user);
    logger.info(`🎯 [WHEEL CONTROLLER] Підписка активна: ${isActive}`);
    logger.info(`🎯 [WHEEL CONTROLLER] Статус підписки: "${user['Active_Subscription_Status']}"`);
    if (!isActive) {
      logger.info(`❌ [WHEEL CONTROLLER] Доступ ЗАБОРОНЕНО - немає активної підписки`);
      await restrictAccessMessage('🎯 Колесо балансу', ctx);
      return;
    }

    logger.info(`🎯 [WHEEL CONTROLLER] Крок 3: Пошук активного колеса`);
    let activeWheel = await wheelBalanceService.getActiveWheel(tgId);

    if (activeWheel) {
      logger.info(`✅ [WHEEL CONTROLLER] Знайдено активне колесо:`, activeWheel.fields);

      const currentSphereRaw = activeWheel.fields.Step;
      const currentSphere = Number.isInteger(currentSphereRaw) ? currentSphereRaw : 0;
      const sphereName = LIFE_SPHERES[currentSphere] || LIFE_SPHERES[0] || 'Сфера';

      logger.info(`🎯 [WHEEL CONTROLLER] Поточна сфера: ${currentSphere} (${sphereName})`);

      await userService.updateUserStep(tgId, WHEEL_STEP);
      logger.info(`✅ [WHEEL CONTROLLER] Встановлено крок: ${WHEEL_STEP}`);

      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу!\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`
      );
      logger.info(`✅ [WHEEL CONTROLLER] Виведено промпт для продовження`);
      return;
    }

    logger.info(`🎯 [WHEEL CONTROLLER] Крок 4: Активне колесо не знайдено, створюємо нове`);
    logger.info(`🎯 [WHEEL CONTROLLER] Викликаємо wheelBalanceService.startWheelBalance(${tgId})`);
    const wheelData = await wheelBalanceService.startWheelBalance(tgId);

    if (!wheelData) {
      logger.error(`❌ [WHEEL CONTROLLER] КРИТИЧНА ПОМИЛКА: startWheelBalance повернув null для ${tgId}`);
      await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
      return;
    }

    await userService.updateUserStep(tgId, WHEEL_STEP);
    logger.info(`✅ [WHEEL CONTROLLER] Встановлено крок: ${WHEEL_STEP}`);

    logger.info(`🎯 [WHEEL CONTROLLER] Крок 5: Відправка першого питання`);
    logger.info(`🎯 [WHEEL CONTROLLER] Повідомлення:`, (wheelData.message || '').substring(0, 120) + '...');
    await ctx.reply(wheelData.message);

    logger.info(`✅ [WHEEL CONTROLLER] ========== КОЛЕСО УСПІШНО ЗАПУЩЕНО ==========`);
  } catch (error) {
    logger.error(`❌ [WHEEL CONTROLLER] Помилка при обробці запиту:`, error);
    await handleError(ctx, error, '❌ Помилка колеса балансу. Спробуйте пізніше.');
  }
};

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
    const result = await wheelBalanceService.processWheelAnswer(tgId, answer);

    if (result?.error) {
      logger.info(`❌ [WHEEL CONTROLLER] Помилка: ${result.message}`);
      if (result.message.includes('введи число від 1 до 10')) {
        const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
        if (activeWheel) {
          const currentSphere = Number.isInteger(activeWheel.fields.Step) ? activeWheel.fields.Step : 0;
          const sphereName = LIFE_SPHERES[currentSphere] || LIFE_SPHERES[0];
          await ctx.reply(
            `❌ ${result.message}\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`
          );
        } else {
          logger.warn(`❌ [WHEEL CONTROLLER] Активне колесо не знайдено після помилки введення`);
          const wheelData = await wheelBalanceService.startWheelBalance(tgId);
          if (wheelData) {
            await userService.updateUserStep(tgId, WHEEL_STEP);
            await ctx.reply(wheelData.message);
          } else {
            await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
          }
        }
      } else if (result.message.includes('Активне колесо не знайдено')) {
        logger.warn(`❌ [WHEEL CONTROLLER] Активне колесо не знайдено, створюємо нове`);
        const wheelData = await wheelBalanceService.startWheelBalance(tgId);
        if (wheelData) {
          await userService.updateUserStep(tgId, WHEEL_STEP);
          await ctx.reply(wheelData.message);
        } else {
          await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
        }
      } else {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
      }
      return;
    }

    await ctx.reply(result.message, result?.completed ? keyboards.mainMenuKeyboard() : undefined);

    if (result?.completed) {
      logger.info(`✅ [WHEEL CONTROLLER] Колесо завершено для ${tgId}`);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      logger.info(`✅ [WHEEL CONTROLLER] Встановлено крок: ${ANSWER_STEPS.COMPLETED}`);
    }

    logger.info(`✅ [WHEEL CONTROLLER] ========== ВІДПОВІДЬ ОБРОБЛЕНА ==========`);
  } catch (error) {
    logger.error(`❌ [WHEEL CONTROLLER] Помилка при обробці відповіді:`, error);
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

        await bot.telegram.sendMessage(tgId, message, keyboards.mainMenuKeyboard());
        logger.info(`✅ [WHEEL CONTROLLER] Нагадування надіслано користувачу ${tgId}`);

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

export default {
  handleWheelBalanceRequest,
  handleWheelBalanceAnswer,
  checkMonthlyWheelNeed,
};