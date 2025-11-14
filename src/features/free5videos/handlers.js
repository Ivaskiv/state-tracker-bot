// src/features/free5videos/handlers.js
import * as funnelEngine from '../../core/funnel/engine.js';
import * as gamification from '../../core/gamification/engine.js';
import * as subscription from '../../core/subscription/service.js';
import { FUNNEL_KEY, VIDEOS, MESSAGES, KEYBOARDS, CHANNEL_ID } from './constants.js';

export const handleStart = async (ctx) => {
  await ctx.answerCbQuery?.();
  const tgId = ctx.from.id;
  const userName = ctx.state.user?.fields?.['User Name'] || ctx.from.first_name;

  let progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (progress) {
    if (funnelEngine.isFunnelExpired(progress)) {
      return ctx.reply(MESSAGES.TIME_EXPIRED);
    }

    if (funnelEngine.isFunnelCompleted(progress)) {
      return ctx.reply('✅ Ти вже завершила курс!');
    }

    if (!funnelEngine.hasLivesRemaining(progress)) {
      return ctx.reply(MESSAGES.ALL_LIVES_LOST);
    }

    return handleContinue(ctx, progress);
  }

  await ctx.reply(MESSAGES.WELCOME(userName), KEYBOARDS.start);
};

export const handleStartFunnel = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;

  const progress = await funnelEngine.createFunnel(tgId, FUNNEL_KEY);

  await ctx.reply(MESSAGES.SUBSCRIPTION_REQUIRED, KEYBOARDS.checkSubscription);
};

export const handleCheckSubscription = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;

  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, tgId);
    const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

    if (!isSubscribed) {
      return ctx.reply(
        '❌ Ти ще не підписана.\n\nПідпишись і натисни кнопку знову.',
        KEYBOARDS.checkSubscription
      );
    }

    await showVideo(ctx, 1);
  } catch (e) {
    console.error('[free5/checkSub]', e.message);
    await showVideo(ctx, 1);
  }
};

const showVideo = async (ctx, videoNum) => {
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (!progress) return;

  const video = VIDEOS[videoNum];
  const lives = progress.fields.lives_remaining;
  const timeLeft = funnelEngine.formatTimeRemaining(funnelEngine.getTimeRemaining(progress));

  await ctx.reply(
    MESSAGES.VIDEO_UNLOCKED(video, lives, timeLeft),
    {
      parse_mode: 'Markdown',
      ...KEYBOARDS.video(videoNum)
    }
  );
};

export const handleVideoRequest = async (ctx) => {
  await ctx.answerCbQuery();
  const videoNum = parseInt(ctx.match[1]);
  await showVideo(ctx, videoNum);
};

export const handleVideoComplete = async (ctx) => {
  await ctx.answerCbQuery();
  const videoNum = parseInt(ctx.match[1]);
  const tgId = ctx.from.id;

  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (!progress) return;

  if (funnelEngine.isFunnelExpired(progress)) {
    return ctx.reply(MESSAGES.TIME_EXPIRED);
  }

  await funnelEngine.completeStep(FUNNEL_KEY, progress.id, videoNum, ctx);

  await gamification.rewardVideoComplete(tgId);

  if (videoNum === 1) {
    await gamification.checkAndAwardBadge(tgId, 'first_video', ctx.telegram);
  }

  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  const lives = progress.fields.lives_remaining;
  const timeLeft = funnelEngine.formatTimeRemaining(funnelEngine.getTimeRemaining(progress));

  if (completed.length >= 5) {
    await gamification.checkAndAwardBadge(tgId, 'all_videos', ctx.telegram);
    await gamification.rewardFunnelComplete(tgId);

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

    await showVideo(ctx, videoNum + 1);
  }
};

export const handleActivateBonus = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;

  await subscription.activateTrial(tgId, 7);

  await ctx.reply(
    MESSAGES.BONUS_ACTIVATED,
    {
      parse_mode: 'Markdown',
      ...KEYBOARDS.startWheel
    }
  );
};

export const handleShowLives = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (!progress) return;

  const lives = progress.fields.lives_remaining;
  await ctx.reply(`💝 Життів: ${lives}/5`);
};

export const handleShowTimer = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (!progress) return;

  const timeLeft = funnelEngine.formatTimeRemaining(funnelEngine.getTimeRemaining(progress));
  await ctx.reply(`⏰ Залишилось: ${timeLeft}`);
};

export const handleShowProgress = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);

  if (!progress) return;

  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  const lives = progress.fields.lives_remaining;
  const timeLeft = funnelEngine.formatTimeRemaining(funnelEngine.getTimeRemaining(progress));

  await ctx.reply(
    `📊 **Мій прогрес:**\n\n` +
    `✅ Пройдено: ${completed.length}/5\n` +
    `💝 Життів: ${lives}/5\n` +
    `⏰ Залишилось: ${timeLeft}`,
    { parse_mode: 'Markdown' }
  );
};

const handleContinue = async (ctx, progress) => {
  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  const nextVideo = completed.length + 1;

  if (nextVideo > 5) {
    return ctx.reply(MESSAGES.ALL_COMPLETED(progress.fields.lives_remaining), KEYBOARDS.activateBonus);
  }

  await showVideo(ctx, nextVideo);
};

export const checkInactivity = async (bot) => {
  console.log('[free5/checkInactivity] Running...');
  // TODO: Scheduler для перевірки неактивності
};