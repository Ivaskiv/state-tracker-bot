// controllers/analyticsController.js
import responseService from '../services/responseService.js';
import aiAnalyticsService from '../services/aiAnalyticsService.js';
import userService from '../services/userService.js';
import { MESSAGES } from '../utils/messages.js';

class AnalyticsController {
  async generateWeeklyReport(ctx) {
    try {
      const telegramId = ctx.from.id;
      const report = await this.generateWeeklyReportForUser(telegramId);
      
      if (report) {
        await ctx.reply(report);
      } else {
        await ctx.reply(MESSAGES.NO_DATA_FOR_REPORT);
      }
    } catch (error) {
      console.error('Error generating weekly report:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async generateMonthlyReport(ctx) {
    try {
      const telegramId = ctx.from.id;
      const report = await this.generateMonthlyReportForUser(telegramId);
      
      if (report) {
        await ctx.reply(report);
      } else {
        await ctx.reply(MESSAGES.NO_DATA_FOR_REPORT);
      }
    } catch (error) {
      console.error('Error generating monthly report:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async generateWeeklyReportForUser(telegramId) {
    try {
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) return null;

      // ✅ Отримуємо записи за тиждень з нової структури
      const weeklyRecords = await responseService.getUserRecords(telegramId, 7);
      
      if (weeklyRecords.length === 0) {
        return null;
      }

      // ✅ Аналізуємо шаблоні з нової структури
      const patterns = this.analyzePatterns(weeklyRecords);
      
      // Генеруємо AI аналіз якщо доступний
      let aiAnalysis = '';
      try {
        const weeklyData = this.prepareWeeklyData(weeklyRecords);
        aiAnalysis = await aiAnalyticsService.generateWeeklyAnalysis(weeklyData);
      } catch (error) {
        console.error('AI analysis failed, using fallback');
        aiAnalysis = this.generateFallbackWeeklyAnalysis(patterns, weeklyRecords);
      }

      const userName = user['User Name'];
      const completedDays = weeklyRecords.length;
      const completionRate = Math.round((completedDays / 7) * 100);

      // Підраховуємо завершені сесії
      let morningCompleted = 0;
      let eveningCompleted = 0;
      weeklyRecords.forEach(record => {
        if (record.fields.morning_completed) morningCompleted++;
        if (record.fields.evening_completed) eveningCompleted++;
      });

      const report = `📊 ЩОТИЖНЕВИЙ ЗВІТ

Привіт, ${userName}! 🌱
Ось твій AI-звіт за останній тиждень:

📈 СТАТИСТИКА:
• Днів з рефлексіями: ${completedDays}/7
• Ранкових сесій: ${morningCompleted}
• Вечірніх сесій: ${eveningCompleted}
• Відсоток виконання: ${completionRate}%

${aiAnalysis}

🎯 РЕКОМЕНДАЦІЇ НА НАСТУПНИЙ ТИЖДЕНЬ:
• Продовжуй щоденну практику рефлексії
• Звертай увагу на повторювані шаблони
• Фокусуйся на своїх сильних сторонах

✨ Пам'ятай: кожен день - це можливість стати кращою версією себе!`;

      return report;
    } catch (error) {
      console.error('Error generating weekly report for user:', error);
      return null;
    }
  }

  async generateMonthlyReportForUser(telegramId) {
    try {
      const user = await userService.getUserByTelegramId(telegramId);
      if (!user) return null;

      // ✅ Отримуємо записи за місяць
      const monthlyRecords = await responseService.getUserRecords(telegramId, 30);
      
      if (monthlyRecords.length === 0) {
        return null;
      }

      // ✅ Аналізуємо шаблони
      const patterns = this.analyzePatterns(monthlyRecords);
      
      // Генеруємо AI аналіз
      let aiAnalysis = '';
      try {
        const monthlyData = this.prepareMonthlyData(monthlyRecords);
        aiAnalysis = await aiAnalyticsService.generateMonthlyAnalysis(monthlyData);
      } catch (error) {
        console.error('AI analysis failed, using fallback');
        aiAnalysis = this.generateFallbackMonthlyAnalysis(patterns, monthlyRecords);
      }

      const userName = user['User Name'];
      const completedDays = monthlyRecords.length;
      const completionRate = Math.round((completedDays / 30) * 100);

      // Підраховуємо завершені сесії
      let morningCompleted = 0;
      let eveningCompleted = 0;
      monthlyRecords.forEach(record => {
        if (record.fields.morning_completed) morningCompleted++;
        if (record.fields.evening_completed) eveningCompleted++;
      });

      const report = `📈 ЩОМІСЯЧНИЙ ЗВІТ

Привіт, ${userName}! 🌟
Ось твій AI-звіт за місяць:

📊 СТАТИСТИКА МІСЯЦЯ:
• Днів з рефлексіями: ${completedDays}/30
• Ранкових сесій: ${morningCompleted}
• Вечірніх сесій: ${eveningCompleted}
• Відсоток виконання: ${completionRate}%

${aiAnalysis}

🚀 СТРАТЕГІЯ НА НОВИЙ МІСЯЦЬ:
• Підвищ регулярність до ${Math.min(completionRate + 10, 100)}%
• Поглибь самоаналіз у виявлених сферах
• Використовуй свої сильні сторони

💎 Твоя трансформація - це процес. Продовжуй рухатися вперед!`;

      return report;
    } catch (error) {
      console.error('Error generating monthly report for user:', error);
      return null;
    }
  }

  // ✅ Оновлена функція підготовки даних для аналізу
  prepareWeeklyData(records) {
    const data = {
      completedDays: records.length,
      totalRecords: records.length,
      patterns: this.analyzePatterns(records)
    };
    
    return data;
  }

  prepareMonthlyData(records) {
    const data = {
      completedDays: records.length,
      totalRecords: records.length,
      patterns: this.analyzePatterns(records)
    };
    
    return data;
  }

  // ✅ Оновлена функція аналізу шаблонів для нової структури
  analyzePatterns(records) {
    const patterns = {
      energyGains: [],
      energyLosses: [],
      programs: [],
      states: [],
      victories: []
    };

    // Збираємо всі відповіді по категоріях
    const energyGains = [];
    const energyLosses = [];
    const programs = [];
    const states = [];
    const victories = [];

    records.forEach(record => {
      const fields = record.fields;
      
      // Енергія (вечірнє питання 1)
      if (fields.Q_e_1) energyGains.push(fields.Q_e_1);
      
      // Втрата енергії (вечірнє питання 2)
      if (fields.Q_e_2) energyLosses.push(fields.Q_e_2);
      
      // Програми (вечірнє питання 3)
      if (fields.Q_e_3) programs.push(fields.Q_e_3);
      
      // Стани (ранкове питання 5)
      if (fields.Q_m_5) states.push(fields.Q_m_5);
      
      // Перемоги (вечірнє питання 5)
      if (fields.Q_e_5) victories.push(fields.Q_e_5);
    });

    // Аналізуємо частоту згадувань
    patterns.energyGains = this.getTopPatterns(energyGains);
    patterns.energyLosses = this.getTopPatterns(energyLosses);
    patterns.programs = this.getTopPatterns(programs);
    patterns.states = this.getTopPatterns(states);
    patterns.victories = this.getTopPatterns(victories);

    return patterns;
  }

  // Функція для виділення найчастіших шаблонів
  getTopPatterns(data) {
    const frequencyMap = {};

    data.forEach(item => {
      if (frequencyMap[item]) {
        frequencyMap[item]++;
      } else {
        frequencyMap[item] = 1;
      }
    });

    const sortedPatterns = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);
  }
}