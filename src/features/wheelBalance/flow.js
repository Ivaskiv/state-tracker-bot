// src/features/wheelBalance/flow.js
import { getBase, tables, createRows, updateRows } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from '../../config/index.js';
import * as utils from './utils.js';
import keyboards, {
  wheelScoreKeyboard,
  wheelCompletedKeyboard,
  wheelActiveKeyboard,
  wheelNoteKeyboard,
  wheelCooldownKeyboard
} from '../../utils/keyboards.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';

const base = getBase();

// Utility to get note field name for a sphere key
export const getNoteField = (sphereKey) => ({
  Health: 'Health_Notes',
  Self_Growth: 'Self_Growth_Notes',
  Relationships: 'Relationships_Notes',
  Career_Business: 'Career_Notes',
  Finance: 'Finance_Notes',
  Rest_Leisure: 'Leisure_Notes',
  Spirituality: 'Spirituality_Notes',
  Housing: 'Housing_Notes'
}[sphereKey]);

// ===============================================================
// 🎯 СТАРТ / ОНОВЛЕННЯ КОЛЕСА
// ===============================================================
export const startWheelBalance = async (tgId, userName) => {
  try {
    logger.info(`🎯 [wheelBalance] Старт для ${tgId}`);

    const existing = await getActiveWheel(tgId);
    if (existing) {
      const step = existing.fields.Step || 1;
      const sphere = LIFE_SPHERES[step - 1];
      return {
        error: false,
        message: `🔄 Ти вже почав колесо балансу (крок ${step}/8)\n\n📍 Сфера: *${sphere.label}*\n\nПродовжити?`,
        keyboard: wheelActiveKeyboard()
      };
    }

    const last = await getLatestCompletedWheel(tgId);
    if (last) {
      const date = last.fields.Created_Date;
      const analysis = last.fields.AI_Analysis || 'Аналіз недоступний';
      const next = new Date(date);
      next.setMonth(next.getMonth() + 1);
      const daysLeft = Math.ceil((next - new Date()) / (1000 * 60 * 60 * 24));

      return {
        error: false,
        message:
          `📊 *ТВОЄ КОЛЕСО БАЛАНСУ*\n\n` +
          `Останнє: ${formatDate(date)}\n\n` +
          `**AI аналіз:**\n${analysis}\n\n` +
          (daysLeft > 0
            ? `⏰ Наступне через ${daysLeft} ${getDaysWord(daysLeft)}`
            : `✅ Можеш оновити оцінки прямо зараз!`),
        keyboard: wheelCompletedKeyboard()
      };
    }

    // ➕ Створити нове колесо
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

    const firstSphere = LIFE_SPHERES[0];
    logger.info(`✅ [wheelBalance] Створено колесо ${newWheel[0].id}`);

    return {
      error: false,
      message: utils.getWheelInfo(firstSphere, 1),
      keyboard: wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('❌ [wheelBalance] startWheelBalance:', e);
    return { error: true, message: '❌ Помилка запуску колеса' };
  }
};

// ✅ UPDATED FUNCTION: Start a new wheel, allowing immediate restart
export const startNewWheelIgnoreOld = async (tgId, userName, forceRestart = false) => {
  try {
    logger.info(`🎯 [wheelBalance] Старт нового колеса для ${tgId}, forceRestart: ${forceRestart}`);

    // Check 30-day restriction unless forceRestart is true
    if (!forceRestart) {
      const lastCompleted = await getLatestCompletedWheel(tgId);
      if (lastCompleted) {
        const completedDate = new Date(lastCompleted.fields.Completed_Date || lastCompleted.fields.Created_Date);
        const daysSince = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSince < 30) {
          const daysLeft = Math.max(1, 30 - daysSince);
          return {
            error: true,
            message:
              `⏰ Ти нещодавно завершив колесо (${formatDate(completedDate)}).\n\n` +
              `Наступне доступне через ${daysLeft} ${getDaysWord(daysLeft)}.`,
            keyboard: wheelCooldownKeyboard()
          };
        }
      }
    }

    // Check for active or incomplete wheel
    const existing = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", OR({Status}="In Progress", {Status}="Incomplete"))`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    if (existing.length > 0) {
      const wheel = existing[0];
      await updateRows(tables.WHEEL_BALANCE, [
        {
          id: wheel.id,
          fields: {
            Status: 'In Progress',
            Step: 1,
            'User Name': userName,
            Created_Date: new Date().toISOString().split('T')[0],
            Health: null,
            Self_Growth: null,
            Relationships: null,
            Career_Business: null,
            Finance: null,
            Rest_Leisure: null,
            Spirituality: null,
            Housing: null,
            Health_Notes: null,
            Self_Growth_Notes: null,
            Relationships_Notes: null,
            Career_Notes: null,
            Finance_Notes: null,
            Leisure_Notes: null,
            Spirituality_Notes: null,
            Housing_Notes: null
          }
        }
      ]);

      logger.info(`✅ [wheelBalance] Оновлено існуюче колесо ${wheel.id} для ${tgId}`);
      const firstSphere = LIFE_SPHERES[0];
      return {
        error: false,
        message: utils.getWheelInfo(firstSphere, 1),
        keyboard: wheelScoreKeyboard()
      };
    }

    // Create new wheel
    const created = await createRows(tables.WHEEL_BALANCE, [
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

    logger.info(`✅ [wheelBalance] Створено нове колесо ${created[0].id} для ${tgId}`);
    const firstSphere = LIFE_SPHERES[0];
    return {
      error: false,
      message: utils.getWheelInfo(firstSphere, 1),
      keyboard: wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('❌ [wheelBalance] startNewWheelIgnoreOld:', e);
    return { error: true, message: '❌ Помилка запуску нового колеса' };
  }
};

// ===============================================================
// 💾 ЗБЕРЕГТИ ОЦІНКУ
// ===============================================================
export const processWheelAnswer = async (tgId, score, ctx) => {
  try {
    const wheel = await getActiveWheel(tgId);
    if (!wheel) {
      await ctx.reply('❌ Немає активного колеса. Почни нове!', keyboards.mainMenuKeyboard());
      return { error: true };
    }

    const step = wheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];

    await updateRows(tables.WHEEL_BALANCE, [
      { id: wheel.id, fields: { [sphere.key]: score } }
    ]);

    logger.info(`[wheelBalance] ✅ ${sphere.label} → ${score}/10`);

    await ctx.reply(
      `✅ Оцінка ${score}/10 для сфери *${sphere.label}* збережена!\n\n` +
        `💭 Напиши коротку нотатку про цю сферу:\n` +
        `• Що працює добре?\n• Що хочеш покращити?\n• Які є плани?\n\n` +
        `Або натисни "Пропустити" ⤵️`,
      wheelNoteKeyboard(step)
    );

    return { error: false };
  } catch (e) {
    logger.error('[wheelBalance] ❌ processWheelAnswer:', e);
    await ctx.reply('❌ Помилка при збереженні оцінки', keyboards.mainMenuKeyboard());
    return { error: true };
  }
};

// ===============================================================
// 🗒️ ЗБЕРЕГТИ НОТАТКУ І ПЕРЕЙТИ ДАЛІ
// ===============================================================
export const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    const tgId = ctx.from.id;
    const wheel = await getActiveWheel(tgId);
    if (!wheel) return { error: true, message: '❌ Колесо не знайдено' };

    const step = wheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];
    const noteField = getNoteField(sphere.key);

    await updateRows(tables.WHEEL_BALANCE, [
      { id: wheel.id, fields: { [noteField]: noteText || 'Без нотатки' } }
    ]);

    logger.info(`[wheelBalance] ✏️ Нотатка для ${sphere.label} збережена`);

    if (step >= LIFE_SPHERES.length) {
      return await completeWheel(tgId, wheel.id, ctx);
    }

    const nextStep = step + 1;
    const nextSphere = LIFE_SPHERES[nextStep - 1];
    await updateRows(tables.WHEEL_BALANCE, [
      { id: wheel.id, fields: { Step: nextStep } }
    ]);

    return {
      error: false,
      completed: false,
      message: utils.getWheelInfo(nextSphere, nextStep),
      keyboard: wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('[wheelBalance] ❌ saveWheelNoteAndGoNext:', e);
    return { error: true, message: '❌ Помилка збереження нотатки' };
  }
};

