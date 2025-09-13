// src/middleware/pendingFlow.js - ВИПРАВЛЕНО БЛОКУВАННЯ МЕНЮ

import userService from '../auth/services/userService.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS, SCHEDULE } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import typing from '../utils/typing.js';
// import wheelBalanceService from '../dialogue/services/wheelBalanceService.js';
import { aiMentorSession } from '../aiMentor/session.js';
import wheelBalanceService from '../services/wheelBalanceService.js';

const userReminders = new Map();

export const schedulePendingReminders = (bot, tgId, sessionType) => {
  clearUserReminders(tgId);
  
  const reminders = {
    timer1: setTimeout(() => sendReminder(bot, tgId, sessionType, 1), 10 * 60 * 1000),
    timer2: setTimeout(() => sendReminder(bot, tgId, sessionType, 2), 60 * 60 * 1000)
  };
  
  userReminders.set(tgId, reminders);
  console.log(`[pendingFlow] ✅ Заплановано 2 нагадування для ${tgId}, сесія: ${sessionType}`);
};

export const clearUserReminders = (tgId) => {
  const reminders = userReminders.get(tgId);
  if (reminders) {
    clearTimeout(reminders.timer1);
    clearTimeout(reminders.timer2);
    userReminders.delete(tgId);
    console.log(`[pendingFlow] Очищено нагадування для ${tgId}`);
  }
};

const sendReminder = async (bot, tgId, sessionType, reminderNumber) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || user.Answer_Step === ANSWER_STEPS.COMPLETED) {
      console.log(`[pendingFlow] Нагадування ${reminderNumber} скасовано - користувач ${tgId} завершив`);
      return;
    }
    
    const lastActivity = user.Last_Activity ? new Date(user.Last_Activity) : null;
    const now = new Date();
    const timeSinceActivity = lastActivity ? (now - lastActivity) / 1000 / 60 : 999;
    const activityThreshold = reminderNumber === 1 ? 2 : 5;
    
    if (timeSinceActivity < activityThreshold) {
      console.log(`[pendingFlow] Нагадування ${reminderNumber} пропущено - користувач ${tgId} активний`);
      return;
    }
    
    await typing({ telegram: bot.telegram, from: { id: tgId } });
    
    const messages = {
      1: {
        Morning: '🔔 Не забудь відповісти на ранкові питання!',
        Evening: '🔔 Час для вечірньої рефлексії!'
      },
      2: {
        Morning: '🔔 Останнє нагадування про ранкові питання!',
        Evening: '🔔 Останнє нагадування про вечірні питання!'
      }
    };
    
    const message = messages[reminderNumber][sessionType];
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Продовжити відповіді', callback_data: 'continue_answers' }],
          [{ text: '⏭️ Пропустити сесію', callback_data: 'skip_session' }]
        ]
      }
    };
    
    await bot.telegram.sendMessage(tgId, message, keyboard);
    console.log(`[pendingFlow] Надіслано нагадування ${reminderNumber} для ${tgId}`);
    
  } catch (error) {
    console.error(`[pendingFlow] Помилка нагадування ${reminderNumber} для ${tgId}:`, error);
  }
};

// ✅ ВИПРАВЛЕНА ФУНКЦІЯ ПЕРЕВІРКИ АКТИВНИХ ВІДПОВІДЕЙ
const isPendingResponse = (user) => {
  if (!user || !user.Answer_Step) return false;
  
  const step = user.Answer_Step;
  
  // ✅ ВСІХ АКТИВНИХ СТАНІВ
  const activeSteps = [
    ANSWER_STEPS.MORNING_1, ANSWER_STEPS.MORNING_2, ANSWER_STEPS.MORNING_3,
    ANSWER_STEPS.MORNING_4, ANSWER_STEPS.MORNING_5, ANSWER_STEPS.MORNING_6,
    ANSWER_STEPS.EVENING_1, ANSWER_STEPS.EVENING_2, ANSWER_STEPS.EVENING_3,
    ANSWER_STEPS.EVENING_4, ANSWER_STEPS.EVENING_5,
    ANSWER_STEPS.MORNING_PENDING, ANSWER_STEPS.EVENING_PENDING,
    ANSWER_STEPS.WHEEL_BALANCE_ACTIVE, ANSWER_STEPS.AI_MENTOR_ACTIVE,
    'WheelBalance' // ✅ ДОДАНО СТАН КОЛЕСА
  ];
  
  const isActive = activeSteps.includes(step);
  
  // ✅ ПЕРЕВІРКА AI МЕНТОРА ОКРЕМО
  const hasAISession = aiMentorSession.isActive(parseInt(user.TG_id));
  
  return isActive || hasAISession;
};

