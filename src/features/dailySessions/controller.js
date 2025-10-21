// src/features/dailySessions/controller.js — МІНІМАЛЬНО ПРАЦЕЗДАТНИЙ КОНТРОЛЕР

import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';

// ──────────────────────────────────────────────────────────────
// Ранкова сесія
// ──────────────────────────────────────────────────────────────
export const handleStartMorning = async (ctx) => {
  try {
    await ctx.reply(
      '🌞 Починаємо ранкову рефлексію.\n\nСкажи: *Який фокус на сьогодні?*',
      { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() }
    );
    return true;
  } catch (e) {
    logger.error('[daily/handleStartMorning] ❌', e);
    await ctx.reply('❌ Не вдалося стартувати ранкову сесію.', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleLaterMorning = async (ctx) => {
  try {
    await ctx.reply('⏭ Добре, нагадаю пізніше. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

// ──────────────────────────────────────────────────────────────
// Вечірня сесія
// ──────────────────────────────────────────────────────────────
export const handleStartEvening = async (ctx) => {
  try {
    await ctx.reply(
      '🌙 Починаємо вечірню рефлексію.\n\n*Що сьогодні вийшло найкраще?*',
      { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() }
    );
    return true;
  } catch (e) {
    logger.error('[daily/handleStartEvening] ❌', e);
    await ctx.reply('❌ Не вдалося стартувати вечірню сесію.', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleLaterEvening = async (ctx) => {
  try {
    await ctx.reply('⏭ Ок, закриваю на зараз. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

// ──────────────────────────────────────────────────────────────
// Вихід / скіп
// ──────────────────────────────────────────────────────────────
export const handleExitSession = async (ctx) => {
  try {
    await ctx.reply('🚪 Сесію завершено.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

export const handleSkipMorningDoEvening = async (ctx) => {
  try {
    await ctx.reply('⏭ Пропускаємо ранок. Запускаю вечірню сесію…');
    return await handleStartEvening(ctx);
  } catch { return false; }
};

// ──────────────────────────────────────────────────────────────
/** Текстовий роутер для daily. Повертає true, якщо оброблено */
export const handleText = async (ctx, textRaw) => {
  const t = (textRaw ?? ctx.message?.text ?? '').toLowerCase();

  try {
    if (t.includes('ранков')) return await handleStartMorning(ctx);
    if (t.includes('вечір'))  return await handleStartEvening(ctx);
    return false;
  } catch (e) {
    logger.error('[daily/handleText] ❌', e);
    return false;
  }
};

// ──────────────────────────────────────────────────────────────
// Опційні тригери для планувальника (якщо треба напряму викликати)
// ──────────────────────────────────────────────────────────────
export const sendMorningReminders = async () => {
  logger.info('[daily] sendMorningReminders stub'); // імплементуй за потреби
};
export const sendEveningReminders = async () => {
  logger.info('[daily] sendEveningReminders stub'); // імплементуй за потреби
};

// ──────────────────────────────────────────────────────────────
export default {
  handleStartMorning,
  handleLaterMorning,
  handleStartEvening,
  handleLaterEvening,
  handleExitSession,
  handleSkipMorningDoEvening,
  handleText,
  sendMorningReminders,
  sendEveningReminders,
};
