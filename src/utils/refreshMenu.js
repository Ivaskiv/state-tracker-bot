// src/utils/refreshMenu.js
import keyboards from '../dialogue/utils/keyboards.js'; // ✅ правильний шлях (файл у тій самій папці)

const IS_DEV = process.env.NODE_ENV !== 'production';
const INVISIBLE = '\u2063'; // невидимий символ, щоб текст був «непорожній»

export async function refreshMenuIfDev(ctx) {
  if (!IS_DEV) return;
  try {
    ctx.session = ctx.session || {};
    const now = Date.now();
    const COOLDOWN_MS = 60 * 1000;

    if (!ctx.session.__menuRefreshedAt || (now - ctx.session.__menuRefreshedAt) > COOLDOWN_MS) {
      // Завжди: спершу рядок, потім клавіатура — інакше буде [object Object] або 400
      await ctx.reply(INVISIBLE, keyboards.mainMenuKeyboard());
      ctx.session.__menuRefreshedAt = now;
    }
  } catch (e) {
    console.error('[refreshMenuIfDev] Помилка:', e);
  }
}
