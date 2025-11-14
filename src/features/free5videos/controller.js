// src/features/free5videos/controller.js
import * as funnelEngine from '../../services/funnelEngine.js';
import { FUNNELS } from '../../config/funnels.js';
import { FREE5_MESSAGES, VIDEOS } from './constants.js';

const FUNNEL_KEY = FUNNELS.FREE_5_VIDEOS;

export const handleStartFunnel = async (ctx) => {
  await ctx.answerCbQuery?.();
  const tgId = ctx.from.id;
  
  // Перевіряємо існуючий прогрес
  let progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  
  if (!progress) {
    progress = await funnelEngine.createFunnel(tgId, FUNNEL_KEY);
  }
  
  await ctx.reply(
    FREE5_MESSAGES.WELCOME_FUNNEL,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '▶️ Почати', callback_data: 'check_subscription' }
        ]]
      }
    }
  );
};

export const handleCheckSubscription = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  
  // Перевірка підписки (спрощена)
  const isMember = true; // TODO: реальна перевірка
  
  if (!isMember) {
    return ctx.reply(FREE5_MESSAGES.SUBSCRIPTION_REQUEST);
  }
  
  // Показуємо перше відео
  const video = VIDEOS[1];
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  const timeLeft = funnelEngine.formatTimeRemaining(
    funnelEngine.getTimeRemaining(progress)
  );
  
  await ctx.reply(
    FREE5_MESSAGES.VIDEO_UNLOCKED
      .replace('{title}', video.title)
      .replace('{description}', video.description)
      .replace('{lives}', progress.fields.lives_remaining)
      .replace('{timeLeft}', timeLeft),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎥 Дивитись', url: video.url }],
          [{ text: '✅ Переглянула', callback_data: 'complete_1' }]
        ]
      }
    }
  );
};

export const handleVideoComplete = async (ctx, videoNum) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  
  // Завершуємо крок
  await funnelEngine.completeFunnelStep(FUNNEL_KEY, progress.id, videoNum);
  
  const config = funnelEngine.getFunnelConfig(FUNNEL_KEY);
  
  // Якщо це останнє відео
  if (videoNum >= config.totalSteps) {
    await funnelEngine.completeFunnel(FUNNEL_KEY, progress.id, config.metadata.reward);
    
    return ctx.reply(
      FREE5_MESSAGES.ALL_VIDEOS_COMPLETED.replace('{lives}', progress.fields.lives_remaining),
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🎁 Забрати бонус', callback_data: 'activate_bonus' }
          ]]
        }
      }
    );
  }
  
  // Наступне відео
  const nextVideo = VIDEOS[videoNum + 1];
  const timeLeft = funnelEngine.formatTimeRemaining(
    funnelEngine.getTimeRemaining(progress)
  );
  
  await ctx.reply(
    FREE5_MESSAGES.VIDEO_COMPLETED
      .replace('{number}', videoNum)
      .replace('{lives}', progress.fields.lives_remaining)
      .replace('{timeLeft}', timeLeft)
  );
  
  await ctx.reply(
    FREE5_MESSAGES.VIDEO_UNLOCKED
      .replace('{title}', nextVideo.title)
      .replace('{description}', nextVideo.description)
      .replace('{lives}', progress.fields.lives_remaining)
      .replace('{timeLeft}', timeLeft),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎥 Дивитись', url: nextVideo.url }],
          [{ text: '✅ Переглянула', callback_data: `complete_${videoNum + 1}` }]
        ]
      }
    }
  );
};

export const handleActivateBonus = async (ctx) => {
  await ctx.answerCbQuery();
  // Активація trial
  await ctx.reply(FREE5_MESSAGES.BONUS_ACTIVATED);
};

export const handleContinueFunnel = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  const nextStep = progress.fields.current_step + 1;
  
  await handleVideoComplete(ctx, nextStep - 1);
};

export const handleRestartFunnel = async (ctx) => {
  await ctx.answerCbQuery();
  await handleStartFunnel(ctx);
};

export const handleShowTimer = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  const timeLeft = funnelEngine.formatTimeRemaining(
    funnelEngine.getTimeRemaining(progress)
  );
  
  await ctx.reply(`⏰ Залишилось: ${timeLeft}`);
};

export const handleShowLives = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  
  await ctx.reply(`💝 Життів: ${progress.fields.lives_remaining}/5`);
};

export const handleShowStatus = async (ctx) => {
  await ctx.answerCbQuery();
  const tgId = ctx.from.id;
  const progress = await funnelEngine.getFunnelProgress(tgId, FUNNEL_KEY);
  
  const completed = JSON.parse(progress.fields.completed_steps || '[]');
  const timeLeft = funnelEngine.formatTimeRemaining(
    funnelEngine.getTimeRemaining(progress)
  );
  
  await ctx.reply(
    `📊 Твій прогрес:\n\n` +
    `✅ Пройдено: ${completed.length}/5\n` +
    `💝 Життів: ${progress.fields.lives_remaining}/5\n` +
    `⏰ Залишилось: ${timeLeft}`
  );
};

export const handleMainMenu = async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🏠 Головне меню');
};

export const handleExitToTilda = async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(FREE5_MESSAGES.EXIT_TO_TILDA);
};