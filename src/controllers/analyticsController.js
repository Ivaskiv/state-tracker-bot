// src/controllers/analyticsController.js
import responseService from '../dialogue/services/responseService.js';
import aiAnalyticsService from '../services/aiAnalyticsService.js';
import userService from '../auth/services/userService.js';
import { MESSAGES } from '../dialogue/utils/messages.js';

class AnalyticsController {
  async generateWeeklyReport(ctx) {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.getUserByTelegramId(telegramId);
      
      if (!user) {
        return ctx.reply('Спочатку зареєструйтесь /start');
      }

      // Перевіряємо активну підписку
      if (!user['Active_Subscription_Status']?.includes('✅ Активна')) {
        return ctx.reply('❌ Для отримання звітів потрібна активна підписка.\n\nОформи підписку в меню "💰 Підписка"');
      }

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
      const user = await userService.getUserByTelegramId(telegramId);
      
      if (!user) {
        return ctx.reply('Спочатку зареєструйтесь /start');
      }

      // Перевіряємо активну підписку
      if (!user['Active_Subscription_Status']?.includes('✅ Активна')) {
        return ctx.reply('❌ Для отримання звітів потрібна активна підписка.\n\nОформи підписку в меню "💰 Підписка"');
      }

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

      // ✅ Отримуємо записи за тиждень
      const weeklyRecords = await responseService.getUserRecords(telegramId, 7);
      
      if (weeklyRecords.length === 0) {
        return null;
      }

      // ✅ Аналізуємо шаблони з оновленої структури
      const patterns = this.analyzeNewPatterns(weeklyRecords);
      
      // Генеруємо AI аналіз якщо доступний
      let aiAnalysis = '';
      try {
        const weeklyData = this.prepareWeeklyDataNew(weeklyRecords, patterns);
        aiAnalysis = await aiAnalyticsService.generateWeeklyAnalysis(weeklyData);
      } catch (error) {
        console.error('AI analysis failed, using fallback');
        aiAnalysis = this.generateFallbackWeeklyAnalysis(patterns, weeklyRecords);
      }

      const userName = user['User Name'];
      const completedDays = weeklyRecords.length;
      const completionRate = Math.round((completedDays / 7) * 100);

      // Підраховуємо завершені сесії з нової структури
      let morningCompleted = 0;
      let eveningCompleted = 0;
      weeklyRecords.forEach(record => {
        if (record.fields.End_m) morningCompleted++;
        if (record.fields.End_e) eveningCompleted++;
      });

      const report = `📊 ЩОТИЖНЕВИЙ AI-ЗВІТ

Привіт, ${userName}! 🌱
Ось твій персональний аналіз за останній тиждень:

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
• Використовуй виявлені джерела енергії

✨ Кожен день - це можливість стати кращою версією себе!`;

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
      const patterns = this.analyzeNewPatterns(monthlyRecords);
      
      // Генеруємо AI аналіз
      let aiAnalysis = '';
      try {
        const monthlyData = this.prepareMonthlyDataNew(monthlyRecords, patterns);
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
        if (record.fields.End_m) morningCompleted++;
        if (record.fields.End_e) eveningCompleted++;
      });

      const report = `📈 ЩОМІСЯЧНИЙ AI-ЗВІТ

Привіт, ${userName}! 🌟
Ось твій глибокий аналіз за місяць:

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
• Трансформуй блокуючі переконання

💎 Твоя трансформація - це процес. Продовжуй рухатися вперед!`;

