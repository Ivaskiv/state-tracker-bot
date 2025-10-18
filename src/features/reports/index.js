// src/features/reports/index.js

import { getBase, tables } from '../../config/database.js';
// import keyboards, { weeklyReportMenuKeyboard, monthlyReportMenuKeyboard } from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import logger from '../../utils/logger.js';
import users from '../../services/users.js';
import keyboards from '../../utils/keyboards.js';

const base = getBase();

/**
 * Отримати щотижневий звіт користувача
 */
const getWeeklyReport = async (tgId) => {
  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) return null;
    
    // Отримуємо дані за останні 7 днів
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const formula = `AND({TG_id}="${tgId}", {Date_Response} >= "${sevenDaysAgoStr}")`;
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Date_Response', direction: 'desc' }]
      })
      .all();
    
    if (!records.length) {
      return {
        message: '📊 На цьому тижні ще немає даних для звіту.',
        records: []
      };
    }
    
    // Підраховуємо статистику
    const morningCompleted = records.filter(r => r.fields.Q_m_6).length;
    const eveningCompleted = records.filter(r => r.fields.Q_e_7).length;
    const totalSessions = morningCompleted + eveningCompleted;
    
    const message = 
      `📊 **ЩОТИЖНЕВИЙ ЗВІТ**\n\n` +
      `📅 Період: останні 7 днів\n\n` +
      `🌞 Ранкових сесій: ${morningCompleted}\n` +
      `🌙 Вечірніх сесій: ${eveningCompleted}\n` +
      `📈 Всього: ${totalSessions} сесій\n\n` +
      `💡 Продовжуй працювати на собою!`;
    
    return { message, records };
  } catch (error) {
    logger.error('[reports/getWeeklyReport] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Отримати щомісячний звіт користувача
 */
const getMonthlyReport = async (tgId) => {
  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) return null;
    
    // Отримуємо дані за останні 30 днів
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const formula = `AND({TG_id}="${tgId}", {Date_Response} >= "${thirtyDaysAgoStr}")`;
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Date_Response', direction: 'desc' }]
      })
      .all();
    
    if (!records.length) {
      return {
        message: '📊 На цьому місяці ще немає даних для звіту.',
        records: []
      };
    }
    
    // Підраховуємо статистику
    const morningCompleted = records.filter(r => r.fields.Q_m_6).length;
    const eveningCompleted = records.filter(r => r.fields.Q_e_7).length;
    const totalSessions = morningCompleted + eveningCompleted;
    const avgDaily = (totalSessions / 30).toFixed(1);
    
    const message = 
      `📊 **ЩОМІСЯЧНИЙ ЗВІТ**\n\n` +
      `📅 Період: останні 30 днів\n\n` +
      `🌞 Ранкових сесій: ${morningCompleted}\n` +
      `🌙 Вечірніх сесій: ${eveningCompleted}\n` +
      `📈 Всього: ${totalSessions} сесій\n` +
      `⏱ Середня на день: ${avgDaily}\n\n` +
      `🎯 Чудовий прогрес! Продовжуй так!`;
    
    return { message, records };
  } catch (error) {
    logger.error('[reports/getMonthlyReport] ❌ Помилка:', error);
    return null;
  }
};

/**
 * Показати щотижневий звіт
 */
const showWeeklyReport = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    await typing(ctx);
    
    const report = await getWeeklyReport(tgId);
    if (!report) {
      await ctx.reply('❌ Помилка завантаження звіту', keyboards.mainMenuKeyboard());
      return;
    }
    
    await ctx.reply(report.message, keyboards.weeklyReportMenuKeyboard());
    
    logger.info('[reports] ✅ Показаний щотижневий звіт');
  } catch (error) {
    logger.error('[reports/showWeeklyReport] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження звіту', keyboards.mainMenuKeyboard());
  }
};

/**
 * Показати щомісячний звіт
 */
const showMonthlyReport = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    await typing(ctx);
    
    const report = await getMonthlyReport(tgId);
    if (!report) {
      await ctx.reply('❌ Помилка завантаження звіту', keyboards.mainMenuKeyboard());
      return;
    }
    
    await ctx.reply(report.message, keyboards.monthlyReportMenuKeyboard());
    
    logger.info('[reports] ✅ Показаний щомісячний звіт');
  } catch (error) {
    logger.error('[reports/showMonthlyReport] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка завантаження звіту', keyboards.mainMenuKeyboard());
  }
};

/**
 * Обробка callback для звітів
 */
const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  
  if (!data) return false;
  
  const reportsCallbacks = [
    'show_weekly_report',
    'show_monthly_report'
  ];
  
  if (!reportsCallbacks.includes(data)) {
    return false;
  }
  
  try {
    await ctx.answerCbQuery();
    
    switch (data) {
      case 'show_weekly_report':
        await showWeeklyReport(ctx);
        break;
      
      case 'show_monthly_report':
        await showMonthlyReport(ctx);
        break;
      
      default:
        return false;
    }
    
    return true;
  } catch (error) {
    logger.error('[reports/handleCallback] ❌ Помилка:', error);
    return false;
  }
};

/**
 * Ініціалізація модуля
 */
export default function initReports(bot) {
  console.log('📊 [reports] Ініціалізація модуля...');
  console.log('✅ [reports] Модуль готовий');
}

// Експорт функцій
export {
  getWeeklyReport,
  getMonthlyReport,
  showWeeklyReport,
  showMonthlyReport,
  handleCallback
};

console.log('✅ [features/reports] Модуль завантажено');