import dailyService from '../../services/dailyService.js';
import responseService from '../../services/responseService.js';
import userService from '../../services/userService.js';
import badgeService from '../../services/badgeService.js';
import activityTracker from '../../services/activityTracker.js';
import keyboards from '../../utils/keyboards.js';
import { QUESTIONS, ANSWER_STEPS } from '../../config/constants.js';

const dailyController = {
  
  handleText: async (ctx, text, userStep) => {
    console.log(`[dailyController] 📝 handleText: ${userStep.sessionType} Q${userStep.questionNumber}`);
    
    try {
      const { tgId, sessionType, questionNumber } = userStep;
      
      // Зберігаємо відповідь
      if (sessionType === 'morning') {
        await responseService.saveMorningAnswer(tgId, questionNumber, text);
      } else if (sessionType === 'evening') {
        await responseService.saveEveningAnswer(tgId, questionNumber, text);
      }
      
      console.log(`[dailyController] ✅ Відповідь збережено`);
      
      // Визначаємо наступне питання
      const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
      const totalQuestions = questions.length;
      const nextQuestionNum = questionNumber + 1;
      
      if (nextQuestionNum > totalQuestions) {
        // Сесія завершена
        console.log(`[dailyController] 🎉 Сесія ${sessionType} завершена`);
        
        const icon = sessionType === 'morning' ? '🌞' : '🌙';
        const title = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
        
        await ctx.reply(
          `${icon} ${title} рефлексію завершено!\n\n✅ Всі відповіді збережено.\n\nДякую за чесність! 💪`,
          keyboards.mainMenuKeyboard()
        );
        
        // Оновлюємо статус
        await userService.updateUserFields(tgId, {
          Answer_Step: ANSWER_STEPS.COMPLETED
        });
        
        await responseService._createOrUpdateRecord(tgId, {
          Current_Activity: sessionType === 'morning' ? 'morning_completed' : 'evening_completed'
        });
        
        // Перевіряємо фіналізацію дня
        const stats = await activityTracker.calculateDailyStats(tgId);
        if (stats?.morningCompleted && stats?.eveningCompleted) {
          await badgeService.assignBadges(tgId);
        }
        
        return true;
      }
      
      // Відправляємо наступне питання
      const nextQuestion = questions[nextQuestionNum - 1];
      
      if (!nextQuestion) {
        throw new Error(`Питання ${nextQuestionNum} не знайдено`);
      }
      
      console.log(`[dailyController] 📤 Відправка питання ${nextQuestionNum}/${totalQuestions}`);
      
      // Форматування повідомлення
      const icon = sessionType === 'morning' ? '🌞' : '🌙';
      const title = sessionType === 'morning' ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
      
      // Емодзі цифри
      const emojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
      const currentEmoji = emojiNumbers[nextQuestionNum];
      
      // Витягуємо перший рядок як заголовок питання
      const questionLines = nextQuestion.text.split('\n');
      const questionTitle = questionLines[0];
      
      const message = 
        `${icon} ${title}\n\n` +
        `${currentEmoji}/${totalQuestions} ${questionTitle}\n` +
        (nextQuestion.hint ? `💡 ${nextQuestion.hint}` : '');
      
      await ctx.reply(
        message,
        keyboards.questionKeyboard?.(nextQuestion) || { 
          reply_markup: { remove_keyboard: true } 
        }
      );
      
      console.log(`[dailyController] ✅ Питання ${nextQuestionNum} відправлено`);
      
      return true;
      
    } catch (error) {
      console.error('[dailyController] ❌ handleText error:', error);
      await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.', keyboards.mainMenuKeyboard());
      throw error;
    }
  },

  handleCallback: async (ctx, data) => {
    return dailyService.handleCallback(ctx, data);
  },

  startMorningSession: async (ctx) => {
    return dailyService.startSession(ctx, 'morning');
  },

  startEveningSession: async (ctx) => {
    return dailyService.startSession(ctx, 'evening');
  },

  restartMorningSession: async (ctx) => {
    return dailyService.restartSession(ctx, 'morning');
  },

  restartEveningSession: async (ctx) => {
    return dailyService.restartSession(ctx, 'evening');
  },

  continueEveningSession: async (ctx) => {
    return dailyService.continueEveningSession(ctx);
  },

  exitSession: async (ctx, type) => {
    await dailyService.exitSession(ctx, type);

    // ✅ Після завершення сесії перевіряємо фіналізацію дня
    const tgId = ctx.from.id;
    const stats = await activityTracker.calculateDailyStats(tgId);

    if (stats?.morningCompleted && stats?.eveningCompleted) {
      // Присвоюємо бейджі після успішного дня
      await badgeService.assignBadges(tgId);
    }
  },

  // Додатковий метод для отримання профілю з бейджами та прогресом
  showProfile: async (ctx) => {
    try {
      const tgId = ctx.from.id;

      const badges = await badgeService.getUserBadges(tgId);
      const last30DaysStats = await activityTracker.getLastNDaysStats(tgId, 30);

      const completedActions = last30DaysStats.reduce((sum, day) => sum + day.actionsCompleted, 0);
      const plannedActions = last30DaysStats.reduce((sum, day) => sum + day.actionsPlanned, 0);
      const progress = plannedActions > 0 ? Math.round((completedActions / plannedActions) * 100) : 0;

      const badgeText = badges.length ? badges.map(b => `🏅 ${b}`).join('\n') : 'Бейджів ще немає';

      await ctx.reply(
        `📊 Твій профіль:\n\nБейджі:\n${badgeText}\n\nПрогрес за місяць: ${progress}%`
      );

    } catch (error) {
      console.error('[dailyController] ❌ showProfile:', error);
      await ctx.reply('Виникла помилка при завантаженні профілю.');
    }
  }

};

export default dailyController;