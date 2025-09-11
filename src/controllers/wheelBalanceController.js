// src/controllers/wheelBalanceController.js - З ДЕТАЛЬНИМИ ЛОГАМИ
import userService from '../auth/services/userService.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

const handleWheelBalanceRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🎯 [WHEEL CONTROLLER] ========== ПОЧАТОК ЗАПИТУ ==========`);
    console.log(`🎯 [WHEEL CONTROLLER] Користувач: ${tgId}`);
    console.log(`🎯 [WHEEL CONTROLLER] Ім'я: ${ctx.from.first_name || 'Невідоме'}`);
    console.log(`🎯 [WHEEL CONTROLLER] Username: ${ctx.from.username || 'Немає'}`);
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 1: Отримання користувача з БД`);
    const user = await userService.getUserByTelegramId(tgId);
    
    if (!user) {
      console.log(`❌ [WHEEL CONTROLLER] Користувача ${tgId} НЕ ЗНАЙДЕНО в БД`);
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }
    
    console.log(`✅ [WHEEL CONTROLLER] Користувач знайдений:`, {
      name: user['User Name'],
      subscription: user['Active_Subscription_Status'],
      answerStep: user['Answer_Step']
    });
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 2: Перевірка підписки`);
    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    console.log(`🎯 [WHEEL CONTROLLER] Підписка активна: ${isActive}`);
    console.log(`🎯 [WHEEL CONTROLLER] Статус підписки: "${user['Active_Subscription_Status']}"`);
    
    if (!isActive) {
      console.log(`❌ [WHEEL CONTROLLER] Доступ ЗАБОРОНЕНО - немає активної підписки`);
      return ctx.reply('🎯 Колесо балансу доступне тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 3: Пошук активного колеса`);
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    
    if (activeWheel) {
      console.log(`✅ [WHEEL CONTROLLER] Знайдено активне колесо:`, activeWheel.fields);
      const currentSphere = activeWheel.fields.Step || 0; // ✅ ПРАВИЛЬНЕ ПОЛЕ Step
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentSphere];
      
      console.log(`🎯 [WHEEL CONTROLLER] Поточна сфера: ${currentSphere} (${sphereName})`);
      
      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу!\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`
      );
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
      console.log(`✅ [WHEEL CONTROLLER] Відновлено активне колесо`);
      return;
    }
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 4: Створення нового колеса`);
    console.log(`🎯 [WHEEL CONTROLLER] Викликаємо wheelBalanceService.startWheelBalance(${tgId})`);
    
    const wheelData = await wheelBalanceService.startWheelBalance(tgId);
    
    console.log(`🎯 [WHEEL CONTROLLER] Результат створення колеса:`, wheelData);
    
    if (!wheelData) {
      console.error(`❌ [WHEEL CONTROLLER] КРИТИЧНА ПОМИЛКА: startWheelBalance повернув null для ${tgId}`);
      console.error(`❌ [WHEEL CONTROLLER] Це означає, що сервіс не зміг створити колесо в БД`);
      return ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
    }
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 5: Встановлення кроку користувача`);
    await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
    console.log(`✅ [WHEEL CONTROLLER] Крок користувача встановлено: ${ANSWER_STEPS.WHEEL_BALANCE_ACTIVE}`);
    
    console.log(`🎯 [WHEEL CONTROLLER] Крок 6: Відправка повідомлення`);
    console.log(`🎯 [WHEEL CONTROLLER] Повідомлення:`, wheelData.message.substring(0, 100) + '...');
    
    await ctx.reply(wheelData.message);
    
    console.log(`✅ [WHEEL CONTROLLER] ========== КОЛЕСО УСПІШНО ЗАПУЩЕНО ==========`);
    
  } catch (error) {
    console.error(`❌ [WHEEL CONTROLLER] ========== КРИТИЧНА ПОМИЛКА ==========`);
    console.error(`❌ [WHEEL CONTROLLER] Помилка тип:`, error.constructor.name);
    console.error(`❌ [WHEEL CONTROLLER] Помилка повідомлення:`, error.message);
    console.error(`❌ [WHEEL CONTROLLER] Стек:`, error.stack);
    console.error(`❌ [WHEEL CONTROLLER] =======================================`);
    
    await ctx.reply('❌ Помилка колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelBalanceAnswer = async (ctx, answer) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🎯 [WHEEL CONTROLLER] ========== ОБРОБКА ВІДПОВІДІ ==========`);
    console.log(`🎯 [WHEEL CONTROLLER] Користувач: ${tgId}`);
    console.log(`🎯 [WHEEL CONTROLLER] Відповідь: "${answer}"`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      console.log(`❌ [WHEEL CONTROLLER] Немає доступу для ${tgId}`);
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      return ctx.reply('🎯 Колесо балансу доступне тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    console.log(`🎯 [WHEEL CONTROLLER] Викликаємо wheelBalanceService.processWheelAnswer`);
    
    const result = await wheelBalanceService.processWheelAnswer(tgId, answer);
    
    console.log(`🎯 [WHEEL CONTROLLER] Результат обробки:`, result);
    
    if (result.error) {
      console.log(`❌ [WHEEL CONTROLLER] Помилка валідації: ${result.message}`);
      await ctx.reply(result.message);
      return;
    }
    
    await ctx.reply(result.message, result.completed ? keyboards.mainMenuKeyboard() : null);
    
    if (result.completed) {
      console.log(`✅ [WHEEL CONTROLLER] Колесо завершено для ${tgId}`);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    }
    
    console.log(`✅ [WHEEL CONTROLLER] ========== ВІДПОВІДЬ ОБРОБЛЕНА ==========`);
    
  } catch (error) {
    console.error(`❌ [WHEEL CONTROLLER] ========== ПОМИЛКА ОБРОБКИ ВІДПОВІДІ ==========`);
    console.error(`❌ [WHEEL CONTROLLER] Помилка тип:`, error.constructor.name);
    console.error(`❌ [WHEEL CONTROLLER] Помилка повідомлення:`, error.message);
    console.error(`❌ [WHEEL CONTROLLER] Стек:`, error.stack);
    console.error(`❌ [WHEEL CONTROLLER] =======================================`);
    
    await ctx.reply('❌ Помилка при обробці відповіді. Спробуйте ще раз.');
  }
};

