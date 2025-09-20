// src/services/wheelBalanceService.js - ВИПРАВЛЕНО + НОТАТКИ + ДОДАНО cancelActiveWheel

import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';
import { LIFE_SPHERES, SPHERE_FIELDS, NOTE_FIELDS } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

// ———————————————————————————————————————————————
// УТИЛІТИ
// ———————————————————————————————————————————————

const buildScoreKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '0',  callback_data: 'wheel_score_0' },
        { text: '1',  callback_data: 'wheel_score_1' },
        { text: '2',  callback_data: 'wheel_score_2' },
        { text: '3',  callback_data: 'wheel_score_3' },
        { text: '4',  callback_data: 'wheel_score_4' },
        { text: '5',  callback_data: 'wheel_score_5' }
      ],
      [
        { text: '6',  callback_data: 'wheel_score_6' },
        { text: '7',  callback_data: 'wheel_score_7' },
        { text: '8',  callback_data: 'wheel_score_8' },
        { text: '9',  callback_data: 'wheel_score_9' },
        { text: '10', callback_data: 'wheel_score_10' }
      ],
      [
        { text: '🚪 Вийти', callback_data: 'wheel_exit' }
      ]
    ]
  }
});

const todayISO = () => new Date().toISOString().split('T')[0];

// ———————————————————————————————————————————————
// ОСНОВНІ ОПЕРАЦІЇ
// ———————————————————————————————————————————————

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

const startWheelBalance = async (tgId, userName) => {
  try {
    logger.info(`🎯 [wheelBalance] ПОЧАТОК КОЛЕСА для ${tgId}`);

    // На старті — скасовуємо всі активні (страховка від дубляжу)
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

    // Створюємо новий запис
    const wheelData = {
      fields: {
        TG_id: String(tgId),
        'User Name': userName || 'Користувач',
        Status: 'Active',
        Step: 0,                                // 0 — старт
        Created_Date: todayISO()
        // Поля оцінок і нотаток можна не ініціалізувати — збережемо по мірі заповнення
      }
    };

    const [wheelRecord] = await base(tables.WHEEL_BALANCE).create([wheelData], { typecast: true });
    logger.info(`🎯 [wheelBalance] ✅ Колесо створено, ID: ${wheelRecord.id}`);

    const message = 
      `🎯 КОЛЕСО БАЛАНСУ\n\n` +
      `Оціни кожну сферу життя від 0 до 10\n\n` +
      `1️⃣/8 ${LIFE_SPHERES[0]}\n\nОбери оцінку:`;

    return {
      message,
      keyboard: buildScoreKeyboard(),
      recordId: wheelRecord.id,
      currentSphere: 0
    };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка створення:', error);
    throw error;
  }
};

// ———————————————————————————————————————————————
// CALLBACK-И
// ———————————————————————————————————————————————

const processWheelCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  try {
    if (data.startsWith('wheel_score_')) {
      const score = parseInt(data.replace('wheel_score_', ''), 10);
      return await processWheelAnswer(tgId, score, ctx);
    }
    
    if (data === 'wheel_exit') {
      await cancelActiveWheel(tgId);
      try { await ctx.editMessageText('🚪 Колесо балансу скасовано'); }
      catch { await ctx.reply('🚪 Колесо балансу скасовано'); }
      return { completed: true, cancelled: true };
    }
    
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка callback:', error);
    return { error: true, message: 'Помилка обробки. Спробуй ще раз.' };
  }
};

// ———————————————————————————————————————————————
// ЛОГІКА ОЦІНКИ (КРОК 1): Зберегти бал і попросити нотатку
// ———————————————————————————————————————————————

const processWheelAnswer = async (tgId, score, ctx = null) => {
  try {
    logger.info(`🎯 [wheelBalance] Обробка відповіді ${tgId}: ${score}`);

    let activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      // Якщо щось пішло не так — створимо нове і витягнемо знову
      const started = await startWheelBalance(tgId, ctx?.from?.first_name);
      activeWheel = await getActiveWheel(tgId);
      if (!activeWheel) {
        return { error: true, message: 'Не вдалося створити активне колесо. Спробуй ще раз.' };
      }
    }

    const currentStep = Number(activeWheel.fields.Step || 0);
    const sphereName = LIFE_SPHERES[currentStep];
    const airtableField = SPHERE_FIELDS[currentStep];

    logger.info(`🎯 [wheelBalance] Зберігаємо: ${airtableField} = ${score}`);

    // 1) Зберігаємо оцінку для поточної сфери (Step НЕ підвищуємо тут)
    await base(tables.WHEEL_BALANCE).update(activeWheel.id, { [airtableField]: score }, { typecast: true });

    // 2) Питаємо нотатку по сфері
    if (ctx) {
      await ctx.reply(
        `✍️ Коротко опиши (2–5 речень), чому поставила таку оцінку для «${sphereName}». Це допоможе точніше у звітах.`
      );

      // позначимо в сесії, що чекаємо нотатку
      ctx.session = ctx.session || {};
      ctx.session.wheel = {
        awaitingNoteFor: currentStep,
        recordId: activeWheel.id
      };
    }

    return { completed: false, awaitingNoteFor: currentStep };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка обробки оцінки:', error);
    return { error: true, message: 'Виникла помилка. Спробуй ще раз.' };
  }
};

