// src/controllers/analyticsController.js
import userService from '../auth/services/userService.js';
import { generateReport, saveReportToAirtable } from '../services/reportService.js'; 

const analyticsController = {
  async generateWeeklyReportForUser(tgId) {
    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        console.error(`[analyticsController] Користувача з TG_id ${tgId} не знайдено`);
        return null;
      }

      const report = await generateReport(tgId, 7);
      await saveReportToAirtable({
        tgId,
        userName: user['User Name'] || 'Користувач',
        period: 'Weekly',
        days: 7,
        reportText: report,
      });
      return report;
    } catch (error) {
      console.error(`[analyticsController] Помилка генерації щотижневого звіту для ${tgId}:`, error);
      return null;
    }
  },

  async generateMonthlyReportForUser(tgId) {
    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        console.error(`[analyticsController] Користувача з TG_id ${tgId} не знайдено`);
        return null;
      }

      const report = await generateReport(tgId, 30);
      await saveReportToAirtable({
        tgId,
        userName: user['User Name'] || 'Користувач',
        period: 'Monthly',
        days: 30,
        reportText: report,
      });
      return report;
    } catch (error) {
      console.error(`[analyticsController] Помилка генерації місячного звіту для ${tgId}:`, error);
      return null;
    }
  },

  async generateWeeklyReport(ctx) {
    const tgId = ctx.from.id;
    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        await ctx.reply('Користувача не знайдено. Спробуйте /start');
        return;
      }

      const report = await generateReport(tgId, 7);
      if (report) {
        await ctx.reply('📊 Щотижневий AI-звіт готовий!');
        await ctx.reply(report);
        await saveReportToAirtable({
          tgId,
          userName: user['User Name'] || 'Користувач',
          period: 'Weekly',
          days: 7,
          reportText: report,
        });
      } else {
        await ctx.reply('📊 Не вдалося згенерувати звіт. Спробуйте пізніше.');
      }
    } catch (error) {
      console.error(`[analyticsController] Помилка генерації щотижневого звіту для ${tgId}:`, error);
      await ctx.reply('📊 Помилка при генерації звіту.');
    }
  },

  async generateMonthlyReport(ctx) {
    const tgId = ctx.from.id;
    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        await ctx.reply('Користувача не знайдено. Спробуйте /start');
        return;
      }

      const report = await generateReport(tgId, 30);
      if (report) {
        await ctx.reply('📈 Місячний AI-звіт готовий!');
        await ctx.reply(report);
        await saveReportToAirtable({
          tgId,
          userName: user['User Name'] || 'Користувач',
          period: 'Monthly',
          days: 30,
          reportText: report,
        });
      } else {
        await ctx.reply('📈 Не вдалося згенерувати звіт. Спробуйте пізніше.');
      }
    } catch (error) {
      console.error(`[analyticsController] Помилка генерації місячного звіту для ${tgId}:`, error);
      await ctx.reply('📈 Помилка при генерації звіту.');
    }
  },
};

export default analyticsController;
