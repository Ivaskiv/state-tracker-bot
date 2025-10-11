// src/services/wheelBalance/flow.js
import { 
  getActiveWheel, 
  cancelActiveWheel, 
  createWheel, 
  updateWheel, 
  completeWheel 
} from './database.js';
import { 
  buildScoreKeyboard, 
  buildExitKeyboard, 
  LIFE_SPHERES, 
  SPHERE_FIELDS, 
  NOTE_FIELDS 
} from './utils.js';
import { generateWheelAnalysis } from './analysis.js';
import logger from '../../123/logger.js';
import { getBase, tables } from '../../config/database.js';

const base = getBase();

export const startWheelBalance = async (tgId, userName) => {
  try {
    logger.info(`🎯 [wheelBalance] Старт для ${tgId}`);
    
    // ✅ ПЕРЕВІРЯЄМО ЧИ Є INCOMPLETE КОЛЕСО
    const incompleteWheel = await getIncompleteWheel(tgId);
    
    if (incompleteWheel) {
      // ✅ РЕАКТИВУЄМО INCOMPLETE КОЛЕСО ЗАМІСТЬ СТВОРЕННЯ НОВОГО
      logger.info(`🎯 [wheelBalance] Знайдено Incomplete колесо ${incompleteWheel.id}, реактивуємо`);
      
      await updateWheel(incompleteWheel.id, { 
        Status: 'Active',
        Step: 0 // Починаємо з початку
      });
      
      // Очищаємо всі попередні оцінки та нотатки
      const clearFields = {};
      SPHERE_FIELDS.forEach(field => clearFields[field] = null);
      NOTE_FIELDS.forEach(field => clearFields[field] = null);
      
      await updateWheel(incompleteWheel.id, clearFields);
      
      return {
        message: `🎯 КОЛЕСО БАЛАНСУ\n\nОціни кожну сферу від 0 до 10\n\n1️⃣/8 ${LIFE_SPHERES[0]}\n\nОбери оцінку:`,
        keyboard: buildScoreKeyboard(),
        recordId: incompleteWheel.id,
        currentSphere: 0
      };
    }
    
    // ✅ СКАСОВУЄМО ІНШІ АКТИВНІ (якщо є)
    await cancelActiveWheel(tgId);
    
    // ✅ СТВОРЮЄМО НОВЕ КОЛЕСО
    const record = await createWheel(tgId, userName);

    return {
      message: `🎯 КОЛЕСО БАЛАНСУ\n\nОціни кожну сферу від 0 до 10\n\n1️⃣/8 ${LIFE_SPHERES[0]}\n\nОбери оцінку:`,
      keyboard: buildScoreKeyboard(),
      recordId: record.id,
      currentSphere: 0
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка startWheelBalance:', error);
    throw error;
  }
};

// ✅ НОВА ФУНКЦІЯ: отримати Incomplete колесо
const getIncompleteWheel = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Incomplete")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка getIncompleteWheel:', error);
    return null;
  }
};

export const processWheelAnswer = async (tgId, score, ctx = null) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Активне колесо не знайдено. Почни заново.' };
    }

    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[currentStep];
    const scoreField = SPHERE_FIELDS[currentStep];

    await updateWheel(activeWheel.id, { [scoreField]: score });

    if (ctx) {
      const message = 
        `✅ Оцінка ${score}/10 для «${sphereName}» збережена.\n\n` +
        `✍️ Коротко опиши (2–5 речень), чому ${score}/10 для «${sphereName}»:`;

      try {
        await ctx.editMessageText(message, buildExitKeyboard());
      } catch {
        await ctx.reply(message, buildExitKeyboard());
      }

      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: score,
        sphereName
      };
    }

    return { completed: false, awaitingNoteFor: currentStep };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка processWheelAnswer:', error);
    return { error: true, message: 'Помилка. Спробуй ще раз.' };
  }
};

export const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    let s = ctx.session?.wheel;
    
    // Відновлення сесії якщо потрібно
    if (!s || s.awaitingNoteFor == null) {
      const activeWheel = await getActiveWheel(ctx.from.id);
      if (!activeWheel) {
        return { error: true, message: 'Колесо не знайдено. Почни заново.' };
      }
      
      const currentStep = Number(activeWheel.fields.Step || 0);
      s = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id,
        lastScore: activeWheel.fields[SPHERE_FIELDS[currentStep]],
        sphereName: LIFE_SPHERES[currentStep]
      };
      
      ctx.session = ctx.session || {};
      ctx.session.wheel = s;
    }

    const { awaitingNoteFor, recordId, sphereName } = s;
    
    // Перевірка існування запису
    let rec;
    try {
      rec = await base(tables.WHEEL_BALANCE).find(recordId);
    } catch {
      return { error: true, message: 'Колесо не знайдено.' };
    }

    // Збереження нотатки
    const noteField = NOTE_FIELDS[awaitingNoteFor];
    await updateWheel(recordId, { [noteField]: noteText });

    const prevStep = Number(rec.fields.Step || 0);
    const nextStep = prevStep + 1;
    const isLast = prevStep >= LIFE_SPHERES.length - 1;
    const isFirst = prevStep === 0; // ✅ ДОДАНО: перевірка чи це перше колесо

    if (isLast) {
      // Завершення
      const scores = SPHERE_FIELDS.map(f => Number(rec.fields[f]) || 0);
      const totalScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      const analysis = await generateWheelAnalysis(scores);

      await completeWheel(recordId, totalScore, analysis);

      if (ctx.session?.wheel) ctx.session.wheel = null;

      // ✅ ПЕРЕВІРКА ЧИ ЦЕ ПЕРШЕ КОЛЕСО
      const tgId = ctx.from?.id;
      const stats = await getUserWheelStats(tgId);
      
      const completionMessage = 
        `✅ Нотатку збережено.\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n` +
        `📊 Твій бал: ${totalScore}/10\n\n` +
        `${analysis}`;

      return {
        completed: true,
        isFirstWheel: stats.total === 1, // ✅ Якщо total = 1, то це перше
        message: completionMessage
      };
    }

    // Наступна сфера
    await updateWheel(recordId, { Step: nextStep });
    if (ctx.session?.wheel) ctx.session.wheel = null;

    return {
      completed: false,
      message: `✅ Нотатку для «${sphereName}» збережено.\n\n${nextStep + 1}️⃣/8 ${LIFE_SPHERES[nextStep]}\n\nОбери оцінку:`,
      keyboard: buildScoreKeyboard()
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка saveWheelNoteAndGoNext:', error);
    return { error: true, message: 'Помилка збереження.' };
  }
};
export const continueActiveWheel = async (tgId, ctx) => {
  try {
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return { error: true, message: 'Колесо не знайдено.' };
    }

    const step = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[step];
    const score = activeWheel.fields[SPHERE_FIELDS[step]];
    
    if (score != null) {
      // Чекаємо нотатку
      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: step,
        recordId: activeWheel.id,
        lastScore: score,
        sphereName
      };

      return {
        message: `✅ Продовжуємо\n\nОцінка ${score}/10 для «${sphereName}».\n\n✍️ Опиши чому ${score}/10:`,
        keyboard: buildExitKeyboard()
      };
    }

    // Чекаємо оцінку
    return {
      message: `✅ Продовжуємо\n\n${step + 1}️⃣/8 ${sphereName}\n\nОбери оцінку:`,
      keyboard: buildScoreKeyboard()
    };
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка continueActiveWheel:', error);
    return { error: true, message: 'Помилка продовження.' };
  }
};

