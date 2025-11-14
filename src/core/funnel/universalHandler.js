// src/features/funnels/universalHandler.js
import * as funnelEngine from '../../services/funnelEngine.js';

export const handleFunnelStep = async (ctx, funnelKey, stepNumber) => {
  const tgId = ctx.from.id;
  
  // Отримуємо прогрес
  let progress = await funnelEngine.getFunnelProgress(tgId, funnelKey);
  
  // Якщо немає - створюємо
  if (!progress) {
    progress = await funnelEngine.createFunnel(tgId, funnelKey);
  }
  
  // Перевірки
  if (funnelEngine.isFunnelExpired(progress)) {
    return ctx.reply('⏰ Час вийшов');
  }
  
  if (!funnelEngine.hasLivesRemaining(progress)) {
    return ctx.reply('❌ Життя закінчились');
  }
  
  // Оновлюємо крок
  await funnelEngine.completeFunnelStep(funnelKey, progress.id, stepNumber);
  
  // Перевіряємо чи завершено
  const config = funnelEngine.getFunnelConfig(funnelKey);
  if (stepNumber >= config.totalSteps) {
    await funnelEngine.completeFunnel(funnelKey, progress.id, config.metadata.reward);
    return ctx.reply(`🎉 Воронку завершено! ${config.metadata.reward}`);
  }
  
  // Наступний крок
  const timeLeft = funnelEngine.formatTimeRemaining(
    funnelEngine.getTimeRemaining(progress)
  );
  
  await ctx.reply(
    `✅ Крок ${stepNumber} завершено!\n⏰ Залишилось: ${timeLeft}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: `➡️ Крок ${stepNumber + 1}`, callback_data: `${funnelKey}:${stepNumber + 1}` }
        ]]
      }
    }
  );
};