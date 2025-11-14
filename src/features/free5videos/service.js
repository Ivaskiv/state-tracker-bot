// 📁 src/features/free5videos/service.js
// # Логіка перевірки підписки, відстеження прогресу
// Логіка перевірки підписки, прогрес, бонус
import * as storage from './database.js';
import logger from '../../utils/logger.js';
import { TOTAL_VIDEOS, CHANNEL_URL, LIFE_LOSS_TRIGGERS, TIME_LIMIT_HOURS } from './constants.js';
import { activateTrial } from '../../services/users.js';

/** Перевірка підписки на канал */
export async function checkChannelSubscription(telegram, userId) {
  try {
    const chatId = normalizeChannelId(CHANNEL_URL);
    if (!chatId) {
      logger.warn('CHANNEL_URL is not checkable via Bot API. Skipping hard check.');
      await storage.markChannelSubscribed(userId, true); // fail-open, якщо приватне запрошення
      return true;
    }
    const chatMember = await telegram.getChatMember(chatId, userId);
    const isSubscribed = ['creator', 'administrator', 'member'].includes(chatMember.status);
    if (isSubscribed) await storage.markChannelSubscribed(userId, true);
    return isSubscribed;
  } catch (error) {
    logger.error('Error checking channel subscription:', error);
    // не валимо UX: даємо пройти далі
    await storage.markChannelSubscribed(userId, true);
    return true;
  }
}

/** Відстеження прогресу перегляду відео */
export async function trackVideoProgress(userId, videoNumber) {
  try {
    const progress = await storage.getOrCreateFunnelProgress(userId);

    if (await storage.checkTimeExpired(userId)) {
      return { success: false, reason: 'time_expired', livesRemaining: 0 };
    }
    if (progress.lives_remaining <= 0) {
      return { success: false, reason: 'no_lives', livesRemaining: 0 };
    }

    const videosCompleted = progress.videos_completed || [];
    if (videoNumber > 1 && !videosCompleted.includes(videoNumber - 1)) {
      return {
        success: false,
        reason: 'previous_not_completed',
        currentVideo: progress.current_video,
        livesRemaining: progress.lives_remaining,
      };
    }

    await storage.updateCurrentVideo(userId, videoNumber);
    return { success: true, currentVideo: videoNumber, livesRemaining: progress.lives_remaining };
  } catch (error) {
    logger.error('Error tracking video progress:', error);
    throw error;
  }
}

/** Завершення перегляду відео */
export async function completeVideo(userId, videoNumber) {
  try {
    const progress = await storage.markVideoCompleted(userId, videoNumber);
    const videosCompleted = progress.videos_completed || [];
    const allCompleted = videosCompleted.length === TOTAL_VIDEOS;
    return {
      success: true,
      videoNumber,
      videosCompleted: videosCompleted.length,
      totalVideos: TOTAL_VIDEOS,
      allCompleted,
      livesRemaining: progress.lives_remaining,
      canActivateBonus: allCompleted && !progress.bonus_activated,
    };
  } catch (error) {
    logger.error('Error completing video:', error);
    throw error;
  }
}

/** Активація 7-денного бонусу */
export async function activateSevenDayBonus(userId) {
  try {
    const progress = await storage.getOrCreateFunnelProgress(userId);
    const videosCompleted = progress.videos_completed || [];
    if (videosCompleted.length < TOTAL_VIDEOS) {
      return { success: false, reason: 'not_all_videos_completed', completed: videosCompleted.length, required: TOTAL_VIDEOS };
    }
    if (progress.bonus_activated) return { success: false, reason: 'bonus_already_activated' };

    await activateTrial(userId, 7);
    await storage.activateBonus(userId);
    logger.info(`7-day bonus activated for user ${userId}`);
    return { success: true, daysGranted: 7, livesRemaining: progress.lives_remaining };
  } catch (error) {
    logger.error('Error activating bonus:', error);
    throw error;
  }
}

/** Втратити життя (неактивність/пропуск) */
export async function handleLifeLoss(userId, reason) {
  try {
    const progress = await storage.loseLife(userId, reason);
    logger.info(`User ${userId} lost a life. Reason: ${reason}. Lives remaining: ${progress.lives_remaining}`);
    return { livesRemaining: progress.lives_remaining, allLivesLost: progress.lives_remaining === 0 };
  } catch (error) {
    logger.error('Error handling life loss:', error);
    throw error;
  }
}

/** Перевірка неактивності користувача */
export async function checkUserInactivity(userId) {
  try {
    const progress = await storage.getOrCreateFunnelProgress(userId);
    const now = new Date();
    const lastActivity = new Date(progress.last_activity);
    const hoursInactive = (now - lastActivity) / 1000 / 60 / 60;

    let livesLost = 0;
    if (hoursInactive >= 12 && hoursInactive < 18 && progress.lives_remaining > 3) {
      await storage.loseLife(userId, 'inactivity_12h');
      livesLost = LIFE_LOSS_TRIGGERS.INACTIVITY_12H;
    }
    if (hoursInactive >= 18 && progress.lives_remaining > 1) {
      await storage.loseLife(userId, 'inactivity_18h');
      livesLost += LIFE_LOSS_TRIGGERS.INACTIVITY_18H;
    }
    if (hoursInactive >= TIME_LIMIT_HOURS) {
      await storage.loseAllLives(userId, 'time_expired');
      livesLost = progress.lives_remaining;
    }
    return { hoursInactive: Math.floor(hoursInactive), livesLost, livesRemaining: Math.max(0, progress.lives_remaining - livesLost) };
  } catch (error) {
    logger.error('Error checking user inactivity:', error);
    throw error;
  }
}

/** Отримання стану воронки */
export async function getFunnelState(userId) {
  try {
    const stats = await storage.getFunnelStats(userId);
    let state = 'not_started';
    if (stats.isExpired || stats.livesRemaining === 0) state = 'expired';
    else if (stats.bonusActivated) state = 'bonus_activated';
    else if (stats.videosCompleted === TOTAL_VIDEOS) state = 'all_completed';
    else if (stats.videosCompleted > 0) state = 'in_progress';
    else if (stats.currentVideo > 0) state = 'started';
    return { state, ...stats };
  } catch (error) {
    logger.error('Error getting funnel state:', error);
    throw error;
  }
}

/** Формат часу */
export function formatTimeRemaining(minutes) {
  if (minutes <= 0) return 'Час вийшов';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} хв`;
  return `${hours} год ${mins} хв`;
}

/** Рестарт воронки */
export async function restartFunnel(userId) {
  try {
    await storage.resetFunnelProgress(userId);
    logger.info(`Funnel restarted for user ${userId}`);
    return { success: true, message: 'Воронка перезапущена. У тебе знову 5 життів!' };
  } catch (error) {
    logger.error('Error restarting funnel:', error);
    throw error;
  }
}

/** Нормалізація channelId з URL (Bot API: @username або -100…) */
function normalizeChannelId(url) {
  if (!url) return null;
  // @username
  if (/^@[\w_]+$/.test(url)) return url;
  // -100… id
  if (/^-100\d+$/.test(url)) return Number(url);
  // https://t.me/username
  const m = url.match(/t\.me\/(@?[\w_]+)/i);
  if (m && !m[1].startsWith('+')) {
    return m[1].startsWith('@') ? m[1] : `@${m[1]}`;
  }
  // invite-link (t.me/+xxxx) — НЕ підтримується getChatMember → повернемо null
  return null;
}
