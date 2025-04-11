import fs from 'fs';
import path from 'path';

// Завантаження конфігурації
export const loadConfig = () => {
  const configPath = path.resolve(__dirname, '../config/defaultConfig.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
};

// Збереження конфігурації
export const saveConfig = (config) => {
  const configPath = path.resolve(__dirname, '../config/defaultConfig.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
};

// Валідація налаштувань опитувань
export function validatePollSettings(settings) {
  const STATES = settings.states.map(state => state.key);
  const EMOTIONS = settings.emotions.map(emotion => emotion.key);
  const FEELINGS = settings.feelings.map(feeling => feeling.key);
  const ACTIONS = settings.actions.map(action => action.key);

  // Перевірка коректності ключів для всіх параметрів
  settings.states.forEach(state => {
    if (!STATES.includes(state.key)) {
      throw new Error(`Invalid state key: ${state.key}`);
    }
  });

  settings.emotions.forEach(emotion => {
    if (!EMOTIONS.includes(emotion.key)) {
      throw new Error(`Invalid emotion key: ${emotion.key}`);
    }
  });

  settings.feelings.forEach(feeling => {
    if (!FEELINGS.includes(feeling.key)) {
      throw new Error(`Invalid feeling key: ${feeling.key}`);
    }
  });

  settings.actions.forEach(action => {
    if (!ACTIONS.includes(action.key)) {
      throw new Error(`Invalid action key: ${action.key}`);
    }
  });
}
