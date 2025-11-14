// 📁 src/features/free5videos/flow.js
// Послідовність повідомлень та кнопки
import * as service from './service.js';
import { MESSAGES, VIDEOS, TOTAL_VIDEOS, CHANNEL_URL, TILDA_PROFILE_URL, TILDA_FUNNEL_URL } from './constants.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';

/** Головне меню */
export async function sendMainMenu(ctx) {
  try {
    await ctx.reply(MESSAGES.MAIN_MENU, keyboards.mainMenuKeyboard());
  } catch (error) {
    logger.error('Error sending main menu:', error);
    throw error;
  }
}

/** Привітальне повідомлення воронки (2 кроки: огляд → підписка/старт) */
export async function sendWelcomeMessage(ctx) {
  try {
    const overview = MESSAGES.WELCOME_FUNNEL;
    // 1) Короткий огляд + кнопка "Дізнатися більше" (Tilda) + "Почати в Telegram"
    await ctx.reply(overview, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ℹ️ Дізнатися більше', url: TILDA_FUNNEL_URL }],
          [{ text: '🎬 Почати в Telegram', callback_data: 'start_funnel' }],
        ],
      },
    });

    // 2) Одразу даємо блок з підпискою (щоб не шукати)
    await ctx.reply('Перш ніж почати — підпишись на канал, тоді натисни кнопку нижче:', {
      ...keyboards.funnelSubscribe(CHANNEL_URL),
    });
  } catch (error) {
    logger.error('Error sending welcome message:', error);
    throw error;
  }
}

/** Запит на підписку (повторно) */
export async function sendSubscriptionRequest(ctx) {
  try {
    await ctx.reply(MESSAGES.SUBSCRIPTION_REQUEST, keyboards.funnelSubscribe(CHANNEL_URL));
  } catch (error) {
    logger.error('Error sending subscription request:', error);
    throw error;
  }
}

/** Відправка відео */
export async function sendVideoMessage(ctx, videoNumber) {
  try {
    const userId = ctx.from.id;
    const state = await service.getFunnelState(userId);

    if (state.isExpired) return await sendTimeExpiredMessage(ctx);
    if (state.livesRemaining === 0) return await sendAllLivesLostMessage(ctx);

    const video = VIDEOS[videoNumber];
    if (!video) {
      await ctx.reply('❌ Відео не знайдено', keyboards.navigationKeyboard('main_menu'));
      return;
    }

    const trackResult = await service.trackVideoProgress(userId, videoNumber);
    if (!trackResult.success) {
      if (trackResult.reason === 'previous_not_completed') {
        return await sendVideoLockedMessage(ctx, videoNumber, state.livesRemaining, state.timeRemaining);
      }
      return;
    }

    const timeLeft = service.formatTimeRemaining(state.timeRemaining);
    const message = MESSAGES.VIDEO_UNLOCKED
      .replace('{title}', video.title)
      .replace('{description}', video.description)
      .replace('{lives}', state.livesRemaining)
      .replace('{timeLeft}', timeLeft);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...keyboards.funnelVideoAction(videoNumber, state.livesRemaining, true),
    });

    await sendTimerReminder(ctx, state.timeRemaining);
  } catch (error) {
    logger.error('Error sending video message:', error);
    throw error;
  }
}

/** Повідомлення про завершення відео */
export async function sendVideoCompletedMessage(ctx, videoNumber) {
  try {
    const userId = ctx.from.id;
    const state = await service.getFunnelState(userId);
    const timeLeft = service.formatTimeRemaining(state.timeRemaining);

    const message = MESSAGES.VIDEO_COMPLETED
      .replace('{number}', videoNumber)
      .replace('{lives}', state.livesRemaining)
      .replace('{timeLeft}', timeLeft);

    await ctx.reply(message, { parse_mode: 'HTML', ...keyboards.navigationKeyboard(null, true) });

    if (videoNumber < TOTAL_VIDEOS) {
      setTimeout(async () => {
        try { await sendVideoMessage(ctx, videoNumber + 1); } catch (e) { logger.error('Deferred next video:', e); }
      }, 2000);
    } else {
      await sendAllVideosCompletedMessage(ctx, state.livesRemaining);
    }
  } catch (error) {
    logger.error('Error sending video completed message:', error);
    throw error;
  }
}

/** Всі відео завершені */
export async function sendAllVideosCompletedMessage(ctx, livesRemaining) {
  try {
    const message = MESSAGES.ALL_VIDEOS_COMPLETED.replace('{lives}', livesRemaining);
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboards.funnelActivateBonus() });
  } catch (error) {
    logger.error('Error sending all videos completed message:', error);
    throw error;
  }
}

/** Бонус активовано */
export async function sendBonusActivatedMessage(ctx) {
  try {
    await ctx.reply(MESSAGES.BONUS_ACTIVATED, { parse_mode: 'HTML', ...keyboards.startWheelInline() });
  } catch (error) {
    logger.error('Error sending bonus activated message:', error);
    throw error;
  }
}