const getCurrentQuestion = (step) => {
  if (step.startsWith('Q_m_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`;
  }
  
  if (step.startsWith('Q_e_')) {
    const questionNum = parseInt(step.split('_')[2]) - 1;
    return `${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`;
  }
  
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE || step === 'WheelBalance') {
    return '🎯 Колесо балансу в процесі...';
  }
  
  if (step === ANSWER_STEPS.AI_MENTOR_ACTIVE) {
    return '🤖 AI наставник активний...';
  }
  
  return null;
};

const updateUserActivity = async (tgId) => {
  try {
    await userService.updateUserActivity(tgId);
  } catch (error) {
    console.error(`[pendingFlow] Помилка оновлення активності для ${tgId}:`, error);
  }
};

const getSessionType = (step, tgId) => {
  if (step.startsWith('Q_m_') || step === ANSWER_STEPS.MORNING_PENDING) return 'ранкові';
  if (step.startsWith('Q_e_') || step === ANSWER_STEPS.EVENING_PENDING) return 'вечірні';
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE || step === 'WheelBalance') return 'колесо балансу';
  if (step === ANSWER_STEPS.AI_MENTOR_ACTIVE || aiMentorSession.isActive(parseInt(tgId))) return 'AI наставник';
  return 'поточні';
};

// ✅ КОМАНДИ МЕНЮ
const isMenuCommand = (text) => {
  const menuCommands = [
    '💎 Афірмація',
    '📈 Щотижневий звіт',
    '📈 Щомісячний звіт', 
    '🤖 AI наставник',
    '🎯 Колесо балансу',
    '💰 Підписка',
    '📊 Мій прогрес',
    '❓ Допомога',
    '📞 Зв\'язок з нами',
    '📝 Інструкції',
    'ℹ️ Профіль'
  ];
  return menuCommands.includes(text);
};

