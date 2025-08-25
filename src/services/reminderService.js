// src/services/reminderService.js
import { MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS, QUESTION_TYPES } from '../config/constants.js';
import responseService from './responseService.js';

// Надсилання наступного питання
export const sendNextQuestion = async (bot, user) => {
  const tgId = user.TG_id;
  const currentStep = user.Answer_Step;
  console.log(`[sendNextQuestion] Надсилання питання для ${tgId}, Крок: ${currentStep}`);
  let questionType, questions, questionNumber;
  if (currentStep.startsWith('Q_m_') || currentStep === ANSWER_STEPS.MORNING_PENDING) {
    questionType = QUESTION_TYPES.MORNING;
    questions = MORNING_QUESTIONS;
    questionNumber = currentStep === ANSWER_STEPS.MORNING_PENDING ? 1 : parseInt(currentStep.split('_')[2]);
  } else if (currentStep.startsWith('Q_e_') || currentStep === ANSWER_STEPS.EVENING_PENDING) {
    questionType = QUESTION_TYPES.EVENING;
    questions = EVENING_QUESTIONS;
    questionNumber = currentStep === ANSWER_STEPS.EVENING_PENDING ? 1 : parseInt(currentStep.split('_')[2]);
  } else {
    console.log('[sendNextQuestion] Невідомий крок:', currentStep);
    return;
  }
  try {
    await bot.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[sendNextQuestion] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    const message = questionType === QUESTION_TYPES.MORNING
      ? `🌞 Ранкові питання для фокусу та активації!\nВідповідай щиро ✨\n\n${questionNumber}️⃣/6 ${questions[questionNumber - 1]}`
      : `🌙 Вечірні питання для аналізу дня!\nЧас підсумувати та зафіксувати перемоги 🏆\n\n${questionNumber}️⃣/5 ${questions[questionNumber - 1]}`;
    await bot.telegram.sendMessage(tgId, message);
    console.log(`[sendNextQuestion] Надіслано питання ${questionNumber}/${questions.length}, тип: ${questionType} для ${tgId}`);
  } catch (error) {
    console.error('[sendNextQuestion] Помилка:', error);
  }
};

// Надсилання нагадування
export const sendReminder = async (bot, tgId, questionType) => {
  try {
    await bot.telegram.sendChatAction(tgId, 'typing').catch(err => console.error('[sendReminder] Помилка sendChatAction:', err));
    await new Promise((res) => setTimeout(res, 1500));
    const message = questionType === QUESTION_TYPES.MORNING
      ? `🌞 Нагадування: не забудь відповісти на ранкові питання! Доступно до 20:00.`
      : `🌙 Нагадування: час для вечірніх питань! Доступно до 8:00 завтра.`;
    await bot.telegram.sendMessage(tgId, message);
    console.log(`[sendReminder] Надіслано нагадування для ${questionType} користувачу ${tgId}`);
  } catch (error) {
    console.error('[sendReminder] Помилка:', error);
  }
};

// Перевірка завершення сесії
export const isSessionCompleted = async (tgId, questionType) => {
  return await responseService.isSessionCompleted(tgId, questionType);
};

export default { sendNextQuestion, sendReminder, isSessionCompleted };