/** Час вийшов */
export async function sendTimeExpiredMessage(ctx) {
  try {
    await ctx.reply(MESSAGES.TIME_EXPIRED, { parse_mode: 'HTML', ...keyboards.funnelExpired() });
  } catch (error) {
    logger.error('Error sending time expired message:', error);
    throw error;
  }
}

/** Втрата життя */
export async function sendLifeLostMessage(ctx, livesRemaining, _reason = 'unknown') {
  try {
    const message = MESSAGES.LIFE_LOST.replace('{lives}', livesRemaining);
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboards.funnelLifeLost() });
  } catch (error) {
    logger.error('Error sending life lost message:', error);
    throw error;
  }
}

/** Всі життя втрачені */
export async function sendAllLivesLostMessage(ctx) {
  try {
    await ctx.reply(MESSAGES.ALL_LIVES_LOST, { parse_mode: 'HTML', ...keyboards.funnelAllLivesLost() });
  } catch (error) {
    logger.error('Error sending all lives lost message:', error);
    throw error;
  }
}

/** Відео заблоковане */
export async function sendVideoLockedMessage(ctx, videoNumber, livesRemaining, timeRemaining) {
  try {
    const timeLeft = service.formatTimeRemaining(timeRemaining);
    const message = MESSAGES.NEXT_VIDEO_LOCKED
      .replace('{number}', videoNumber)
      .replace('{lives}', livesRemaining)
      .replace('{timeLeft}', timeLeft);
    await ctx.reply(message, { parse_mode: 'HTML', ...keyboards.funnelLocked(videoNumber - 1) });
  } catch (error) {
    logger.error('Error sending video locked message:', error);
    throw error;
  }
}

/** Вихід на Tilda */
export async function sendExitToTildaMessage(ctx) {
  try {
    await ctx.reply(MESSAGES.EXIT_TO_TILDA, { parse_mode: 'HTML', ...keyboards.returnToTilda(TILDA_PROFILE_URL) });
  } catch (error) {
    logger.error('Error sending exit to tilda message:', error);
    throw error;
  }
}

/** Нагадування про таймер (одноразове коротке) */
async function sendTimerReminder(ctx, timeRemaining) {
  try {
    const hours = Math.floor(timeRemaining / 60);
    const minutes = timeRemaining % 60;

    let emoji = '⏰';
    if (hours < 4) emoji = '🔥';
    if (hours < 2) emoji = '🚨';

    const reminder = `${emoji} Залишилось: ${hours} год ${minutes} хв`;
    await ctx.reply(reminder, {
      reply_markup: { inline_keyboard: [[{ text: '⏱️ Показати таймер', callback_data: 'show_timer' }]] },
    });
  } catch (error) {
    logger.error('Error sending timer reminder:', error);
  }
}

/** Відправка запланованих нагадувань (cron/interval) */
export async function sendScheduledReminder(bot, userId, reminderType, state) {
  try {
    let message = '';
    switch (reminderType) {
      case 'REMINDER_21H': message = MESSAGES.REMINDER_21H.replace('{lives}', state.livesRemaining); break;
      case 'REMINDER_12H':
        message = MESSAGES.REMINDER_12H.replace('{completed}', state.videosCompleted).replace('{lives}', state.livesRemaining);
        break;
      case 'REMINDER_4H':
        message = MESSAGES.REMINDER_4H.replace('{remaining}', TOTAL_VIDEOS - state.videosCompleted).replace('{lives}', state.livesRemaining);
        break;
      case 'REMINDER_1H':
        message = MESSAGES.REMINDER_1H.replace('{lives}', state.livesRemaining).replace('{remaining}', TOTAL_VIDEOS - state.videosCompleted);
        break;
    }
    if (message) {
      await bot.telegram.sendMessage(userId, message, {
        parse_mode: 'HTML',
        ...keyboards.funnelContinue(state.currentVideo || 1, state.livesRemaining),
      });
    }
  } catch (error) {
    logger.error(`Error sending scheduled reminder to user ${userId}:`, error);
  }
}

/**
 * Відправка запланованих нагадувань (cron)
 */
export async function sendScheduledReminders(bot) {
  try {
    for (const { hours, message: type } of REMINDER_SCHEDULE) {
      const users = await storage.getUsersForReminders(hours);
      for (const u of users) {
        const userId = u.user_id;
        const state = {
          livesRemaining: u.lives_remaining,
          videosCompleted: u.videos_completed.length,
          currentVideo: u.current_video
        };
        let message = MESSAGES[type]
          .replace('{lives}', state.livesRemaining)
          .replace('{completed}', state.videosCompleted)
          .replace('{remaining}', TOTAL_VIDEOS - state.videosCompleted);
        
        await bot.telegram.sendMessage(userId, message, keyboards.funnelContinue(state.currentVideo || 1));
      }
    }
  } catch (e) {
    logger.error('[flow/sendScheduledReminders]', e);
  }
}