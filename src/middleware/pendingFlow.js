// src/middleware/pendingFlow.js
import userService from '../auth/services/userService.js';
import {
  ANSWER_STEPS,
  MORNING_QUESTIONS,
  EVENING_QUESTIONS,
  SCHEDULER_MESSAGES,
} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';

// Кроки незавершених сесій
const MORNING_SET = new Set([
  ANSWER_STEPS.MORNING_1,
  ANSWER_STEPS.MORNING_2,
  ANSWER_STEPS.MORNING_3,
  ANSWER_STEPS.MORNING_4,
  ANSWER_STEPS.MORNING_5,
  ANSWER_STEPS.MORNING_6,
  ANSWER_STEPS.AFFIRMATION_MORNING,
  ANSWER_STEPS.END_MORNING,
]);
const EVENING_SET = new Set([
  ANSWER_STEPS.EVENING_1,
  ANSWER_STEPS.EVENING_2,
  ANSWER_STEPS.EVENING_3,
  ANSWER_STEPS.EVENING_4,
  ANSWER_STEPS.EVENING_5,
  ANSWER_STEPS.AFFIRMATION_EVENING,
  ANSWER_STEPS.END_EVENING,
]);
const isPendingStep = (step) => MORNING_SET.has(step) || EVENING_SET.has(step);
const sessionTypeOf = (step) => (MORNING_SET.has(step) ? 'Morning' : 'Evening');

// Тексти меню як у твоїй клавіатурі (враховано обидва варіанти Інструкцій)
const MENU_ITEMS = new Set([
  '📈 Щотижневий звіт',
  '📈 Щомісячний звіт',
  '🤖 AI наставник',
  '💎 Афірмація',
  '📊 Мій прогрес',
  '💰 Підписка',
  '❓ Допомога',
  '📝 Інструкції',
  '📊 Інструкції',
  "📞 Зв'язок з нами",
  'ℹ️ Профіль',
  '🏠 Головне меню',
]);

// Таймери персональних нагадувань (key = `${tgId}:${type}`)
const timers = new Map();

// Клавіатура блокування (reply)
const PENDING_KEYBOARD = {
  keyboard: [
    ['🔄 Продовжити відповіді', '⏭️ Пропустити'],
    ['🏠 Головне меню'],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// ===== API =====
export function installPendingFlow(bot) {
  // 1) Блокування меню під час незавершених відповідей
  bot.on('text', async (ctx, next) => {
    const t = (ctx.message?.text || '').trim();
    if (!MENU_ITEMS.has(t)) return next();

    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || ANSWER_STEPS.COMPLETED;
    if (!isPendingStep(step)) return next();

    const name = user?.['User Name'] || 'друже';
    const type = sessionTypeOf(step);
    const prefix = type === 'Morning' ? 'ранкової' : 'вечірньої';

    await ctx.reply(
      `✋ ${name}, у тебе активна сесія ${prefix} рефлексії.\nОбери дію нижче:`,
      { reply_markup: PENDING_KEYBOARD }
    );
  });

  // 2) 🔄 Продовжити відповіді → повернення рівно на останнє питання
  bot.hears('🔄 Продовжити відповіді', async (ctx) => {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || ANSWER_STEPS.COMPLETED;

    if (!isPendingStep(step)) {
      await ctx.reply('Все готово ✅', keyboards.mainMenuKeyboard());
      return;
    }

    const msg = renderPromptForStep(step, user?.['User Name']);
    if (msg) await ctx.reply(msg);
  });

  // 3) ⏭️ Пропустити → завершення сесії + відміна нагадувань
  bot.hears('⏭️ Пропустити', async (ctx) => {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step || ANSWER_STEPS.COMPLETED;

    if (isPendingStep(step)) {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      cancelPendingReminders(tgId, sessionTypeOf(step));
    }

    await ctx.reply('Сесію пропущено. Повертаю в головне меню.', keyboards.mainMenuKeyboard());
  });

  // 4) 🏠 Головне меню
  bot.hears('🏠 Головне меню', async (ctx) => {
    await ctx.reply('Меню:', keyboards.mainMenuKeyboard());
  });
}

// Персональні нагадування після старту сесії: +10хв та +60хв
export function schedulePendingReminders(bot, tgId, type /* 'Morning' | 'Evening' */) {
  cancelPendingReminders(tgId, type);
  const key = `${tgId}:${type}`;

  const tenMin = setTimeout(async () => {
    try {
      const txt =
        (type === 'Morning' ? SCHEDULER_MESSAGES.MORNING_REMINDER : SCHEDULER_MESSAGES.EVENING_REMINDER) +
        `\n\nНатисни «🔄 Продовжити відповіді».`;
      await bot.telegram.sendMessage(tgId, txt);
    } catch {}
  }, 10 * 60 * 1000);

  const sixtyMin = setTimeout(async () => {
    try {
      const txt =
        (type === 'Morning' ? SCHEDULER_MESSAGES.MORNING_REMINDER : SCHEDULER_MESSAGES.EVENING_REMINDER) +
        `\n\nНатисни «🔄 Продовжити відповіді».`;
      await bot.telegram.sendMessage(tgId, txt);
    } catch {}
  }, 60 * 60 * 1000);

  timers.set(key, [tenMin, sixtyMin]);
}

export function cancelPendingReminders(tgId, type /* 'Morning' | 'Evening' */) {
  const key = `${tgId}:${type}`;
  const arr = timers.get(key);
  if (arr) {
    arr.forEach(clearTimeout);
    timers.delete(key);
  }
}

// Точний промпт за кроком (повертаємо останнє питання)
function renderPromptForStep(step, name) {
  // Ранок
  if (step === ANSWER_STEPS.MORNING_1) return `🌞 Доброго ранку, ${name || 'друже'}!\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`;
  if (step === ANSWER_STEPS.MORNING_2) return `2️⃣/6 ${MORNING_QUESTIONS[1]}`;
  if (step === ANSWER_STEPS.MORNING_3) return `3️⃣/6 ${MORNING_QUESTIONS[2]}`;
  if (step === ANSWER_STEPS.MORNING_4) return `4️⃣/6 ${MORNING_QUESTIONS[3]}`;
  if (step === ANSWER_STEPS.MORNING_5) return `5️⃣/6 ${MORNING_QUESTIONS[4]}`;
  if (step === ANSWER_STEPS.MORNING_6) return `6️⃣/6 ${MORNING_QUESTIONS[5]}`;
  if (step === ANSWER_STEPS.AFFIRMATION_MORNING) return '✨ Ось твоя ранкова афірмація:\n\nНапиши її своїми словами.';

  // Вечір
  if (step === ANSWER_STEPS.EVENING_1) return `🌙 Добрий вечір, ${name || 'друже'}!\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`;
  if (step === ANSWER_STEPS.EVENING_2) return `2️⃣/5 ${EVENING_QUESTIONS[1]}`;
  if (step === ANSWER_STEPS.EVENING_3) return `3️⃣/5 ${EVENING_QUESTIONS[2]}`;
  if (step === ANSWER_STEPS.EVENING_4) return `4️⃣/5 ${EVENING_QUESTIONS[3]}`;
  if (step === ANSWER_STEPS.EVENING_5) return `5️⃣/5 ${EVENING_QUESTIONS[4]}`;
  if (step === ANSWER_STEPS.AFFIRMATION_EVENING) return '✨ Вечірня афірмація:\n\nНапиши підсумкову афірмацію дня.';

  return '';
}
