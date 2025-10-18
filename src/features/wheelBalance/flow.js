// src/features/wheelBalance/flow.js — ВИПРАВЛЕНО

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from '../../config/index.js';
import keyboards from '../../utils/keyboards.js';

import { 
  getActiveWheel,
  getLatestCompletedWheel,
  createWheel,
  updateWheel,
  completeWheel,
  cancelActiveWheel,
  canStartNewWheel
} from './database.js';

import { generateWheelAnalysis } from './analysis.js';
import { wheelController } from './controller.js';
import { todayISO } from '../../utils/helpers.js';
import { getProgressBar } from '../../utils/progress.js';

const base = getBase();

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
        message: wheelController.getWheelQuestionBeautiful(sphere, step),
        keyboard: keyboards.wheelScoreKeyboard()
      };
    }

    const last = await getLatestCompletedWheel(tgId);
    if (last) {
      const analysis = last.fields.AI_Analysis || 'Аналіз недоступний';
      return {
        error: false,
        message:
          `🎡 *ТВОЄ КОЛЕСО БАЛАНСУ*\n\n` +
          `📅 Останнє заповнення: ${last.fields.Completed_Date}\n\n` +
          `**AI Аналіз:**\n${analysis}\n\n` +
          `✅ Час оновити колесо!`,
        keyboard: keyboards.wheelCompletedKeyboard()
      };
    }

    // ➕ Створити нове колесо
    const newWheel = await createWheel(tgId, userName);
    const firstSphere = LIFE_SPHERES[0];

    return {
      error: false,
      message: wheelController.getWheelQuestionBeautiful(firstSphere, 1),
      keyboard: keyboards.wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('❌ [wheelBalance] startWheelBalance:', e);
    return { error: true, message: '❌ Помилка запуску колеса' };
  }
};

// ─────────────────────────────────────────────────────────────

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

    if (step > LIFE_SPHERES.length) {
      return {
        error: true,
        message: '✅ Колесо вже завершено!',
        keyboard: keyboards.wheelCompletedKeyboard()
      };
    }

    const sphere = LIFE_SPHERES[step - 1];

    return {
      error: false,
      message: wheelController.getWheelQuestionBeautiful(sphere, step),
      keyboard: keyboards.wheelScoreKeyboard()
    };
  } catch (error) {
    logger.error('[wheelBalance] ❌ continueActiveWheel:', error);
    return {
      error: true,
      message: '❌ Помилка продовження колеса'
    };
  }
};

// ─────────────────────────────────────────────────────────────

export const goBackWheelStep = async (tgId, ctx) => {
  try {
    const wheel = await getActiveWheel(tgId);
    if (!wheel) {
      await ctx.reply('❌ Немає активного колеса', keyboards.mainMenuKeyboard());
      return { error: true };
    }

    const step = wheel.fields.Step || 1;

    if (step <= 1) {
      await ctx.reply('⬅️ Це перший крок, повернутися неможливо!', keyboards.wheelScoreKeyboard());
      return { error: false };
    }

    const prevStep = step - 1;
    const prevSphere = LIFE_SPHERES[prevStep - 1];
    const noteField = getNoteField(prevSphere.key);

    // ✅ Видаляємо оцінку для переопції
    await updateWheel(wheel.id, {
      Step: prevStep,
      [prevSphere.key]: null,
      [noteField]: null
    });

    logger.info(`[wheelBalance] ⬅️ Повернення на крок ${prevStep}`);

    const message = wheelController.getWheelQuestionBeautiful(prevSphere, prevStep);

    await ctx.reply(
      `⬅️ Повертаємось до *${prevSphere.label}*\n\n${message}`,
      keyboards.wheelScoreKeyboard()
    );

    return { error: false };
  } catch (e) {
    logger.error('[wheelBalance] ❌ goBackWheelStep:', e);
    await ctx.reply('❌ Помилка при поверненні назад', keyboards.mainMenuKeyboard());
    return { error: true };
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ ОСНОВНА ОБРОБКА ВІДПОВІДІ
// ═══════════════════════════════════════════════════════════════

export const processWheelAnswer = async (tgId, score, ctx) => {
  try {
    const wheel = await getActiveWheel(tgId);
    if (!wheel) {
      await ctx.reply('❌ Немає активного колеса. Почни нове!', keyboards.mainMenuKeyboard());
      return { error: true };
    }

    const step = wheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];

    // ✅ ЗБЕРІГАЄМО ОЦІНКУ
    await updateWheel(wheel.id, {
      [sphere.key]: score
    });

    logger.info(`[wheelBalance] ✅ ${sphere.label} → ${score}/10`);

    const progressPercent = Math.round((step / LIFE_SPHERES.length) * 100);

    // ✅ НОВОЕ ПОВІДОМЛЕННЯ (не редагуємо!)
    const message = 
      `✅ *${sphere.label}* — ${score}/10\n\n` +
      `${getProgressBar(progressPercent)}\n\n` +
      `💭 Напиши коротку нотатку про цю сферу:\n` +
      `• Що працює добре?\n` +
      `• Що хочеш покращити?\n` +
      `• Яке буде твоє першоє дія?\n\n` +
      `Або натисни "Пропустити" ⤵️`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити нотатку', callback_data: `wheel_skip_note_${step}` }],
          [{ text: '⬅️ Змінити оцінку', callback_data: 'wheel_go_back' }],
          [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }],
        ],
      }
    });

    return { error: false };
  } catch (e) {
    logger.error('[wheelBalance] ❌ processWheelAnswer:', e);
    await ctx.reply('❌ Помилка при збереженні оцінки', keyboards.mainMenuKeyboard());
    return { error: true };
  }
};

