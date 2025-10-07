import activityTracker from '../../services/activityTracker.js';
import badgeService from '../../services/badgeService.js';

const profileController = {

  showProfile: async (ctx) => {
    try {
      const tgId = ctx.from.id;

      // Отримуємо бейджі та прогрес
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
      console.error('[profileController] ❌ showProfile:', error);
      await ctx.reply('Виникла помилка при завантаженні профілю.');
    }
  }

};

export default profileController;
