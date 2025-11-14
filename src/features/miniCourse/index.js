//src/features/miniCourse/index.js
// Приклад нової воронки (3-денний міні-курс)
import funnelEngine from '../../services/funnelEngine.js';
import gamificationHub from '../../services/gamificationHub.js';
import analyticsLogger from '../../services/analyticsLogger.js';
import reminderScheduler from '../../services/reminderScheduler.js';

const CONFIG = {
  tableName: 'Mini_Course_Funnel',
  totalSteps: 3,
  durationHours: 72,
  maxLives: 3
};

export default function initMiniCourse(bot) {
  console.log('📚 [miniCourse] Ініціалізація...');
  
  // Start funnel
  bot.action('start_mini_course', async (ctx) => {
    const tgId = ctx.from.id;
    
    await funnelEngine.createFunnel(tgId, 'mini_course', CONFIG);
    await gamificationHub.reward(tgId, 'FUNNEL_STARTED', bot);
    await analyticsLogger.logEvent(tgId, 'mini_course_started');
    
    await ctx.reply('🎓 Міні-курс розпочато! День 1...');
    
    // Schedule reminder (24h)
    reminderScheduler.scheduleReminder(tgId, 24 * 60 * 60 * 1000, async () => {
      await bot.telegram.sendMessage(tgId, '⏰ Нагадування: День 2 чекає!');
    });
  });
  
  // Complete step
  bot.action(/^mini_complete_(\d+)$/, async (ctx) => {
    const step = parseInt(ctx.match[1]);
    const tgId = ctx.from.id;
    
    const funnel = await funnelEngine.getFunnelProgress(tgId, CONFIG.tableName);
    
    await funnelEngine.updateFunnelStep(funnel.id, CONFIG.tableName, step);
    await gamificationHub.reward(tgId, 'FUNNEL_VIDEO', bot);
    
    if (step === CONFIG.totalSteps) {
      await funnelEngine.completeFunnel(funnel.id, CONFIG.tableName, { bonus: true });
      await gamificationHub.reward(tgId, 'FUNNEL_BONUS', bot);
      await ctx.reply('🎉 Курс завершено! +50 балів');
    } else {
      await ctx.reply(`✅ День ${step} завершено! +10 балів`);
    }
  });
  
  console.log('✅ [miniCourse] Готово');
}