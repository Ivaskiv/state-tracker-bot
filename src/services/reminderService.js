// src/services/reminderService.js
import userService from './userService.js';
import affirmationService from './affirmationService.js';
import responseService from './responseService.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, STEP_ORDER, ANSWER_STEPS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';

const sendNextQuestion = async (bot, user) => {
  const tgId = user.TG_id;
  let step = user.Answer_Step;

  // If step is empty or invalid, reset to initial morning question
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

// Функція для надсилання нагадувань
const sendReminder = async (bot, tgId, questionType) => {
  try {
    const reminderText = questionType === QUESTION_TYPES.MORNING 
      ? '🔔 Не забудь відповісти на ранкові питання!'
      : '🔔 Час для вечірньої рефлексії!';
    
    await bot.telegram.sendMessage(tgId, reminderText, keyboards.mainMenuKeyboard());
    console.log(`[sendReminder] Надіслано нагадування для ${questionType} користувачу ${tgId}`);
  } catch (err) {
    console.error(`[sendReminder] Error for user ${tgId}:`, err);
  }
};

// ✅ Початок ранкової сесії
const startMorningSession = async (bot, user) => {
  const tgId = user.TG_id;
  
  try {
    // Перевіряємо, чи вже завершено ранкову сесію
    const isCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
    if (isCompleted) {
      console.log(`[startMorningSession] User ${tgId} already completed morning session today`);
      return;
    }

    // Встановлюємо перше питання
    await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
    
    const message = `🌞 Доброго ранку, ${user['User Name'] || 'Користувач'}!

Час для ранкової рефлексії та налаштування на день! ✨

1️⃣/6 ${MORNING_QUESTIONS[0]}`;

    await bot.telegram.sendMessage(tgId, message);
    console.log(`[startMorningSession] ✅ Started morning session for ${tgId}`);
    
  } catch (error) {
    console.error(`[startMorningSession] ❌ Error for user ${tgId}:`, error);
  }
};

// ✅ Початок вечірньої сесії
const startEveningSession = async (bot, user) => {
  const tgId = user.TG_id;
  
  try {
    // Перевіряємо, чи вже завершено вечірню сесію
    const isCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
    if (isCompleted) {
      console.log(`[startEveningSession] User ${tgId} already completed evening session today`);
      return;
    }

    // Встановлюємо перше питання
    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
    
    const message = `🌙 Добрий вечір, ${user['User Name'] || 'Користувач'}!

Час підсумувати день і зафіксувати перемоги! 🏆

1️⃣/5 ${EVENING_QUESTIONS[0]}`;

    await bot.telegram.sendMessage(tgId, message);
    console.log(`[startEveningSession] ✅ Started evening session for ${tgId}`);
    
  } catch (error) {
    console.error(`[startEveningSession] ❌ Error for user ${tgId}:`, error);
  }
};

// ✅ ОНОВЛЕНА ФУНКЦІЯ - Обробка відповіді (вже не потрібна, бо логіка в botController)
const handleAnswer = async (ctx) => {
  // Ця функція більше не використовується, логіка перенесена в botController.handleQuestionAnswer
  console.log('[handleAnswer] This function is deprecated, logic moved to botController');
  return;
};

// ✅ Функція для отримання прогресу користувача
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