// src/services/wheelBalanceService.js - ВИПРАВЛЕНО ПРОБЛЕМУ З ПРОПУСКОМ ПИТАНЬ

import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';
import { LIFE_SPHERES, SPHERE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ✅ ДІАГНОСТИКА КОНФІГУРАЦІЇ
console.log('🎯 [wheelBalance] ДІАГНОСТИКА КОНФІГУРАЦІЇ:');
console.log(`- LIFE_SPHERES довжина: ${LIFE_SPHERES.length}`);
console.log(`- SPHERE_FIELDS довжина: ${SPHERE_FIELDS.length}`);
console.log('- LIFE_SPHERES:', LIFE_SPHERES);
console.log('- SPHERE_FIELDS:', SPHERE_FIELDS);

if (LIFE_SPHERES.length !== SPHERE_FIELDS.length) {
  logger.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА: Невідповідність довжини масивів!', {
    lifeSpheresLength: LIFE_SPHERES.length,
    sphereFieldsLength: SPHERE_FIELDS.length
  });
}

// ✅ СТАРТ НОВОГО КОЛЕСА
const startWheelBalance = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] ========== ПОЧАТОК КОЛЕСА БАЛАНСУ ==========`);
    logger.info(`🎯 [wheelBalance] Користувач: ${tgId}`);

    // Перевіряємо чи немає активного колеса
    const existingWheel = await getActiveWheel(tgId);
    if (existingWheel) {
      logger.warn(`⚠️ [wheelBalance] Вже є активне колесо для ${tgId}, ID: ${existingWheel.id}`);
      
      const currentStep = existingWheel.fields.Step || 0;
      const sphereName = LIFE_SPHERES[currentStep] || 'Невідома сфера';
      
      return {
        message: `🎯 У тебе вже є активне колесо!\n\n${currentStep + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`,
        recordId: existingWheel.id,
        currentSphere: currentStep,
        totalSpheres: LIFE_SPHERES.length
      };
    }

    // Створюємо нове колесо з правильними початковими даними
    const wheelData = {
      fields: {
        TG_id: String(tgId),
        Status: 'Active',
        Step: 0, // ✅ ПОЧИНАЄМО З 0 (перша сфера)
        Created_Date: new Date().toISOString().split('T')[0] // YYYY-MM-DD формат
      }
    };

    logger.info(`🎯 [wheelBalance] Дані для створення:`, wheelData.fields);

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData]);

    if (!wheelRecord) {
      throw new Error('Не вдалося створити запис колеса балансу');
    }

    logger.info(`🎯 [wheelBalance] ✅ Колесо створено, ID: ${wheelRecord.id}`);
    logger.info(`🎯 [wheelBalance] ✅ Початковий Step: ${wheelRecord.fields.Step}`);

    const firstSphere = LIFE_SPHERES[0] || 'Невідома сфера';
    const message = 
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 1 до 10, де:\n` +
      `1 = дуже погано, 10 = ідеально\n\n` +
      `1️⃣/8 ${firstSphere}\n\nОцінка (1-10):`;

    logger.info(`🎯 [wheelBalance] ✅ Готовий до відправки першого питання`);

    return {
      message,
      recordId: wheelRecord.id,
      currentSphere: 0,
      totalSpheres: LIFE_SPHERES.length
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА створення колеса:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    throw error;
  }
};

