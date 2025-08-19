// controllers/analyticsController.js
import reflectionService from '../services/reflectionService.js';
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

      const weeklyData = await reflectionService.getWeeklyReflectionData(telegramId);
      
      if (weeklyData.reflections.length === 0) {
        return null;
      }

      // Analyze patterns
      const patterns = await reflectionService.analyzePatterns(weeklyData.reflections);
      
      // Generate AI analysis if available
      let aiAnalysis = '';
      try {
        aiAnalysis = await aiAnalyticsService.generateWeeklyAnalysis(weeklyData);
      } catch (error) {
        console.error('AI analysis failed, using fallback');
        aiAnalysis = this.generateFallbackWeeklyAnalysis(patterns, weeklyData);
      }

      const userName = user.fields['User Name'];
      const completionRate = Math.round((weeklyData.completedDays / 7) * 100);

      const report = `📊 ЩОТИЖНЕВИЙ ЗВІТ

Привіт, ${userName}! 🌱
Ось твій AI-звіт за останній тиждень:

📈 СТАТИСТИКА:
• Днів з рефлексіями: ${weeklyData.completedDays}/7
• Відсоток виконання: ${completionRate}%
• Всього відповідей: ${weeklyData.reflections.length}

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

      const monthlyData = await reflectionService.getMonthlyReflectionData(telegramId);
      
      if (monthlyData.reflections.length === 0) {
        return null;
      }

      // Analyze patterns
      const patterns = await reflectionService.analyzePatterns(monthlyData.reflections);
      
      // Generate AI analysis if available
      let aiAnalysis = '';
      try {
        aiAnalysis = await aiAnalyticsService.generateMonthlyAnalysis(monthlyData);
      } catch (error) {
        console.error('AI analysis failed, using fallback');
        aiAnalysis = this.generateFallbackMonthlyAnalysis(patterns, monthlyData);
      }

      const userName = user.fields['User Name'];
      const completionRate = Math.round((monthlyData.completedDays / 30) * 100);
      const stats = await reflectionService.getReflectionStats(telegramId);

      const report = `📈 ЩОМІСЯЧНИЙ ЗВІТ

Привіт, ${userName}! 🌟
Ось твій AI-звіт за місяць:

📊 СТАТИСТИКА МІСЯЦЯ:
• Днів з рефлексіями: ${monthlyData.completedDays}/30
• Відсоток виконання: ${completionRate}%
• Всього відповідей: ${monthlyData.reflections.length}
• Поточна серія днів: ${stats.streak}

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

  generateFallbackWeeklyAnalysis(patterns, data) {
    let analysis = '🔍 АНАЛІЗ ТИЖНЯ:\n';

    // Energy gains analysis
    if (patterns.energyGains.length > 0) {
      analysis += `\n🌊 Найбільше наповнювало:\n`;
      patterns.energyGains.slice(0, 3).forEach(item => {
        analysis += `• ${item.pattern} (${item.count} разів)\n`;
      });
    }

    // Energy losses analysis
    if (patterns.energyLosses.length > 0) {
      analysis += `\n🕳 Витоки енергії:\n`;
      patterns.energyLosses.slice(0, 3).forEach(item => {
        analysis += `• ${item.pattern} (${item.count} разів)\n`;
      });
    }

    // Programs analysis
    if (patterns.programs.length > 0) {
      analysis += `\n🚧 Блокуючі програми:\n`;
      patterns.programs.slice(0, 3).forEach(item => {
        analysis += `• "${item.pattern}" зʼявлялась ${item.count} разів\n`;
      });
    }

    // Victories analysis
    if (patterns.victories.length > 0) {
      analysis += `\n🏆 Головні перемоги:\n`;
      patterns.victories.slice(0, 3).forEach(item => {
        analysis += `• ${item.pattern}\n`;
      });
    }

    return analysis;
  }

  generateFallbackMonthlyAnalysis(patterns, data) {
    let analysis = '🧠 ГЛИБОКИЙ АНАЛІЗ МІСЯЦЯ:\n';

    // Overall trends
    const completionRate = Math.round((data.completedDays / 30) * 100);
    if (completionRate >= 80) {
      analysis += '\n✨ Ти показала високу регулярність - це основа трансформації!\n';
    } else if (completionRate >= 60) {
      analysis += '\n💪 Добра регулярність, є простір для покращення.\n';
    } else {
      analysis += '\n🎯 Фокус на регулярність допоможе поглибити результати.\n';
    }

    // Dominant patterns
    if (patterns.states.length > 0) {
      analysis += `\n🧭 Домінуючі стани:\n`;
      patterns.states.slice(0, 3).forEach(item => {
        analysis += `• ${item.pattern} (${item.count} разів)\n`;
      });
    }

    if (patterns.energyGains.length > 0) {
      analysis += `\n⚡️ Головні джерела енергії:\n`;
      patterns.energyGains.slice(0, 3).forEach(item => {
        analysis += `• ${item.pattern}\n`;
      });
    }

    if (patterns.programs.length > 0) {
      analysis += `\n🔄 Програми для трансформації:\n`;
      patterns.programs.slice(0, 2).forEach(item => {
        analysis += `• "${item.pattern}" - потребує уваги\n`;
      });
    }

    return analysis;
  }

  async getUserProgress(ctx) {
    try {
      const telegramId = ctx.from.id;
      const stats = await reflectionService.getReflectionStats(telegramId);
      const userStats = await userService.getUserStats(telegramId);

      if (!userStats) {
        await ctx.reply('Дані не знайдено');
        return;
      }

      const progress = `📊 ТВІЙ ПРОГРЕС

👤 Профіль:
• Реєстрація: ${new Date(userStats.registrationDate).toLocaleDateString('uk-UA')}
• Статус: ${userStats.subscriptionStatus}

📈 Статистика рефлексій:
• Всього: ${stats.total}
• Ранкових: ${stats.morning}
• Вечірніх: ${stats.evening}
• Цього тижня: ${stats.thisWeek}
• Поточна серія: ${stats.streak} днів

🔥 Продовжуй в тому ж дусі!`;

      await ctx.reply(progress);
    } catch (error) {
      console.error('Error getting user progress:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  }

  async exportUserData(telegramId) {
    try {
      const user = await userService.getUserByTelegramId(telegramId);
      const reflections = await reflectionService.getUserReflections(telegramId, 365);
      const morningResponses = await reflectionService.getMorningResponses(telegramId, 365);
      const eveningResponses = await reflectionService.getEveningResponses(telegramId, 365);

      const exportData = {
        user: user?.fields || {},
        stats: await reflectionService.getReflectionStats(telegramId),
        reflections: reflections.map(r => r.fields),
        morningResponses: morningResponses.map(r => r.fields),
        eveningResponses: eveningResponses.map(r => r.fields),
        exportDate: new Date().toISOString()
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      return null;
    }
  }

  async getSystemStats() {
    try {
      // This would return overall system statistics
      // Could be used for admin purposes
      const totalUsers = await userService.getActiveUsers();
      
      return {
        totalActiveUsers: totalUsers.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return null;
    }
  }
}

export default new AnalyticsController();