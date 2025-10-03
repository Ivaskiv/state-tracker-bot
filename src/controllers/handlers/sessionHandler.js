// src/controllers/handlers/sessionHandler.js - управління сесіями через централізовані сервіси

import { aiMentorSession } from '../../utils/session.js';

const isActiveSession = async (tgId) => {
  try {
    const userService = (await import('../../services/userService.js')).default;
    const user = await userService.getUserByTgId(tgId);
    const step = user?.Current_Activity;
    return (
      aiMentorSession.isActive?.(tgId) ||
      step === 'WheelBalance' ||
      (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_')))
    );
  } catch (error) {
    console.error('[isActiveSession] Помилка:', error);
    return false;
  }
};

const handleBlockedMenu = async (ctx) => {
  const tgId = ctx.from.id;
  let sessionType = 'сесія';

  try {
    const userService = (await import('../../services/userService.js')).default;
    const user = await userService.getUserByTgId(tgId);
    const step = user?.Current_Activity;

    if (aiMentorSession.isActive?.(tgId)) sessionType = 'AI наставник';
    else if (step === 'WheelBalance') sessionType = 'колесо балансу';
    else if (step?.startsWith('Q_m_')) sessionType = 'ранкова рефлексія';
    else if (step?.startsWith('Q_e_')) sessionType = 'вечірня рефлексія';
  } catch (error) {
    console.error('[handleBlockedMenu] Помилка:', error);
  }

  const message =
    `⚠️ Зараз іде ${sessionType}\n\n` +
    `Завершимо поточну сесію?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔁 Продовжити', callback_data: 'continue_session' }],
        [{ text: '🚪 Вийти із сесії', callback_data: 'exit_session' }]
      ]
    }
  });
};

const handleSessionControl = async (ctx, data) => {
  const tgId = ctx.from.id;

  try {
    const userService = (await import('../../services/userService.js')).default;
    const user = await userService.getUserByTgId(tgId);
    const step = user?.Current_Activity;

    if (data === 'continue_session') {
      if (aiMentorSession.isActive?.(tgId)) {
        const keyboards = (await import('../../utils/keyboards.js')).default;
        await ctx.reply('💬 Продовжуємо діалог з AI наставником. Напиши своє питання!', keyboards.aiMentorControlKeyboard());
      } else if (step === 'WheelBalance') {
        await ctx.reply('🎯 Продовжуємо колесо балансу...');
      } else if (step?.startsWith('Q_m_')) {
        const dailyController = (await import('../flows/dailyController.js')).default;
        const qnum = parseInt(step.split('_')[2], 10);
        await dailyController.askMorningQuestion?.(ctx, qnum);
      } else if (step?.startsWith('Q_e_')) {
        const dailyController = (await import('../flows/dailyController.js')).default;
        const qnum = parseInt(step.split('_')[2], 10);
        await dailyController.askEveningQuestion?.(ctx, qnum);
      }
    } else if (data === 'exit_session') {
      if (aiMentorSession.isActive?.(tgId)) aiMentorSession.end?.(tgId);
      await userService.updateUserActivity?.(tgId);
      const keyboards = (await import('../../utils/keyboards.js')).default;
      await ctx.reply('🏠 Повернулися до головного меню', keyboards.mainMenuKeyboard());
    }
  } catch (error) {
    console.error('[handleSessionControl] Помилка:', error);
    const keyboards = (await import('../../utils/keyboards.js')).default;
    await ctx.reply('❌ Помилка. Повертаємося до меню.', keyboards.mainMenuKeyboard());
  }
};

export default {
  isActiveSession,
  handleBlockedMenu,
  handleSessionControl
};
