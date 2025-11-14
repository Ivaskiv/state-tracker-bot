// src/core/auth/middleware.js
import { authenticateUser, isRegistered } from './service.js';

export const authMiddleware = async (ctx, next) => {
  const tgId = ctx.from?.id;
  if (!tgId) return;
  
  const firstName = ctx.from.first_name || '';
  const source = ctx.startPayload?.source || 'telegram';
  
  ctx.state.user = await authenticateUser(tgId, firstName, source);
  ctx.state.isRegistered = isRegistered(ctx.state.user);
  
  await next();
};

export const requireAuth = async (ctx, next) => {
  if (!ctx.state.isRegistered) {
    return ctx.reply('Спочатку зареєструйся /start');
  }
  await next();
};