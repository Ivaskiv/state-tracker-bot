// services/schedulerService.js
import cron from 'node-cron';
import { AirtableService } from './airtableService.js';
import { AIAnalytics } from './aiAnalytics.js';
import { telegramBot } from './telegramBot.js';
import { QuestionHandler } from '../handlers/questionHandler.js';
import moment from 'moment-timezone';

export function startScheduler() {
  console.log('🕐 Starting scheduler...');
  
  // Ранкові нагадування о 08:00 (кожен день)
  cron.schedule('0 8 * * *', async () => {
    console.log('📅 Running morning reminders...');
    await sendMorningReminders();
  }, {
    timezone: 'Europe/Kiev'
  });

  // Вечірні нагадування о 20:30 (кожен день)
  cron.schedule('30 20 * * *', async () => {
    console.log('📅 Running evening reminders...');
    await sendEveningReminders();
  }, {
    timezone: 'Europe/Kiev'
  });

  // Щотижневі звіти (неділя о 19:00)
  cron.schedule('0 19 * * 0', async () => {
    console.log('📅 Generating weekly reports...');
    await sendWeeklyReports();
  }, {
    timezone: 'Europe/Kiev'
  });

  // Щомісячні звіти (1-го числа о 12:00)
  cron.schedule('0 12 1 * *', async () => {
    console.log('📅 Generating monthly reports...');
    await sendMonthlyReports();
  }, {
    timezone: 'Europe/Kiev'
  });

  console.log('⏰ Scheduler started successfully');
}

