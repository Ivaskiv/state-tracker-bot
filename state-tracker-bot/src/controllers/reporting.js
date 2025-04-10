// Файл controllers/reporting.js
import User from '../models/user.js';
import Record from '../models/record.js';
import * as analytics from '../services/analytics.js';

// Відправка щоденного звіту
async function sendDailyReport(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start.');
    }
    
    // Отримання даних за сьогодні
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const records = await Record.find({
      telegramId,
      timestamp: { $gte: today, $lt: tomorrow }
    }).sort({ timestamp: 1 });
    
    if (records.length === 0) {
      return ctx.reply('За сьогодні ще немає записів. Пройдіть опитування, використовуючи команду /poll.');
    }
    
    // Аналіз даних
    const report = await analytics.generateDailyReport(records, user);
    
    await ctx.reply(report);
  } catch (err) {
    console.error('Error generating daily report:', err);
    await ctx.reply('Вибачте, сталася помилка при створенні звіту. Спробуйте знову пізніше.');
  }
}

// Відправка тижневого звіту
async function sendWeeklyReport(ctx) {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start.');
    }
    
    // Отримання даних за тиждень
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const records = await Record.find({
      telegramId,
      timestamp: { $gte: weekAgo, $lt: today }
    }).sort({ timestamp: 1 });
    
    if (records.length === 0) {
      return ctx.reply('За останній тиждень немає записів. Пройдіть опитування, використовуючи команду /poll.');
    }
    
    // Аналіз даних
    const report = await analytics.generateWeeklyReport(records, user);
    
    await ctx.reply(report);
  } catch (err) {
    console.error('Error generating weekly report:', err);
    await ctx.reply('Вибачте, сталася помилка при створенні звіту. Спробуйте знову пізніше.');
  }
}

export {
  sendDailyReport,
  sendWeeklyReport
};
