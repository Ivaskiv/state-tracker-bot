import { configData } from "../config/configData.js";
import { Markup } from "telegraf";
import fs from "fs";
import path from "path";

// Тимчасове сховище відповідей користувачів
const userResponses = new Map();

// Helper: Приведення першої літери до верхнього регістру
const capitalizeFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Функція для отримання кнопок для конкретного кроку (наприклад, state, emotion, feeling, action)
 * за замовчуванням для теми, що вказана в BOT_THEME (якщо не задана – використовується 'emotionTracking').
 */
export const getButtonsForStep = (step) => {
  // Наприклад, очікується, що конфігурація має ключі: stateButtons, emotionButtons, feelingButtons, actionButtons
  return configData.keyboard?.[`${step}Buttons`] || [];
};

/**
 * Функція для отримання тексту наступного запитання.
 * Якщо для даної теми (BOT_THEME) задано текст для кроку, він повертається,
 * інакше – шукається відповідне повідомлення в configData.messages.
 */
export const getStepMessage = (step) => {
  const theme = process.env.BOT_THEME || 'emotionTracking';
  return configData.themes?.[theme]?.[step] ||
         configData.messages?.[`${step}Step`] ||
         configData.messages?.defaultStep ||
         'Оберіть варіант:';
};

/**
 * Функція для визначення порядку кроків в опитуванні.
 * За замовчуванням використовуємо порядок: state, emotion, feeling, action.
 */
export const getThemeSteps = () => {
  return ['state', 'emotion', 'feeling', 'action'];
};

/**
 * Функція для отримання наступного кроку після поточного.
 */
export const getNextStep = (currentStep) => {
  const steps = getThemeSteps();
  const currentIndex = steps.indexOf(currentStep);
  return steps[currentIndex + 1];
};

/**
 * Універсальна функція для створення інлайн-клавіатури.
 */
export const createKeyboard = (buttons) => {
  if (!buttons || !Array.isArray(buttons)) {
    console.error('Invalid buttons format:', buttons);
    return [];
  }
  return buttons.map(button => [Markup.button.callback(button.text, button.callback_data)]);
};

/**
 * Функція для оновлення конфігурації.
 */
export const updateConfig = (key, value) => {
  const [category, keyToChange] = key.split('.');
  try {
    if (configData[category] && configData[category][keyToChange]) {
      configData[category][keyToChange] = value;
      const configString = `export const configData = ${JSON.stringify(configData, null, 2)};`;
      fs.writeFileSync('./config/configData.js', configString, 'utf8');
    } else {
      throw new Error(`Invalid key: ${key}`);
    }
  } catch (err) {
    console.error('Error updating config:', err);
    return 'Сталася помилка при оновленні конфігурації. Спробуйте ще раз.';
  }
};

/**
 * Генерує текст для поточного кроку опитування.
 * Шукає відповідний запис у configData.pollSettings для даного кроку.
 */
export const generateMessage = (step, key) => {
  const category = configData.pollSettings[step];
  const item = category.find(item => item.key === key);
  return item ? `${capitalizeFirst(step)}: ${item.text}` : `Невідоме ${step}`;
};

/**
 * Запуск опитування.
 * Відправляє початкове повідомлення (startMessage) та кнопки для першого кроку (state).
 */
export const startPoll = async (ctx) => {
  const theme = process.env.BOT_THEME || 'emotionTracking';
  const pollSettings = configData.pollSettings[theme] || {};
  const initialButtons = getButtonsForStep('state');

  // Ініціалізуємо сховище відповідей для користувача
  userResponses.set(ctx.from.id, {});
  
  await ctx.reply(
    pollSettings.startMessage || 'Привіт! Починаємо опитування...',
    {
      reply_markup: {
        inline_keyboard: createKeyboard(initialButtons)
      }
    }
  );
};

/**
 * Універсальний хендлер відповіді для будь-якого кроку опитування.
 * Зберігає відповідь, визначає наступний крок та відправляє повідомлення відповідно.
 */
export const handleStepResponse = async (ctx, currentStep) => {
  const userId = ctx.from.id;
  const value = ctx.match[1]; // Значення вибору (ключ кнопки)
  let responses = userResponses.get(userId) || {};
  responses[currentStep] = value;
  userResponses.set(userId, responses);

  const currentMessage = generateMessage(currentStep, value);
  const nextStep = getNextStep(currentStep);

  if (nextStep) {
    const nextMessage = getStepMessage(nextStep);
    const nextButtons = getButtonsForStep(nextStep);
    await ctx.reply(
      `${currentMessage}\n\n${nextMessage}`,
      { reply_markup: { inline_keyboard: createKeyboard(nextButtons) } }
    );
  } else {
    // Фінальний крок – завершення опитування
    const theme = process.env.BOT_THEME || 'emotionTracking';
    const finalMessage = configData.themes?.[theme]?.completion || 'Дякую! Ваші відповіді збережено.';
    const filePath = path.resolve(`./data/${userId}_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(userResponses.get(userId), null, 2), 'utf8');
    userResponses.delete(userId);
    await ctx.reply(`${currentMessage}\n\n${finalMessage}`);
    // Опціонально: повернути користувача в головне меню
    // await sendMainMenu(ctx);
  }
};

// Хендлери конкретних кроків, що викликають універсальний хендлер:
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

/**
 * Спеціальний хендлер для фінального кроку (якщо потрібний окремо).
 * Зберігає результат та повертає користувача до головного меню.
 */
export const handleFinalStep = async (ctx, finalKey) => {
  const value = ctx.match[1];
  const message = generateMessage(finalKey, value);
  const userData = { [finalKey]: value };
  fs.writeFileSync(
    path.resolve(`./data/${ctx.from.id}_results.json`),
    JSON.stringify(userData, null, 2),
    'utf8'
  );
  await ctx.reply(`${message}\n\nДякую за вашу відповідь! Опитування завершено.`);
  await sendMainMenu(ctx);
};

/**
 * Фолбек: якщо текстове повідомлення не відповідає очікуваним варіантам.
 */
export const handleTextFallback = (ctx) => {
  ctx.reply(configData.messages?.errorMessage || 'Вибач, я не зрозумів повідомлення.');
};
