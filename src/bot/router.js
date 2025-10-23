import initOnboarding from '../features/onboarding/index.js';
import initWheelBalance, { publicApi as wheelApi } from '../features/wheelBalance/index.js';
import initDaily,       { publicApi as dailyApi } from '../features/dailySessions/index.js';
import initSubs,        { publicApi as subsApi }  from '../features/subscription/index.js';
import initDashboard,   { publicApi as dashApi }  from '../features/dashboard/index.js';
import initAIMentor,    { publicApi as aiApi }    from '../features/aiMentor/index.js';
import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';

const ensureHandler = (fn, txt='⛔️ Тимчасово недоступно') =>
  (typeof fn === 'function' ? fn : async (ctx)=>{ try{ await ctx.reply(txt, keyboards.mainMenuKeyboard()); }catch{} });

const attachRoutes = (bot) => {
  // Кожна фіча сама реєструє свої дії:
  initOnboarding(bot);
  initWheelBalance(bot);
  initDaily(bot);
  initSubs(bot);
  initDashboard(bot);
  initAIMentor(bot);

  // Єдиний TEXT-обробник (пріоритети зверху вниз):
  bot.on('text', async (ctx) => {
    const text = (ctx.message?.text || '').trim();
    const tgId = ctx.from.id;

    // 1) daily як основний фокус діалогу
    if (await dailyApi?.handleText?.(ctx, text)) return;

    // 2) wheel — якщо очікується нотатка
    if (await wheelApi?.handleNoteText?.(ctx, text)) return; // зроби такий метод-обгортку, що дергає saveNote+next

    // 3) AI-ментор — центральний «мозок»
    if (await aiApi?.handleText?.(ctx, text)) return;

    // 4) Дашборд/навігація
    if (await dashApi?.handleText?.(ctx, text)) return;

    await ctx.reply('Не зовсім зрозумів. Обери дію:', keyboards.mainMenuKeyboard());
  });

  bot.catch((err, ctx) => {
    logger.error(`[router] ${ctx.updateType} error:`, err);
    try { ctx.reply('Сталася помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard()); } catch {}
  });

  logger.info('✅ [router] wired');
};

export const initRouter = attachRoutes;
export default attachRoutes;
