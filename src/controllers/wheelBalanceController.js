// src/controllers/wheelBalanceController.js
import userService from '../auth/services/userService.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

const handleWheelBalanceRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🎯 [WHEEL BALANCE REQUEST] Початок для користувача ${tgId}`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }
    
    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (!isActive) {
      return ctx.reply('🎯 Колесо балансу доступне тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    // ✅ ПЕРЕВІРЯЄМО ЧИ Є АКТИВНЕ КОЛЕСО
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    if (activeWheel) {
      const currentSphere = activeWheel.fields.Current_Sphere || 0;
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentSphere];
      
      await ctx.reply(
        `🎯 У тебе є незавершене колесо балансу!\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`
      );
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
      return;
    }
    
    // ✅ ЗАПУСКАЄМО НОВЕ КОЛЕСО
    console.log(`🎯 [WHEEL BALANCE] Створення нового колеса для ${tgId}`);
    
    const wheelData = await wheelBalanceService.startWheelBalance(tgId);
    if (!wheelData) {
      console.error(`❌ [WHEEL BALANCE] startWheelBalance повернув null для ${tgId}`);
      return ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
    }
    
    await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
    await ctx.reply(wheelData.message);
    
    console.log(`✅ [WHEEL BALANCE] Колесо запущено для ${tgId}`);
    
  } catch (error) {
    console.error('[WHEEL BALANCE REQUEST] Помилка:', error);
    await ctx.reply('❌ Помилка колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelBalanceAnswer = async (ctx, answer) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🎯 [WHEEL BALANCE ANSWER] Обробка відповіді від ${tgId}: "${answer}"`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      console.log(`❌ [WHEEL BALANCE] Немає доступу для ${tgId}`);
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      return ctx.reply('🎯 Колесо балансу доступне тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    // ✅ ОБРОБЛЯЄМО ВІДПОВІДЬ
    const result = await wheelBalanceService.processWheelAnswer(tgId, answer);
    
    if (result.error) {
      await ctx.reply(result.message);
      return;
    }
    
    await ctx.reply(result.message, result.completed ? keyboards.mainMenuKeyboard() : null);
    
    if (result.completed) {
      // ✅ КОЛЕСО ЗАВЕРШЕНО
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      console.log(`✅ [WHEEL BALANCE] Колесо завершено для ${tgId}`);
    }
    
  } catch (error) {
    console.error('[WHEEL BALANCE ANSWER] Помилка:', error);
    await ctx.reply('❌ Помилка при обробці відповіді. Спробуйте ще раз.');
  }
};

// ✅ АВТОМАТИЧНИЙ ЗАПУСК ПРИ РЕЄСТРАЦІЇ
const checkAndStartWheelForNewUser = async (ctx, user) => {
  try {
    const tgId = ctx.from.id;
    const needsWheel = await wheelBalanceService.needsWheelBalance(tgId);
    
    if (needsWheel) {
      console.log(`🎯 [WHEEL BALANCE] Автозапуск для нового користувача ${tgId}`);
      
      const wheelData = await wheelBalanceService.startWheelBalance(tgId);
      if (wheelData) {
        await userService.updateUserStep(tgId, ANSWER_STEPS.WHEEL_BALANCE_ACTIVE);
        
        await ctx.reply(
          `Почнемо з оцінки твого поточного балансу життя! ✨\n\n${wheelData.message}`
        );
        
        return true; // колесо запущено
      }
    }
    
    return false; // колесо не потрібне
  } catch (error) {
    console.error('[WHEEL BALANCE] Помилка автозапуску:', error);
    return false;
  }
};

// ✅ ЩОМІСЯЧНА ПЕРЕВІРКА ПОТРЕБИ В КОЛЕСІ
const checkMonthlyWheelNeed = async (bot) => {
  try {
    console.log('[WHEEL BALANCE] Щомісячна перевірка потреби в колесі');
    
    const users = await userService.getActiveUsers();
    
    for (const user of users) {
      const tgId = user['TG_id'];
      const needsWheel = await wheelBalanceService.needsWheelBalance(tgId);
      
      if (needsWheel) {
        const message = `📊 Час для оновлення твого колеса балансу!\n\nМинув місяць з останньої оцінки. Подивимося, як змінився твій життєвий баланс ✨\n\nНатисни "🎯 Колесо балансу" для початку.`;
        
        await bot.telegram.sendMessage(tgId, message, keyboards.mainMenuKeyboard());
        console.log(`🎯 [WHEEL BALANCE] Нагадування надіслано користувачу ${tgId}`);
        
        await new Promise(r => setTimeout(r, 500)); // затримка між повідомленнями
      }
    }
  } catch (error) {
    console.error('[WHEEL BALANCE] Помилка щомісячної перевірки:', error);
  }
};

export default {
  handleWheelBalanceRequest,
  handleWheelBalanceAnswer,
  checkAndStartWheelForNewUser,
  checkMonthlyWheelNeed
};