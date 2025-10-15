// src/features/wheelBalance/flow.js
import { getBase, tables, createRows, updateRows } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from '../../config/constants.js';
import * as utils from './utils.js';
import keyboards, {
  wheelScoreKeyboard,
  wheelCompletedKeyboard,
  wheelActiveKeyboard,
  wheelNoteKeyboard
} from '../../utils/keyboards.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';

const base = getBase();

// ===============================================================
// 🎯 СТАРТ КОЛЕСА БАЛАНСУ
// ===============================================================
export const startWheelBalance = async (tgId, userName) => {
  try {
    logger.info(`🎯 [wheelBalance] Старт для ${tgId}`);

    const existingWheel = await getLatestCompletedWheel(tgId);

    if (existingWheel) {
      const wheelData = existingWheel.fields;
      const createdDate = wheelData.Created_Date;
      const analysis = wheelData.AI_Analysis || 'Аналіз недоступний';

      const createdDateObj = new Date(createdDate);
      const nextWheelDate = new Date(createdDateObj);
      nextWheelDate.setMonth(nextWheelDate.getMonth() + 1);

      const today = new Date();
      const daysUntilNext = Math.ceil((nextWheelDate - today) / (1000 * 60 * 60 * 24));

      let message =
        `📊 **ТВОЄ КОЛЕСО БАЛАНСУ**\n\n` +
        `Останнє заповнення: ${formatDate(createdDate)}\n\n` +
        `**AI Аналіз:**\n${analysis}\n\n`;

      if (daysUntilNext > 0) {
        message += `⏰ Наступне колесо рекомендовано через ${daysUntilNext} ${getDaysWord(daysUntilNext)}\n\n`;
        message += `💡 Колесо балансу краще проходити раз на місяць для відстеження прогресу.`;
      } else {
        message += `✅ Час для нового колеса балансу!\n\n`;
        message += `💡 Минув місяць — можна оновити оцінки.`;
      }

      return { error: false, message, keyboard: wheelCompletedKeyboard() };
    }

    const activeWheel = await getActiveWheel(tgId);

    if (activeWheel) {
      const step = activeWheel.fields.Step || 1;
      const sphere = LIFE_SPHERES[step - 1];

      return {
        error: false,
        message: `У тебе вже є незавершене колесо на кроці ${step}/8.\n\n📍 Сфера: **${sphere.label}**\n\nПродовжити?`,
        keyboard: wheelActiveKeyboard()
      };
    }

    const newWheel = await createRows(tables.WHEEL_BALANCE, [
      {
        fields: {
          TG_id: String(tgId),
          'User Name': userName,
          Status: 'In Progress',
          Step: 1,
          Created_Date: new Date().toISOString().split('T')[0]
        }
      }
    ]);

    logger.info(`✅ [wheelBalance] Створено колесо ${newWheel[0].id} для ${tgId}`);

    const firstSphere = LIFE_SPHERES[0];

    return {
      error: false,
      message: utils.getWheelInfo(firstSphere, 1),
      keyboard: wheelScoreKeyboard()
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] startWheelBalance:', error);
    return { error: true, message: '❌ Помилка створення колеса. Спробуй ще раз.' };
  }
};

// ===============================================================
// 🔄 СТВОРИТИ / ПЕРЕЗАПУСТИТИ КОЛЕСО
// ===============================================================
export const startNewWheelIgnoreOld = async (tgId, userName) => {
  try {
    logger.info(`🔄 [wheelBalance] Перезапуск колеса для ${tgId}`);

    const activeWheel = await getActiveWheel(tgId);
    if (activeWheel) {
      await updateRows(tables.WHEEL_BALANCE, [{
        id: activeWheel.id,
        fields: { Status: 'Cancelled' }
      }]);
    }

    const lastWheel = await getLastWheel(tgId);

    let wheelId;

    if (lastWheel) {
      const createdDate = new Date(lastWheel.fields.Created_Date);
      const today = new Date();
      const daysSince = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

      if (daysSince < 30) {
        logger.info(`[wheelBalance] 🔄 Оновлюємо існуюче колесо (${daysSince} днів з останнього)`);
        
        // ✅ ТІЛЬКИ Status та Step, решта оновиться по ходу
        await updateRows(tables.WHEEL_BALANCE, [{
          id: lastWheel.id,
          fields: {
            Status: 'In Progress',
            Step: 1
          }
        }]);

        wheelId = lastWheel.id;
      } else {
        logger.info(`[wheelBalance] 🆕 Створюємо нове колесо (минуло ${daysSince} днів)`);
        
        const newWheel = await createRows(tables.WHEEL_BALANCE, [{
          fields: {
            TG_id: String(tgId),
            "User Name": userName,
            Status: 'In Progress',
            Step: 1,
            Created_Date: new Date().toISOString().split('T')[0]
          }
        }]);

        wheelId = newWheel[0].id;
      }
    } else {
      const newWheel = await createRows(tables.WHEEL_BALANCE, [{
        fields: {
          TG_id: String(tgId),
          "User Name": userName,
          Status: 'In Progress',
          Step: 1,
          Created_Date: new Date().toISOString().split('T')[0]
        }
      }]);

      wheelId = newWheel[0].id;
    }

    logger.info(`✅ [wheelBalance] Колесо готове: ${wheelId}`);

    const firstSphere = LIFE_SPHERES[0];

    return {
      error: false,
      message: utils.getWheelInfo(firstSphere, 1),
      keyboard: wheelScoreKeyboard()
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] startNewWheelIgnoreOld:', error);
    return {
      error: true,
      message: '❌ Помилка створення колеса'
    };
  }
};