// ✅ ГОЛОВНИЙ MIDDLEWARE
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

      // ✅ ДОЗВОЛЯЄМО КОМАНДИ ПРОДОВЖЕННЯ/ПРОПУСКУ
      if (text === '🔄 Продовжити відповіді' || text === '⏭️ Пропустити' ||
          text.startsWith('🔄') || text.startsWith('⏭️')) {
        console.log(`[pendingFlow] ✅ Дозволено команду продовження: "${text}"`);
        return next();
      }

      // ✅ СВІЖА ПЕРЕВІРКА СТАНУ
      const freshUser = await userService.getUserByTelegramId(tgId);
      const pending = isPendingResponse(freshUser);
      
      console.log(`[pendingFlow] 🔍 ДІАГНОСТИКА для ${tgId}:`);
      console.log(`- Текст: "${text}"`);
      console.log(`- Answer_Step: "${freshUser.Answer_Step}"`);
      console.log(`- isPending: ${pending}`);
      console.log(`- isMenuCommand: ${isMenuCommand(text)}`);
      console.log(`- hasAISession: ${aiMentorSession.isActive(tgId)}`);

      // ✅ ЯКЩО НЕМАЄ АКТИВНИХ ПИТАНЬ - ДОЗВОЛЯЄМО ВСЕ
      if (!pending) {
        console.log(`[pendingFlow] ✅ Немає активних питань, дозволяємо: "${text}"`);
        return next();
      }

      const step = freshUser.Answer_Step;
      const sessionType = getSessionType(step, tgId);

      // ✅ БЛОКУЄМО КОМАНДИ МЕНЮ ПРИ АКТИВНИХ ПИТАННЯХ
      if (pending && isMenuCommand(text)) {
        console.log(`[pendingFlow] 🚫 БЛОКУЄМО команду меню: "${text}" (активний стан: ${step})`);
        
        // Обробка часового вікна для ранкових питань
        if ((step.startsWith('Q_m_') || step === ANSWER_STEPS.MORNING_PENDING)) {
          const currentTime = getUserDateTime(tgId);
          const currentHour = new Date(currentTime).getHours();
          const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
          
          if (currentHour >= eveningHour) {
            await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
            await typing(ctx);
            await ctx.reply(
              '🌙 Ранкові питання недоступні після 20:00.\n\nМожеш почати вечірні питання або вийти.',
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
                    [{ text: '🚪 Вийти із сесії', callback_data: 'skip_session' }]
                  ]
                }
              }
            );
            return;
          }
        }

        let message;
        
        if (sessionType === 'AI наставник') {
          message = `🤖 Зараз в тебе активна сесія AI наставника.\n\nЩоб використати кнопки меню:`;
        } else {
          const currentQuestion = getCurrentQuestion(step);
          message = `🔒 Спочатку заверши ${sessionType} або вийди із сесії.\n\n`;
          
          if (currentQuestion && !currentQuestion.includes('🎯 Колесо балансу') && !currentQuestion.includes('🤖 AI наставник')) {
            message += `📝 Поточне питання:\n${currentQuestion}`;
          } else {
            message += `📝 У тебе незавершена сесія: ${sessionType}.`;
          }
        }
        
        await typing(ctx);
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
              [{ text: '🚪 Вийти із сесії', callback_data: 'skip_session' }]
            ]
          }
        });
        return; // ✅ БЛОКУЄМО ВИКОНАННЯ
      }

      // ✅ ДОЗВОЛЯЄМО ВІДПОВІДІ НА ПИТАННЯ
      console.log(`[pendingFlow] ✅ Дозволяємо відповідь на питання: "${text}"`);
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
  const tgId = user.TG_id;
  
  // ✅ ПЕРЕВІРКА AI МЕНТОРА
  if (step === ANSWER_STEPS.AI_MENTOR_ACTIVE || aiMentorSession.isActive(parseInt(tgId))) {
    await typing(ctx);
    await ctx.reply('🤖 AI-наставник активний. Задавай питання!');
    await ctx.answerCbQuery('Продовжуємо AI діалог');
    return;
  }
  
  // Колесо балансу
  if (step === ANSWER_STEPS.WHEEL_BALANCE_ACTIVE || step === 'WheelBalance') {
    const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
    if (activeWheel) {
      const currentSphere = activeWheel.fields.Step || 0;
      const sphereName = wheelBalanceService.LIFE_SPHERES[currentSphere] || `Сфера ${currentSphere + 1}`;
      
      await typing(ctx);
      await ctx.reply(`🎯 КОЛЕСО БАЛАНСУ\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`);
      await ctx.answerCbQuery('Продовжуємо колесо балансу');
    } else {
      await typing(ctx);
      await ctx.reply('Колесо балансу завершено!', keyboards.mainMenuKeyboard());
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.answerCbQuery('Готово');
    }
    return;
  }
  
  // Ранкові/вечірні питання
  const currentQuestion = getCurrentQuestion(step);
  if (currentQuestion && !currentQuestion.includes('🎯 Колесо балансу') && !currentQuestion.includes('🤖 AI наставник')) {
    await typing(ctx);
    await ctx.reply(currentQuestion);
    await ctx.answerCbQuery('Продовжуємо відповіді');
  } else {
    await typing(ctx);
    await ctx.reply('Питання завершені!', keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    await ctx.answerCbQuery('Готово');
  }
};

// Обробка пропуску сесії
const handleSkipSession = async (ctx, tgId) => {
  // ✅ ОЧИЩАЄМО AI СЕСІЮ ЯКЩО АКТИВНА
  if (aiMentorSession.isActive(tgId)) {
    aiMentorSession.end(tgId);
  }
  
  await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  clearUserReminders(tgId);
  
  await typing(ctx);
  await ctx.reply('Сесію пропущено. Повертаємося до меню.', keyboards.mainMenuKeyboard());
  await ctx.answerCbQuery('Сесію пропущено');
  
  console.log(`✅ [SKIP] Сесію пропущено для ${tgId}, Answer_Step: COMPLETED`);
};