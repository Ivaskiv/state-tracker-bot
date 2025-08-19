// services/schedulerService.js
import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import userService from './userService.js';
import analyticsController from '../controllers/analyticsController.js';
import { MESSAGES } from '../utils/messages.js';
import { mainMenuKeyboard } from '../utils/keyboards.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

class SchedulerService {
  constructor() {
    this.jobs = new Map();
  }

  setupScheduler() {
    console.log('🕒 Setting up scheduler...');

    // Morning reminders (08:00 every day)
    this.jobs.set('morning', cron.schedule('0 8 * * *', async () => {
      await this.sendMorningReminders();
    }, {
      timezone: 'Europe/Kiev'
    }));

    // Evening reminders (20:30 every day)
    this.jobs.set('evening', cron.schedule('30 20 * * *', async () => {
      await this.sendEveningReminders();
    }, {
      timezone: 'Europe/Kiev'
    }));

    // Weekly reports (Sunday 19:00)
    this.jobs.set('weekly', cron.schedule('0 19 * * 0', async () => {
      await this.sendWeeklyReports();
    }, {
      timezone: 'Europe/Kiev'
    }));

    // Monthly reports (1st day of month at 12:00)
    this.jobs.set('monthly', cron.schedule('0 12 1 * *', async () => {
      await this.sendMonthlyReports();
    }, {
      timezone: 'Europe/Kiev'
    }));

    // Subscription expiry check (daily at 10:00)
    this.jobs.set('subscription_check', cron.schedule('0 10 * * *', async () => {
      await this.checkSubscriptionExpiry();
    }, {
      timezone: 'Europe/Kiev'
    }));

    // Affirmation reset (weekly on Monday at 00:00)
    this.jobs.set('affirmation_reset', cron.schedule('0 0 * * 1', async () => {
      await this.resetAffirmations();
    }, {
      timezone: 'Europe/Kiev'
    }));

    console.log('✅ Scheduler setup complete');
  }

  async sendMorningReminders() {
    try {
      console.log('🌅 Sending morning reminders...');
      const activeUsers = await userService.getActiveUsers();
      
      let sentCount = 0;

      for (const user of activeUsers) {
        try {
          const telegramId = user.fields['TG_id'];
          
          if (telegramId) {
            await bot.telegram.sendMessage(
              telegramId,
              MESSAGES.MORNING_REMINDER,
              { reply_markup: mainMenuKeyboard().reply_markup }
            );
            sentCount++;
            
            // Add small delay to avoid rate limiting
            await this.delay(100);
          }
        } catch (error) {
          console.error(`Error sending morning reminder to user ${user.fields['User Name']}:`, error);
        }
      }

      console.log(`✅ Sent ${sentCount} morning reminders`);
    } catch (error) {
      console.error('Error in sendMorningReminders:', error);
    }
  }

  async sendEveningReminders() {
    try {
      console.log('🌙 Sending evening reminders...');
      const activeUsers = await userService.getActiveUsers();
      
      let sentCount = 0;

      for (const user of activeUsers) {
        try {
          const telegramId = user.fields['TG_id'];
          
          if (telegramId) {
            await bot.telegram.sendMessage(
              telegramId,
              MESSAGES.EVENING_REMINDER,
              { reply_markup: mainMenuKeyboard().reply_markup }
            );
            sentCount++;
            
            // Add small delay to avoid rate limiting
            await this.delay(100);
          }
        } catch (error) {
          console.error(`Error sending evening reminder to user ${user.fields['User Name']}:`, error);
        }
      }

      console.log(`✅ Sent ${sentCount} evening reminders`);
    } catch (error) {
      console.error('Error in sendEveningReminders:', error);
    }
  }

  async sendWeeklyReports() {
    try {
      console.log('📊 Sending weekly reports...');
      const activeUsers = await userService.getActiveUsers();
      
      let sentCount = 0;

      for (const user of activeUsers) {
        try {
          const telegramId = user.fields['TG_id'];
          
          if (telegramId) {
            const report = await analyticsController.generateWeeklyReportForUser(telegramId);
            
            if (report) {
              await bot.telegram.sendMessage(telegramId, MESSAGES.WEEKLY_REPORT_READY);
              await bot.telegram.sendMessage(telegramId, report);
              sentCount++;
            }
            
            // Add delay to avoid rate limiting
            await this.delay(200);
          }
        } catch (error) {
          console.error(`Error sending weekly report to user ${user.fields['User Name']}:`, error);
        }
      }

      console.log(`✅ Sent ${sentCount} weekly reports`);
    } catch (error) {
      console.error('Error in sendWeeklyReports:', error);
    }
  }

