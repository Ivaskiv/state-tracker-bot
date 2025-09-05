// src/dialogue/services/reminderService.js
import userService from '../../auth/services/userService.js';
import affirmationService from './affirmationService.js';
import responseService from './responseService.js';
import keyboards from '../utils/keyboards.js';
import { 
  QUESTION_TYPES, 
  MORNING_QUESTIONS, 
  EVENING_QUESTIONS, 
  STEP_ORDER, 
  ANSWER_STEPS,
  SCHEDULER_MESSAGES
} from '../../config/constants.js';

const sendNextQuestion = async (bot, user) => {
  const tgId = user.TG_id;
  let step = user.Answer_Step;
  
 if (user.Answer_Step?.startsWith('Q_m_')) {
    await bot.telegram.sendMessage(tgId, 
      '⚠️ Ви не завершили ранкові питання, але час вечірньої рефлексії! Переходимо до вечірніх питань.');
  }
  
  if (!step || typeof step !== 'string') {
    step = ANSWER_STEPS.MORNING_1;
    await userService.updateUserStep(tgId, step);
    user.Answer_Step = step;
    console.log(`[sendNextQuestion] Invalid or empty Answer_Step for user ${tgId}, reset to ${step}`);
  }

  if ([ANSWER_STEPS.END_MORNING, ANSWER_STEPS.END_EVENING, ANSWER_STEPS.COMPLETED].includes(step)) {
    console.log(`[sendNextQuestion] Session ended for user ${tgId}, step: ${step}`);
    return;
  }

  let questions, type, questionIndex;

  if (step.startsWith('Q_m')) {
    questions = MORNING_QUESTIONS;
    type = QUESTION_TYPES.MORNING;
    questionIndex = parseInt(step.split('_')[2], 10) - 1;
  } else if (step.startsWith('Q_e')) {
    questions = EVENING_QUESTIONS;
    type = QUESTION_TYPES.EVENING;
    questionIndex = parseInt(step.split('_')[2], 10) - 1;
  } else {
    console.error(`[sendNextQuestion] ❌ Unknown step: ${step} for user ${tgId}`);
    return;
  }

  try {
    await bot.telegram.sendChatAction(tgId, 'typing');
    await new Promise((res) => setTimeout(res, 1500));

    await bot.telegram.sendMessage(tgId, `${questionIndex + 1}️⃣ ${questions[questionIndex]}`);

    console.log(`[sendNextQuestion] Надіслано питання ${questionIndex + 1}, тип: ${type} для ${tgId}`);
  } catch (err) {
    console.error(`[sendNextQuestion] Error for user ${tgId}:`, err);
  }
};

// ⚠️ Функція для надсилання нагадувань - використовуємо константи
const sendReminder = async (bot, tgId, questionType) => {
  try {
    const reminderText = questionType === QUESTION_TYPES.MORNING 
      ? SCHEDULER_MESSAGES.MORNING_REMINDER
      : SCHEDULER_MESSAGES.EVENING_REMINDER;
    
    await bot.telegram.sendMessage(tgId, reminderText, keyboards.mainMenuKeyboard());
    console.log(`[sendReminder] Надіслано нагадування для ${questionType} користувачу ${tgId}`);
  } catch (err) {
    console.error(`[sendReminder] Error for user ${tgId}:`, err);
  }
};

// ⚠️ Початок ранкової сесії - використовуємо SCHEDULER_MESSAGES
const startMorningSession = async (bot, user) => {
  const tgId = user.TG_id;
  
  try {
    const isCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
    if (isCompleted) {
      console.log(`[startMorningSession] User ${tgId} already completed morning session today`);
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
    
    const userName = user['User Name'] || 'Користувач';
    const message = SCHEDULER_MESSAGES.MORNING_SESSION_START(userName);

    await bot.telegram.sendMessage(tgId, message);
    console.log(`[startMorningSession] ✅ Started morning session for ${tgId}`);
    
  } catch (error) {
    console.error(`[startMorningSession] ❌ Error for user ${tgId}:`, error);
  }
};

// ⚠️ Початок вечірньої сесії - використовуємо SCHEDULER_MESSAGES
const startEveningSession = async (bot, user) => {
  const tgId = user.TG_id;
  
  try {
    const isCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
    if (isCompleted) {
      console.log(`[startEveningSession] User ${tgId} already completed evening session today`);
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
    
    const userName = user['User Name'] || 'Користувач';
    const message = SCHEDULER_MESSAGES.EVENING_SESSION_START(userName);

    await bot.telegram.sendMessage(tgId, message);
    console.log(`[startEveningSession] ✅ Started evening session for ${tgId}`);
    
  } catch (error) {
    console.error(`[startEveningSession] ❌ Error for user ${tgId}:`, error);
  }
};

const handleAnswer = async (ctx) => {
  console.log('[handleAnswer] This function is deprecated, logic moved to botController');
  return;
};

const getUserProgress = async (tgId, days = 30) => {
  try {
    const records = await responseService.getUserRecords(tgId, days);
    
    let morningCount = 0;
    let eveningCount = 0;
    let totalDays = records.length;
    
    records.forEach(record => {
      if (record.fields.morning_completed) morningCount++;
      if (record.fields.evening_completed) eveningCount++;
    });
    
    return {
      totalDays,
      morningCount,
      eveningCount,
      completionRate: totalDays > 0 ? Math.round(((morningCount + eveningCount) / (totalDays * 2)) * 100) : 0
    };
    
  } catch (error) {
    console.error('[getUserProgress] Error:', error);
    return {
      totalDays: 0,
      morningCount: 0,
      eveningCount: 0,
      completionRate: 0
    };
  }
};

export default { 
  sendNextQuestion, 
  sendReminder, 
  handleAnswer, 
  startMorningSession,
  startEveningSession,
  getUserProgress
};