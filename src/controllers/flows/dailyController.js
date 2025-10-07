import dailyService from '../../services/dailyService.js';
import badgeService from '../../services/badgeService.js';
import activityTracker from '../../services/activityTracker.js';

const dailyController = {
  handleText: async (ctx, text, userStep) => dailyService.handleText(ctx, text, userStep),
  handleCallback: async (ctx, data) => dailyService.handleCallback(ctx, data),
  startMorningSession: async (ctx) => dailyService.startSession(ctx, 'morning'),
  startEveningSession: async (ctx) => dailyService.startSession(ctx, 'evening'),
  restartMorningSession: async (ctx) => dailyService.restartSession(ctx, 'morning'),
  restartEveningSession: async (ctx) => dailyService.restartSession(ctx, 'evening'),
  continueEveningSession: async (ctx) => dailyService.continueEveningSession(ctx),

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