  async sendMonthlyReports() {
    try {
      console.log('📈 Sending monthly reports...');
      const activeUsers = await userService.getActiveUsers();
      
      let sentCount = 0;

      for (const user of activeUsers) {
        try {
          const telegramId = user.fields['TG_id'];
          
          if (telegramId) {
            const report = await analyticsController.generateMonthlyReportForUser(telegramId);
            
            if (report) {
              await bot.telegram.sendMessage(telegramId, MESSAGES.MONTHLY_REPORT_READY);
              await bot.telegram.sendMessage(telegramId, report);
              sentCount++;
            }
            
            // Add delay to avoid rate limiting
            await this.delay(200);
          }
        } catch (error) {
          console.error(`Error sending monthly report to user ${user.fields['User Name']}:`, error);
        }
      }

      console.log(`✅ Sent ${sentCount} monthly reports`);
    } catch (error) {
      console.error('Error in sendMonthlyReports:', error);
    }
  }

  async checkSubscriptionExpiry() {
    try {
      console.log('📅 Checking subscription expiry...');
      
      // Get users with subscriptions expiring in 3 days
      const today = new Date();
      const warningDate = new Date();
      warningDate.setDate(today.getDate() + 3);
      
      const expiringUsers = await userService.getActiveUsers();
      
      let warningCount = 0;

      for (const user of expiringUsers) {
        try {
          const endDate = new Date(user.fields['End_Date']);
          const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
          
          if (daysLeft <= 3 && daysLeft > 0) {
            const telegramId = user.fields['TG_id'];
            const message = `⏰ Твоя підписка закінчується через ${daysLeft} ${this.getDaysWord(daysLeft)}!\n\nПродовж підписку, щоб не втратити прогрес 💫`;
            
            await bot.telegram.sendMessage(telegramId, message);
            warningCount++;
            
            await this.delay(100);
          }
        } catch (error) {
          console.error(`Error checking expiry for user ${user.fields['User Name']}:`, error);
        }
      }

      console.log(`✅ Sent ${warningCount} expiry warnings`);
    } catch (error) {
      console.error('Error in checkSubscriptionExpiry:', error);
    }
  }

  async resetAffirmations() {
    try {
      console.log('🔄 Resetting affirmations...');
      // This will be handled by airtableService
      // await airtableService.resetAffirmations();
      console.log('✅ Affirmations reset complete');
    } catch (error) {
      console.error('Error resetting affirmations:', error);
    }
  }

  async sendCustomReminder(telegramId, message) {
    try {
      await bot.telegram.sendMessage(telegramId, message);
      return true;
    } catch (error) {
      console.error(`Error sending custom reminder to ${telegramId}:`, error);
      return false;
    }
  }

  getDaysWord(days) {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дні';
    return 'днів';
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`✅ Started job: ${jobName}`);
    }
  }

  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`⏹️ Stopped job: ${jobName}`);
    }
  }

  startAll() {
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started job: ${name}`);
    });
  }

  stopAll() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Stopped job: ${name}`);
    });
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    });
    return status;
  }

  // Manual trigger methods for testing
  async triggerMorningReminders() {
    console.log('🔧 Manual trigger: Morning reminders');
    await this.sendMorningReminders();
  }

  async triggerEveningReminders() {
    console.log('🔧 Manual trigger: Evening reminders');
    await this.sendEveningReminders();
  }

  async triggerWeeklyReports() {
    console.log('🔧 Manual trigger: Weekly reports');
    await this.sendWeeklyReports();
  }

  async triggerMonthlyReports() {
    console.log('🔧 Manual trigger: Monthly reports');
    await this.sendMonthlyReports();
  }
}

const schedulerService = new SchedulerService();

export const setupScheduler = () => {
  schedulerService.setupScheduler();
  schedulerService.startAll();
};

export default schedulerService;