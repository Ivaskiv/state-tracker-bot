// src/controllers/flows/dailyController.js
import dailySessions from '../../services/dailySessions/index.js';
import userService from '../../services/userService.js';
import badgeService from '../../services/badgeService.js';
import activityTracker from '../../services/activityTracker.js';
import keyboards from '../../utils/keyboards.js';

const dailyController = {
  
  // ===== ОБРОБКА ТЕКСТОВИХ ВІДПОВІДЕЙ =====
  handleText: async (ctx, text, userStep) => {
    console.log(`[dailyController] 📝 handleText: ${userStep.sessionType} Q${userStep.questionNumber}`);
    
    try {
      const { tgId, sessionType, questionNumber } = userStep;
      
      // Делегуємо в dailySessions
      if (sessionType === 'morning') {
        const result = await dailySessions.handleMorningAnswer(ctx, text, questionNumber);
        
        if (result.completed) {
          // Перевіряємо фіналізацію дня
          const stats = await activityTracker.calculateDailyStats(tgId);
          if (stats?.morningCompleted && stats?.eveningCompleted) {
            await badgeService.assignBadges(tgId);
          }
        }
        
        return true;
      } else if (sessionType === 'evening') {
        const result = await dailySessions.handleEveningAnswer(ctx, text, questionNumber);
        
        // Фіналізація вже відбувається всередині handleEveningAnswer
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('[dailyController] ❌ handleText error:', error);
      await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.', keyboards.mainMenuKeyboard());
      throw error;
    }
  },

  // ===== CALLBACK (НЕ ЧІПАЄМО) =====
  handleCallback: async (ctx, data) => {
    // Залишаємо як є - тут можуть бути інші callback'и
    console.log('[dailyController] handleCallback:', data);
    return false;
  },

  // ===== СТАРТ СЕСІЙ =====
  startMorningSession: async (ctx) => {
    return dailySessions.startMorningSession(ctx);
  },

  startEveningSession: async (ctx) => {
    return dailySessions.startEveningSession(ctx);
  },

  // ===== ПЕРЕЗАПУСК =====
  restartMorningSession: async (ctx) => {
    return dailySessions.restartMorningSession(ctx);
  },

  restartEveningSession: async (ctx) => {
    return dailySessions.restartEveningSession(ctx);
  },

  // ===== ПРОДОВЖЕННЯ =====
  continueEveningSession: async (ctx) => {
    return dailySessions.continueEveningSession(ctx);
  },

  // ===== ВИХІД =====
  exitSession: async (ctx, type) => {
    const tgId = ctx.from.id;
    
    if (type === 'morning') {
      await dailySessions.exitMorningSession(ctx);
    } else {
      await dailySessions.exitEveningSession(ctx);
    }

    // Перевіряємо фіналізацію дня
    const stats = await activityTracker.calculateDailyStats(tgId);
    if (stats?.morningCompleted && stats?.eveningCompleted) {
      await badgeService.assignBadges(tgId);
    }
  },

  // ===== ПРОФІЛЬ (НЕ ЧІПАЄМО) =====
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