      return report;
    } catch (error) {
      console.error('Error generating monthly report for user:', error);
      return null;
    }
  }

  // ✅ Нова функція аналізу шаблонів для оновленої структури
  analyzeNewPatterns(records) {
    const patterns = {
      energyGains: [],
      energyLosses: [],
      programs: [],
      states: [],
      victories: [],
      goals: []
    };

    // Збираємо всі відповіді по категоріях з нової структури
    const energyGains = [];
    const energyLosses = [];
    const programs = [];
    const states = [];
    const victories = [];
    const goals = [];

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

      // Цілі (ранкове питання 4)
      if (fields.Q_m_4) goals.push(fields.Q_m_4);
    });

    // Аналізуємо частоту згадувань
    patterns.energyGains = this.getTopPatterns(energyGains);
    patterns.energyLosses = this.getTopPatterns(energyLosses);
    patterns.programs = this.getTopPatterns(programs);
    patterns.states = this.getTopPatterns(states);
    patterns.victories = this.getTopPatterns(victories);
    patterns.goals = this.getTopPatterns(goals);

    return patterns;
  }

  // ✅ Оновлена функція підготовки даних для тижневого аналізу
  prepareWeeklyDataNew(records, patterns) {
    const data = {
      completedDays: records.length,
      totalRecords: records.length,
      patterns: patterns,
      energySources: patterns.energyGains.slice(0, 3),
      energyDrains: patterns.energyLosses.slice(0, 3),
      dominantPrograms: patterns.programs.slice(0, 2),
      commonStates: patterns.states.slice(0, 3),
      topVictories: patterns.victories.slice(0, 3)
    };
    
    return data;
  }

  // ✅ Оновлена функція підготовки даних для місячного аналізу
  prepareMonthlyDataNew(records, patterns) {
    const data = {
      completedDays: records.length,
      totalRecords: records.length,
      patterns: patterns,
      energySources: patterns.energyGains.slice(0, 5),
      energyDrains: patterns.energyLosses.slice(0, 5),
      dominantPrograms: patterns.programs.slice(0, 3),
      commonStates: patterns.states.slice(0, 5),
      topVictories: patterns.victories.slice(0, 5),
      focusedGoals: patterns.goals.slice(0, 3)
    };
    
    return data;
  }

  // Функція для виділення найчастіших шаблонів
  getTopPatterns(data) {
    if (!data || data.length === 0) return [];

    const frequencyMap = {};

    data.forEach(item => {
      const cleanItem = item.toLowerCase().trim();
      if (frequencyMap[cleanItem]) {
        frequencyMap[cleanItem]++;
      } else {
        frequencyMap[cleanItem] = 1;
      }
    });

    const sortedPatterns = Object.entries(frequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));

    return sortedPatterns;
  }

  // ✅ Резервний аналіз для щотижневого звіту
  generateFallbackWeeklyAnalysis(patterns, records) {
    let analysis = `🔍 АНАЛІЗ ШАБЛОНІВ:\n\n`;

    // Аналіз енергії
    if (patterns.energyGains.length > 0) {
      analysis += `🌊 Джерела енергії: ${patterns.energyGains[0].pattern}\n`;
    }
    if (patterns.energyLosses.length > 0) {
      analysis += `🔻 Витоки енергії: ${patterns.energyLosses[0].pattern}\n`;
    }

    // Аналіз програм
    if (patterns.programs.length > 0) {
      analysis += `🚧 Активні програми: ${patterns.programs[0].pattern}\n`;
    }

    // Аналіз перемог
    if (patterns.victories.length > 0) {
      analysis += `🏆 Головні перемоги: ${patterns.victories[0].pattern}\n`;
    }

    analysis += `\n💡 ІНСАЙТИ:\n`;
    analysis += `• Твоя сила проявляється через щоденну практику\n`;
    analysis += `• Усвідомлення шаблонів - перший крок до трансформації\n`;
    analysis += `• Кожна відповідь наближає тебе до мети`;

    return analysis;
  }

  // ✅ Резервний аналіз для місячного звіту
  generateFallbackMonthlyAnalysis(patterns, records) {
    let analysis = `🧠 ГЛИБОКИЙ АНАЛІЗ:\n\n`;

    // Домінуючі шаблони
    if (patterns.states.length > 0) {
      analysis += `🎭 Домінуючий стан: ${patterns.states[0].pattern} (${patterns.states[0].count} разів)\n`;
    }

    if (patterns.programs.length > 0) {
      analysis += `🔄 Основна програма: ${patterns.programs[0].pattern}\n`;
    }

    if (patterns.energyGains.length > 0) {
      analysis += `⚡ Головне джерело енергії: ${patterns.energyGains[0].pattern}\n`;
    }

    // Трансформація
    analysis += `\n🔥 ТРАНСФОРМАЦІЯ:\n`;
    const completionRate = Math.round((records.length / 30) * 100);
    
    if (completionRate >= 80) {
      analysis += `• Ти показуєш високу дисципліну та відданість\n`;
    } else if (completionRate >= 60) {
      analysis += `• Твоя практика стабільна, є простір для росту\n`;
    } else {
      analysis += `• Фокус на регулярність принесе прорив\n`;
    }

    analysis += `• Твоя свідомість розширюється через рефлексію\n`;
    analysis += `• Шаблони стають видимими - це сила для змін`;

    return analysis;
  }
}

export default new AnalyticsController();