// ===============================================================
// ✅ ЗАВЕРШИТИ КОЛЕСО
// ===============================================================
const completeWheel = async (tgId, wheelId, ctx) => {
  try {
    logger.info(`[wheelBalance] 🏁 Завершення колеса для ${tgId}`);

    const record = await base(tables.WHEEL_BALANCE).find(wheelId);
    const fields = record.fields;
    const scores = LIFE_SPHERES.map((s) => fields[s.key] || 0);
    const total = scores.reduce((a, b) => a + b, 0);

    let analysis;
    try {
      const { generateWheelAnalysis } = await import('./analysis.js');
      analysis = await generateWheelAnalysis(scores);
    } catch (error) {
      logger.error('[wheelBalance] ❌ Помилка аналізу:', error);
      const average = (total / scores.length).toFixed(1);
      const strong = [];
      const weak = [];

      scores.forEach((score, i) => {
        if (score >= 9) strong.push({ label: LIFE_SPHERES[i].label, score });
        if (score <= 5) weak.push({ label: LIFE_SPHERES[i].label, score });
      });

      const strongText = strong.length > 0
        ? strong.map(s => `${s.label} (${s.score})`).join(', ')
        : 'немає сфер з оцінкою ≥9';
      const weakText = weak.length > 0
        ? weak.map(w => `${w.label} (${w.score})`).join(', ')
        : 'немає сфер з оцінкою ≤5';

      analysis = (
        `✅ Середній бал: ${average}/10\n\n` +
        `🌟 Сильні: ${strongText}\n` +
        `⚡ Увага: ${weakText}\n\n` +
        `🎯 Зосередься на сферах ≤5 - це точки росту.\n` +
        `📈 Відстежуй прогрес щомісяця.`
      );
    }

    await updateRows(tables.WHEEL_BALANCE, [
      {
        id: wheelId,
        fields: {
          Status: 'Completed',
          Completed_Date: new Date().toISOString().split('T')[0],
          Total_Score: total,
          AI_Analysis: analysis
        }
      }
    ]);

    await ctx.reply(
      `🎉 *КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!*\n\n${analysis}\n\n` +
        `💡 Рекомендую оновлювати раз на місяць.`,
      wheelCompletedKeyboard()
    );

    return { error: false, completed: true };
  } catch (e) {
    logger.error('[wheelBalance] ❌ completeWheel:', e);
    return { error: true, message: '❌ Помилка завершення' };
  }
};

