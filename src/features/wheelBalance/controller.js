// src/features/wheelBalance/controller.js

import * as users from '../../services/users.js';
import * as wheelService from './service.js';
import keyboards, { KB_WHEEL_SCORE, KB_WHEEL_COMPLETED, WHEEL_SPHERES, SPHERE_DESCRIPTIONS  } from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';
import logger from '../../utils/logger.js';
import callbacks from '../../services/callbacks.js';

// ═══════════════════════════════════════════════════════════
// 📊 ПОКАЗАТИ СФЕРУ З ОЦІНКОЮ
// ═══════════════════════════════════════════════════════════

const askWheelScore = async (ctx, sphereId) => {
  try {
    await typing(ctx);

    const sphere = WHEEL_SPHERES[sphereId];
    if (!sphere) {
      await ctx.reply('❌ Помилка: невідома сфера', keyboards.mainMenuKeyboard());
      return;
    }

    const description = SPHERE_DESCRIPTIONS[sphereId];
    const message = `${sphere.name}\n\n${description}\n\n📊 Оціни від 0 до 10:`;

    // ✅ ПРЯМО ВИКОРИСТОВУЄМО KB_WHEEL_SCORE константу
    await ctx.reply(message, KB_WHEEL_SCORE);
    await safeAnswerCb(ctx, 'Оцінка сфери');
  } catch (e) {
    logger.error('[wheelBalance/askWheelScore]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 💭 ПОКАЗАТИ НОТАТКУ ДЛЯ СФЕРИ
// ═══════════════════════════════════════════════════════════

const askWheelNote = async (ctx, sphereId) => {
  try {
    await typing(ctx);

    const sphere = WHEEL_SPHERES[sphereId];
    const message = `${sphere.name}\n\n📝 Напиши коротку нотатку (1-2 рядки) що покращити в цій сфері, або пропусти:\n\n💡 Приклад: "Збільшити час для друзів, планувати зустрічі"`;

    // ✅ ВИКОРИСТОВУЄМО ГОТОВИЙ ГЕНЕРАТОР
    const noteKeyboard = keyboards.wheelNoteKeyboard(sphereId);

    await ctx.reply(message, noteKeyboard);
    await safeAnswerCb(ctx, 'Нотатка сфери');
  } catch (e) {
    logger.error('[wheelBalance/askWheelNote]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ КОЛЕСО ЗАВЕРШЕНО - ПОКАЗАТИ РЕЗУЛЬТАТИ
// ═══════════════════════════════════════════════════════════

const showWheelCompleted = async (ctx, wheelData) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    const analysis = await wheelService.generateWheelAnalysis(wheelData);

    const message = `🎡 **Твоє Колесо Балансу**\n\n${analysis}\n\n🎯 Обери дві сфери для фокусу на цей місяць та слідуй рекомендаціям вище.`;

    // ✅ ПРЯМО ВИКОРИСТОВУЄМО KB_WHEEL_COMPLETED константу
    await ctx.reply(message, KB_WHEEL_COMPLETED);
    await safeAnswerCb(ctx, '✅ Колесо завершено');
  } catch (e) {
    logger.error('[wheelBalance/showWheelCompleted]', e);
    await ctx.reply('❌ Помилка при обробці результатів', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 🚪 ВИХІД З КОЛЕСА
// ═══════════════════════════════════════════════════════════

const exitWheel = async (ctx) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    await wheelService.cancelWheelSession(tgId);

    const message = `⚠️ Ти вийшов з колеса балансу.\n\n🎡 Його можна пройти коли буде час з меню: **🎯 Колесо балансу**`;

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    await safeAnswerCb(ctx, '🚪 Вихід з колеса');
  } catch (e) {
    logger.error('[wheelBalance/exitWheel]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 🔄 ПЕРЕЗАВАНТАЖЕННЯ КОЛЕСА
// ═══════════════════════════════════════════════════════════

const restartWheel = async (ctx) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    await wheelService.resetWheelSession(tgId);

    const message = `🔄 Колесо скинуте. Почнемо з початку!\n\n❤️ **Сфера 1/8: Здоров\'я**`;

    await ctx.reply(message, KB_WHEEL_SCORE);
    await safeAnswerCb(ctx, '🔄 Перезавантаження');
  } catch (e) {
    logger.error('[wheelBalance/restartWheel]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 📊 ПОКАЗАТИ ІСТОРІЮ КОЛЕС
// ═══════════════════════════════════════════════════════════

const showWheelHistory = async (ctx) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    const history = await wheelService.getWheelHistory(tgId);

    if (!history || history.length === 0) {
      await ctx.reply('📊 Історія коліс поки порожня.', keyboards.mainMenuKeyboard());
      return;
    }

    let message = `📊 **Твоя історія Коліс Балансу**\n\n`;
    history.forEach((wheel, idx) => {
      message += `${idx + 1}. ${wheel.date}\n`;
      message += `   Середнє: ${wheel.average}/10\n`;
      message += `   Найбільше: ${wheel.maxSphere} (${wheel.maxScore}/10)\n\n`;
    });

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    await safeAnswerCb(ctx, '📊 Історія');
  } catch (e) {
    logger.error('[wheelBalance/showWheelHistory]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 🔒 COOLDOWN - МОЖНА ПРОХОДИТИ РАЗ НА МІСЯЦЬ
// ═══════════════════════════════════════════════════════════

const showWheelCooldown = async (ctx) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    const nextDate = await wheelService.getWheelCooldownDate(tgId);

    const message = `⏰ **Колесо можна пройти раз на місяць**\n\n📅 Наступна спроба: ${nextDate}\n\n💡 А поки що:\n• Слідкуй за своїм фокусом\n• Обирай 2-3 сфери на місяць\n• Виконуй рекомендації`;

    await ctx.reply(message, keyboards.wheelCooldownKeyboard());
    await safeAnswerCb(ctx, '⏰ Cooldown');
  } catch (e) {
    logger.error('[wheelBalance/showWheelCooldown]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 🛡️ HELPER: Safe callback answer
// ═══════════════════════════════════════════════════════════

const safeAnswerCb = async (ctx, text = '') => {
  try {
    if (ctx?.callbackQuery) {
      await ctx.answerCbQuery(text);
    }
  } catch (e) {
    logger.warn('[wheelBalance/safeAnswerCb]', e.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 🎛️ CALLBACK ROUTER
// ═══════════════════════════════════════════════════════════

// 📊 ОЦІНКА СФЕР
callbacks.on('wheel_score_0', (ctx) => handleWheelScore(ctx, 0));
callbacks.on('wheel_score_1', (ctx) => handleWheelScore(ctx, 1));
callbacks.on('wheel_score_2', (ctx) => handleWheelScore(ctx, 2));
callbacks.on('wheel_score_3', (ctx) => handleWheelScore(ctx, 3));
callbacks.on('wheel_score_4', (ctx) => handleWheelScore(ctx, 4));
callbacks.on('wheel_score_5', (ctx) => handleWheelScore(ctx, 5));
callbacks.on('wheel_score_6', (ctx) => handleWheelScore(ctx, 6));
callbacks.on('wheel_score_7', (ctx) => handleWheelScore(ctx, 7));
callbacks.on('wheel_score_8', (ctx) => handleWheelScore(ctx, 8));
callbacks.on('wheel_score_9', (ctx) => handleWheelScore(ctx, 9));
callbacks.on('wheel_score_10', (ctx) => handleWheelScore(ctx, 10));

// 🎛️ ДІЇ
callbacks.on('wheel_exit', (ctx) => exitWheel(ctx));
callbacks.on('wheel_restart', (ctx) => restartWheel(ctx));
callbacks.on('wheel_restart_confirmed', (ctx) => restartWheel(ctx));
callbacks.on('wheel_history', (ctx) => showWheelHistory(ctx));

// ═══════════════════════════════════════════════════════════
// 🎯 HANDLER: ОБРОБКА ОЦІНКИ
// ═══════════════════════════════════════════════════════════

const handleWheelScore = async (ctx, score) => {
  try {
    await typing(ctx);

    const tgId = ctx.from.id;
    const user = await users.getUserByTgId(tgId);

    if (!user) {
      await ctx.reply('❌ Користувач не знайдений', keyboards.mainMenuKeyboard());
      return;
    }

    // Зберегти оцінку
    await wheelService.saveWheelScore(tgId, score);

    // Отримати поточну сферу
    const currentSphere = await wheelService.getCurrentWheelSphere(tgId);

    if (currentSphere >= WHEEL_SPHERES.length) {
      // ✅ КОЛЕСО ЗАВЕРШЕНО
      const wheelData = await wheelService.getWheelData(tgId);
      await showWheelCompleted(ctx, wheelData);
      return;
    }

    // Запитати нотатку для поточної сфери
    await askWheelNote(ctx, currentSphere);
    await safeAnswerCb(ctx, `✅ ${score}/10`);
  } catch (e) {
    logger.error('[wheelBalance/handleWheelScore]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════
// 📥 EXPORT
// ═══════════════════════════════════════════════════════════

export default {
  askWheelScore,
  askWheelNote,
  showWheelCompleted,
  exitWheel,
  restartWheel,
  showWheelHistory,
  showWheelCooldown,
  handleWheelScore,
  WHEEL_SPHERES,
  SPHERE_DESCRIPTIONS,
};

logger.info('✅ [wheelBalance/controller] Завантажено');