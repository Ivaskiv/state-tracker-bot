//templates.js
import { config } from "../config/config.js";
import { Markup } from "telegraf";
import fs from "fs";
import path from "path";

// Тимчасове сховище для відповідей (можна використовувати сесію, якщо потрібно)
const userResponses = new Map();

/**
 * Повертає текст для кроку опитування для заданої теми.
 * Якщо для теми задано конкретний текст для кроку, воно повертається, інакше – використовується загальне повідомлення.
 * @param {string} themeKey – ключ теми (наприклад, 'emotionTracking' або 'dietTracking')
 * @param {string} step – крок опитування (наприклад, 'emotion', 'feeling', 'action', 'customPrompt')
 * @returns {string}
 */
export const getThemeText = (themeKey, step) => {
  if (config.themes && config.themes[themeKey] && config.themes[themeKey][step]) {
    return config.themes[themeKey][step];
  }
  // Фолбек: шукаємо загальне повідомлення за ключем step+ "Step", або повертаємо стандартний текст
  return config.messages?.[`${step}Step`] || `Оберіть ${step}:`;
};
export const getFrequencyText = (frequency) => {
  return config.frequencyOptions[frequency] || "Невідомо";
};
/**
 * Універсальна функція для створення інлайн-клавіатури.
 * Очікує список кнопок у вигляді масиву об’єктів { text, callback_data }.
 * @param {Array} buttons 
 * @returns {Array}
 */
export const createKeyboard = (buttons) => {
  if (!Array.isArray(buttons)) {
    console.error('Invalid buttons format:', buttons);
    return [];
  }
  return buttons.map(button => [Markup.button.callback(button.text, button.callback_data)]);
};

/**
 * Функція для генерації повідомлення за даним кроком опитування.
 * Вона шукає відповідний запис у розділі pollSettings із ключем step та значенням key.
 * @param {string} step – крок опитування (наприклад, 'state', 'emotion')
 * @param {string} key – вибране значення (ключ кнопки)
 * @returns {string}
 */
export const generateMessage = (step, key) => {
  const category = config.pollSettings[step];
  if (!category) return `Невідомий крок: ${step}`;
  const item = category.find(item => item.key === key);
  return item ? `${step.charAt(0).toUpperCase() + step.slice(1)}: ${item.text}` : `Невідоме ${step}`;
};

/**
 * Функція для запуску опитування.
 * Відправляє початкове повідомлення та інлайн-клавіатуру для першого кроку.
 * Також ініціалізує тимчасове сховище відповідей.
 */
export const startPoll = async (ctx) => {
  const themeKey = process.env.BOT_THEME || "emotionTracking";
  // В pollSettings для конкретної теми може бути окреме стартове повідомлення,
  // якщо воно не задано – використовується загальний текст.
  const pollSettings = config.pollSettings[themeKey] || {};
  const startMessage = pollSettings.startMessage || "Привіт! Починаємо опитування...";
  const initialButtons = config.keyboard?.stateButtons || [];

  userResponses.set(ctx.from.id, {}); // Ініціалізація відповідей

  await ctx.reply(startMessage, {
    reply_markup: {
      inline_keyboard: createKeyboard(initialButtons)
    }
  });
};

/**
 * Універсальний хендлер для відповіді користувача на крок опитування.
 * Зберігає відповідь у тимчасовому сховищі, визначає наступний крок (якщо є)
 * та відправляє наступне повідомлення з клавіатурою. Якщо крок останній – завершує опитування.
 * @param {object} ctx – контекст Telegraf
 * @param {string} currentStep – поточний крок (наприклад, 'state', 'emotion')
 */
export const handleStepResponse = async (ctx, currentStep) => {
  const userId = ctx.from.id;
  // Значення вибраного варіанту має бути у callback_match (наприклад, "state_resourceful")
  const value = ctx.match[1];
  
  // Зберігаємо відповідь користувача
  let responses = userResponses.get(userId) || {};
  responses[currentStep] = value;
  userResponses.set(userId, responses);

  const currentMessage = generateMessage(currentStep, value);
  const steps = config.pollSettings.steps || ['state', 'emotion', 'feeling', 'action'];
  const currentIndex = steps.indexOf(currentStep);
  const nextStep = steps[currentIndex + 1];

  if (nextStep) {
    const nextMessage = getThemeText(process.env.BOT_THEME || "emotionTracking", nextStep);
    const nextButtons = config.keyboard?.[`${nextStep}Buttons`] || [];
    await ctx.reply(
      `${currentMessage}\n\n${nextMessage}`,
      { reply_markup: { inline_keyboard: createKeyboard(nextButtons) } }
    );
  } else {
    // Фінальний крок – завершення опитування
    const themeKey = process.env.BOT_THEME || "emotionTracking";
    const finalMessage = config.themes?.[themeKey]?.completion || "Дякую! Ваші відповіді збережено.";
    const filePath = path.resolve(`./data/${userId}_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(responses, null, 2), "utf8");
    userResponses.delete(userId);
    await ctx.reply(`${currentMessage}\n\n${finalMessage}`);
    // За бажанням повертаємо до головного меню (якщо така логіка потрібна)
    // await sendMainMenu(ctx);
  }
};

/**
 * Обробка відповіді для кожного конкретного кроку.
 * В даному прикладі створено окремі функції для state, emotion, feeling та action,
 * які викликають універсальний handleStepResponse із відповідними параметрами.
 */
export const handleStateResponse = async (ctx) => {
  await handleStepResponse(ctx, "state");
};

export const handleEmotionResponse = async (ctx) => {
  await handleStepResponse(ctx, "emotion");
};

export const handleFeelingResponse = async (ctx) => {
  await handleStepResponse(ctx, "feeling");
};

export const handleActionResponse = async (ctx) => {
  await handleStepResponse(ctx, "action");
};

/**
 * Обробка текстових повідомлень як фолбек, якщо користувач вводить некоректний текст.
 */
export const handleTextFallback = (ctx) => {
  ctx.reply(config.messages?.errorMessage || "Вибач, я не зрозумів повідомлення.");
};

/**
 * Функція для оновлення конфігурації.
 * Зберігає зміни у файлі config.js.
 */
export const updateConfig = (key, value) => {
  const [category, keyToChange] = key.split('.');
  try {
    if (config[category] && config[category][keyToChange]) {
      config[category][keyToChange] = value;
      const configString = `export const config = ${JSON.stringify(config, null, 2)};`;
      fs.writeFileSync(path.resolve("./config/config.js"), configString, "utf8");
    } else {
      throw new Error(`Invalid key: ${key}`);
    }
  } catch (err) {
    console.error("Error updating config:", err);
    return "Сталася помилка при оновленні конфігурації. Спробуйте ще раз.";
  }
};
