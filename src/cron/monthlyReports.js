import cron from 'node-cron';
import { userService } from '../services/userService.js';
import { aiAnalyticsService } from '../services/aiAnalyticsService.js';
import { reflectionService } from '../services/reflectionService.js';
import { getBase, TABLES } from '../config/database.js';

export const startMonthlyReports = (bot) => {
  // Run on the 1st day of every month at 12:00
  cron.schedule('0 12 1 * *', async () => {
    console.log('Starting monthly reports generation...');
    
    try {
      const usersWithSubs = await userService.getUsersWithActiveSubscriptions();
      console.log(`Generating monthly reports for ${usersWithSubs.length} users`);
      
      let sentCount = 0;
      let errorCount = 0;
      
      for (const user of usersWithSubs) {
        try {
          console.log(`Generating monthly report for user ${user.telegram_id}`);
          
          // Get user's reflections for the past month
          const reflectionsData = await reflectionService.getReflectionsForAnalysis(
            user.telegram_id, 
            30
          );
          
          if (reflectionsData.total_count < 5) {
            console.log(`User ${user.telegram_id} has insufficient reflections for monthly analysis, skipping`);
            continue;
          }
          
          // Generate comprehensive monthly AI analysis
          const analysis = await aiAnalyticsService.generateMonthlyAnalysis(
            user.name,
            reflectionsData
          );
          
          // Save report to database
          await saveMonthlyReport(user, analysis, reflectionsData.total_count);
          
          // Send report to user
          await bot.telegram.sendMessage(
            user.telegram_id,
            analysis,
            { parse_mode: 'HTML' }
          );
          
          // Send to email if available
          if (user.email && analysis.length < 2000) {
            // In production, integrate with email service
            console.log(`Monthly report would be sent to email: ${user.email}`);
          }
          
          sentCount++;
          console.log(`Monthly report sent to ${user.telegram_id}`);
          
          // Add delay between messages
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.error(`Failed to generate/send monthly report for ${user.telegram_id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Monthly reports completed. Sent: ${sentCount}, Errors: ${errorCount}`);
      
      // Send summary to admin
      if (process.env.ADMIN_CHAT_ID) {
        const now = new Date();
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const monthName = new Date(now.getFullYear(), lastMonth).toLocaleDateString('uk-UA', { month: 'long' });
        
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `📊 Monthly Reports Summary (${monthName}):\n• Sent: ${sentCount}\n• Errors: ${errorCount}\n• Total users: ${usersWithSubs.length}`
        );
      }
      
    } catch (error) {
      console.error('Monthly reports job failed:', error);
      
      if (process.env.ADMIN_CHAT_ID) {
        await bot.telegram.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `❌ Monthly reports job failed: ${error.message}`
        );
      }
    }
  }, {
    timezone: process.env.DEFAULT_TIMEZONE || 'Europe/Kiev'
  });
  
  console.log('Monthly reports cron job scheduled');
};

async function saveMonthlyReport(user, reportContent, reflectionCount) {
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
    
    await base(TABLES.MONTHLY_REPORTS).create([
      {
        fields: {
          user_id: [userRecordId],
          month_start: monthStart.toISOString().split('T')[0],
          month_end: monthEnd.toISOString().split('T')[0],
          content: reportContent,
          reflections_count: reflectionCount,
          generated_at: new Date().toISOString()
        }
      }
    ]);
    
    console.log(`Monthly report saved for user ${user.telegram_id}`);
  } catch (error) {
    console.error('Save monthly report error:', error);
    // Don't throw - report was still sent to user
  }
}