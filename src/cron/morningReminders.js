import cron from 'node-cron';
import { userService } from '../services/userService.js';
import { reflectionService } from '../services/reflectionService.js';
import { KEYBOARDS } from '../utils/messages.js';

export const startMorningReminders = (bot) => {
  // Run every day at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('Starting morning reminders...');
    
    try {
      const usersWithSubs = await userService.getUsersWithActiveSubscriptions();
      console.log(`Found ${usersWithSubs.length} users with active subscriptions`);
      
      let sentCount = 0;
      let errorCount = 0;
      
      for (const user of usersWithSubs) {
        try {
          // Check if user already completed morning reflection today
          const existingReflection = await reflectionService.findTodayReflection(
            user.telegram_id, 
            'morning'
          );
          
          if (existingReflection) {
            console.log(`User ${user.telegram_id} already completed morning reflection`);
            continue;
          }
          
          const message = `🌅 Доброго ранку, ${user.name}!

Час для ранкової рефлексії! Це займе лише 5 хвилин, але дасть тобі фокус на весь день.

Готова налаштуватися на успіх? 💪`;

          await bot.telegram.sendMessage(
            user.telegram_id, 
            message, 
            KEYBOARDS.MAIN_MENU
          );
          
          sentCount++;
          console.log(`Morning reminder sent to ${user.telegram_id}`);
          
          // Add delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Failed to send morning reminder to ${user.telegram_id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Morning reminders completed. Sent: ${sentCount}, Errors: ${errorCount}`);
      
      // Send summary to admin if configured
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `📊 Morning Reminders Summary:\n• Sent: ${sentCount}\n• Errors: ${errorCount}\n• Total users: ${usersWithSubs.length}`
        );
      }
      
    } catch (error) {
      console.error('Morning reminders job failed:', error);
      
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `❌ Morning reminders job failed: ${error.message}`
        );
      }
    }
  }, {
    timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Kiev'
  });
  
  console.log('Morning reminders cron job scheduled');
};