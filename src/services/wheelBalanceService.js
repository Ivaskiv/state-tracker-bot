// src/services/wheelBalanceService.js - МІНІМАЛЬНІ ВИПРАВЛЕННЯ

import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';
import { LIFE_SPHERES, SPHERE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ВИПРАВЛЕНО: використовувати keyboards замість локальної функції
const startWheelBalance = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] ПОЧАТОК КОЛЕСА для ${tgId}`);

    await base(tables.WHEEL_BALANCE).select({
      filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`
    }).eachPage(async (records) => {
      if (records.length > 0) {
        const updates = records.map(record => ({
          id: record.id,
          fields: { Status: 'Cancelled' }
        }));
        await base(tables.WHEEL_BALANCE).update(updates);
      }
    });

    const wheelData = {
      fields: {
        TG_id: String(tgId),
        Status: 'Active',
        Step: 0,
        Created_Date: new Date().toISOString().split('T')[0]
      }
    };

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData]);
    logger.info(`🎯 [wheelBalance] ✅ Колесо створено, ID: ${wheelRecord.id}`);

    const message = 
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 0 до 10\n\n` +
      `1️⃣/8 ${LIFE_SPHERES[0]}\n\nОбери оцінку:`;

    // ВИПРАВЛЕНО: використовувати keyboards
    const { default: keyboards } = await import('../utils/keyboards.js');
    return {
      message,
      keyboard: keyboards.wheelScoreInlineKeyboard(),
      recordId: wheelRecord.id,
      currentSphere: 0
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка створення:', error);
    throw error;
  }
};

// ДОДАНО: обробка callback (критично важливо)
const processWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  try {
    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''));
      return await processWheelAnswer(tgId, score, ctx);
    }
    
    if (data === 'wheel_exit') {
      await base(tables.WHEEL_BALANCE).select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`
      }).eachPage(async (records) => {
        if (records.length > 0) {
          const updates = records.map(record => ({
            id: record.id,
            fields: { Status: 'Cancelled' }
          }));
          await base(tables.WHEEL_BALANCE).update(updates);
        }
      });
      
      await ctx.editMessageText('🚪 Колесо балансу скасовано');
      return { completed: true, cancelled: true };
    }
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка callback:', error);
    return { error: true, message: 'Помилка обробки. Спробуй ще раз.' };
  }
};

const processWheelAnswer = async (tgId, score, ctx = null) => {
  try {
    logger.info(`🎯 [wheelBalance] Обробка відповіді ${tgId}: ${score}`);

    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Активне колесо не знайдено. Почни спочатку.' };
    }

    const currentStep = activeWheel.fields.Step || 0;
    const sphereName = LIFE_SPHERES[currentStep];
    const airtableField = SPHERE_FIELDS[currentStep];

    logger.info(`🎯 [wheelBalance] Зберігаємо: ${airtableField} = ${score}`);

    const updateFields = { [airtableField]: score };
    const isLastSphere = currentStep >= (LIFE_SPHERES.length - 1);
    
    if (isLastSphere) {
      const allScores = [];
      for (let i = 0; i < LIFE_SPHERES.length - 1; i++) {
        const fieldName = SPHERE_FIELDS[i];
        const score = Number(activeWheel.fields[fieldName]) || 0;
        allScores.push(score);
      }
      allScores.push(score);

      const totalScore = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
      const analysis = await generateWheelAnalysis(allScores);

      updateFields.Status = 'Completed';
      updateFields.Completed_Date = new Date().toISOString().split('T')[0];
      updateFields.Total_Score = totalScore;
      updateFields.AI_Analysis = analysis;

      await base(tables.WHEEL_BALANCE).update(activeWheel.id, updateFields);

      const message = 
        `✅ ${sphereName}: ${score}/10\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n` +
        `📊 Загальний бал: ${totalScore}/10\n\n` +
        `${analysis}`;

      // ВИПРАВЛЕНО: використовувати правильну клавіатуру
      if (ctx) {
        const { default: keyboards } = await import('../utils/keyboards.js');
        await ctx.editMessageText(message, keyboards.wheelBalanceCompleteKeyboard());
      }

      return { message, completed: true, analysis };

    } else {
      const nextStep = currentStep + 1;
      updateFields.Step = nextStep;
      
      await base(tables.WHEEL_BALANCE).update(activeWheel.id, updateFields);
      
      const nextSphereName = LIFE_SPHERES[nextStep];
      const message = 
        `✅ ${sphereName}: ${score}/10\n\n` +
        `${nextStep + 1}️⃣/8 ${nextSphereName}\n\n` +
        `Обери оцінку:`;

      // ВИПРАВЛЕНО: використовувати keyboards
      if (ctx) {
        const { default: keyboards } = await import('../utils/keyboards.js');
        await ctx.editMessageText(message, keyboards.wheelScoreInlineKeyboard());
      }

      return {
        message,
        currentSphere: nextStep,
        completed: false
      };
    }

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка обробки:', error);
    return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
  }
};

const generateWheelAnalysis = async (scoresArr) => {
  try {
    const pairs = LIFE_SPHERES.map((name, i) => ({ 
      name, 
      score: scoresArr[i] || 0 
    }));
    
    const prompt =
      `Проаналізуй результати колеса балансу:\n\n` +
      `${pairs.map(s => `${s.name}: ${s.score}/10`).join('\n')}\n\n` +
      `Дай короткий аналіз (до 120 слів):\n` +
      `🌟 Сильні сторони: [2-3 найвищі сфери]\n` +
      `⚡ Точки росту: [1-2 найнижчі сфери]\n` +
      `🎯 Наступні кроки: [2-3 конкретні дії]\n\n` +
      `Тон: підтримуючий, українською мовою.`;

    const analysis = await chat(
      [
        { role: 'system', content: 'Ти експертний коуч. Аналізуй колесо балансу підтримуюче, конкретно.' },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    return analysis || '📊 Твоє колесо показує унікальний баланс. Продовжуй розвивати сильні сторони!';

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка аналізу:', error);
    return '📊 Дякуємо за заповнення колеса балансу! Продовжуй працювати над своїм розвитком.';
  }
};

const getActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    if (records.length > 0) {
      const wheel = records[0];
      logger.info(`🎯 [wheelBalance] ✅ Знайдено активне колесо: ID=${wheel.id}, Step=${wheel.fields.Step}`);
      return wheel;
    }
    
    logger.info(`🎯 [wheelBalance] ❌ Активне колесо не знайдено для ${tgId}`);
    return null;

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка отримання активного колеса:', error);
    throw error;
  }
};

const needsWheelBalance = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length === 0) return true;
    
    const lastWheel = records[0];
    const completedDate = new Date(lastWheel.fields.Completed_Date);
    const now = new Date();
    const daysDiff = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 30;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return false;
  }
};

const getUserWheelStats = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .all();
    
    return {
      total: records.length,
      lastScore: records.length > 0 ? records[0].fields.Total_Score : null,
      lastDate: records.length > 0 ? records[0].fields.Completed_Date : null,
      records: records.map(r => r.fields)
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка статистики:', error);
    return { total: 0, lastScore: null, lastDate: null, records: [] };
  }
};

export default {
  startWheelBalance,
  processWheelAnswer,
  processWheelCallback, // ДОДАНО: критично важливо
  getActiveWheel,
  needsWheelBalance,
  getUserWheelStats,
  LIFE_SPHERES
};