import * as flow from './flow.js';
import * as controller from './controller.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';

// 1) Експортуємо публічні функції (щоб router міг дернути їх напряму за потреби)
export const publicApi = {
  // приклад:
  handleText: controller.handleText,        // опціонально: текстовий роутер фічі
  getState: flow.getState,                  // бізнес-логіка
  // ...
};

// 2) Ініціалізуємо хендлери Telegraf
export default function initFeature(bot) {
  logger.info('🚀 [<feature>] init');
  
  // приклади:
  bot.action('<feature>_start', async (ctx) => {
    const res = await flow.start(ctx.from.id, ctx.from.username || '');
    await ctx.reply(res.message, res.keyboard || keyboards.mainMenuKeyboard());
  });

  bot.action(/^<feature>_do_(.+)$/, async (ctx) => {
    const [, arg] = ctx.match;
    const res = await flow.doThing(ctx.from.id, arg);
    await ctx.reply(res.message, res.keyboard || keyboards.mainMenuKeyboard());
  });

  // ...інші кнопки/команди саме цієї фічі
  logger.info('✅ [<feature>] handlers ready');
}
