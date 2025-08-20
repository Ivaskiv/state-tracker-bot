import cron from 'node-cron';
import dotenv from 'dotenv';
import Airtable from 'airtable';
import { startQuestions } from '../handlers/questionHandler.js';
import reportService from './reportService.js'; 

dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
let bot;

export default {
  initBot(b) {
    bot = b;
  },

  async setupScheduler() {
    async function getActiveUsers() {
      const records = await base('Users')
        .select({
          filterByFormula: "AND({Active_Subscription_Status} != '', {Status}='Active User')"
        })
        .all();
      return records.map(r => ({
        id: r.fields.TG_id,
        name: r.fields['User Name']
      }));
    }

    async function sendQuestionsToUser(user, type) {
      try {
        const ctx = {
          from: { id: user.id },
          session: {}
        };
        await startQuestions(ctx, type);
        console.log(`✅ Надіслано ${type} питання користувачу ${user.name}`);
      } catch (err) {
        console.error(`❌ Помилка при надсиланні ${type} питань ${user.name}:`, err);
      }
    }

    // Ранкові питання о 08:00
    cron.schedule('0 8 * * *', async () => {
      const users = await getActiveUsers();
      for (const user of users) await sendQuestionsToUser(user, 'morning');
    });

    // Вечірні питання о 20:30
    cron.schedule('30 20 * * *', async () => {
      const users = await getActiveUsers();
      for (const user of users) await sendQuestionsToUser(user, 'evening');
    });

    // Тижневий звіт о 21:00 щонеділі
    cron.schedule('0 21 * * 0', async () => {
      const users = await getActiveUsers();
      for (const user of users) {
        const report = await reportService.generateWeeklyReport(user.id);
        await bot.telegram.sendMessage(user.id, report);
        console.log(`📊 Надіслано тижневий звіт користувачу ${user.name}`);
      }
    });

// Місячний звіт о 22:00 останнього дня місяця
cron.schedule('0 22 * * *', async () => {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); 

  if (today.getDate() !== lastDay) return; 

  const users = await getActiveUsers();
  for (const user of users) {
    const report = await reportService.generateMonthlyReport(user.id);
    await bot.telegram.sendMessage(user.id, report);
    console.log(`📈 Надіслано місячний звіт користувачу ${user.name}`);
  }
});

    console.log('✅ Scheduler initialized');
  }
};
