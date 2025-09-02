// src/utils/refreshMenu.js
import keyboards from '../utils/keyboards.js';

const IS_DEV = process.env.NODE_ENV !== 'production';

export async function refreshMenuIfDev(ctx) {
  if (!IS_DEV) return;
  try {
    ctx.session = ctx.session || {};
    const now = Date.now();
    const COOLDOWN_MS = 60 * 1000;
    if (!ctx.session.__menuRefreshedAt || (now - ctx.session.__menuRefreshedAt) > COOLDOWN_MS) {
      await ctx.reply('🔄 Меню оновлено (dev)', keyboards.mainMenuKeyboard());
      ctx.session.__menuRefreshedAt = now;
    }
  } catch (e) {
    console.error('[refreshMenuIfDev] Помилка:', e);
  }
}
