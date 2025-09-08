// src/controllers/analyticsController.js
import userService from '../auth/services/userService.js';
import { generateReport, saveReportToAirtable } from '../dialogue/services/reportService.js';

const generateWeeklyReport = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    
    if (!user) {
      return ctx.reply('Спочатку зареєструйтесь /start');
    }

    const report = await generateReport(tgId, 7);
    
    await ctx.reply('📊 Твій щотижневий AI-звіт:');
    await ctx.reply(report);

    // Зберігаємо звіт
    await saveReportToAirtable(
      tgId, 
      user['User Name'] || 'Користувач', 
      'Weekly', 
      report, 
      7
    );

  } catch (error) {
    console.error('[analyticsController] Помилка щотижневого звіту:', error);
    await ctx.reply('❌ Помилка при створенні звіту. Спробуйте пізніше.');
  }
};

const generateMonthlyReport = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    
    if (!user) {
      return ctx.reply('Спочатку зареєструйтесь /start');
    }

    const report = await generateReport(tgId, 30);
    
    await ctx.reply('📈 Твій щомісячний AI-звіт:');
    await ctx.reply(report);

    // Зберігаємо звіт
    await saveReportToAirtable(
      tgId, 
      user['User Name'] || 'Користувач', 
      'Monthly', 
      report, 
      30
    );

  } catch (error) {
    console.error('[analyticsController] Помилка місячного звіту:', error);
    await ctx.reply('❌ Помилка при створенні звіту. Спробуйте пізніше.');
  }
};

const generateWeeklyReportForUser = async (tgId) => {
  try {
    const report = await generateReport(tgId, 7);
    const user = await userService.getUserByTelegramId(tgId);
    
    if (user) {
      await saveReportToAirtable(
        tgId, 
        user['User Name'] || 'Користувач', 
        'Weekly', 
        report, 
        7
      );
    }
    
    return report;
  } catch (error) {
    console.error('[analyticsController] Помилка генерації щотижневого звіту:', error);
    return null;
  }
};

const generateMonthlyReportForUser = async (tgId) => {
  try {
    const report = await generateReport(tgId, 30);
    const user = await userService.getUserByTelegramId(tgId);
    
    if (user) {
      await saveReportToAirtable(
        tgId, 
        user['User Name'] || 'Користувач', 
        'Monthly', 
        report, 
        30
      );
    }
    
    return report;
  } catch (error) {
    console.error('[analyticsController] Помилка генерації місячного звіту:', error);
    return null;
  }
};

export default {
  generateWeeklyReport,
  generateMonthlyReport,
  generateWeeklyReportForUser,
  generateMonthlyReportForUser
};