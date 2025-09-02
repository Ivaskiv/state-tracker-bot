// src/modules/answers.js
import responseService from '../services/responseService.js';
import affirmationService from '../services/affirmationService.js';
import userService from '../services/userService.js';
import keyboards from '../utils/keyboards.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, ANSWER_STEPS, SCHEDULE, QUESTION_TYPES, LATE_TEXT } from '../config/constants.js';
import { isValidResponseTime } from '../utils/time.js';

export async function handleOngoingQuestions(ctx) {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);
  if (!user || !user.Answer_Step || user.Answer_Step === ANSWER_STEPS.COMPLETED) return false;

  const text = (ctx.message?.text || '').trim();
  if (!isValidResponseTime(user.Answer_Step)) {
    const nextType = user.Answer_Step.startsWith('Q_m_') || user.Answer_Step === ANSWER_STEPS.MORNING_PENDING
      ? QUESTION_TYPES.EVENING
      : QUESTION_TYPES.MORNING;
    await ctx.reply(LATE_TEXT(nextType), keyboards.mainMenuKeyboard());
    return true;
  }

  await processAnswer(ctx, user, text);
  return true;
}

async function processAnswer(ctx, user, answer) {
  const tgId = ctx.from.id;
  const currentStep = user.Answer_Step;
  const userName = user['User Name'] || 'Користувач';

  let questionType, questions, questionNumber, nextStep, fieldName;

  if (currentStep.startsWith('Q_m_')) {
    questionType = QUESTION_TYPES.MORNING;
    questions = MORNING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2], 10);
    fieldName = `Q_m_${questionNumber}`;
    nextStep = questionNumber < 6 ? `Q_m_${questionNumber + 1}` : ANSWER_STEPS.END_MORNING;
  } else if (currentStep.startsWith('Q_e_')) {
    questionType = QUESTION_TYPES.EVENING;
    questions = EVENING_QUESTIONS;
    questionNumber = parseInt(currentStep.split('_')[2], 10);
    fieldName = `Q_e_${questionNumber}`;
    nextStep = questionNumber < 5 ? `Q_e_${questionNumber + 1}` : ANSWER_STEPS.END_EVENING;
  } else {
    await softTyping(ctx);
    return ctx.reply('Щось пішло не так. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }

  try {
    // зберегти відповідь
    await responseService.createOrUpdateResponse(
      tgId, userName, questionType, currentStep, questionNumber, answer, fieldName
    );

    // останнє питання?
    if (nextStep === ANSWER_STEPS.END_MORNING || nextStep === ANSWER_STEPS.END_EVENING) {
      const affirmation = await affirmationService.getAffirmationAndMarkUsed(questionType.toLowerCase());
      const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
      await responseService.createOrUpdateResponse(
        tgId, userName, questionType, nextStep, 0, affirmation, affirmationField, true
      );
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);

      const endMessage = questionType === QUESTION_TYPES.MORNING
        ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
        : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`;
      await softTyping(ctx);
      return ctx.reply(endMessage, keyboards.mainMenuKeyboard());
    }

    // перейти до наступного питання
    await userService.updateUserStep(tgId, nextStep);
    const nextQuestionIndex = questionNumber;
    const nextQuestion = questions[nextQuestionIndex];

    await softTyping(ctx);
    return ctx.reply(`${questionNumber + 1}️⃣/${questions.length} ${nextQuestion}`);
  } catch (error) {
    console.error('[answers.processAnswer] Помилка:', error);
    await softTyping(ctx);
    return ctx.reply('Помилка при збереженні відповіді. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
}

async function softTyping(ctx) {
  try {
    await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
    await new Promise(res => setTimeout(res, 800));
  } catch (_) {}
}
