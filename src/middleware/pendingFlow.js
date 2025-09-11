// src/middleware/pendingFlow.js
import userService from '../auth/services/userService.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS, MENU_MATCHERS, SCHEDULE } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';

// Глобальні таймери для персональних нагадувань
const userReminders = new Map(); // tgId -> { timer1, timer2 }

// Функція планування персональних нагадувань
export const schedulePendingReminders = (bot, tgId, sessionType) => {
  // Очищуємо попередні таймери
  clearUserReminders(tgId);
  
  const reminders = {
    timer1: setTimeout(async () => {
      try {
        const user = await userService.getUserByTelegramId(tgId);
        if (!user || user.Answer_Step === ANSWER_STEPS.COMPLETED) return;
        
        // Додаємо typing анімацію
        await bot.telegram.sendChatAction(tgId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const message = sessionType === 'Morning' 
          ? '🔔 Не забудь відповісти на ранкові питання!\n\n🔄 Натисни "🔄 Продовжити відповіді"'
          : '🔔 Час для вечірньої рефлексії!\n\n🔄 Натисни "🔄 Продовжити відповіді"';
          
        await bot.telegram.sendMessage(tgId, message, keyboards.continueAnswersKeyboard());
        console.log(`[pendingFlow] Надіслано перше нагадування (+10хв) для ${tgId}`);
      } catch (error) {
        console.error(`[pendingFlow] Помилка першого нагадування для ${tgId}:`, error);
      }
    }, 10 * 60 * 1000), // 10 хвилин
    
    timer2: setTimeout(async () => {
      try {
        const user = await userService.getUserByTelegramId(tgId);
        if (!user || user.Answer_Step === ANSWER_STEPS.COMPLETED) return;
        
        // Додаємо typing анімацію
        await bot.telegram.sendChatAction(tgId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const message = sessionType === 'Morning'
          ? '🔔 Останнє нагадування про ранкові питання!'
          : '🔔 Останнє нагадування про вечірні питання!';
          
        await bot.telegram.sendMessage(tgId, message, keyboards.continueAnswersKeyboard());
        console.log(`[pendingFlow] Надіслано друге нагадування (+60хв) для ${tgId}`);
      } catch (error) {
        console.error(`[pendingFlow] Помилка другого нагадування для ${tgId}:`, error);
      }
    }, 60 * 60 * 1000) // 60 хвилин
  };
  
  userReminders.set(tgId, reminders);
  console.log(`[pendingFlow] Заплановано персональні нагадування для ${tgId}, сесія: ${sessionType}`);
};

// Функція очищення таймерів
export const clearUserReminders = (tgId) => {
  const reminders = userReminders.get(tgId);
  if (reminders) {
    clearTimeout(reminders.timer1);
    clearTimeout(reminders.timer2);
    userReminders.delete(tgId);
    console.log(`[pendingFlow] Очищено нагадування для ${tgId}`);
  }
};

// Функція отримання поточного питання
const getCurrentQuestion = (step) => {
  if (step.startsWith('Q_m_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`;
  }
  
  if (step.startsWith('Q_e_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`;
  }
  
  return null;
};

// Перевірка чи користувач у процесі відповідей (ВИКЛЮЧАЄМО AI_MENTOR_ACTIVE)
const isPendingResponse = (user) => {
  if (!user || !user.Answer_Step) return false;
  
  const step = user.Answer_Step;
  return step.startsWith('Q_m_') || step.startsWith('Q_e_') || 
         step === ANSWER_STEPS.MORNING_PENDING || step === ANSWER_STEPS.EVENING_PENDING;
  // ВИДАЛИЛИ AI_MENTOR_ACTIVE - він не блокує меню
};

// Middleware для блокування меню при незавершених відповідях
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

      // Перевіряємо, чи користувач у процесі відповідей (крім AI-наставника)
      const pending = isPendingResponse(user);
      
      // Дозволяємо команди продовження/пропуску завжди
      if (MENU_MATCHERS.CONTINUE_ANSWERS(text) || 
          MENU_MATCHERS.SKIP_SESSION(text) ||
          text.startsWith('🔄') || text.startsWith('⏭️')) {
        return next();
      }

      // Якщо користувач НЕ у процесі відповідей - дозволяємо все
      if (!pending) {
        return next();
      }

      // Спеціальна обробка для AI-наставника при незавершених питаннях
      if (pending && text === '🤖 AI наставник') {
        const step = user.Answer_Step;
        const sessionType = step.startsWith('Q_m_') ? 'ранкові' : 'вечірні';
        
        // Додаємо typing анімацію
        await ctx.telegram.sendChatAction(tgId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await ctx.reply(
          `🔒 Спочатку заверши ${sessionType} питання або пропусти сесію.\n\nПотім зможеш користуватися AI-наставником.`,
          keyboards.continueAnswersKeyboard()
        );
        return;
      }

      // Якщо користувач у процесі відповідей і це команда меню (крім AI-наставника)
      if (pending && isMenuCommand(text)) {
        
        // Перевіряємо часове вікно
        const currentTime = getUserDateTime(tgId);
        const currentHour = new Date(currentTime).getHours();
        const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
        
        const step = user.Answer_Step;
        const isMorningStep = step.startsWith('Q_m_') || step === ANSWER_STEPS.MORNING_PENDING;
        const isEveningStep = step.startsWith('Q_e_') || step === ANSWER_STEPS.EVENING_PENDING;
        
        // Якщо ранкові питання після 20:00 - переключаємо на вечірні
        if (isMorningStep && currentHour >= eveningHour) {
          await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
          
          // Додаємо typing анімацію
          await ctx.telegram.sendChatAction(tgId, 'typing');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          await ctx.reply(
            '🌙 Ранкові питання недоступні після 20:00.\n\nМожеш почати вечірні питання або пропустити сесію.',
            keyboards.continueAnswersKeyboard()
          );
          return;
        }
        
        // Блокуємо меню і пропонуємо продовжити
        const currentQuestion = getCurrentQuestion(step);
        const sessionType = isMorningStep ? 'ранкові' : isEveningStep ? 'вечірні' : 'поточні';
        
        let message = `🔒 Спочатка заверши ${sessionType} питання або пропусти сесію.\n\n`;
        
        if (currentQuestion) {
          message += `📝 Поточне питання:\n${currentQuestion}`;
        } else {
          message += `📝 У тебе незавершена сесія відповідей.`;
        }
        
        // Додаємо typing анімацію
        await ctx.telegram.sendChatAction(tgId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await ctx.reply(message, keyboards.continueAnswersKeyboard());
        return;
      }

      // Дозволяємо обробку відповідей на питання
      return next();
    } catch (error) {
      console.error('[pendingFlow] Помилка middleware:', error);
      return next();
    }
  });

  // Функція перевірки чи це команда меню (ВИКЛЮЧИЛИ AI-наставника)
  const isMenuCommand = (text) => {
    const menuCommands = [
      '💎 Афірмація',
      '📈 Щотижневий звіт',
      '📈 Щомісячний звіт',
      '💰 Підписка',
      '📊 Мій прогрес',
      '❓ Допомога',
      '📞 Зв\'язок з нами',
      '📝 Інструкції', // виправлено пробіли
      'ℹ️ Профіль'
    ];
    // НЕ включаємо '🤖 AI наставник' - він обробляється окремо
    return menuCommands.includes(text);
  };

  // Callback query для inline кнопок
  bot.on('callback_query', async (ctx) => {
    const tgId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    
    try {
      if (data === 'continue_answers') {
        const user = await userService.getUserByTelegramId(tgId);
        if (!user) {
          await ctx.answerCbQuery('Користувача не знайдено');
          return;
        }
        
        const currentQuestion = getCurrentQuestion(user.Answer_Step);
        if (currentQuestion) {
          // Додаємо typing анімацію
          await ctx.telegram.sendChatAction(tgId, 'typing');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          await ctx.reply(currentQuestion);
          await ctx.answerCbQuery('Продовжуємо відповіді');
        } else {
          // Додаємо typing анімацію
          await ctx.telegram.sendChatAction(tgId, 'typing');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          await ctx.reply('Питання завершені!', keyboards.mainMenuKeyboard());
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          await ctx.answerCbQuery('Готово');
        }
      } else if (data === 'skip_session') {
        await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
        clearUserReminders(tgId); // очищуємо нагадування
        
        // Додаємо typing анімацію
        await ctx.telegram.sendChatAction(tgId, 'typing');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        await ctx.reply('Сесію пропущено. Повертаємося до меню.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Сесію пропущено');
      }
    } catch (error) {
      console.error('[pendingFlow] Помилка callback:', error);
      await ctx.answerCbQuery('Помилка');
    }
  });
};