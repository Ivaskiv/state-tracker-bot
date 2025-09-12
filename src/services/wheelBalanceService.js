// src/services/wheelBalanceService.js
import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';
import { LIFE_SPHERES, SPHERE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ✅ Перевірка конфігурації
if (LIFE_SPHERES.length !== SPHERE_FIELDS.length) {
  logger.error('❌ [wheelBalance] Невідповідність довжини LIFE_SPHERES і SPHERE_FIELDS:', {
    lifeSpheresLength: LIFE_SPHERES.length,
    sphereFieldsLength: SPHERE_FIELDS.length
  });
  throw new Error('LIFE_SPHERES and SPHERE_FIELDS must have the same length');
}

// ✅ Старт нового колеса
const startWheelBalance = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] Початок колеса балансу для ${tgId}`);
    const wheelData = {
      fields: {
        TG_id: String(tgId),
        Status: 'Active',
        Step: 0,
        Created_Date: new Date().toISOString().split('T')[0]
      }
    };

    logger.info(`🎯 [wheelBalance] Дані для створення:`, JSON.stringify(wheelData, null, 2));
    
    if (!wheelData.fields.TG_id || !wheelData.fields.Created_Date) {
      logger.error(`❌ [wheelBalance] Некоректні дані для створення:`, wheelData);
      throw new Error('Invalid wheel balance data');
    }

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData]);

    if (!wheelRecord) {
      logger.error(`❌ [wheelBalance] Не вдалося створити запис у ${tables.WHEEL_BALANCE}`);
      throw new Error('Failed to create wheel balance record');
    }

    logger.info(`🎯 [wheelBalance] ✅ Створено запис ID: ${wheelRecord.id}`);

    const firstSphere = LIFE_SPHERES[0] || 'Невідома сфера';
    const message =
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 1 до 10, де:\n` +
      `1 = дуже погано\n10 = ідеально\n\n` +
      `1️⃣/8 ${firstSphere}\n\nОцінка (1-10):`;

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

// ✅ Обробка відповіді користувача
const processWheelAnswer = async (tgId, score) => {
  try {
    logger.info(`🎯 [wheelBalance] Обробка відповіді від ${tgId}: "${score}"`);

    const scoreNum = parseInt(score, 10);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      logger.info(`❌ [wheelBalance] Невалідний бал: ${score}`);
      return { error: true, message: 'Будь ласка, введи число від 1 до 10' };
    }

    const filterFormula = `AND({TG_id}="${tgId}", {Status}="Active")`;
    logger.info(`🎯 [wheelBalance] Фільтр: ${filterFormula}`);

    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    logger.info(`🎯 [wheelBalance] Знайдено активних записів: ${records.length}`);
    if (!records.length) {
      logger.warn(`❌ [wheelBalance] Активне колесо не знайдено для ${tgId}`);
      return { error: true, message: 'Активне колесо не знайдено. Почни спочатку.' };
    }

    const record = records[0];
    const fields = record.fields;
    const currentSphere = Number.isInteger(fields.Step) && fields.Step >= 0 && fields.Step < LIFE_SPHERES.length 
      ? fields.Step 
      : 0;
    const sphereName = LIFE_SPHERES[currentSphere] || 'Невідома сфера';
    const airtableField = SPHERE_FIELDS[currentSphere];

    if (!airtableField) {
      logger.error(`❌ [wheelBalance] Некоректне поле для сфери ${currentSphere}: ${airtableField}`);
      return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
    }

    logger.info(`🎯 [wheelBalance] Поточна сфера: ${currentSphere} (${sphereName})`);
    logger.info(`🎯 [wheelBalance] Поле Airtable: ${airtableField} = ${scoreNum}`);

    const updateFields = { [airtableField]: scoreNum };
    const nextSphere = currentSphere + 1;

    if (nextSphere < LIFE_SPHERES.length) {
      updateFields.Step = nextSphere;
      logger.info(`🎯 [wheelBalance] Переходимо до сфери: ${nextSphere} (${LIFE_SPHERES[nextSphere]})`);
      logger.info(`🎯 [wheelBalance] Дані для оновлення:`, JSON.stringify(updateFields, null, 2));

      try {
        await base(tables.WHEEL_BALANCE).update(record.id, updateFields);
        logger.info(`🎯 [wheelBalance] ✅ Запис оновлено: Step=${nextSphere}, ${airtableField}=${scoreNum}`);
      } catch (updateError) {
        logger.error('❌ [wheelBalance] Помилка оновлення запису:', {
          message: updateError.message,
          stack: updateError.stack,
          statusCode: updateError.statusCode,
          response: updateError.response?.data
        });
        return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
      }

      const nextSphereName = LIFE_SPHERES[nextSphere] || 'Невідома сфера';
      const message =
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `${nextSphere + 1}️⃣/8 ${nextSphereName}\n\n` +
        `Оцінка (1-10):`;

      return {
        message,
        currentSphere: nextSphere,
        totalSpheres: LIFE_SPHERES.length,
        completed: false
      };
    } else {
      // Фінальна сфера — завершуємо
      const existingScores = SPHERE_FIELDS.map((f, i) => (i === currentSphere ? scoreNum : Number(fields[f]) || 0));
      const totalScore = existingScores.reduce((a, b) => a + b, 0);

      updateFields.Status = 'Completed';
      updateFields.Completed_Date = new Date().toISOString().split('T')[0];
      updateFields.Total_Score = totalScore;

      logger.info(`🎯 [wheelBalance] Дані для завершення:`, JSON.stringify(updateFields, null, 2));
      try {
        await base(tables.WHEEL_BALANCE).update(record.id, updateFields);
        logger.info(`🎯 [wheelBalance] ✅ Запис завершено: Status=Completed, Total_Score=${totalScore}`);
      } catch (updateError) {
        logger.error('❌ [wheelBalance] Помилка завершення запису:', {
          message: updateError.message,
          stack: updateError.stack,
          statusCode: updateError.statusCode,
          response: updateError.response?.data
        });
        return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
      }

      logger.info(`🎯 [wheelBalance] ✅ Колесо завершено, генеруємо аналіз`);
      const analysis = await generateWheelAnalysisFromScores(existingScores);

      const message =
        `✅ ${sphereName}: ${scoreNum}/10\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n${analysis}`;

      return { message, completed: true, analysis };
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

// ✅ AI-аналіз за готовими балами
const generateWheelAnalysisFromScores = async (scoresArr) => {
  try {
    const pairs = LIFE_SPHERES.map((name, i) => ({ name: name || 'Невідома сфера', score: scoresArr[i] || 0 }));
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

    return analysis || '📊 Твоє колесо показує унікальний баланс. Продовжуй розвивати сильні сторони!';
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка генерації аналізу:', {
      message: error.message,
      stack: error.stack
    });
    return '📊 Дякуємо за заповнення колеса балансу! Продовжуй працювати над своїм розвитком.';
  }
};

// ✅ Отримання активного колеса
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
      return records[0];
    }
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

export default {
  startWheelBalance,
  processWheelAnswer,
  getActiveWheel,
};