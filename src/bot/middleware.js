// src/bot/middleware.js

import { getRegistrationData } from "../features/registration/service.js";
import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

// ═══════════════════════════════════════════════════════════
// INIT MIDDLEWARE - Завантаження даних користувача
// ═══════════════════════════════════════════════════════════

export const initMiddleware = () => async (ctx, next) => {
  const tgId = String(ctx.from?.id || ctx.chat?.id);
  
  if (!tgId) return next();
  
  try {
    const users = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1
      })
      .firstPage();
    
    if (users.length > 0) {
      const user = users[0];
      ctx.state.user = user;
      ctx.state.isOnboarded = user.fields.UserRegistered === true;
      ctx.state.step = user.fields.Answer_Step || 'idle';
    } else {
      ctx.state.user = null;
      ctx.state.isOnboarded = false;
      ctx.state.step = 'idle';
    }
  } catch (err) {
    console.error('[initMiddleware] Error:', err);
    ctx.state.user = null;
    ctx.state.isOnboarded = false;
    ctx.state.step = 'idle';
  }
  
  return next();
};

// ═══════════════════════════════════════════════════════════
// ERROR MIDDLEWARE - Обробка помилок
// ═══════════════════════════════════════════════════════════

export const errorMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('❌ [errorMiddleware]', err);
    
    try {
      await ctx.reply(
        '❌ Виникла помилка при обробці запиту.\n\n' +
        'Спробуй ще раз або напиши @vira_333'
      );
    } catch (replyErr) {
      console.error('❌ [errorMiddleware] Failed to send error message:', replyErr);
    }
  }
};

// ═══════════════════════════════════════════════════════════
// ANTI-SPAM MIDDLEWARE
// ═══════════════════════════════════════════════════════════

export const antiSpamMiddleware = (maxRequests = 10, timeWindow = 5000) => {
  const userRequests = new Map();

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const userHistory = userRequests.get(userId) || [];
    
    const recentRequests = userHistory.filter(time => now - time < timeWindow);
    
    if (recentRequests.length >= maxRequests) {
      console.warn(`⚠️ [antiSpam] User ${userId} exceeded rate limit`);
      return ctx.reply('⏱ Занадто багато запитів. Зачекай кілька секунд.');
    }
    
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);
    
    return next();
  };
};

// ═══════════════════════════════════════════════════════════
// PERFORMANCE MIDDLEWARE
// ═══════════════════════════════════════════════════════════

export const performanceMiddleware = (threshold = 2000) => {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    
    if (duration > threshold) {
      console.warn(`⚠️ [performance] Slow request: ${duration}ms, User: ${ctx.from?.id}`);
    }
  };
};

// ═══════════════════════════════════════════════════════════
// CHECK USER REGISTRATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════

export const checkUserRegistration = async (ctx, next) => {
  const tgId = String(ctx.from?.id);
  
  if (!tgId) return next();
  
  console.log('🔍 [checkUserRegistration] Перевірка:', tgId);
  
  try {
    const userData = await getRegistrationData(tgId);
    
    ctx.state.userData = userData;
    ctx.state.isRegistered = !!userData?.UserRegistered;
    ctx.state.needsRegistration = !userData;
    
    const publicCommands = ['/start', 'show_bot_info', 'quick_registration'];
    const isPublicCommand = publicCommands.some(cmd => 
      ctx.message?.text?.startsWith(cmd) || 
      ctx.callbackQuery?.data === cmd
    );
    
    if (!userData && !isPublicCommand) {
      console.log('⛔ [checkUserRegistration] Блокуємо доступ → редирект на реєстрацію');
      return sendRegistrationRequired(ctx);
    }
    
    if (userData && !userData.UserRegistered) {
      const step = userData.Answer_Step;
      if (/^ob_/i.test(step)) {
        console.log('🔄 [checkUserRegistration] Незавершений онбординг:', step);
        ctx.state.onboardingStep = step;
      }
    }
    
    console.log('✅ [checkUserRegistration] Перевірка пройдена');
    return next();
  } catch (err) {
    console.error('❌ [checkUserRegistration] Error:', err);
    return next();
  }
};

const sendRegistrationRequired = async (ctx) => {
  const tgId = String(ctx.from?.id);
  const firstName = ctx.from.first_name || 'Користувач';
  const registrationUrl = `${process.env.TILDA_REGISTRATION_URL || 'https://star-way.pro/registration'}?tg_id=${tgId}`;
  
  await ctx.reply(
    `👋 Привіт, ${firstName}!\n\n` +
    `Для використання цієї функції потрібна реєстрація.\n\n` +
    `**Оберіть спосіб:**\n\n` +
    `⚡ **Швидка** — 1 хвилина в боті\n` +
    `📝 **Повна** — форма на сайті`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Швидка реєстрація', callback_data: 'quick_registration' }],
          [{ text: '📝 Повна форма', url: registrationUrl }]
        ]
      }
    }
  );
};

console.log('✅ [bot/middleware] Всі middleware завантажено');