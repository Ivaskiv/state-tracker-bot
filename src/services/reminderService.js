// src/services/reminderService.js
import { updateUserStep, findUserByTGId } from './userService.js';
import { createOrUpdateResponse } from './reflectionService.js';
import { QUESTION_TYPES } from '../config/constants.js';


export const sendReminder = async (bot, tgId, questions, type) => {
  const user = await findUserByTGId(tgId);

  // Якщо юзер ще не завершив попередній блок — попередження
  if (type === QUESTION_TYPES.EVENING && !user.Answer_Step?.startsWith('End_m')) {
    await bot.telegram.sendMessage(
      tgId,
      '⏰ На жаль, ви не відповіли на ранкові питання вчасно.\nБудь ласка, переходьте одразу до вечірніх.'
    );
  }

  if (type === QUESTION_TYPES.MORNING && !user.Answer_Step?.startsWith('End_e') && user.Answer_Step !== 'Begin_answer') {
    await bot.telegram.sendMessage(
      tgId,
      '⏰ Ви пропустили вечірні відповіді. Тепер доступні лише ранкові.'
    );
  }

  // Відправлення питань
  for (let i = 0; i < questions.length; i++) {
    await bot.telegram.sendMessage(tgId, `${i + 1}️⃣ ${questions[i]}`);
    await updateUserStep(tgId, `${type}_${i + 1}`);
  }
};

export const handleAnswer = async (ctx, user, questionType, step, questionNumber) => {
  const tgId = ctx.from.id.toString();
  const answer = ctx.message.text;

  await createOrUpdateResponse(
    tgId,
    user['User Name'],
    questionType,
    step,
    questionNumber,
    answer
  );

  // якщо це остання відповідь у блоці — позначаємо "End_m" чи "End_e"
  if (questionType === QUESTION_TYPES.MORNING && questionNumber === 5) {
    await updateUserStep(tgId, 'End_m');
  }
  if (questionType === QUESTION_TYPES.EVENING && questionNumber === 5) {
    await updateUserStep(tgId, 'End_e');
  }
};
