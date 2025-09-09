// src/middleware/pendingFlow.js
import userService from '../auth/services/userService.js';
import { ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';

export const installPendingFlow = (bot) => {
  bot.use(async (ctx, next) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();

    if (!text) return next();

    if (text.startsWith('/') || ctx.callbackQuery) return next();

    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return next();

      const step = user.Answer_Step;

      if (step && step.startsWith('Q_') && step !== ANSWER_STEPS.COMPLETED) {
        const isMenuCommand = [
          '📈 Щотижневий звіт',
          '📈 Щомісячний звіт',
          '💎 Афірмація',
          '🤖 AI наставник',
          '📊 Мій прогрес',
          '💰 Підписка',
          '❓ Допомога',
          '📞 Зв\'язок з нами',
          '📝 Інструкції',
        ].includes(text);

        if (isMenuCommand) {
          await ctx.reply('⚠️ Спочатку завершіть поточні відповіді або пропустіть їх', keyboards.continueAnswersKeyboard());
          return;
        }
      }

      return next();
    } catch (error) {
      return next();
    }
  });

  bot.action('continue_answers', async (ctx) => {
    const tgId = ctx.from.id;

    try {
      const user = await userService.getUserByTelegramId(tgId);
      const step = user?.Answer_Step;

      if (!step || !step.startsWith('Q_')) {
        await ctx.answerCbQuery('Немає активних питань');
        return;
      }

      let questionText = '';
      let questionNum = 0;

      if (step.startsWith('Q_m_')) {
        questionNum = parseInt(step.split('_')[2]) - 1;
        questionText = `${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`;
      } else if (step.startsWith('Q_e_')) {
        questionNum = parseInt(step.split('_')[2]) - 1;
        questionText = `${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`;
      }

      await ctx.answerCbQuery();
      await ctx.reply(questionText);
    } catch (error) {
      await ctx.answerCbQuery('Помилка. Спробуйте ще раз.');
    }
  });

  bot.action('skip_session', async (ctx) => {
    const tgId = ctx.from.id;

    try {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.answerCbQuery();
      await ctx.reply('✅ Сесію пропущено', keyboards.mainMenuKeyboard());
    } catch (error) {
      await ctx.answerCbQuery('Помилка. Спробуйте ще раз.');
    }
  });
};