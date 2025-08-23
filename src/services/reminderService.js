import userService from './userService.js';
import { createOrUpdateResponse } from './reflectionService.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, SCHEDULE } from '../config/constants.js';

const sendNextQuestion = async (bot, tgId) => {
  console.log('[sendNextQuestion] Start for', tgId);

  const user = await userService.getUserByTelegramId(tgId);
  if (!user) {
    console.log('[sendNextQuestion] ❌ User not found, exit.');
    return;
  }

  const step = user.fields.Answer_Step || 'Begin_answer';

  let questions, type;
  if (step.startsWith('Q_m') || step === 'Begin_answer') {
    questions = MORNING_QUESTIONS;
    type = QUESTION_TYPES.MORNING;
  } else if (step.startsWith('Q_e')) {
    questions = EVENING_QUESTIONS;
    type = QUESTION_TYPES.EVENING;
  } else {
    console.log('[sendNextQuestion] Step is end marker, exit.');
    return;
  }

  let questionIndex = 0;
  if (step !== 'Begin_answer') {
    const match = step.match(/\d+/);
    questionIndex = match ? parseInt(match[0], 10) - 1 : 0;
  }

  if (type === QUESTION_TYPES.MORNING && isEveningTime() && step !== 'End_m') {
    console.log('[sendNextQuestion] Morning missed, switch to evening.');
    await bot.telegram.sendMessage(
      tgId,
      '⏰ На жаль, ви не завершили ранкові питання вчасно. Тепер переходьте до вечірніх.'
    );
    await startEveningQuestions(bot, tgId);
    return;
  }

  await bot.telegram.sendMessage(tgId, `${questionIndex + 1}️⃣ ${questions[questionIndex]}`);
  await userService.updateUserStep(tgId, `${type === QUESTION_TYPES.MORNING ? 'Q_m' : 'Q_e'}_${questionIndex + 1}`);
  console.log('[sendNextQuestion] Sent question', questionIndex + 1, 'type:', type);
};

const handleAnswer = async (ctx) => {
  const tgId = ctx.from.id.toString();
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return;

  const answer = ctx.message.text;
  const step = user.fields.Answer_Step;
  const type =
    step.startsWith('Q_m') || step === 'Begin_answer'
      ? QUESTION_TYPES.MORNING
      : QUESTION_TYPES.EVENING;

  const questionIndex = step === 'Begin_answer' ? 0 : parseInt(step.split('_')[1], 10) - 1;
  const questions = type === QUESTION_TYPES.MORNING ? MORNING_QUESTIONS : EVENING_QUESTIONS;

  await createOrUpdateResponse(tgId, user.fields['User Name'], type, step, questionIndex + 1, answer);

  if (questionIndex + 1 < questions.length) {
    await sendNextQuestion(ctx.bot, tgId);
  } else {
    const endStep = type === QUESTION_TYPES.MORNING ? 'End_m' : 'End_e';
    await userService.updateUserStep(tgId, endStep);

    await ctx.bot.telegram.sendMessage(
      tgId,
      type === QUESTION_TYPES.MORNING
        ? '💡 Афірмація ранку: Ти сильна, здатна та готова діяти сьогодні!'
        : '💡 Афірмація вечора: Твій день завершено, ти заслуговуєш відпочинку та гармонії.'
    );

    await userService.updateUserStep(tgId, null);
  }
};

const isEveningTime = () => {
  const hour = new Date().getHours();
  return hour >= SCHEDULE.EVENING_START;
};

const startEveningQuestions = async (bot, tgId) => {
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return;
  await userService.updateUserStep(tgId, 'Q_e_1');
  await bot.telegram.sendMessage(tgId, `1️⃣ ${EVENING_QUESTIONS[0]}`);
};

export default {
  sendNextQuestion,
  handleAnswer,
  startEveningQuestions
};
