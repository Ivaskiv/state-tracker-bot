import cron from 'node-cron';
import { 
  getActiveUsers,
  getTodayMorningResponse,
  getTodayEveningResponse,
  createMorningResponse,
  createEveningResponse,
  getUserReflections,
  updateMorningResponse,
  updateEveningResponse
} from './airtable.js';
import { generateWeeklyReport, generateMonthlyReport } from './reports.js';
import { generateAIAnalytics } from './ai.js';

async function safeSend(bot, tgId, message) {
  if (!tgId || !message) return;
  try {
    await bot.telegram.sendMessage(tgId, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error(`Помилка при надсиланні повідомлення ${tgId}:`, err);
  }
}

function generateReminderKey(user, type) {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g,'');
  return `${user.fields['User Name']}_${user.fields.TG_id}_${dateStr}_${type}`;
}

export async function initScheduler(bot) {
  console.log('🗓️ Scheduler initializing...');

  // ===== Ранкові повідомлення =====
  cron.schedule('0 8 * * *', async () => {
    const users = await getActiveUsers();
    for (const user of users) {
      if (!user.fields['Active Subscription Plan'] || !user.fields['Active_Subscription_Status']?.includes('✅')) continue;

      const reminderKey = generateReminderKey(user, 'Morning');
      const todayResponse = await getTodayMorningResponse(user.fields.TG_id);
      if (todayResponse && todayResponse.fields['Reminder Key Morning'] === reminderKey) continue;

      const reflections = await getUserReflections(user.fields.TG_id, 'Morning');
      const aiResult = await generateAIAnalytics(reflections, 'Morning'); // повертає { affirmation, analyticsMessage }

      await safeSend(bot, user.fields.TG_id, `☀️ Ранок:\n${aiResult.affirmation}\n\n${aiResult.analyticsMessage}`);

      await createMorningResponse({
        user_id: user.fields.TG_id,
        user_name: user.fields['User Name'],
        date: new Date().toISOString().split('T')[0],
        'Reminder Key Morning': reminderKey,
        Affirmation: aiResult.affirmation,
        AI_Analytics: aiResult.analyticsMessage
      });
    }
  });

  // ===== Вечірні повідомлення =====
  cron.schedule('30 20 * * *', async () => {
    const users = await getActiveUsers();
    for (const user of users) {
      if (!user.fields['Active Subscription Plan'] || !user.fields['Active_Subscription_Status']?.includes('✅')) continue;

      const reminderKey = generateReminderKey(user, 'Evening');
      const todayResponse = await getTodayEveningResponse(user.fields.TG_id);
      if (todayResponse && todayResponse.fields['Reminder Key Evening'] === reminderKey) continue;

      const reflections = await getUserReflections(user.fields.TG_id, 'Evening');
      const aiResult = await generateAIAnalytics(reflections, 'Evening');

      await safeSend(bot, user.fields.TG_id, `🌙 Вечір:\n${aiResult.affirmation}\n\n${aiResult.analyticsMessage}`);

      await createEveningResponse({
        user_id: user.fields.TG_id,
        user_name: user.fields['User Name'],
        date: new Date().toISOString().split('T')[0],
        'Reminder Key Evening': reminderKey,
        Affirmation: aiResult.affirmation,
        AI_Analytics: aiResult.analyticsMessage
      });
    }
  });

  // ===== Щотижневий та щомісячний звіт =====
  cron.schedule('0 21 * * 0', async () => { // неділя 21:00
    const users = await getActiveUsers();
    for (const user of users) {
      if (!user.fields['Active Subscription Plan'] || !user.fields['Active_Subscription_Status']?.includes('✅')) continue;
      const report = await generateWeeklyReport(user.fields.TG_id);
      await safeSend(bot, user.fields.TG_id, `📊 Щотижневий звіт:\n${report}`);
    }
  });

  cron.schedule('0 21 28-31 * *', async () => { // кінець місяця
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (tomorrow.getMonth() !== today.getMonth()) {
      const users = await getActiveUsers();
      for (const user of users) {
        if (!user.fields['Active Subscription Plan'] || !user.fields['Active_Subscription_Status']?.includes('✅')) continue;
        const report = await generateMonthlyReport(user.fields.TG_id);
        await safeSend(bot, user.fields.TG_id, `📅 Щомісячний звіт:\n${report}`);
      }
    }
  });

  console.log('🗓️ Scheduler initialized with AI integration');
}