/**
 * Отримати останнє колесо (будь-якого статусу)
 */
export const getLastWheel = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created_Date', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      logger.info(`[wheelBalance] ℹ️ Коліс не знайдено для ${tgId}`);
      return null;
    }

    logger.info(`[wheelBalance] ✅ Знайдено колесо від ${records[0].fields.Created_Date}`);
    return records[0];

  } catch (error) {
    logger.error('[wheelBalance] ❌ getLastWheel:', error);
    return null;
  }
};

// ===============================================================
// ▶️ ПРОДОВЖИТИ АКТИВНЕ КОЛЕСО
// ===============================================================
export const continueActiveWheel = async (tgId, ctx) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) return { error: true, message: '❌ Активне колесо не знайдено. Почни нове!' };

    const step = activeWheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];

    return { error: false, message: utils.getWheelInfo(sphere, step), keyboard: wheelScoreKeyboard() };
  } catch (error) {
    logger.error('❌ [wheelBalance] continueActiveWheel:', error);
    return { error: true, message: '❌ Помилка продовження колеса' };
  }
};

// ===============================================================
// 💾 ЗБЕРЕГТИ ОЦІНКУ
// ===============================================================
export const processWheelAnswer = async (tgId, score, ctx) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      await ctx.reply('❌ Активне колесо не знайдено. Почни нове!', keyboards.mainMenuKeyboard());
      return { error: true };
    }

    const step = activeWheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];

    await updateRows(tables.WHEEL_BALANCE, [{ id: activeWheel.id, fields: { [sphere.key]: score } }]);
    logger.info(`[wheelBalance] ✅ Оцінка ${score} для ${sphere.label} збережена`);

    await ctx.reply(
      `✅ Оцінка ${score}/10 для сфери "${sphere.label}" збережена!\n\n` +
      `💭 Напиши коротку нотатку про цю сферу:\n` +
      `• Що працює добре?\n` +
      `• Що хочеш покращити?\n` +
      `• Які є плани?\n\n` +
      `Або натисни "Пропустити" ⤵️`,
      wheelNoteKeyboard(step)
    );

    return { error: false };
  } catch (error) {
    logger.error('❌ [wheelBalance] processWheelAnswer:', error);
    await ctx.reply('❌ Помилка збереження оцінки', keyboards.mainMenuKeyboard());
    return { error: true };
  }
};

// ===============================================================
// 🗒️ ЗБЕРЕГТИ НОТАТКУ ТА ПЕРЕЙТИ ДАЛІ
// ===============================================================
export const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    const tgId = ctx.from.id;
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) return { error: true, message: '❌ Активне колесо не знайдено' };

    const step = activeWheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];
    const noteField = `${sphere.key}_Notes`;

    await updateRows(tables.WHEEL_BALANCE, [
      { id: activeWheel.id, fields: { [noteField]: noteText || 'Без нотатки' } }
    ]);
    logger.info(`[wheelBalance] ✅ Нотатка для ${sphere.label} збережена`);

    if (step >= 8) return await completeWheel(tgId, activeWheel.id, ctx);

    const nextStep = step + 1;
    const nextSphere = LIFE_SPHERES[nextStep - 1];
    await updateRows(tables.WHEEL_BALANCE, [{ id: activeWheel.id, fields: { Step: nextStep } }]);

    return { error: false, completed: false, message: utils.getWheelInfo(nextSphere, nextStep), keyboard: wheelScoreKeyboard() };
  } catch (error) {
    logger.error('❌ [wheelBalance] saveWheelNoteAndGoNext:', error);
    return { error: true, message: '❌ Помилка збереження нотатки' };
  }
};

