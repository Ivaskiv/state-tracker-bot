import cron from 'node-cron';
import { userService } from '../services/userService.js';
import { reflectionService } from '../services/reflectionService.js';
import { KEYBOARDS } from '../utils/messages.js';

export const startEveningReminders = (bot) => {
  // Run every day at 20:30
  cron.schedule('30 20 * * *', async () => {
    console.log('Starting evening reminders...');
    
    try {
      const usersWithSubs = await userService.getUsersWithActiveSubscriptions();
      console.log(`Found ${usersWithSubs.length} users with active subscriptions`);
      
      let sentCount = 0;
      let errorCount = 0;
      
      for (const user of usersWithSubs) {
        try {
          // Check if user already completed evening reflection today
          const existingReflection = await reflectionService.findTodayReflection(
            user.telegram_id, 
            'evening'
          );
          
          if (existingReflection) {
            console.log(`User ${user.telegram_id} already completed evening reflection`);
            continue;
          }
          
          const message = `🌙 Добрий вечір, ${user.name}!

Час підвести підсумки дня та зафіксувати свої перемоги! 

Вечірня рефлексія допоможе тобі усвідомити прогрес і підготуватися до завтрашнього дня.

Готова? ✨`;

          await bot.telegram.sendMessage(
            user.telegram_id, 
            message, 
            KEYBOARDS.MAIN_MENU
          );
          
          sentCount++;
          console.log(`Evening reminder sent to ${user.telegram_id}`);
          
          // Add delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Failed to send evening reminder to ${user.telegram_id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Evening reminders completed. Sent: ${sentCount}, Errors: ${errorCount}`);
      
      // Send summary to admin if configured
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `📊 Evening Reminders Summary:\n• Sent: ${sentCount}\n• Errors: ${errorCount}\n• Total users: ${usersWithSubs.length}`
        );
      }
      
    } catch (error) {
      console.error('Evening reminders job failed:', error);
      
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `❌ Evening reminders job failed: ${error.message}`
        );
      }
    }
  }, {
    timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Kiev'
  });
  
  console.log('Evening reminders cron job scheduled');
};