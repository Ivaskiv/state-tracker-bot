import * as controller from './controller.js';
import keyboards from '../../utils/keyboards.js';
import { isValidName } from '../../utils/validators.js';
import logger from '../../utils/logger.js';
import { getUserByTgId, updateUserStep, updateUserFields } from '../../services/users.js';

export default function initOnboarding(bot) {
  bot.start(controller.start);
  bot.on('text', controller.onText);

  bot.action('enter_custom_name', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const tgId = ctx.from.id;
      await updateUserStep(tgId, 'ob_name_input');
      await ctx.reply('Введи, будь ласка, ім’я (2–50 символів):');
    } catch (e) {
      logger.error('[onboarding/enter_custom_name]', e);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  bot.action('use_telegram_name', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const tgId = ctx.from.id;
      const name = (ctx.from.first_name || 'Користувач').trim();
      await updateUserFields(tgId, { 'User Name': name });
      await updateUserStep(tgId, 'ob_email');
      await ctx.reply(
        `Записала: "${name}". Тепер введи email або натисни "Пропустити".`,
        keyboards.kbSkipEmail()
      );
    } catch (e) {
      logger.error('[onboarding/use_telegram_name]', e);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  bot.on('text', async (ctx, next) => {
    try {
      const tgId = ctx.from.id;
      const userRec = await getUserByTgId(tgId);
      const step = userRec?.fields?.Answer_Step;
      if (step !== 'ob_name_input') return next?.();

      const name = (ctx.message.text || '').trim();
      if (!isValidName(name)) {
        await ctx.reply('Імʼя має бути 2–50 символів. Спробуй ще раз:');
        return;
      }

      await updateUserFields(tgId, { 'User Name': name });
      await updateUserStep(tgId, 'ob_email');
      await ctx.reply(
        `Чудово, ${name}! Тепер введи email або натисни "Пропустити".`,
        keyboards.kbSkipEmail()
      );
    } catch (e) {
      logger.error('[onboarding/text ob_name_input]', e);
    }
  });
}
