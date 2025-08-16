// handlers/menuHandler.js
import { AirtableService } from '../services/airtableService.js';
import { AIAnalytics } from '../services/aiAnalytics.js';
import { createInlineKeyboard } from '../utils/helpers.js';
import moment from 'moment-timezone';

export class MenuHandler {
  
  static async showMainMenu(bot, chatId) {
    const menuMessage = `🏠 **ГОЛОВНЕ МЕНЮ**

Оберіть дію:`;

    const keyboard = createInlineKeyboard([
      [{ text: '🌅 Ранкові питання', callback_data: 'morning_questions' }],
      [{ text: '🌙 Вечірні питання', callback_data: 'evening_questions' }],
      [{ text: '📊 Мій статус', callback_data: 'my_status' }],
      [{ text: '📈 Звіти', callback_data: 'reports_menu' }],
      [{ text: '✨ Афірмація', callback_data: 'get_affirmation' }],
      [{ text: '💬 Підтримка', callback_data: 'support' }]
    ]);

    await bot.sendMessage(chatId, menuMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async showReportsMenu(bot, chatId) {
    const menuMessage = `📈 **ЗВІТИ ТА АНАЛІТИКА**

Оберіть тип звіту:`;

    const keyboard = createInlineKeyboard([
      [{ text: '📊 Щотижневий звіт', callback_data: 'weekly_report' }],
      [{ text: '📈 Щомісячний звіт', callback_data: 'monthly_report' }],
      [{ text: '📝 Мої відповіді за тиждень', callback_data: 'week_responses' }],
      [{ text: '⬅️ Назад в меню', callback_data: 'main_menu' }]
    ]);

    await bot.sendMessage(chatId, menuMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  static async showMyStatus(bot, chatId, telegramId) {
    try {
      const user = await AirtableService.getUserByTelegramId(telegramId);
      
      if (!user) {
        await bot.sendMessage(chatId, "❌ Користувач не знайдений. Потрібно пройти реєстрацію.");
        return;
      }

      const userName = user.get('User Name');
      const subscriptionStatus = user.get('Active_Subscription_Status') || '❌ Немає активної підписки';
      const currentPlan = user.get('Active Subscription Plan') || 'Не вказано';
      const registrationDate = user.get('DateUserRegistered') || 'Не вказано';

      const statusMessage = `👤 **МІЙ ПРОФІЛЬ**

🏷️ **Ім'я:** ${userName}
📅 **Дата реєстрації:** ${registrationDate}
💳 **Поточний план:** ${currentPlan}
📊 **Статус підписки:** ${subscriptionStatus}

🔄 **Останні дії:**
• Ранкові питання: ${await this.getLastActivityDate('morning', user.id)}
• Вечірні питання: ${await this.getLastActivityDate('evening', user.id)}

📈 **Статистика:**
• Днів активності: ${await this.getActivityDays(user.id)}
• Завершених опитувань: ${await this.getCompletedSurveys(user.id)}`;

      const keyboard = createInlineKeyboard([
        [{ text: '🔄 Оновити статус', callback_data: 'my_status' }],
        [{ text: '⬅️ Назад в меню', callback_data: 'main_menu' }]
      ]);

      await bot.sendMessage(chatId, statusMessage, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error showing status:', error);
      await bot.sendMessage(chatId, "❌ Помилка отримання статусу. Спробуйте пізніше.");
    }
  }

  static async generateWeeklyReport(bot, chatId, telegramId) {
    try {
      const user = await AirtableService.getUserByTelegramId(telegramId);
      if (!user) return;

      await bot.sendMessage(chatId, "🔄 Генерую твій щотижневий звіт...");

      const weeklyData = await AirtableService.getUserReflectionsForAnalysis(user.id, 7);
      
      if (weeklyData.length === 0) {
        await bot.sendMessage(chatId, `📊 **ЩОТИЖНЕВИЙ ЗВІТ**

🤔 Поки що недостатньо даних для аналізу.

Щоб отримувати детальні звіти:
• Відповідай на ранкові питання щодня
• Не пропускай вечірні рефлексії  
• Через тиждень активності отримаєш перший звіт

💪 Продовжуй щоденну практику!`);
        return;
      }

      const reportData = weeklyData.map(record => ({
        energyLoss: record.get('Energy Loss'),
        programs: record.get('Programs'),
        victory: record.get('Victory'),
        energyGain: record.get('Energy Gain'),
        state: record.get('State'),
        goal: record.get('Goal')
      }));

      const weeklyReport = await AIAnalytics.generateWeeklyReport(reportData);

      await bot.sendMessage(chatId, weeklyReport, { parse_mode: 'Markdown' });

      const keyboard = createInlineKeyboard([
        [{ text: '📈 Звіти', callback_data: 'reports_menu' }],
        [{ text: '⬅️ Головне меню', callback_data: 'main_menu' }]
      ]);

      await bot.sendMessage(chatId, "Що далі?", { reply_markup: keyboard });

    } catch (error) {
      console.error('Error generating weekly report:', error);
      await bot.sendMessage(chatId, "❌ Помилка генерації звіту. Спробуйте пізніше.");
    }
  }

  static async generateMonthlyReport(bot, chatId, telegramId) {
    try {
      const user = await AirtableService.getUserByTelegramId(telegramId);
      if (!user) return;

      await bot.sendMessage(chatId, "🔄 Генерую твій місячний звіт...");

      const monthlyData = await AirtableService.getUserReflectionsForAnalysis(user.id, 30);
      
      if (monthlyData.length < 7) {
        await bot.sendMessage(chatId, `📈 **МІСЯЧНИЙ ЗВІТ**

🤔 Для місячного аналізу потрібно мінімум тиждень активних відповідей.

📊 **Поточна статистика:**
• Днів з відповідями: ${monthlyData.length}
• Потрібно для аналізу: 7 днів

💡 **Рекомендації:**
• Відповідай на питання кожен день
• Через ${7 - monthlyData.length} днів отримаєш перший аналіз
• Повний місячний звіт — через 30 днів

🚀 Продовжуй, ти на правильному шляху!`);
        return;
      }

      const reportData = monthlyData.map(record => ({
        energyLoss: record.get('Energy Loss'),
        programs: record.get('Programs'),
        victory: record.get('Victory'),
        energyGain: record.get('Energy Gain'),
        state: record.get('State'),
        goal: record.get('Goal')
      }));

      const monthlyReport = await AIAnalytics.generateMonthlyReport(reportData);

      await bot.sendMessage(chatId, monthlyReport, { parse_mode: 'Markdown' });

      const keyboard = createInlineKeyboard([
        [{ text: '📈 Звіти', callback_data: 'reports_menu' }],
        [{ text: '⬅️ Головне меню', callback_data: 'main_menu' }]
      ]);

      await bot.sendMessage(chatId, "Що далі?", { reply_markup: keyboard });

    } catch (error) {
      console.error('Error generating monthly report:', error);
      await bot.sendMessage(chatId, "❌ Помилка генерації звіту. Спробуйте пізніше.");
    }
  }

  static async sendQuickAffirmation(bot, chatId) {
    try {
      const affirmation = await AirtableService.getRandomAffirmation();
      
      const affirmationMessage = `✨ **АФІРМАЦІЯ ДЛЯ ТЕБЕ**

💫 *"${affirmation}"*

🌟 Повтори це кілька разів і відчуй, як ці слова наповнюють тебе силою.

Потрібна ще одна афірмація?`;

      const keyboard = createInlineKeyboard([
        [{ text: '🔄 Ще афірмація', callback_data: 'get_affirmation' }],
        [{ text: '⬅️ Головне меню', callback_data: 'main_menu' }]
      ]);

      await bot.sendMessage(chatId, affirmationMessage, { 
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      console.error('Error sending affirmation:', error);
      const fallbackMessage = `✨ **АФІРМАЦІЯ ДЛЯ ТЕБЕ**

💫 *"Ти маєш всю силу всередині себе. Довіряй своєму шляху."*

🌟 Повтори це і відчуй внутрішню впевненість.`;

      await bot.sendMessage(chatId, fallbackMessage, { parse_mode: 'Markdown' });
    }
  }

  static async showSupport(bot, chatId) {
    const supportMessage = `💬 **ПІДТРИМКА**

📧 **Email:** nadyastarway@gmail.com

❓ **Часті питання:**

🔹 **Як змінити план підписки?**
Напишіть на email, вкажіть ваш Telegram username.

🔹 **Не приходять нагадування?**
• Перевірте часовий пояс в налаштуваннях
• Переконайтесь, що підписка активна
• Напишіть на email якщо проблема не вирішена

🔹 **Як працює AI-аналіз?**
Бот аналізує ваші щоденні відповіді та виявляє закономірності, надаючи персональні рекомендації.

🔹 **Чи зберігаються мої дані?**
Так, всі відповіді зберігаються конфіденційно для надання персональної аналітики.`;

    const keyboard = createInlineKeyboard([
      [{ text: '⬅️ Головне меню', callback_data: 'main_menu' }]
    ]);

    await bot.sendMessage(chatId, supportMessage, { 
      reply_markup: keyboard,
      parse_mode: 'Markdown'
    });
  }

  // Допоміжні методи
  static async getLastActivityDate(type, userId) {
    try {
      const table = type === 'morning' ? 'Morning_Responses' : 'Evening_Responses';
      // Тут має бути запит до відповідної таблиці
      return 'Сьогодні'; // Заглушка
    } catch (error) {
      return 'Ніколи';
    }
  }

  static async getActivityDays(userId) {
    try {
      // Запит до бази для підрахунку унікальних днів активності
      return '5'; // Заглушка
    } catch (error) {
      return '0';
    }
  }

  static async getCompletedSurveys(userId) {
    try {
      // Запит до бази для підрахунку завершених опитувань
      return '10'; // Заглушка
    } catch (error) {
      return '0';
    }
  }
}