// ———————————————————————————————————————————————
// ЛОГІКА НОТАТКИ (КРОК 2): Зберегти нотатку, перейти далі або завершити
// ———————————————————————————————————————————————

const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    const s = ctx.session?.wheel;
    if (!s || s.awaitingNoteFor == null || !s.recordId) {
      return { error: true, message: 'Немає активної сфери для нотатки.' };
    }

    const { awaitingNoteFor, recordId } = s;

    // 1) Зберегти нотатку у відповідне *_Notes поле
    const noteField = NOTE_FIELDS[awaitingNoteFor];
    await base(tables.WHEEL_BALANCE).update(recordId, { [noteField]: noteText }, { typecast: true });

    // 2) Дістаємо поточний запис щоб знати Step та бали
    const rec = await base(tables.WHEEL_BALANCE).find(recordId);
    const prevStep = Number(rec.fields.Step || 0);

    // Перевірка: якщо Step рухається разом із оцінкою, то prevStep == awaitingNoteFor
    // Наш флоу: Step ще prev, і ми зараз його підвищимо
    const nextStep = prevStep + 1;

    // Чи це була остання (8-ма) сфера — індекси 0..7
    const wasLast = awaitingNoteFor >= (LIFE_SPHERES.length - 1);

    if (wasLast) {
      // Рахуємо Total_Score по всіх 8 оцінках
      const allScores = SPHERE_FIELDS.map(f => Number(rec.fields[f]) || 0);
      const totalScore = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10;

      // Короткий AI аналіз
      const analysis = await generateWheelAnalysis(allScores);

      await base(tables.WHEEL_BALANCE).update(recordId, {
        Status: 'Completed',
        Completed_Date: todayISO(),
        Total_Score: totalScore,
        AI_Analysis: analysis,
        Step: LIFE_SPHERES.length // 8
      }, { typecast: true });

      // очищаємо прапор в сесії
      ctx.session.wheel = undefined;

      const message =
        `✅ Нотатку збережено.\n\n` +
        `🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n` +
        `📊 Загальний бал: ${totalScore}/10\n\n` +
        `${analysis}`;

      return { completed: true, message };
    }

    // Якщо НЕ остання — підвищуємо крок і показуємо наступну сферу
    await base(tables.WHEEL_BALANCE).update(recordId, { Step: nextStep }, { typecast: true });
    ctx.session.wheel = undefined;

    const nextSphereName = LIFE_SPHERES[nextStep];
    const message =
      `✅ Нотатку збережено.\n\n` +
      `${nextStep + 1}️⃣/8 ${nextSphereName}\n\n` +
      `Обери оцінку:`;

    return { completed: false, message, keyboard: buildScoreKeyboard() };

  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка збереження нотатки:', error);
    return { error: true, message: 'Не вдалося зберегти нотатку. Спробуй ще раз.' };
  }
};

// ———————————————————————————————————————————————
// АНАЛІТИКА
// ———————————————————————————————————————————————

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

// ———————————————————————————————————————————————
// ДОДАТКОВІ ОПЕРАЦІЇ
// ———————————————————————————————————————————————

const cancelActiveWheel = async (tgId) => {
  try {
    logger.info(`🎯 [wheelBalance] Скасування активного колеса для ${tgId}`);

    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Active")`
      })
      .all();

    if (records.length > 0) {
      const updates = records.map(record => ({
        id: record.id,
        fields: { Status: 'Cancelled' }
      }));
      
      await base(tables.WHEEL_BALANCE).update(updates);
      logger.info(`✅ [wheelBalance] Скасовано ${records.length} активних колес для ${tgId}`);
    }
    
    return true;
  } catch (error) {
    logger.error('❌ [wheelBalance] Помилка скасування:', error);
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

// ———————————————————————————————————————————————
// ЕКСПОРТИ
// ———————————————————————————————————————————————

export default {
  startWheelBalance,
  processWheelAnswer,         // Крок 1: оцінка → питаємо нотатку
  saveWheelNoteAndGoNext,     // Крок 2: зберегти нотатку → наступна сфера/фініш
  processWheelCallback,
  getActiveWheel,
  needsWheelBalance,
  getUserWheelStats,
  cancelActiveWheel,
  LIFE_SPHERES
};

/*
🔧 ДОДАЙ У ХЕНДЛЕР ТЕКСТУ (bot.on('text', ...)):

// 1) Якщо чекаємо нотатку — зберегти її і рухатись далі
if (ctx.session?.wheel?.awaitingNoteFor != null && ctx.session?.wheel?.recordId) {
  const note = (ctx.message?.text || '').trim();
  if (note.length < 5) {
    await ctx.reply('Додай, будь ласка, ще трішки деталей (2–5 речень).');
    return;
  }
  const res = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, note);
  if (res.completed) {
    await userService.updateUserStep(ctx.from.id, 'completed');
    await ctx.reply(res.message);
    // показати меню або наступні кроки
  } else {
    await ctx.reply(res.message, res.keyboard || {});
  }
  return;
}

// 2) Якщо активне колесо — парсимо число 0–10 і викликаємо processWheelAnswer
const maybeScore = parseInt((ctx.message?.text || '').trim(), 10);
if (!Number.isNaN(maybeScore) && maybeScore >= 0 && maybeScore <= 10) {
  await wheelBalanceController.handleWheelBalanceAnswer(ctx, maybeScore);
  return;
}
*/