// ✅ ЩОМІСЯЧНА ПЕРЕВІРКА ПОТРЕБИ В КОЛЕСІ
const checkMonthlyWheelNeed = async (bot) => {
  try {
    console.log(`🎯 [WHEEL CONTROLLER] ========== ЩОМІСЯЧНА ПЕРЕВІРКА ==========`);
    
    const users = await userService.getActiveUsers();
    console.log(`🎯 [WHEEL CONTROLLER] Знайдено активних користувачів: ${users.length}`);
    
    for (const user of users) {
      const tgId = user['TG_id'];
      console.log(`🎯 [WHEEL CONTROLLER] Перевіряємо користувача: ${tgId}`);
      
      const needsWheel = await wheelBalanceService.needsWheelBalance(tgId);
      
      if (needsWheel) {
        console.log(`✅ [WHEEL CONTROLLER] Користувач ${tgId} потребує колесо`);
        
        const message = `📊 Час для оновлення твого колеса балансу!\n\nМинув місяць з останньої оцінки. Подивимося, як змінився твій життєвий баланс ✨\n\nНатисни "🎯 Колесо балансу" для початку.`;
        
        await bot.telegram.sendMessage(tgId, message, keyboards.mainMenuKeyboard());
        console.log(`✅ [WHEEL CONTROLLER] Нагадування надіслано користувачу ${tgId}`);
        
        await new Promise(r => setTimeout(r, 500)); // затримка між повідомленнями
      } else {
        console.log(`⏭️ [WHEEL CONTROLLER] Користувач ${tgId} не потребує колесо`);
      }
    }
    
    console.log(`✅ [WHEEL CONTROLLER] ========== ЩОМІСЯЧНА ПЕРЕВІРКА ЗАВЕРШЕНА ==========`);
  } catch (error) {
    console.error(`❌ [WHEEL CONTROLLER] Помилка щомісячної перевірки:`, error);
  }
};

export default {
  handleWheelBalanceRequest,
  handleWheelBalanceAnswer,
  checkMonthlyWheelNeed
};