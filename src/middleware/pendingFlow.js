// src/middleware/pendingFlow.js
import userService from '../auth/services/userService.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS, MENU_MATCHERS, SCHEDULE } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import typing from '../utils/typing.js';
import wheelBalanceService from '../services/wheelBalanceService.js';

// Глобальні таймери для персональних нагадувань
const userReminders = new Map();

// Планування нагадувань з перевіркою активності
export const schedulePendingReminders = (bot, tgId, sessionType) => {
  clearUserReminders(tgId);
  
  const reminders = {
    timer1: setTimeout(() => sendReminder(bot, tgId, sessionType, 1), 10 * 60 * 1000), // 10 хв
    timer2: setTimeout(() => sendReminder(bot, tgId, sessionType, 2), 60 * 60 * 1000)  // 60 хв
  };
  
  userReminders.set(tgId, reminders);
  console.log(`[pendingFlow] Заплановано нагадування для ${tgId}, сесія: ${sessionType}`);
};

// Очищення таймерів
export const clearUserReminders = (tgId) => {
  const reminders = userReminders.get(tgId);
  if (reminders) {
    clearTimeout(reminders.timer1);
    clearTimeout(reminders.timer2);
    userReminders.delete(tgId);
    console.log(`[pendingFlow] Очищено нагадування для ${tgId}`);
  }
};

// Централізована функція надсилання нагадувань
const sendReminder = async (bot, tgId, sessionType, reminderNumber) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || user.Answer_Step === ANSWER_STEPS.COMPLETED) {
      console.log(`[pendingFlow] Нагадування ${reminderNumber} скасовано - користувач ${tgId} завершив`);
      return;
    }
    
    // Перевірка активності користувача
    const lastActivity = user.Last_Activity ? new Date(user.Last_Activity) : null;
    const now = new Date();
    const timeSinceActivity = lastActivity ? (now - lastActivity) / 1000 / 60 : 999;
    const activityThreshold = reminderNumber === 1 ? 2 : 5; // 2 хв для першого, 5 хв для другого
    
    if (timeSinceActivity < activityThreshold) {
      console.log(`[pendingFlow] Нагадування ${reminderNumber} пропущено - користувач ${tgId} активний`);
      return;
    }
    
    await typing({ telegram: bot.telegram, from: { id: tgId } });
    
    const messages = {
      1: {
        Morning: '🔔 Не забудь відповісти на ранкові питання!\n\n🔄 Натисни "🔄 Продовжити відповіді"',
        Evening: '🔔 Час для вечірньої рефлексії!\n\n🔄 Натисни "🔄 Продовжити відповіді"'
      },
      2: {
        Morning: '🔔 Останнє нагадування про ранкові питання!',
        Evening: '🔔 Останнє нагадування про вечірні питання!'
      }
    };
    
    const message = messages[reminderNumber][sessionType];
    await bot.telegram.sendMessage(tgId, message, keyboards.continueAnswersKeyboard());
    console.log(`[pendingFlow] Надіслано нагадування ${reminderNumber} для ${tgId}`);
    
  } catch (error) {
    console.error(`[pendingFlow] Помилка нагадування ${reminderNumber} для ${tgId}:`, error);
  }
};

// Утиліти для визначення стану користувача
const getCurrentQuestion = (step) => {
  if (step.startsWith('Q_m_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`;
  }
  
  if (step.startsWith('Q_e_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`;
  }
  
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE) {
    return '🎯 Колесо балансу в процесі...';
  }
  
  return null;
};

const isPendingResponse = (user) => {
  if (!user || !user.Answer_Step) return false;
  
  const step = user.Answer_Step;
  const pendingSteps = [
    ANSWER_STEPS.MORNING_PENDING,
    ANSWER_STEPS.EVENING_PENDING,
    ANSWER_STEPS.WHEEL_BALANCE_ACTIVE
  ];
  
  return step.startsWith('Q_m_') || step.startsWith('Q_e_') || pendingSteps.includes(step);
};

const updateUserActivity = async (tgId) => {
  try {
    await userService.updateUserActivity(tgId);
  } catch (error) {
    console.error(`[pendingFlow] Помилка оновлення активності для ${tgId}:`, error);
  }
};

const getSessionType = (step) => {
  if (step.startsWith('Q_m_') || step === ANSWER_STEPS.MORNING_PENDING) return 'ранкові';
  if (step.startsWith('Q_e_') || step === ANSWER_STEPS.EVENING_PENDING) return 'вечірні';
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE) return 'колесо балансу';
  return 'поточні';
};

const isMenuCommand = (text) => {
  const menuCommands = [
    '💎 Афірмація',
    '📈 Щотижневий звіт',
    '📈 Щомісячний звіт',
    '💰 Підписка',
    '📊 Мій прогрес',
    '❓ Допомога',
    '📞 Зв\'язок з нами',
    '📝 Інструкції',
    'ℹ️ Профіль'
  ];
  return menuCommands.includes(text);
};

