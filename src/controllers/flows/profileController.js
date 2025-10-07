// src/controllers/flows/profileController.js - ПРИКЛАД ВИКОРИСТАННЯ

import badgeService from '../../services/badgeService.js';
import activityTracker from '../../services/activityTracker.js';
import keyboards from '../../utils/keyboards.js';

const profileController = {

  /**
   * 📊 Показує повний профіль користувача з бейджами та прогресом
   */
  async showProfile(ctx) {
    try {
      const tgId = ctx.from.id;
      
      console.log(`[profileController] 📊 Профіль для ${tgId}`);
      
      // Показуємо typing
      await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      
      // Отримуємо повний звіт
      const progressReport = await badgeService.getProgressReport(tgId);
      
      // Додаємо додаткову інформацію
      const stats = await activityTracker.calculateDailyStats(tgId);
      
      let additionalInfo = '\n\n📅 СЬОГОДНІ\n';
      if (stats) {
        additionalInfo += `✅ Ранок: ${stats.morningCompleted ? 'Так' : 'Ні'}\n`;
        additionalInfo += `🌙 Вечір: ${stats.eveningCompleted ? 'Так' : 'Ні'}\n`;
        additionalInfo += `🎯 Дії: ${stats.actionsCompleted}/${stats.actionsPlanned}\n`;
        if (stats.actionsPlanned > 0) {
          additionalInfo += `📊 Виконано: ${stats.completionRate}%\n`;
        }
      } else {
        additionalInfo += '📝 Дані ще не заповнені\n';
      }
      
      const fullReport = progressReport + additionalInfo;
      
      await ctx.reply(fullReport, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Оновити', callback_data: 'profile_refresh' },
              { text: '🎖️ Всі бейджі', callback_data: 'profile_badges' }
            ],
            [
              { text: '📊 Детальна статистика', callback_data: 'profile_stats' }
            ],
            [
              { text: '🏠 Головне меню', callback_data: 'main_menu' }
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('[profileController] ❌ showProfile:', error);
      await ctx.reply(
        '❌ Помилка завантаження профілю. Спробуй пізніше.',
        keyboards.mainMenuKeyboard()
      );
    }
  },

  /**
   * 🎖️ Показує всі доступні бейджі та прогрес
   */
  async showAllBadges(ctx) {
    try {
      const tgId = ctx.from.id;
      
      const progress = await badgeService.getUserProgress(tgId);
      const userBadges = await badgeService.getUserBadges(tgId);
      
      const { BADGES } = await import('../../config/constants.js');
      
      let message = `🎖️ ВСІ БЕЙДЖІ\n\n`;
      message += `📊 Отримано: ${userBadges.length}/${Object.keys(BADGES).length}\n\n`;
      
      // Отримані бейджі
      if (userBadges.length > 0) {
        message += `✅ ОТРИМАНІ:\n`;
        for (const [key, badge] of Object.entries(BADGES)) {
          if (userBadges.some(ub => ub.includes(badge.title))) {
            message += `${badge.icon} ${badge.title} - ${badge.points} балів\n`;
            message += `   ${badge.description}\n\n`;
          }
        }
      }
      
      // Недоступні бейджі
      message += `\n🔒 ДОСТУПНІ ДЛЯ ОТРИМАННЯ:\n`;
      for (const [key, badge] of Object.entries(BADGES)) {
        if (!userBadges.some(ub => ub.includes(badge.title))) {
          message += `${badge.icon} ${badge.title} - ${badge.points} балів\n`;
          message += `   📝 ${badge.requirement}\n\n`;
        }
      }
      
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад до профілю', callback_data: 'show_profile' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[profileController] ❌ showAllBadges:', error);
      await ctx.reply('❌ Помилка завантаження бейджів');
    }
  },

  /**
   * 📊 Детальна статистика
   */
  async showDetailedStats(ctx) {
    try {
      const tgId = ctx.from.id;
      
      // Статистика за різні періоди
      const last7Days = await activityTracker.getLastNDaysStats(tgId, 7);
      const last30Days = await activityTracker.getLastNDaysStats(tgId, 30);
      
      const weeklyAnalysis = await activityTracker.checkWeeklyCompletionRate(tgId);
      
      let message = `📊 ДЕТАЛЬНА СТАТИСТИКА\n\n`;
      
      // Тиждень
      message += `📅 ОСТАННІ 7 ДНІВ\n`;
      if (last7Days && last7Days.length > 0) {
        const completedDays = last7Days.filter(d => d.morningCompleted && d.eveningCompleted).length;
        const totalActions = last7Days.reduce((sum, d) => sum + d.actionsCompleted, 0);
        const plannedActions = last7Days.reduce((sum, d) => sum + d.actionsPlanned, 0);
        
        message += `✅ Завершено днів: ${completedDays}/7\n`;
        message += `🎯 Виконано дій: ${totalActions}/${plannedActions}\n`;
        
        if (plannedActions > 0) {
          const rate = Math.round((totalActions / plannedActions) * 100);
          message += `📈 Completion rate: ${rate}%\n`;
        }
      } else {
        message += `Немає даних\n`;
      }
      
      // Місяць
      message += `\n📅 ОСТАННІ 30 ДНІВ\n`;
      if (last30Days && last30Days.length > 0) {
        const completedDays = last30Days.filter(d => d.morningCompleted && d.eveningCompleted).length;
        const totalActions = last30Days.reduce((sum, d) => sum + d.actionsCompleted, 0);
        const plannedActions = last30Days.reduce((sum, d) => sum + d.actionsPlanned, 0);
        
        message += `✅ Завершено днів: ${completedDays}/30\n`;
        message += `🎯 Виконано дій: ${totalActions}/${plannedActions}\n`;
        
        if (plannedActions > 0) {
          const rate = Math.round((totalActions / plannedActions) * 100);
          message += `📈 Completion rate: ${rate}%\n`;
        }
      } else {
        message += `Немає даних\n`;
      }
      
      // Аналіз тижня
      if (weeklyAnalysis) {
        message += `\n📊 ТИЖНЕВИЙ АНАЛІЗ\n`;
        message += `📈 Середній completion rate: ${weeklyAnalysis.avgCompletionRate}%\n`;
        message += `🏆 Днів з перемогами: ${weeklyAnalysis.daysWithVictories}/${weeklyAnalysis.totalDays}\n`;
      }
      
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Назад до профілю', callback_data: 'show_profile' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('[profileController] ❌ showDetailedStats:', error);
      await ctx.reply('❌ Помилка завантаження статистики');
    }
  },

  /**
   * Обробка callback кнопок профілю
   */
  async handleCallback(ctx, data) {
    try {
      await ctx.answerCbQuery();
      
      switch (data) {
        case 'show_profile':
        case 'profile_refresh':
          await this.showProfile(ctx);
          break;
          
        case 'profile_badges':
          await this.showAllBadges(ctx);
          break;
          
        case 'profile_stats':
          await this.showDetailedStats(ctx);
          break;
          
        default:
          await ctx.answerCbQuery('Невідома команда');
      }
      
    } catch (error) {
      console.error('[profileController] ❌ handleCallback:', error);
      await ctx.answerCbQuery('Помилка обробки');
    }
  }

};

export default profileController;