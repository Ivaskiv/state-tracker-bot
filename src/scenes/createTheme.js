import { config } from "../config/config.js";
import fs from 'fs';
import { Markup, Scenes } from 'telegraf';

/**
 * За замовчуванням повертає текст запитання для конкретного кроку опитування за темою.
 * Якщо для даної теми є запитання (наприклад, completion, emotion тощо) воно використовується,
 * інакше повертається загальний текст із config.messages.
 */
export const getThemeText = (themeKey, step) => {
  // Перевіряємо, чи задана тема в конфігурації themes
  if (config.themes && config.themes[themeKey] && config.themes[themeKey][step]) {
    return config.themes[themeKey][step];
  }
  // Фолбек: шукаємо відповідне повідомлення в messages із ключем step + "Step"
  return config.messages?.[`${step}Step`] || `Оберіть ${step}:`;
};

/**
 * Універсальна функція для створення клавіатури.
 * Очікує список кнопок у вигляді масиву об’єктів { text, callback_data }.
 */
export const createKeyboard = (buttons) => {
  if (!Array.isArray(buttons)) {
    console.error('Invalid buttons format:', buttons);
    return [];
  }
  return buttons.map(button => [Markup.button.callback(button.text, button.callback_data)]);
};

/**
 * Генерує текст для поточного кроку опитування.
 * Використовує дані з pollSettings, якщо вони задані, або повертає дефолтний текст із теми.
 */
export const generateMessage = (step, key) => {
  // Шукаємо у полі pollSettings, якщо воно існує
  const setting = config.pollSettings && config.pollSettings[step]
    ? config.pollSettings[step].find(item => item.key === key)
    : null;
  if (setting) {
    return `${step.charAt(0).toUpperCase() + step.slice(1)}: ${setting.text}`;
  }
  // Фолбек: повертаємо «Невідоме» повідомлення
  return `Невідоме ${step}`;
};

/**
 * Запускає опитування.
 * Відправляє початкове повідомлення та кнопки для вибору state.
 */
export const startPoll = async (ctx) => {
  const themeKey = process.env.BOT_THEME || 'emotionTracking';
  // Якщо в темі є особливе стартове повідомлення, використовуйте його, інакше дефолтно:
  const startMessage = config.themes?.[themeKey]?.startMessage || 'Привіт! Починаємо опитування...';
  // Отримуємо кнопки для state (за замовчуванням — з ключем stateButtons)
  const stateButtons = config.keyboard?.stateButtons || [];
  await ctx.reply(startMessage, { 
    reply_markup: { inline_keyboard: createKeyboard(stateButtons) }
  });
};

/**
 * Універсальний хендлер відповіді для будь-якого кроку опитування.
 * Він зберігає відповідь у сесії та переходить до наступного кроку (якщо є),
 * або завершує опитування і зберігає результати.
 */
export const handleStepResponse = async (ctx, currentStep) => {
  const value = ctx.match[1]; // Значення, яке отримали (наприклад, ключ кнопки)
  // Зберігаємо відповідь в сесії
  ctx.session.pollAnswers = ctx.session.pollAnswers || {};
  ctx.session.pollAnswers[currentStep] = value;

  // Генеруємо повідомлення для поточного кроку
  const currentMessage = generateMessage(currentStep, value);

  // Масив кроків – у порядку: state, emotion, feeling, action
  const steps = ['state', 'emotion', 'feeling', 'action'];
  const currentIndex = steps.indexOf(currentStep);
  if (currentIndex === -1) {
    console.error(`Невідомий крок: ${currentStep}`);
    return ctx.reply('Сталася помилка опитування.');
  }

  if (currentIndex < steps.length - 1) {
    // Отримуємо наступний крок
    const nextStep = steps[currentIndex + 1];
    const themeKey = process.env.BOT_THEME || 'emotionTracking';
    // Отримуємо текст наступного запитання (якщо він налаштований в темі, інакше стандартно)
    const nextQuestion = getThemeText(themeKey, nextStep);
    // Отримуємо кнопки для наступного кроку, наприклад: emotionButtons, feelingButtons, actionButtons
    const nextKeyboardKey = `${nextStep}Buttons`;
    const nextButtons = config.keyboard?.[nextKeyboardKey] || [];
    await ctx.reply(`${currentMessage}\n\n${nextQuestion}`, {
      reply_markup: {
        inline_keyboard: createKeyboard(nextButtons)
      }
    });
  } else {
    // Фінальний крок: завершення опитування
    const themeKey = process.env.BOT_THEME || 'emotionTracking';
    const finalMessage = config.themes?.[themeKey]?.completion || 'Дякую! Ваші відповіді збережено. Опитування завершено.';
    await ctx.reply(`${currentMessage}\n\n${finalMessage}`);
    // Зберігаємо результати опитування (приклад: у файл)
    fs.writeFileSync(`./data/${ctx.from.id}_pollResults.json`,
      JSON.stringify(ctx.session.pollAnswers, null, 2), 'utf8'
    );
    // Опціонально – повертаємо користувача до головного меню
    // await sendMainMenu(ctx);
    ctx.session.pollAnswers = {}; // Очистка сесії
  }
};

// Спеціфічні хендлери для кожного кроку, які викликають універсальний хендлер:
export const handleStateResponse = async (ctx) => {
  await handleStepResponse(ctx, 'state');
};

export const handleEmotionResponse = async (ctx) => {
  await handleStepResponse(ctx, 'emotion');
};

export const handleFeelingResponse = async (ctx) => {
  await handleStepResponse(ctx, 'feeling');
};

export const handleActionResponse = async (ctx) => {
  await handleStepResponse(ctx, 'action');
};

// Обробка текстових повідомлень як фолбек для опитування
// (якщо користувач напише щось, що не відповідає очікуваним варіантам)
export const handleTextFallback = (ctx) => {
  ctx.reply(config.messages.errorMessage || 'Вибач, я не зрозумів повідомлення.');
};
