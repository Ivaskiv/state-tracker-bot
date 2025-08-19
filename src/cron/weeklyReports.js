import cron from 'node-cron';
import { userService } from '../services/userService.js';
import { aiAnalyticsService } from '../services/aiAnalyticsService.js';
import { reflectionService } from '../services/reflectionService.js';
import { getBase, TABLES } from '../config/database.js';

export const startWeeklyReports = (bot) => {
  // Run every Sunday at 19:00
  cron.schedule('0 19 * * 0', async () => {
    console.log('Starting weekly reports generation...');
    
    try {
      const usersWithSubs = await userService.getUsersWithActiveSubscriptions();
      console.log(`Generating weekly reports for ${usersWithSubs.length} users`);
      
      let sentCount = 0;
      let errorCount = 0;
      
      for (const user of usersWithSubs) {
        try {
          console.log(`Generating weekly report for user ${user.telegram_id}`);
          
          // Get user's reflections for the past week
          const reflectionsData = await reflectionService.getReflectionsForAnalysis(
            user.telegram_id, 
            7
          );
          
          if (reflectionsData.total_count === 0) {
            console.log(`User ${user.telegram_id} has no reflections this week, skipping report`);
            continue;
          }
          
          // Generate AI analysis
          const analysis = await aiAnalyticsService.generateWeeklyAnalysis(
            user.name,
            reflectionsData
          );
          
          // Save report to database
          await saveWeeklyReport(user, analysis, reflectionsData.total_count);
          
          // Send report to user
          await bot.telegram.sendMessage(
            user.telegram_id,
            analysis,
            { parse_mode: 'HTML' }
          );
          
          sentCount++;
          console.log(`Weekly report sent to ${user.telegram_id}`);
          
          // Add delay between messages
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Failed to generate/send weekly report for ${user.telegram_id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Weekly reports completed. Sent: ${sentCount}, Errors: ${errorCount}`);
      
      // Send summary to admin
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `📊 Weekly Reports Summary:\n• Sent: ${sentCount}\n• Errors: ${errorCount}\n• Total users: ${usersWithSubs.length}`
        );
      }
      
    } catch (error) {
      console.error('Weekly reports job failed:', error);
      
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `❌ Weekly reports job failed: ${error.message}`
        );
      }
    }
  }, {
    timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Kiev'
  });
  
  console.log('Weekly reports cron job scheduled');
};

async function saveWeeklyReport(user, reportContent, reflectionCount) {
  try {
    const base = getBase();
    
    // Get user record ID
    const userRecords = await base(TABLES.USERS)
      .select({
        filterByFormula: `{telegram_id} = "${user.telegram_id}"`
      })
      .firstPage();

    if (userRecords.length === 0) {
      throw new Error('User record not found');
    }

    const userRecordId = userRecords[0].id;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6); // 6 days ago = week start
    
    await base(TABLES.WEEKLY_REPORTS).create([
      {
        fields: {
          user_id: [userRecordId],
          week_start: weekStart.toISOString().split('T')[0],
          week_end: new Date().toISOString().split('T')[0],
          content: reportContent,
          reflections_count: reflectionCount,
          generated_at: new Date().toISOString()
        }
      }
    ]);
    
    console.log(`Weekly report saved for user ${user.telegram_id}`);
  } catch (error) {
    console.error('Save weekly report error:', error);
    // Don't throw - report was still sent to user
  }
}