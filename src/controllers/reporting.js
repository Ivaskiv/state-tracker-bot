import User from '../models/user.js';
import Record from '../models/record.js';
import * as analytics from '../services/analytics.js';

// Загальна функція для отримання звітів (щоденний, тижневий)
async function sendReport(ctx, period = 'daily') {
  const telegramId = ctx.from.id;
  
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('Спочатку потрібно зареєструватися. Використовуйте команду /start.');
    }

    const { startDate, endDate } = getPeriodDates(period);
    const records = await Record.find({
      telegramId,
      timestamp: { $gte: startDate, $lt: endDate }
    }).sort({ timestamp: 1 });

    if (records.length === 0) {
      return ctx.reply(`За ${period === 'daily' ? 'сьогодні' : 'остання тиждень'} ще немає записів.`);
    }

    const report = await analytics.generateReport(records, user, period);
    await ctx.reply(report);
  } catch (err) {
    console.error('Error generating report:', err);
    await ctx.reply('Вибачте, сталася помилка при створенні звіту. Спробуйте знову пізніше.');
  }
}

// Отримання дат для звітів
function getPeriodDates(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'daily') {
    return { startDate: today, endDate: new Date(today).setDate(today.getDate() + 1) };
  } else if (period === 'weekly') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { startDate: weekAgo, endDate: today };
  }
}

// Відправка щоденного звіту
async function sendDailyReport(ctx) {
  await sendReport(ctx, 'daily');
}

// Відправка тижневого звіту
async function sendWeeklyReport(ctx) {
  await sendReport(ctx, 'weekly');
}

export {
  sendDailyReport,
  sendWeeklyReport
};