// ===============================================================
// 🔍 СТАТУС / ДОПОМІЖНІ
// ===============================================================
export const getActiveWheel = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "In Progress")`;
    const res = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();
    return res[0] || null;
  } catch (e) {
    logger.error('[wheelBalance] getActiveWheel:', e);
    return null;
  }
};

export const getLatestCompletedWheel = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "Completed")`;
    const res = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created_Date', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();
    return res[0] || null;
  } catch (e) {
    logger.error('[wheelBalance] getLatestCompletedWheel:', e);
    return null;
  }
};

export const isAwaitingNote = async (tgId) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) return null;

    const step = Number(activeWheel.fields.Step || 0);
    const scoreField = LIFE_SPHERES[step - 1]?.key;
    const score = activeWheel.fields[scoreField];

    if (score != null) {
      return {
        recordId: activeWheel.id,
        step,
        score,
        sphereName: LIFE_SPHERES[step - 1]?.label
      };
    }

    return null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка isAwaitingNote:', error);
    return null;
  }
};

export const cancelActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", {Status}="In Progress")` })
      .all();

    if (records.length > 0) {
      await updateRows(tables.WHEEL_BALANCE, [
        ...records.map(r => ({ id: r.id, fields: { Status: 'Incomplete' } }))
      ]);
      logger.info(`✅ [wheelBalance] Скасовано ${records.length} коліс для ${tgId}`);
    }

    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка cancelActiveWheel:', error);
    return false;
  }
};
/**
 * Продовжити активне колесо з поточного кроку
 */
export const continueActiveWheel = async (tgId, ctx) => {
  try {
    logger.info(`[wheelBalance] ▶️ Продовження колеса для ${tgId}`);

    const wheel = await getActiveWheel(tgId);
    if (!wheel) {
      return {
        error: true,
        message: '❌ Немає активного колеса. Почни нове!'
      };
    }

    const step = wheel.fields.Step || 1;
    const LIFE_SPHERES_IMPORT = (await import('../../config/index.js')).LIFE_SPHERES;
    
    if (step > LIFE_SPHERES_IMPORT.length) {
      // Колесо вже завершено
      return {
        error: true,
        message: '✅ Колесо вже завершено!',
        keyboard: wheelCompletedKeyboard()
      };
    }

    const sphere = LIFE_SPHERES_IMPORT[step - 1];
    
    return {
      error: false,
      message: utils.getWheelInfo(sphere, step),
      keyboard: wheelScoreKeyboard()
    };
  } catch (error) {
    logger.error('[wheelBalance] ❌ continueActiveWheel:', error);
    return {
      error: true,
      message: '❌ Помилка продовження колеса'
    };
  }
};
export const goBackWheelStep = async (tgId, ctx) => {
  try {
    const wheel = await getActiveWheel(tgId);
    if (!wheel) {
      await ctx.reply('❌ Немає активного колеса. Почни нове!', keyboards.mainMenuKeyboard());
      return { error: true };
    }

    const step = wheel.fields.Step || 1;
    const awaitingNote = await isAwaitingNote(tgId);

    if (awaitingNote) {
      const sphere = LIFE_SPHERES[step - 1];
      await ctx.reply(
        utils.getWheelInfo(sphere, step),
        wheelScoreKeyboard()
      );
      return { error: false };
    } else if (step > 1) {
      const newStep = step - 1;
      const sphere = LIFE_SPHERES[newStep - 1];
      await updateRows(tables.WHEEL_BALANCE, [
        {
          id: wheel.id,
          fields: {
            Step: newStep,
            [sphere.key]: null,
            [getNoteField(sphere.key)]: null,
          },
        },
      ]);
      await ctx.reply(
        `✅ Повернення до сфери *${sphere.label}* (крок ${newStep}/8)\n\n` +
          `💭 Напиши нотатку або пропусти:`,
        wheelNoteKeyboard(newStep)
      );
      return { error: false };
    } else {
      await ctx.reply(
        '⬅️ Це перший крок, повернутися далі неможливо.',
        wheelScoreKeyboard()
      );
      return { error: false };
    }
  } catch (e) {
    logger.error('❌ [wheelBalance] goBackWheelStep:', e);
    await ctx.reply('❌ Помилка при поверненні назад', keyboards.mainMenuKeyboard());
    return { error: true };
  }
};

console.log('✅ [wheelBalance/flow] Flow логіка оновлена — оцінка → нотатка → назад');