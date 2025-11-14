// src/features/free5videos/handlers.js
import { checkAndAwardBadge } from '../../core/gamification/engine.js';
import * as subscription from '../../core/subscription/service.js';
import funnelEngine from '../../services/funnelEngine.js';
import { FUNNEL_KEY, VIDEOS, MESSAGES, KEYBOARDS, CHANNEL_ID } from './constants.js';

// ===== CACHE =====
const progressCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const getProgressCached = async (tgId) => {
  const cached = progressCache.get(tgId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  if (progress) {
    progressCache.set(tgId, { data: progress, timestamp: Date.now() });
  }
  return progress;
};

const clearProgressCache = (tgId) => {
  progressCache.delete(tgId);
};

// ===== HANDLE START (ОПТИМІЗОВАНО) =====
export const handleStart = async (ctx) => {
  try {
    await ctx.answerCbQuery?.();
    const tgId = ctx.from.id;
    const userName = ctx.state.user?.fields?.['User Name'] || ctx.from.first_name;

    const progress = await getProgressCached(tgId);

    if (progress) {
      // Перевіримо у порядку пріоритету
      if (funnelEngine.isFunnelExpired(progress)) {
        return ctx.reply(MESSAGES.TIME_EXPIRED);
      }

      if (!funnelEngine.hasLivesRemaining(progress)) {
        return ctx.reply(MESSAGES.ALL_LIVES_LOST);
      }

      if (funnelEngine.isFunnelCompleted(progress)) {
        return ctx.reply('✅ Ти вже завершила курс!');
      }

      return handleContinue(ctx, progress);
    }

    await ctx.reply(MESSAGES.WELCOME(userName), KEYBOARDS.start);

  } catch (error) {
    console.error('[free5/handleStart]', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
  }
};

// ===== HANDLE START FUNNEL (ОПТИМІЗОВАНО) =====
export const handleStartFunnel = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;

    await funnelEngine.createFunnel(tgId, FUNNEL_KEY);
    clearProgressCache(tgId);

    await ctx.reply(MESSAGES.SUBSCRIPTION_REQUIRED, KEYBOARDS.checkSubscription);

  } catch (error) {
    console.error('[free5/handleStartFunnel]', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
  }
};

// ===== HANDLE CHECK SUBSCRIPTION (ОПТИМІЗОВАНО) =====
export const handleCheckSubscription = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;

    let isSubscribed = false;

    try {
      const member = await ctx.telegram.getChatMember(CHANNEL_ID, tgId);
      isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);
    } catch (e) {
      console.warn('[free5/checkSub]', e.message);
      isSubscribed = true; // Якщо помилка - допускаємо
    }

    if (!isSubscribed) {
      return ctx.reply(
        '❌ Ти ще не підписана.\n\nПідпишись і натисни кнопку знову.',
        KEYBOARDS.checkSubscription
      );
    }

    await showVideo(ctx, 1);

  } catch (error) {
    console.error('[free5/handleCheckSubscription]', error);
    await ctx.reply('❌ Помилка.');
  }
};

// ===== SHOW VIDEO (ОПТИМІЗОВАНО) =====
const showVideo = async (ctx, videoNum) => {
  try {
    const tgId = ctx.from.id;
    const progress = await getProgressCached(tgId);

    if (!progress) return;

    const video = VIDEOS[videoNum];
    if (!video) {
      return ctx.reply('❌ Відео не знайдено.');
    }

    const lives = progress.fields.lives_remaining;
    const timeLeft = funnelEngine.formatTimeRemaining(
      funnelEngine.getTimeRemaining(progress)
    );

    await ctx.reply(
      MESSAGES.VIDEO_UNLOCKED(video, lives, timeLeft),
      {
        parse_mode: 'Markdown',
        ...KEYBOARDS.video(videoNum)
      }
    );

  } catch (error) {
    console.error('[free5/showVideo]', error);
    await ctx.reply('❌ Помилка.');
  }
};

// ===== HANDLE VIDEO REQUEST (ОПТИМІЗОВАНО) =====
export const handleVideoRequest = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const videoNum = parseInt(ctx.match[1]);
    
    if (isNaN(videoNum) || videoNum < 1 || videoNum > 5) {
      return ctx.reply('❌ Невірний номер відео.');
    }

    await showVideo(ctx, videoNum);

  } catch (error) {
    console.error('[free5/handleVideoRequest]', error);
    await ctx.reply('❌ Помилка.');
  }
};

