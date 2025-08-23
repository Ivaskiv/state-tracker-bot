import { updateUserStep, findUserByTGId } from './userService.js';
import { createOrUpdateResponse } from './reflectionService.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, SCHEDULE } from '../config/constants.js';

export const sendNextQuestion = async (bot, tgId) => {
  const user = await findUserByTGId(tgId);

  if (!user) return;

  const step = user.Answer_Step || 'Begin_answer';
  
  let questions, type;

  if (step.startsWith('Q_m') || step === 'Begin_answer') {
    questions = MORNING_QUESTIONS;
    type = QUESTION_TYPES.MORNING;
  } else if (step.startsWith('Q_e')) {
    questions = EVENING_QUESTIONS;
    type = QUESTION_TYPES.EVENING;
  } else {
    return; // якщо вже End_m або End_e
  }

  let questionIndex = 0;
  if (step !== 'Begin_answer') {
    const match = step.match(/\d+/);
    questionIndex = match ? parseInt(match[0], 10) : 0;
  }

  // Якщо ранкові пропущені і настав час вечірніх
  if (type === QUESTION_TYPES.MORNING && isEveningTime() && step !== 'End_m') {
    await bot.telegram.sendMessage(
      tgId,
      '⏰ На жаль, ви не завершили ранкові питання вчасно. Важливо відповідати в межах часу — тепер переходьте до вечірніх.'
    );
    await startEveningQuestions(bot, tgId);
    return;
  }

  // Відправка наступного питання
  await bot.telegram.sendMessage(tgId, `${questionIndex + 1}️⃣ ${questions[questionIndex]}`);
  await updateUserStep(tgId, `${type}_${questionIndex + 1}`);
};

export const handleAnswer = async (ctx) => {
  const tgId = ctx.from.id.toString();
  const user = await findUserByTGId(tgId);
  if (!user) return;

  const answer = ctx.message.text;
  const step = user.Answer_Step;
  const type = step.startsWith('Q_m') || step === 'Begin_answer' ? QUESTION_TYPES.MORNING : QUESTION_TYPES.EVENING;

  const questionIndex = step === 'Begin_answer' ? 0 : parseInt(step.split('_')[1], 10) - 1;

  const questions = type === QUESTION_TYPES.MORNING ? MORNING_QUESTIONS : EVENING_QUESTIONS;

  await createOrUpdateResponse(tgId, user['User Name'], type, step, questionIndex + 1, answer);

  if (questionIndex + 1 < questions.length) {
    // Наступне питання після відповіді
    await sendNextQuestion(ctx.bot, tgId);
  } else {
    // Завершення блоку
    const endStep = type === QUESTION_TYPES.MORNING ? 'End_m' : 'End_e';
    await updateUserStep(tgId, endStep);

    // Надсилання афірмації
    await ctx.bot.telegram.sendMessage(tgId, type === QUESTION_TYPES.MORNING
      ? '💡 Афірмація ранку: Ти сильна, здатна та готова діяти сьогодні!'
      : '💡 Афірмація вечора: Твій день завершено, ти заслуговуєш відпочинку та гармонії.'
    );

    // Обнулення Answer_Step
    await updateUserStep(tgId, null);
  }
};

const isEveningTime = () => {
  const hour = new Date().getHours();
  return hour >= SCHEDULE.EVENING_START;
};

const startEveningQuestions = async (bot, tgId) => {
  const user = await findUserByTGId(tgId);
  if (!user) return;
  await updateUserStep(tgId, 'Q_e_1');
  await bot.telegram.sendMessage(tgId, `1️⃣ ${EVENING_QUESTIONS[0]}`);
};
