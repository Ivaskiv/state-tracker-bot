// src/tilda/controller.js

import { TILDA_MESSAGES } from './constants.js';
import { TILDA_CONFIG } from './config.js';
import { getMemberAreaUrl, getUserAccessLevel } from './service.js';
import { getTildaKeyboards } from './keyboards.js';
import { getUserByTgId } from '../services/users.js';
import { typing } from '../utils/typing.js';
import { formatDate } from '../utils/helpers.js';
import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';

export const openMemberArea = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    await typing(ctx);
    
    const accessLevel = await getUserAccessLevel(tgId);
    const user = await getUserByTgId(tgId);
    
    if (accessLevel === TILDA_CONFIG.ACCESS_LEVELS.EXPIRED) {
      await ctx.reply(TILDA_MESSAGES.ACCESS_EXPIRED, getTildaKeyboards.upgrade());
      return;
    }
    
    let accessMessage = '';
    const endDate = user?.fields?.End_Date ? formatDate(user.fields.End_Date) : null;
    
    switch (accessLevel) {
      case TILDA_CONFIG.ACCESS_LEVELS.FREE:
        accessMessage = TILDA_MESSAGES.FREE_ACCESS_ONLY;
        break;
      case TILDA_CONFIG.ACCESS_LEVELS.TRIAL:
        accessMessage = TILDA_MESSAGES.TRIAL_ACCESS.replace('{END_DATE}', endDate || '—');
        break;
      case TILDA_CONFIG.ACCESS_LEVELS.PAID:
        accessMessage = TILDA_MESSAGES.PAID_ACCESS.replace('{END_DATE}', endDate || '—');
        break;
    }
    
    await ctx.reply(accessMessage, { parse_mode: 'Markdown' });
    
    const cabinetUrl = await getMemberAreaUrl(tgId);
    
    await ctx.reply(
      TILDA_MESSAGES.MEMBER_AREA(cabinetUrl),
      getTildaKeyboards.cabinet(cabinetUrl, accessLevel)
    );
    
    logger.info(`[Tilda Controller] ✅ Cabinet opened for ${tgId}, level: ${accessLevel}`);
  } catch (error) {
    logger.error('[Tilda Controller] ❌ openMemberArea:', error);
    await ctx.reply(TILDA_MESSAGES.ERROR_GENERATING_LINK, keyboards.mainMenuKeyboard());
  }
};

export const refreshToken = async (ctx) => {
  try {
    await ctx.answerCbQuery('🔄 Оновлюємо...');
    const tgId = ctx.from.id;
    const newUrl = await getMemberAreaUrl(tgId);
    
    await ctx.editMessageText(
      TILDA_MESSAGES.MEMBER_AREA(newUrl),
      {
        parse_mode: 'Markdown',
        reply_markup: getTildaKeyboards.cabinet(newUrl).reply_markup
      }
    );
  } catch (error) {
    logger.error('[Tilda Controller] ❌ refreshToken:', error);
    await ctx.answerCbQuery('❌ Помилка оновлення');
  }
};

export const viewSubscriptionInfo = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const subscriptionController = await import('../core/subscription/controller.js');
    await subscriptionController.default.handleSubscriptionInfo(ctx);
  } catch (error) {
    logger.error('[Tilda Controller] ❌ viewSubscriptionInfo:', error);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

export const upgradeAccess = async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const subscriptionController = await import('../core/subscription/controller.js');
    await subscriptionController.default.handleSubscriptionPlans(ctx);
  } catch (error) {
    logger.error('[Tilda Controller] ❌ upgradeAccess:', error);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
  }
};

export default { openMemberArea, refreshToken, viewSubscriptionInfo, upgradeAccess };

console.log('✅ [Tilda Controller] Завантажено');