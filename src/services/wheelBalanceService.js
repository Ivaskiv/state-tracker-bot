// src/services/wheelBalanceService.js - ВИПРАВЛЕНО ЛОГІКУ ПИТАНЬ

import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';
import { LIFE_SPHERES, SPHERE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ✅ СТАРТ НОВОГО КОЛЕСА
const startWheelBalance = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] ПОЧАТОК КОЛЕСА для ${tgId}`);

    // Перевіряємо чи немає активного колеса
    const existingWheel = await getActiveWheel(tgId);
    if (existingWheel) {
      const currentStep = existingWheel.fields.Step || 0;
      const sphereName = LIFE_SPHERES[currentStep];
      
      return {
        message: `🎯 У тебе вже є активне колесо!\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`,
        recordId: existingWheel.id,
        currentSphere: currentStep
      };
    }

    // Створюємо нове колесо
    const wheelData = {
      fields: {
        TG_id: String(tgId),
        Status: 'Active',
        Step: 0, // ✅ ПОЧАТКОВИЙ КРОК = 0 (перша сфера)
        Created_Date: new Date().toISOString().split('T')[0]
      }
    };

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData]);
    logger.info(`🎯 [wheelBalance] ✅ Колесо створено, ID: ${wheelRecord.id}, Step: ${wheelRecord.fields.Step}`);

    const message = 
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 1 до 10, де:\n` +
      `1 = дуже погано, 10 = ідеально\n\n` +
      `1️⃣/8 ${LIFE_SPHERES[0]}\n\nОцінка (1-10):`;

    return {
      message,
      recordId: wheelRecord.id,
      currentSphere: 0
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка створення:', error);
    throw error;
  }
};

// ✅ ВИПРАВЛЕНА ОБРОБКА ВІДПОВІДІ
const processWheelAnswer = async (tgId, score) => {
  try {
    logger.info(`🎯 [wheelBalance] Обробка відповіді ${tgId}: "${score}"`);

    // Валідація оцінки
    const scoreNum = parseInt(score, 10);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      return { error: true, message: 'Будь ласка, введи число від 1 до 10' };
    }

    // Отримуємо активне колесо
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Активне колесо не знайдено. Почни спочатку.' };
    }

    const currentStep = activeWheel.fields.Step || 0;
    logger.info(`🎯 [wheelBalance] ПОТОЧНИЙ КРОК: ${currentStep} (сфера: ${LIFE_SPHERES[currentStep]})`);

    // ✅ ПРАВИЛЬНА ЛОГІКА: currentStep відповідає поточній сфері
    const sphereName = LIFE_SPHERES[currentStep];
    const airtableField = SPHERE_FIELDS[currentStep];

    logger.info(`🎯 [wheelBalance] Зберігаємо в поле: ${airtableField} = ${scoreNum}`);

    // Готуємо дані для оновлення
    const updateFields = { [airtableField]: scoreNum };
    
    // Перевіряємо чи це остання сфера
    const isLastSphere = currentStep >= (LIFE_SPHERES.length - 1);
    
    if (isLastSphere) {
      // ✅ ЗАВЕРШУЄМО КОЛЕСО
      logger.info(`🎯 [wheelBalance] ЗАВЕРШЕННЯ КОЛЕСА (остання сфера ${currentStep})`);
      
      // Збираємо всі оцінки
      const allScores = [];
      for (let i = 0; i < LIFE_SPHERES.length - 1; i++) {
        const fieldName = SPHERE_FIELDS[i];
        const score = Number(activeWheel.fields[fieldName]) || 0;
        allScores.push(score);
      }
      allScores.push(scoreNum); // додаємо останню оцінку

      const totalScore = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;
      const analysis = await generateWheelAnalysis(allScores);

      updateFields.Status = 'Completed';
      updateFields.Completed_Date = new Date().toISOString().split('T')[0];
      updateFields.Total_Score = totalScore;
      updateFields.AI_Analysis = analysis;

      await base(tables.WHEEL_BALANCE).update(activeWheel.id, updateFields);

      const message = 
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n${analysis}`;

      return { 
        message, 
        completed: true, 
        analysis
      };

    } else {
      // ✅ ПЕРЕХОДИМО ДО НАСТУПНОЇ СФЕРИ
      const nextStep = currentStep + 1; // ✅ ЗБІЛЬШУЄМО КРОК
      updateFields.Step = nextStep;
      
      logger.info(`🎯 [wheelBalance] ПЕРЕХІД: крок ${currentStep} -> ${nextStep}`);
      
      await base(tables.WHEEL_BALANCE).update(activeWheel.id, updateFields);
      
      const nextSphereName = LIFE_SPHERES[nextStep];
      const message = 
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `${nextStep + 1}️⃣/8 ${nextSphereName}\n\n` +
        `Оцінка (1-10):`;

      logger.info(`🎯 [wheelBalance] ✅ Наступне питання: ${nextStep + 1}/8 ${nextSphereName}`);

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

// ✅ ГЕНЕРАЦІЯ AI-АНАЛІЗУ
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

// ✅ ОТРИМАННЯ АКТИВНОГО КОЛЕСА
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

// ✅ ПЕРЕВІРКА ПОТРЕБИ В НОВОМУ КОЛЕСІ (раз на місяць)
const needsWheelBalance = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length === 0) return true; // перше колесо
    
    const lastWheel = records[0];
    const completedDate = new Date(lastWheel.fields.Completed_Date);
    const now = new Date();
    const daysDiff = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= 30; // раз на місяць
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return false;
  }
};

// ✅ ОТРИМАННЯ СТАТИСТИКИ
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
  getActiveWheel,
  needsWheelBalance,
  getUserWheelStats
};