// ✅ ВИПРАВЛЕНА ОБРОБКА ВІДПОВІДІ КОРИСТУВАЧА
const processWheelAnswer = async (tgId, score) => {
  try {
    logger.info(`🎯 [wheelBalance] ========== ОБРОБКА ВІДПОВІДІ ==========`);
    logger.info(`🎯 [wheelBalance] Користувач: ${tgId}`);
    logger.info(`🎯 [wheelBalance] Відповідь: "${score}"`);

    // ✅ ВАЛІДАЦІЯ ОЦІНКИ
    const scoreNum = parseInt(score, 10);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      logger.info(`❌ [wheelBalance] Невалідний бал: ${score}`);
      return { error: true, message: 'Будь ласка, введи число від 1 до 10' };
    }

    // ✅ ОТРИМУЄМО АКТИВНЕ КОЛЕСО
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      logger.warn(`❌ [wheelBalance] Активне колесо не знайдено для ${tgId}`);
      return { error: true, message: 'Активне колесо не знайдено. Почни спочатку.' };
    }

    logger.info(`🎯 [wheelBalance] Знайдено активне колесо, ID: ${activeWheel.id}`);

    const fields = activeWheel.fields;
    const currentStep = Number.isInteger(fields.Step) && fields.Step >= 0 && fields.Step < LIFE_SPHERES.length 
      ? fields.Step 
      : 0;

    logger.info(`🎯 [wheelBalance] Поточний крок (Step): ${currentStep}`);

    // ✅ ОТРИМУЄМО ДАНІ ПОТОЧНОЇ СФЕРИ
    const sphereName = LIFE_SPHERES[currentStep] || 'Невідома сфера';
    const airtableField = SPHERE_FIELDS[currentStep];

    if (!airtableField) {
      logger.error(`❌ [wheelBalance] Некоректне поле для кроку ${currentStep}: ${airtableField}`);
      return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
    }

    logger.info(`🎯 [wheelBalance] Сфера: ${sphereName}`);
    logger.info(`🎯 [wheelBalance] Поле Airtable: ${airtableField}`);
    logger.info(`🎯 [wheelBalance] Оцінка: ${scoreNum}`);

    // ✅ ГОТУЄМО ДАНІ ДЛЯ ОНОВЛЕННЯ
    const updateFields = { [airtableField]: scoreNum };
    
    // ✅ ПЕРЕВІРЯЄМО ЧИ ЦЕ ОСТАННЯ СФЕРА
    const isLastSphere = currentStep >= (LIFE_SPHERES.length - 1);
    
    if (isLastSphere) {
      // ✅ ЗАВЕРШУЄМО КОЛЕСО
      logger.info(`🎯 [wheelBalance] Це остання сфера (${currentStep + 1}/${LIFE_SPHERES.length}), завершуємо колесо`);
      
      // Збираємо всі оцінки для розрахунку загального балу
      const allScores = [];
      for (let i = 0; i < LIFE_SPHERES.length - 1; i++) {
        const fieldName = SPHERE_FIELDS[i];
        const score = Number(fields[fieldName]) || 0;
        allScores.push(score);
      }
      allScores.push(scoreNum); // додаємо останню оцінку

      const totalScore = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;

      updateFields.Status = 'Completed';
      updateFields.Completed_Date = new Date().toISOString().split('T')[0];
      updateFields.Total_Score = totalScore;
      
      // Step НЕ ЗМІНЮЄМО при завершенні

      logger.info(`🎯 [wheelBalance] Дані для завершення:`, updateFields);
      logger.info(`🎯 [wheelBalance] Загальний бал: ${totalScore}`);
      logger.info(`🎯 [wheelBalance] Всі оцінки: [${allScores.join(', ')}]`);

    } else {
      // ✅ ПЕРЕХОДИМО ДО НАСТУПНОЇ СФЕРИ
      const nextStep = currentStep + 1;
      updateFields.Step = nextStep;
      
      logger.info(`🎯 [wheelBalance] Переходимо до наступної сфери: ${nextStep} (${LIFE_SPHERES[nextStep]})`);
      logger.info(`🎯 [wheelBalance] Дані для оновлення:`, updateFields);
    }

    // ✅ ОНОВЛЮЄМО ЗАПИС В AIRTABLE
    try {
      await base(tables.WHEEL_BALANCE).update(activeWheel.id, updateFields);
      logger.info(`🎯 [wheelBalance] ✅ Запис успішно оновлено`);
    } catch (updateError) {
      logger.error('❌ [wheelBalance] Помилка оновлення запису:', {
        message: updateError.message,
        stack: updateError.stack,
        statusCode: updateError.statusCode,
        response: updateError.response?.data,
        updateFields
      });
      return { error: true, message: 'Виникла помилка при збереженні. Спробуй ще раз.' };
    }

    // ✅ ФОРМУЄМО ВІДПОВІДЬ КОРИСТУВАЧУ
    if (isLastSphere) {
      logger.info(`🎯 [wheelBalance] ✅ Колесо завершено для ${tgId}`);
      
      const analysis = await generateWheelAnalysisFromScores(
        SPHERE_FIELDS.map((field, index) => {
          if (index === currentStep) return scoreNum;
          return Number(fields[field]) || 0;
        })
      );

      const message = 
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n${analysis}`;

      return { message, completed: true, analysis };

    } else {
      const nextStep = currentStep + 1;
      const nextSphereName = LIFE_SPHERES[nextStep] || 'Невідома сфера';
      
      const message = 
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `${nextStep + 1}️⃣/8 ${nextSphereName}\n\n` +
        `Оцінка (1-10):`;

      logger.info(`🎯 [wheelBalance] ✅ Переходимо до сфери ${nextStep + 1}/8: ${nextSphereName}`);

      return {
        message,
        currentSphere: nextStep,
        totalSpheres: LIFE_SPHERES.length,
        completed: false
      };
    }

  } catch (error) {
    logger.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА обробки відповіді:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
  }
};

// ✅ AI-АНАЛІЗ ЗА ГОТОВИМИ БАЛАМИ
const generateWheelAnalysisFromScores = async (scoresArr) => {
  try {
    logger.info(`🎯 [wheelBalance] Генерація аналізу для оцінок: [${scoresArr.join(', ')}]`);
    
    const pairs = LIFE_SPHERES.map((name, i) => ({ 
      name: name || 'Невідома сфера', 
      score: scoresArr[i] || 0 
    }));
    
    const prompt =
      `Ти експертний коуч трансформації. Проаналізуй результати колеса балансу:\n\n` +
      `${pairs.map(s => `${s.name}: ${s.score}/10`).join('\n')}\n\n` +
      `Дай короткий аналіз (до 120 слів):\n` +
      `🌟 Сильні сторони: [2-3 найвищі сфери]\n` +
      `⚡ Точки росту: [1-2 найнижчі сфери]\n` +
      `🎯 Наступні кроки: [2-3 конкретні дії]\n\n` +
      `Тон: підтримуючий, з позиції сили. Українською мовою.`;

    const analysis = await chat(
      [
        { role: 'system', content: 'Ти експертний коуч. Аналізуй колесо балансу підтримуюче, конкретно.' },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    const finalAnalysis = analysis || '📊 Твоє колесо показує унікальний баланс. Продовжуй розвивати сильні сторони!';
    logger.info(`🎯 [wheelBalance] ✅ Аналіз згенеровано: ${finalAnalysis.length} символів`);
    
    return finalAnalysis;

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка генерації аналізу:', {
      message: error.message,
      stack: error.stack
    });
    return '📊 Дякуємо за заповнення колеса балансу! Продовжуй працювати над своїм розвитком.';
  }
};

// ✅ ОТРИМАННЯ АКТИВНОГО КОЛЕСА
const getActiveWheel = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] Пошук активного колеса для ${tgId}`);

    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    if (records.length > 0) {
      const wheel = records[0];
      logger.info(`🎯 [wheelBalance] ✅ Знайдено активне колесо:`, {
        id: wheel.id,
        step: wheel.fields.Step,
        status: wheel.fields.Status,
        createdDate: wheel.fields.Created_Date
      });
      return wheel;
    }
    
    logger.info(`🎯 [wheelBalance] ❌ Активне колесо не знайдено для ${tgId}`);
    return null;

  } catch (error) {
    logger.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА отримання активного колеса:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode
    });
    throw error;
  }
};

// ✅ ПЕРЕВІРКА ПОТРЕБИ В НОВОМУ КОЛЕСІ (раз на місяць)
const needsWheelBalance = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] Перевірка потреби в колесі для ${tgId}`);
    
    // Шукаємо останнє завершене колесо
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1,
        sort: [{ field: 'Completed_Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length === 0) {
      logger.info(`✅ [wheelBalance] Перше колесо для ${tgId}`);
      return true; // перше колесо
    }
    
    const lastWheel = records[0];
    const completedDate = new Date(lastWheel.fields.Completed_Date);
    const now = new Date();
    const daysDiff = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
    
    const needsNew = daysDiff >= 30; // раз на місяць
    logger.info(`🎯 [wheelBalance] Останнє колесо ${daysDiff} днів тому. Потреба: ${needsNew}`);
    
    return needsNew;
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return false;
  }
};

// ✅ ОТРИМАННЯ СТАТИСТИКИ КОРИСТУВАЧА
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
    logger.error('❌ [wheelBalance] Помилка отримання статистики:', error);
    return { total: 0, lastScore: null, lastDate: null, records: [] };
  }
};

export default {
  startWheelBalance,
  processWheelAnswer,
  getActiveWheel,
  needsWheelBalance,
  getUserWheelStats,
};