// Головний middleware
export const installPendingFlow = (bot) => {
  bot.use(async (ctx, next) => {
    const tgId = ctx.from?.id;
    const text = ctx.message?.text?.trim();
    
    if (!tgId || !text || text.startsWith('/')) {
      return next();
    }

    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return next();

      await updateUserActivity(tgId);

      const pending = isPendingResponse(user);
      
      // Дозвол команд продовження/пропуску
      if (MENU_MATCHERS.CONTINUE_ANSWERS(text) || 
          MENU_MATCHERS.SKIP_SESSION(text) ||
          text.startsWith('🔄') || text.startsWith('⏭️')) {
        return next();
      }

      if (!pending) {
        return next();
      }

      const step = user.Answer_Step;
      const sessionType = getSessionType(step);

      // Обробка спеціальних команд при незавершених відповідях
      if ((text === '🤖 AI наставник' || text === '🎯 Колесо балансу') && pending) {
        await typing(ctx);
        await ctx.reply(
          `🔒 Спочатку заверши ${sessionType} або пропусти сесію.\n\nПотім зможеш користуватися цією функцією.`,
          keyboards.continueAnswersKeyboard()
        );
        return;
      }

      // Обробка колеса балансу
      if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE) {
        if (isMenuCommand(text)) {
          await typing(ctx);
          await ctx.reply(
            `🔒 Спочатку заверши колесо балансу або пропусти сесію.\n\n📝 У тебе незавершене колесо балансу.`,
            keyboards.continueAnswersKeyboard()
          );
          return;
        }
        return next(); // Дозволяємо відповіді на колесо
      }

      // Обробка часового вікна для ранкових питань
      if ((step.startsWith('Q_m_') || step === ANSWER_STEPS.MORNING_PENDING) && isMenuCommand(text)) {
        const currentTime = getUserDateTime(tgId);
        const currentHour = new Date(currentTime).getHours();
        const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
        
        if (currentHour >= eveningHour) {
          await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
          await typing(ctx);
          await ctx.reply(
            '🌙 Ранкові питання недоступні після 20:00.\n\nМожеш почати вечірні питання або пропустити сесію.',
            keyboards.continueAnswersKeyboard()
          );
          return;
        }
      }

      // Блокування меню при незавершених відповідях
      if (pending && isMenuCommand(text)) {
        const currentQuestion = getCurrentQuestion(step);
        let message = `🔒 Спочатку заверши ${sessionType} або пропусти сесію.\n\n`;
        
        if (currentQuestion && !currentQuestion.includes('🎯 Колесо балансу')) {
          message += `📝 Поточне питання:\n${currentQuestion}`;
        } else {
          message += `📝 У тебе незавершена сесія відповідей.`;
        }
        
        await typing(ctx);
        await ctx.reply(message, keyboards.continueAnswersKeyboard());
        return;
      }

      return next();
    } catch (error) {
      console.error('[pendingFlow] Помилка middleware:', error);
      return next();
    }
  });

  // Обробка callback кнопок
  bot.on('callback_query', async (ctx) => {
    const tgId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    
    try {
      if (data === 'continue_answers') {
        await updateUserActivity(tgId);
        
        const user = await userService.getUserByTelegramId(tgId);
        if (!user) {
          await ctx.answerCbQuery('Користувача не знайдено');
          return;
        }
        
        await handleContinueAnswers(ctx, user);
      } else if (data === 'skip_session') {
        await handleSkipSession(ctx, tgId);
      }
    } catch (error) {
      console.error('[pendingFlow] Помилка callback:', error);
      await ctx.answerCbQuery('Помилка');
    }
  });
};

// Обробка продовження відповідей
const handleContinueAnswers = async (ctx, user) => {
  const step = user.Answer_Step;
  
  // Колесо балансу
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE) {
    const activeWheel = await wheelBalanceService.getActiveWheel(user.TG_id);
    if (activeWheel) {
      const currentSphere = activeWheel.fields.Current_Sphere || 0;
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentSphere];
      
      await typing(ctx);
      await ctx.reply(`🎯 КОЛЕСО БАЛАНСУ\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`);
      await ctx.answerCbQuery('Продовжуємо колесо балансу');
    } else {
      await typing(ctx);
      await ctx.reply('Колесо балансу завершено!', keyboards.mainMenuKeyboard());
      await userService.updateUserStep(user.TG_id, ANSWER_STEPS.COMPLETED);
      await ctx.answerCbQuery('Готово');
    }
    return;
  }
  
  // Ранкові/вечірні питання
  const currentQuestion = getCurrentQuestion(step);
  if (currentQuestion && !currentQuestion.includes('🎯 Колесо балансу')) {
    await typing(ctx);
    await ctx.reply(currentQuestion);
    await ctx.answerCbQuery('Продовжуємо відповіді');
  } else {
    await typing(ctx);
    await ctx.reply('Питання завершені!', keyboards.mainMenuKeyboard());
    await userService.updateUserStep(user.TG_id, ANSWER_STEPS.COMPLETED);
    await ctx.answerCbQuery('Готово');
  }
};

// Обробка пропуску сесії
const handleSkipSession = async (ctx, tgId) => {
  await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  clearUserReminders(tgId);
  
  await typing(ctx);
  await ctx.reply('Сесію пропущено. Повертаємося до меню.', keyboards.mainMenuKeyboard());
  await ctx.answerCbQuery('Сесію пропущено');
};