// ===============================================================
// ✅ ЗАВЕРШЕННЯ КОЛЕСА
// ===============================================================
const completeWheel = async (tgId, wheelId, ctx) => {
  try {
    logger.info(`[wheelBalance] 🎉 Завершення колеса для ${tgId}`);
    const wheel = await base(tables.WHEEL_BALANCE).find(wheelId);
    const fields = wheel.fields;

    const scores = LIFE_SPHERES.map(s => fields[s.key] || 0);
    const totalScore = scores.reduce((a, b) => a + b, 0);

    let analysis = 'Аналіз генерується...';
    try {
      const analysisModule = await import('./analysis.js');
      analysis = await analysisModule.generateWheelAnalysis(scores);
    } catch (aiError) {
      logger.warn('[wheelBalance] ⚠️ AI аналіз недоступний:', aiError.message);
      analysis = `✅ Загальна оцінка: ${totalScore}/80\n\n📊 Колесо балансу заповнено!`;
    }

    await updateRows(tables.WHEEL_BALANCE, [
      {
        id: wheelId,
        fields: {
          Status: 'Completed',
          Completed_Date: new Date().toISOString().split('T')[0],
          Total_Score: totalScore,
          AI_Analysis: analysis
        }
      }
    ]);

    return {
      error: false,
      completed: true,
      message:
        `🎉 **КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!**\n\n${analysis}\n\n💡 Колесо рекомендується оновлювати раз на місяць для відстеження прогресу.`
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] completeWheel:', error);
    return { error: true, message: '❌ Помилка завершення колеса' };
  }
};

// ===============================================================
// 🔍 СТАТУС / ДОПОМІЖНІ
// ===============================================================
export const isAwaitingNote = async (tgId) => {
  try {
    console.log(`[isAwaitingNote] 🔍 Початок перевірки для ${tgId}`);

    const activeWheel = await getActiveWheel(tgId);
    
    if (!activeWheel) {
      console.log(`[isAwaitingNote] ❌ Активного колеса немає`);
      return false;
    }

    console.log(`[isAwaitingNote] ✅ Активне колесо знайдено: ${activeWheel.id}`);

    const step = activeWheel.fields.Step || 1;
    
    if (step < 1 || step > 8) {
      console.log(`[isAwaitingNote] ❌ Некоректний step: ${step}`);
      return false;
    }

    const sphere = LIFE_SPHERES[step - 1];

    if (!sphere) {
      console.log(`[isAwaitingNote] ❌ Sphere не знайдено для step ${step}`);
      return false;
    }

    console.log(`[isAwaitingNote] 📍 Step: ${step}, Sphere: ${sphere.label}, Key: ${sphere.key}`);

    const scoreField = sphere.key;
    const noteField = `${sphere.key}_Notes`;

    const score = activeWheel.fields[scoreField];
    const note = activeWheel.fields[noteField];

    console.log(`[isAwaitingNote] 📊 ${scoreField} = ${score}, ${noteField} = ${note}`);

    const hasScore = score !== undefined && score !== null;
    const hasNote = note !== undefined && note !== null && note !== '';

    console.log(`[isAwaitingNote] 🔍 hasScore: ${hasScore}, hasNote: ${hasNote}`);

    if (hasScore && !hasNote) {
      console.log(`[isAwaitingNote] ✅ ЧЕКАЄМО НОТАТКУ для ${sphere.label}`);
      return { step, sphere };
    }

    console.log(`[isAwaitingNote] ℹ️ НЕ чекаємо нотатку`);
    return false;

  } catch (error) {
    console.error('[isAwaitingNote] ❌ Помилка:', error);
    console.error('[isAwaitingNote] Stack:', error.stack);
    return false;
  }
};


export const cancelActiveWheel = async (tgId) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) return;

    await updateRows(tables.WHEEL_BALANCE, [
      { id: activeWheel.id, fields: { Status: 'Cancelled' } }
    ]);
    logger.info(`[wheelBalance] ✅ Колесо скасовано для ${tgId}`);
  } catch (error) {
    logger.error('[wheelBalance] ❌ cancelActiveWheel:', error);
  }
};

export const getActiveWheel = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "In Progress")`;
    const records = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: formula, sort: [{ field: 'Created_Date', direction: 'desc' }], maxRecords: 1 })
      .firstPage();
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('[wheelBalance] ❌ getActiveWheel:', error);
    return null;
  }
};

export const getLatestCompletedWheel = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "Completed")`;
    const records = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: formula, sort: [{ field: 'Created_Date', direction: 'desc' }], maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return null;
    logger.info(`[wheelBalance] ✅ Знайдено колесо від ${records[0].fields.Created_Date}`);
    return records[0];
  } catch (error) {
    logger.error('[wheelBalance] ❌ getLatestCompletedWheel:', error);
    return null;
  }
};


console.log('✅ [wheelBalance/flow] Flow логіка завантажена');