// ─────────────────────────────────────────────────────────────

export const startNewWheelIgnoreOld = async (tgId, userName, forceRestart = false) => {
  try {
    logger.info(`🎯 [wheelBalance] Старт нового колеса для ${tgId}, forceRestart: ${forceRestart}`);

    // ✅ ПЕРЕВІРЯЄМО COOLDOWN
    if (!forceRestart) {
      const canStart = await canStartNewWheel(tgId);
      if (!canStart.allowed) {
        return {
          error: true,
          message: `⏰ ${canStart.reason}`,
          keyboard: keyboards.wheelCooldownKeyboard()
        };
      }
    }

    const existing = await getActiveWheel(tgId);

    // ✅ ЯКЩО АКТИВНЕ КОЛЕСО - СКАСУВАТИ І СТВОРИТИ НОВЕ
    if (existing) {
      // Скасовуємо старе (In Progress → Incomplete)
      await updateWheel(existing.id, { Status: 'Incomplete' });
      logger.info(`✅ [wheelBalance] Скасовано старе колесо ${existing.id}`);
    }

    // ✅ ЗАВЖДИ СТВОРЮЄМО НОВИЙ РЯДОК (не оновлюємо!)
    const newWheel = await createWheel(tgId, userName);
    logger.info(`✅ [wheelBalance] НОВИЙ рядок створено ${newWheel.id}`);

    // ✅ СПОВІЩЕННЯ КОРИСТУВАЧА
    const firstSphere = LIFE_SPHERES[0];
    const message = 
      `🎯 *НОВЕ КОЛЕСО БАЛАНСУ*\n\n` +
      `✅ Попереднє колесо збережено в історії.\n` +
      `📊 Почнемо з нуля!\n\n` +
      wheelController.getWheelQuestionBeautiful(firstSphere, 1);

    return {
      error: false,
      message: message,
      keyboard: keyboards.wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('❌ [wheelBalance] startNewWheelIgnoreOld:', e);
    return { error: true, message: '❌ Помилка запуску нового колеса' };
  }
};
// ═══════════════════════════════════════════════════════════════
// 🗒️ ЗБЕРЕГТИ НОТАТКУ І ПЕРЕЙТИ ДАЛІ
// ═══════════════════════════════════════════════════════════════

export const saveWheelNoteAndGoNext = async (ctx, noteText) => {
  try {
    const tgId = ctx.from.id;
    const wheel = await getActiveWheel(tgId);
    if (!wheel) return { error: true, message: '❌ Колесо не знайдено' };

    const step = wheel.fields.Step || 1;
    const sphere = LIFE_SPHERES[step - 1];
    const noteField = getNoteField(sphere.key);

    // ✅ ЗБЕРЕЖЕМО НОТАТКУ
    await updateWheel(wheel.id, {
      [noteField]: noteText?.substring(0, 2000) || '(пропущена)'
    });

    logger.info(`[wheelBalance] ✏️ Нотатка для ${sphere.label} збережена`);

    // ✅ ЧИ ЗАКІНЧИЛИ?
    if (step >= LIFE_SPHERES.length) {
      return await completeWheelProcess(tgId, wheel.id, ctx);
    }

    // ✅ НАСТУПНИЙ КРОК
    const nextStep = step + 1;
    const nextSphere = LIFE_SPHERES[nextStep - 1];

    await updateWheel(wheel.id, {
      Step: nextStep
    });

    return {
      error: false,
      completed: false,
      message: wheelController.getWheelQuestionBeautiful(nextSphere, nextStep),
      keyboard: keyboards.wheelScoreKeyboard()
    };
  } catch (e) {
    logger.error('[wheelBalance] ❌ saveWheelNoteAndGoNext:', e);
    return { error: true, message: '❌ Помилка збереження нотатки' };
  }
};

// ═══════════════════════════════════════════════════════════════
// ✅ ЗАВЕРШИТИ КОЛЕСО
// ═══════════════════════════════════════════════════════════════

const completeWheelProcess = async (tgId, wheelId, ctx) => {
  try {
    logger.info(`[wheelBalance] 🏁 Завершення колеса для ${tgId}`);

    const record = await base(tables.WHEEL_BALANCE).find(wheelId);
    const fields = record.fields;
    const scores = LIFE_SPHERES.map((s) => fields[s.key] || 0);
    const total = scores.reduce((a, b) => a + b, 0);

    // ✅ ГЕНЕРУЄМО АНАЛІЗ
    let analysis = generateFallbackAnalysis(scores);

    try {
      analysis = await generateWheelAnalysis(scores);
    } catch (error) {
      logger.warn('[wheelBalance] ⚠️ Помилка AI аналізу:', error);
    }

    // ✅ ЗБЕРІГАЄМО РЕЗУЛЬТАТ
    await completeWheel(wheelId, total, analysis);

    // ✅ ВІДПРАВЛЯЄМО РЕЗУЛЬТАТ
    const wheelViz = formatSimpleWheel(scores);
    const completionMessage =
      `${wheelViz}\n\n` +
      `*📊 AI АНАЛІЗ:*\n\n` +
      `${analysis}\n\n` +
      `💡 Оновлюй колесо раз на місяць для відстеження прогресу.`;

    await ctx.reply(completionMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.wheelCompletedKeyboard().reply_markup
    });

    // ✅ НАГОРОДЖЕННЯ
    try {
      const rewardsService = (await import('../gamification/rewards.js')).default;
      await rewardsService.rewardWheel(tgId, ctx.telegram);
    } catch (e) {
      logger.warn('[wheelBalance] ⚠️ Помилка нагородження:', e);
    }

    return { error: false, completed: true };
  } catch (e) {
    logger.error('[wheelBalance] ❌ completeWheelProcess:', e);
    await ctx.reply(
      '❌ Помилка завершення колеса. Спробуй пізніше.',
      keyboards.mainMenuKeyboard()
    );
    return { error: true, completed: false };
  }
};

