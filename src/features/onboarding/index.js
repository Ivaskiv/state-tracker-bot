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
    const tgId = String(ctx.from?.id || '');
    const rawPayload = ctx.startPayload || (ctx.message?.text?.split(' ')[1] || '');
    logger.info(`[onboarding] /start ${tgId} | payload:${rawPayload || '-'}`);

    // не блокуємо UX: "друкування" як fire-and-forget
    typing(ctx).catch(() => {});

    // (опційно) передамо payload вниз, якщо контролер хоче ним скористатися
    if (rawPayload) {
      ctx.state = { ...(ctx.state || {}), rawPayload };
    }

    try {
      return controller.start(ctx);
    } catch (e) {
      logger.error('[onboarding]/start failed', e);
      await ctx.reply('⚠️ Виникла тимчасова помилка. Спробуй ще раз /start за хвилину 🙏');
      return false;
    }
  });

bot.action(cbRegex, async (ctx) => {
  logger.info(`[onboarding] cb ${ctx.callbackQuery?.data}`);
  await typing(ctx).catch(() => {});
  // або просто відповімо на callback і передамо керування у callbacks-сервіс,
  // раз ти вже реєструєш їх у controller.js через callbacks.on(...)
  await ctx.answerCbQuery().catch(() => {});
});

  bot.on('text', async (ctx) => {
    logger.info(`[onboarding] text ${ctx.from?.id}`);
    await controller.onText(ctx);
  });
}