// ===== HANDLE VIDEO COMPLETE (ОПТИМІЗОВАНО) =====
export const handleVideoComplete = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const videoNum = parseInt(ctx.match[1]);
    const tgId = ctx.from.id;

    const progress = await getProgressCached(tgId);

    if (!progress) return ctx.reply('❌ Прогрес не знайдено.');

    if (funnelEngine.isFunnelExpired(progress)) {
      return ctx.reply(MESSAGES.TIME_EXPIRED);
    }

    // Завершити крок
    await funnelEngine.completeStep(FUNNEL_KEY, progress.id, videoNum, ctx);
    clearProgressCache(tgId);

    // Бейджі та нагороди (без await)
    handleRewards(tgId, videoNum, ctx.telegram).catch(e => 
      console.error('[free5/rewards]', e)
    );

    // Отримати оновлений прогрес
    const updated = await getProgressCached(tgId);
    const completed = JSON.parse(updated.fields.completed_steps || '[]');
    const lives = updated.fields.lives_remaining;
    const timeLeft = funnelEngine.formatTimeRemaining(
      funnelEngine.getTimeRemaining(updated)
    );

    if (completed.length >= 5) {
      await ctx.reply(
        MESSAGES.ALL_COMPLETED(lives),
        {
          parse_mode: 'Markdown',
          ...KEYBOARDS.activateBonus
        }
      );
    } else {
      await ctx.reply(
        MESSAGES.VIDEO_COMPLETED(videoNum, lives, timeLeft),
        { parse_mode: 'Markdown' }
      );

      setTimeout(() => showVideo(ctx, videoNum + 1), 1000);
    }

  } catch (error) {
    console.error('[free5/handleVideoComplete]', error);
    await ctx.reply('❌ Помилка при завершенні.');
  }
};

// ===== HANDLE ACTIVATE BONUS (ОПТИМІЗОВАНО) =====
export const handleActivateBonus = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;

    await subscription.activateTrial(tgId, 7);
    clearProgressCache(tgId);

    await ctx.reply(
      MESSAGES.BONUS_ACTIVATED,
      {
        parse_mode: 'Markdown',
        ...KEYBOARDS.startWheel
      }
    );

  } catch (error) {
    console.error('[free5/handleActivateBonus]', error);
    await ctx.reply('❌ Помилка активації бонусу.');
  }
};

// ===== INFO HANDLERS (ОПТИМІЗОВАНО) =====

export const handleShowLives = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;
    const progress = await getProgressCached(tgId);

    if (!progress) return ctx.reply('❌ Прогрес не знайдено.');

    await ctx.reply(`💝 Життів: ${progress.fields.lives_remaining}/5`);
  } catch (error) {
    console.error('[free5/handleShowLives]', error);
  }
};

export const handleShowTimer = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;
    const progress = await getProgressCached(tgId);

    if (!progress) return ctx.reply('❌ Прогрес не знайдено.');

    const timeLeft = funnelEngine.formatTimeRemaining(
      funnelEngine.getTimeRemaining(progress)
    );
    
    await ctx.reply(`⏰ Залишилось: ${timeLeft}`);
  } catch (error) {
    console.error('[free5/handleShowTimer]', error);
  }
};

export const handleShowProgress = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const tgId = ctx.from.id;
    const progress = await getProgressCached(tgId);

    if (!progress) return ctx.reply('❌ Прогрес не знайдено.');

    const completed = JSON.parse(progress.fields.completed_steps || '[]');
    const lives = progress.fields.lives_remaining;
    const timeLeft = funnelEngine.formatTimeRemaining(
      funnelEngine.getTimeRemaining(progress)
    );

    await ctx.reply(
      `📊 **Мій прогрес:**\n\n` +
      `✅ Пройдено: ${completed.length}/5\n` +
      `💝 Життів: ${lives}/5\n` +
      `⏰ Залишилось: ${timeLeft}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[free5/handleShowProgress]', error);
  }
};

// ===== HELPERS (ОПТИМІЗОВАНО) =====

const handleContinue = async (ctx, progress) => {
  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  const nextVideo = completed.length + 1;

  if (nextVideo > 5) {
    return ctx.reply(
      MESSAGES.ALL_COMPLETED(progress.fields.lives_remaining),
      KEYBOARDS.activateBonus
    );
  }

  await showVideo(ctx, nextVideo);
};

const handleRewards = async (tgId, videoNum, telegram) => {
  // Бейджі
  if (videoNum === 1) {
    await checkAndAwardBadge(tgId, 'first_video', { telegram });
  }

  if (videoNum === 5) {
    await checkAndAwardBadge(tgId, 'all_videos', { telegram });
  }
};

export const checkInactivity = async (bot) => {
  console.log('[free5/checkInactivity] Running...');
  // TODO: Scheduler для перевірки неактивності
};

export default {
  handleStart,
  handleStartFunnel,
  handleCheckSubscription,
  handleVideoRequest,
  handleVideoComplete,
  handleActivateBonus,
  handleShowLives,
  handleShowTimer,
  handleShowProgress,
  checkInactivity,
  clearProgressCache
};