// ═══════════════════════════════════════════════════════════════
// 🔍 ДОПОМІЖНІ ФУНКЦІЇ
// ═══════════════════════════════════════════════════════════════

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

export const cancelWheelBalance = async (tgId) => {
  try {
    return await cancelActiveWheel(tgId);
  } catch (error) {
    logger.error('❌ [wheelBalance] cancelWheelBalance:', error);
    return false;
  }
};

export const getWheelHistory = async (tgId) => {
  try {
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }],
        maxRecords: 12
      })
      .all();

    return records;
  } catch (e) {
    logger.error('[wheelBalance] ❌ getWheelHistory:', e);
    return [];
  }
};

const getNoteField = (sphereKey) => {
  const mapping = {
    'Health': 'Health_Notes',
    'Self_Growth': 'Self_Growth_Notes',
    'Relationships': 'Relationships_Notes',
    'Career_Business': 'Career_Notes',
    'Finance': 'Finance_Notes',
    'Rest_Leisure': 'Leisure_Notes',
    'Spirituality': 'Spirituality_Notes',
    'Housing': 'Housing_Notes'
  };
  return mapping[sphereKey] || sphereKey + '_Notes';
};

const formatSimpleWheel = (scores) => {
  const sphereEmojis = ['❤️', '📚', '👥', '💼', '💰', '🎨', '🧘', '🏠'];
  const total = scores.reduce((a, b) => a + b, 0);
  const avg = (total / 8).toFixed(1);

  let result = `🎡 *КОЛЕСО БАЛАНСУ*\n━━━━━━━━━━━━━━━\n\n`;

  for (let i = 0; i < 8; i++) {
    const emoji = sphereEmojis[i];
    const name = LIFE_SPHERES[i].label;
    const score = scores[i];
    const bar = '█'.repeat(score) + '░'.repeat(10 - score);
    result += `${emoji} ${name}\n[${bar}] ${score}/10\n\n`;
  }

  result += `━━━━━━━━━━━━━━━\n⭐ Середня: ${avg}/10\n📊 Всього: ${total}/80`;
  return result;
};

const generateFallbackAnalysis = (scores) => {
  const total = scores.reduce((a, b) => a + b, 0);
  const avg = (total / 8).toFixed(1);
  const weak = scores.filter(s => s <= 5);
  const strong = scores.filter(s => s >= 8);

  let analysis = `✅ *Результат:* ${avg}/10\n\n`;

  if (strong.length > 0) {
    analysis += `🌟 *Сильні сфери:* ${strong.length}\n`;
  }

  if (weak.length > 0) {
    analysis += `⚡ *Для розвитку:* ${weak.length}\n`;
  }

  if (avg >= 8) {
    analysis += `\n🎉 Твій баланс практично ідеальний!`;
  } else if (avg >= 5) {
    analysis += `\n💪 Хороший прогрес! Продовжуй розвиватися.`;
  } else {
    analysis += `\n🎯 Час для дій! Вибери 1-2 сфери на фокус.`;
  }

  return analysis;
};

console.log('✅ [wheelBalance/flow] Flow логіка завантажена');