// src/bot/middleware.js
import { ensureUserExists, updateUserActivity, hasActiveAccess } from '../services/users.js';

// ========== AUTH + STATE ==========
export const initMiddleware = () => async (ctx, next) => {
  const tgId = ctx.from?.id;
  if (!tgId) return next();
  
  ctx.state = ctx.state || {};
  ctx.state.user = await ensureUserExists(tgId, ctx.from.first_name || '');
  ctx.state.step = ctx.state.user.fields?.Answer_Step || 'idle';
  ctx.state.isOnboarded = ctx.state.user.fields?.UserRegistered || false;
  
  await next();
};

// ========== ACCESS ==========
export const checkAccessMiddleware = () => async (ctx, next) => {
  const freeCommands = ['/start', '/help'];
  if (freeCommands.includes(ctx.message?.text)) {
    return next();
  }
  
  const { user } = ctx.state;
  if (!user) return next();
  
  ctx.state.hasAccess = hasActiveAccess(user);
  
  if (!ctx.state.hasAccess && ctx.callbackQuery?.data !== 'subscribe') {
    return ctx.reply('❌ Підписка неактивна', {
      reply_markup: {
        inline_keyboard: [[
          { text: '💳 Оформити підписку', callback_data: 'subscribe' }
        ]]
      }
    });
  }
  
  await next();
};

// ========== ANTI-SPAM ==========
const userTimestamps = new Map();
const SPAM_THRESHOLD = 1000;

export const antiSpamMiddleware = () => async (ctx, next) => {
  const tgId = ctx.from?.id;
  if (!tgId) return next();
  
  const now = Date.now();
  const last = userTimestamps.get(tgId) || 0;
  
  if (now - last < SPAM_THRESHOLD) {
    return ctx.answerCbQuery?.('⏳ Повільніше').catch(() => {});
  }
  
  userTimestamps.set(tgId, now);
  await next();
};

// ========== PERFORMANCE ==========
export const performanceMiddleware = (warningMs = 2000) => async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  if (duration > warningMs) {
    console.warn('⚠️ Slow:', ctx.from?.id, ctx.updateType, `${duration}ms`);
  }
};

// ========== ACTIVITY ==========
// export const activityMiddleware = async (ctx, next) => {
//   await next();
//   const tgId = ctx.from?.id;
//   if (tgId) updateUserActivity(tgId).catch(() => {});
// };

// ========== ERROR ==========
export const errorMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    console.error('❌', e.message, 'User:', ctx.from?.id);
    await ctx.reply('❌ Помилка. /start').catch(() => {});
  }
};