async function sendMorningReminders() {
  try {
    const activeUsers = await AirtableService.getActiveUsers();
    console.log(`📨 Sending morning reminders to ${activeUsers.length} users`);

    for (const user of activeUsers) {
      const telegramId = user.get('TG_id');
      const userName = user.get('User Name');
      
      if (telegramId) {
        try {
          await QuestionHandler.startMorningQuestions(telegramBot.bot, telegramId, user);
          await new Promise(resolve => setTimeout(resolve, 100)); // Невелика затримка між повідомленнями
        } catch (error) {
          console.error(`Error sending morning reminder to ${userName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in morning reminders:', error);
  }
}

async function sendEveningReminders() {
  try {
    const activeUsers = await AirtableService.getActiveUsers();
    console.log(`📨 Sending evening reminders to ${activeUsers.length} users`);

    for (const user of activeUsers) {
      const telegramId = user.get('TG_id');
      const userName = user.get('User Name');
      
      if (telegramId) {
        try {
          await QuestionHandler.startEveningQuestions(telegramBot.bot, telegramId, user);
          await new Promise(resolve => setTimeout(resolve, 100)); // Невелика затримка між повідомленнями
        } catch (error) {
          console.error(`Error sending evening reminder to ${userName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in evening reminders:', error);
  }
}

async function sendWeeklyReports() {
  try {
    const activeUsers = await AirtableService.getActiveUsers();
    console.log(`📈 Generating weekly reports for ${activeUsers.length} users`);

    for (const user of activeUsers) {
      const telegramId = user.get('TG_id');
      const userName = user.get('User Name');
      
      if (telegramId) {
        try {
          // Отримуємо дані за тиждень
          const weeklyData = await AirtableService.getUserReflectionsForAnalysis(user.id, 7);
          
          if (weeklyData.length >= 3) { // Мінімум 3 дні для звіту
            const reportData = weeklyData.map(record => ({
              energyLoss: record.get('Energy Loss'),
              programs: record.get('Programs'),
              victory: record.get('Victory'),
              energyGain: record.get('Energy Gain'),
              state: record.get('State'),
              goal: record.get('Goal')
            }));

            const weeklyReport = await AIAnalytics.generateWeeklyReport(reportData);
            
            const message = `📊 **ТВІЙ ЩОТИЖНЕВИЙ ЗВІТ**

${weeklyReport}

💡 Цей звіт допоможе тобі краще зрозуміти свої шаблони та зробити наступний тиждень ще більш ефективним!`;

            await telegramBot.bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
            
            // Зберігаємо звіт в User Reflections
            await AirtableService.saveUserReflection({
              userName: userName,
              userId: user.id,
              telegramId: telegramId,
              questionType: 'Weekly Report',
              userResponse: 'Auto-generated weekly report',
              aiAnalytics: weeklyReport,
              affirmation: await AIAnalytics.generateAffirmation()
            });

          } else {
            // Мотиваційне повідомлення для неактивних користувачів
            const motivationMessage = `📊 **ЩОТИЖНЕВИЙ НАГАДУВАННЯ**

${userName}, цього тижня ти відповіла на питання лише ${weeklyData.length} разів.

💪 **Для отримання детального AI-аналізу потрібно:**
• Відповідати на ранкові питання щодня
• Не пропускати вечірні рефлексії
• Мінімум 3 дні активності на тиждень

🎯 **Наступного тижня спробуй:**
• Встановити нагадування на телефоні
• Відповідати одразу після отримання повідомлення
• Навіть короткі відповіді краще за пропуски

✨ Ти можеш це зробити! Твоя трансформація залежить від щоденних кроків.`;

            await telegramBot.bot.sendMessage(telegramId, motivationMessage, { parse_mode: 'Markdown' });
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error sending weekly report to ${userName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in weekly reports:', error);
  }
}

async function sendMonthlyReports() {
  try {
    const activeUsers = await AirtableService.getActiveUsers();
    console.log(`📈 Generating monthly reports for ${activeUsers.length} users`);

    for (const user of activeUsers) {
      const telegramId = user.get('TG_id');
      const userName = user.get('User Name');
      
      if (telegramId) {
        try {
          // Отримуємо дані за місяць
          const monthlyData = await AirtableService.getUserReflectionsForAnalysis(user.id, 30);
          
          if (monthlyData.length >= 10) { // Мінімум 10 днів для місячного звіту
            const reportData = monthlyData.map(record => ({
              energyLoss: record.get('Energy Loss'),
              programs: record.get('Programs'),
              victory: record.get('Victory'),
              energyGain: record.get('Energy Gain'),
              state: record.get('State'),
              goal: record.get('Goal')
            }));

            const monthlyReport = await AIAnalytics.generateMonthlyReport(reportData);
            
            const message = `🌟 **ТВІЙ МІСЯЧНИЙ ЗВІТ**

${monthlyReport}

🎉 **Статистика місяця:**
• Днів активності: ${monthlyData.length}/30
• Відповідей загалом: ${monthlyData.length}
• Прогрес: ${Math.round((monthlyData.length/30)*100)}%

🚀 Продовжуй рухатися до своїх цілей! Кожен день має значення.`;

            await telegramBot.bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
            
            // Зберігаємо звіт в User Reflections
            await AirtableService.saveUserReflection({
              userName: userName,
              userId: user.id,
              telegramId: telegramId,
              questionType: 'Monthly Report',
              userResponse: 'Auto-generated monthly report',
              aiAnalytics: monthlyReport,
              affirmation: await AIAnalytics.generateAffirmation()
            });

          } else {
            // Мотиваційне повідомлення
            const currentMonth = moment().format('MMMM');
            const motivationMessage = `📈 **ПІДСУМКИ МІСЯЦЯ ${currentMonth.toUpperCase()}**

${userName}, за цей місяць ти була активна ${monthlyData.length} днів з 30.

💡 **Для трансформації потрібна постійність:**
${monthlyData.length >= 15 ? '🟢 Добрий результат! Продовжуй в тому ж темпі' : '🟡 Спробуй бути більш постійною'}

🎯 **План на наступний місяць:**
• Ціль: мінімум 20 днів активності
• Стратегія: відповідай відразу після нагадування
• Результат: отримаєш детальний AI-аналіз

✨ Кожен новий місяць — це новий шанс стати кращою версією себе!`;

            await telegramBot.bot.sendMessage(telegramId, motivationMessage, { parse_mode: 'Markdown' });
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error sending monthly report to ${userName}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in monthly reports:', error);
  }
}

// Функція для ручного тестування нагадувань
export async function testReminders(type = 'morning') {
  console.log(`🧪 Testing ${type} reminders...`);
  
  if (type === 'morning') {
    await sendMorningReminders();
  } else if (type === 'evening') {
    await sendEveningReminders();
  } else if (type === 'weekly') {
    await sendWeeklyReports();
  } else if (type === 'monthly') {
    await sendMonthlyReports();
  }
}