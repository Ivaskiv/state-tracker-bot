// src/features/onboarding/index.js
import logger from '../../utils/logger.js';
import { typing } from '../../utils/typing.js';
import * as controller from './controller.js';
import { CALLBACKS } from './constants.js';

const cbList = [
  CALLBACKS.START_REGISTRATION,
  CALLBACKS.SKIP_REGISTRATION,
  CALLBACKS.CONFIRM_NAME,
  CALLBACKS.CHANGE_NAME,
  CALLBACKS.SKIP_NAME,
  CALLBACKS.SKIP_EMAIL,
  CALLBACKS.BACK_EMAIL,
  CALLBACKS.SKIP_PHONE,
  CALLBACKS.BACK_PHONE,
  CALLBACKS.TRIAL,
  CALLBACKS.WEEK,
  CALLBACKS.MONTH,
  CALLBACKS.YEAR,
  CALLBACKS.NO_SUBSCRIPTION,
].join('|');

const cbRegex = new RegExp(`^(${cbList})$|^${CALLBACKS.TZ_PREFIX}`);

export default function initOnboarding(bot) {
  bot.start(async (ctx) => {
    logger.info(`[onboarding] /start ${ctx.from?.id}`);
    await typing(ctx);
    await controller.start(ctx);
  });

  bot.action(cbRegex, async (ctx) => {
    logger.info(`[onboarding] cb ${ctx.callbackQuery?.data}`);
    await typing(ctx);
    await controller.onCallback(ctx);
    await ctx.answerCbQuery().catch(() => {});
  });

  bot.on('text', async (ctx) => {
    logger.info(`[onboarding] text ${ctx.from?.id}`);
    await controller.onText(ctx);
  });
}
