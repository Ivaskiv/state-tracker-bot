// src/services/reminderService.js
// src/services/reminderService.js
import userService from './userService.js';
import affirmationService from './affirmationService.js';
import { createOrUpdateResponse } from './responseService.js';
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

  if ([ANSWER_STEPS.END_MORNING, ANSWER_STEPS.END_EVENING].includes(step)) {
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

    console.log(`[sendNextQuestion] Sent question ${questionIndex + 1}, type: ${type} to user ${tgId}`);
  } catch (err) {
    console.error(`[sendNextQuestion] Error for user ${tgId}:`, err);
  }
};

const handleAnswer = async (ctx) => {
  try {
    const tgId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.error(`[handleAnswer] ❌ User not found: ${tgId}`);
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }

    let step = user.Answer_Step;
    if (!step || typeof step !== 'string') {
      step = ANSWER_STEPS.MORNING_1;
      await userService.updateUserStep(tgId, step);
      user.Answer_Step = step;
      console.log(`[handleAnswer] Invalid or empty Answer_Step for user ${tgId}, reset to ${step}`);
    }

    const answer = ctx.message.text;
    const type = step.startsWith('Q_m') ? QUESTION_TYPES.MORNING : QUESTION_TYPES.EVENING;
    const questionIndex = parseInt(step.split('_')[2], 10) - 1;

    console.log(`[handleAnswer] User ${tgId}, Step: ${step}, Answer: ${answer}`);

    // Save the answer
    await createOrUpdateResponse(tgId, user['User Name'], type, step, questionIndex + 1, answer, step);
    console.log(`[handleAnswer] ✅ Saved answer for ${tgId}, field: ${step}`);

    // Determine the next step
    const nextStep = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];

    if (!nextStep || nextStep.startsWith('End_')) {
      const endStep = type === QUESTION_TYPES.MORNING ? ANSWER_STEPS.END_MORNING : ANSWER_STEPS.END_EVENING;
      await userService.updateUserStep(tgId, endStep);

      await ctx.bot.telegram.sendChatAction(tgId, 'typing');
      await new Promise((res) => setTimeout(res, 3000));

      // Get and save affirmation
      const affirmation = await affirmationService.getAffirmationAndMarkUsed();
      
      // Save the affirmation as part of the response
      const affirmationType = type === QUESTION_TYPES.MORNING ? 'morning_affirmation' : 'evening_affirmation';
      await createOrUpdateResponse(tgId, user['User Name'], type, affirmationType, 0, affirmation, endStep);
      console.log(`[handleAnswer] ✅ Saved ${affirmationType} for ${tgId}: ${affirmation}`);

      const endMessage =
        type === QUESTION_TYPES.MORNING
          ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
          : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`;

      return ctx.reply(endMessage, keyboards.mainMenuKeyboard());
    }

    await userService.updateUserStep(tgId, nextStep);
    user.Answer_Step = nextStep;
    await sendNextQuestion(ctx.bot, user);
  } catch (error) {
    console.error(`[handleAnswer] ❌ Error for user ${tgId}:`, error);
    return ctx.reply('Помилка при збереженні відповіді. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

export default { sendNextQuestion, handleAnswer };