// src/controllers/sessionHandlers.js - НОВИЙ ФАЙЛ
import userService from '../../auth/services/userService.js';
import responseService from '../services/responseService.js';
import affirmationService from '../services/affirmationService.js';
import { schedulePendingReminders } from '../../middleware/pendingFlow.js';
import { getUserDateTime } from '../../utils/timezoneUtils.js';
import { completeSession } from '../../utils/sessionUtils.js';
import { handleError } from '../../utils/errorHandler.js';
import keyboards from '../../utils/keyboards.js';
import {
  ANSWER_STEPS, 
  QUESTION_TYPES, 
  MORNING_QUESTIONS, 
  EVENING_QUESTIONS, 
  SCHEDULE
} from '../../config/constants.js';


// Початок ранкових питань
const startMorningQuestions = async (ctx, user, bot) => {
  const tgId = ctx.from.id;
  const currentTime = getUserDateTime(tgId);
  const currentHour = new Date(currentTime).getHours();
  const eveningHour = SCHEDULE.EVENING_HOUR;

  if (currentHour >= eveningHour) {
    await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
    return;
  }

  const isMorningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
  if (isMorningCompleted) {
    await ctx.reply('✅ Ти вже завершила ранкові питання за сьогодні.\n\n🔄 Хочеш оновити свої відповіді?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Відповісти ще раз', callback_data: 'restart_morning' }],
          [{ text: '❌ Відмінити', callback_data: 'cancel_restart' }]
        ]
      }
    });
    return;
  }

  await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
  await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
  schedulePendingReminders(bot, tgId, 'Morning');
};

// Початок вечірніх питань
const startEveningQuestions = async (ctx, user, bot) => {
  const tgId = ctx.from.id;
  const isEveningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
  
  if (isEveningCompleted) {
    await ctx.reply('✅ Ти вже завершила вечірні питання за сьогодні.\n\n🔄 Хочеш оновити свої відповіді?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Відповісти ще раз', callback_data: 'restart_evening' }],
          [{ text: '❌ Відмінити', callback_data: 'cancel_restart' }]
        ]
      }
    });
    return;
  }

  await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
  await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
  schedulePendingReminders(bot, tgId, 'Evening');
};

// Обробка відповідей на питання
const handleQuestionAnswer = async (ctx, user, text) => {
  const step = user.Answer_Step;
  if (!step || step === ANSWER_STEPS.COMPLETED) return false;
  
  const tgId = ctx.from.id;
  const userName = user['User Name'] || 'Користувач';

  try {
    if (step.startsWith('Q_m_')) {
      return await processMorningQuestions(ctx, user, text, step, tgId, userName);
    }

    if (step.startsWith('Q_e_')) {
      return await processEveningQuestions(ctx, user, text, step, tgId, userName);
    }

    return false;
  } catch (error) {
    await handleError(ctx, error);
    return true;
  }
};

// Обробка ранкових питань
const processMorningQuestions = async (ctx, user, text, step, tgId, userName) => {
  const currentTime = getUserDateTime(tgId);
  const currentHour = new Date(currentTime).getHours();
  const eveningHour = SCHEDULE.EVENING_HOUR;
  
  if (currentHour >= eveningHour) {
    await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
    return true;
  }

  const questionNum = parseInt(step.split('_')[2]);
  const fieldName = `Q_m_${questionNum}`;
  
  await responseService.createOrUpdateResponse(
    tgId, userName, QUESTION_TYPES.MORNING, step, questionNum, text, fieldName
  );

  if (questionNum < 6) {
    const nextStep = `Q_m_${questionNum + 1}`;
    await userService.updateUserStep(tgId, nextStep);
    await ctx.reply(`${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`);
  } else {
    await completeSessionWithAffirmation(ctx, tgId, userName, QUESTION_TYPES.MORNING, 'morning');
  }
  return true;
};

// Обробка вечірніх питань
const processEveningQuestions = async (ctx, user, text, step, tgId, userName) => {
  const questionNum = parseInt(step.split('_')[2]);
  const fieldName = `Q_e_${questionNum}`;
  
  await responseService.createOrUpdateResponse(
    tgId, userName, QUESTION_TYPES.EVENING, step, questionNum, text, fieldName
  );

  if (questionNum < 5) {
    const nextStep = `Q_e_${questionNum + 1}`;
    await userService.updateUserStep(tgId, nextStep);
    await ctx.reply(`${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`);
  } else {
    await completeSessionWithAffirmation(ctx, tgId, userName, QUESTION_TYPES.EVENING, 'evening');
  }
  return true;
};

// Завершення сесії з афірмацією
const completeSessionWithAffirmation = async (ctx, tgId, userName, questionType, sessionType) => {
  const affirmation = await affirmationService.getAffirmationAndMarkUsed(sessionType);
  const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
  const affirmationStep = questionType === QUESTION_TYPES.MORNING ? ANSWER_STEPS.AFFIRMATION_MORNING : ANSWER_STEPS.AFFIRMATION_EVENING;
  
  await responseService.createOrUpdateResponse(
    tgId, userName, questionType, affirmationStep, 0, affirmation, affirmationField, true
  );
  
  const sessionName = questionType === QUESTION_TYPES.MORNING ? 'Ранкові' : 'Вечірні';
  await completeSession(tgId, ctx, `✅ ${sessionName} питання завершено!\n\n💎 ${affirmation}`);
};

// Обробка рестарту сесій
const handleRestartCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  try {
    if (data === 'restart_morning') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
      await ctx.reply(`🔄 ОНОВЛЮЄМО РАНКОВІ ВІДПОВІДІ\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
      await ctx.answerCbQuery('Починаємо заново');
      
    } else if (data === 'restart_evening') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
      await ctx.reply(`🔄 ОНОВЛЮЄМО ВЕЧІРНІ ВІДПОВІДІ\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
      await ctx.answerCbQuery('Починаємо заново');
      
    } else if (data === 'cancel_restart') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply('❌ Відмінено. Повертаємося до меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Відмінено');
    }
  } catch (error) {
    console.error('[sessionHandlers] Помилка рестарту:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

export {
  startMorningQuestions,
  startEveningQuestions,
  handleQuestionAnswer,
  processMorningQuestions,
  processEveningQuestions,
  completeSessionWithAffirmation,
  handleRestartCallback
};