// src/services/reminderService.js
import userService from './userService.js';
import affirmationService from './affirmationService.js';
import { createOrUpdateResponse } from './responseService.js';
import { QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, STEP_ORDER, ANSWER_STEPS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';

const sendNextQuestion = async (bot, user) => {
  const tgId = user.TG_id;
  let step = user.Answer_Step;

  // Якщо крок пустий або некоректний, стартуємо з першого ранкового питання
  if (!step || typeof step !== 'string') {
    step = ANSWER_STEPS.MORNING_1;
    await userService.updateUserStep(tgId, step);
    user.Answer_Step = step;
    console.log(`[sendNextQuestion] Invalid or empty Answer_Step for user ${tgId}, reset to ${step}`);
  }

  // Якщо сесія завершена — виходимо
  if ([ANSWER_STEPS.END_MORNING, ANSWER_STEPS.END_EVENING].includes(step)) return;

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
    // Імітація друку
    await bot.telegram.sendChatAction(tgId, 'typing');
    await new Promise(res => setTimeout(res, 1500));

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
    }

    if ([ANSWER_STEPS.END_MORNING, ANSWER_STEPS.END_EVENING].includes(step)) {
      console.log(`[handleAnswer] User ${tgId} already finished session at step ${step}`);
      return;
    }

    const answer = ctx.message.text;
    const type = step.startsWith('Q_m') ? QUESTION_TYPES.MORNING : QUESTION_TYPES.EVENING;
    const questionIndex = parseInt(step.split('_')[2], 10) - 1;

    // Зберігаємо відповідь на питання
    await createOrUpdateResponse(tgId, user['User Name'], type, step, answer, step);

    // Перевіряємо, чи це останнє питання
    const isLastMorning = type === QUESTION_TYPES.MORNING && questionIndex === MORNING_QUESTIONS.length - 1;
    const isLastEvening = type === QUESTION_TYPES.EVENING && questionIndex === EVENING_QUESTIONS.length - 1;

    if (isLastMorning || isLastEvening) {
      // Генеруємо афірмацію
      const affirmation = await affirmationService.getAffirmationAndMarkUsed();

      // Встановлюємо крок End та зберігаємо афірмацію
      if (isLastMorning) {
        await userService.updateUserStep(tgId, ANSWER_STEPS.END_MORNING, { affirmation_m: affirmation });
        user.Answer_Step = ANSWER_STEPS.END_MORNING;
      } else {
        await userService.updateUserStep(tgId, ANSWER_STEPS.END_EVENING, { affirmation_e: affirmation });
        user.Answer_Step = ANSWER_STEPS.END_EVENING;
      }

      // Відправляємо афірмацію з анімацією друку
      await ctx.bot.telegram.sendChatAction(tgId, 'typing');
      await new Promise(res => setTimeout(res, 3000));

      return ctx.reply(
        isLastMorning
          ? `✅ Ранкові питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`
          : `✅ Вечірні питання завершено!\n\n💎 Афірмація для тебе:\n${affirmation}`,
        keyboards.mainMenuKeyboard()
      );
    }

    // Якщо не останнє питання — оновлюємо крок і надсилаємо наступне
    const nextStep = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
    await userService.updateUserStep(tgId, nextStep);
    user.Answer_Step = nextStep;

    await sendNextQuestion(ctx.bot, user);

  } catch (error) {
    console.error(`[handleAnswer] ❌ Error for user ${ctx.from.id}:`, error);
    return ctx.reply('Помилка при збереженні відповіді. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

export default { sendNextQuestion, handleAnswer };
