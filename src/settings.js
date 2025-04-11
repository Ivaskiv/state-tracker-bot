import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Отримати кореневу директорію
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../config/defaultconfigData.json');

// Завантаження конфігурації
export const loadConfig = () => {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
};

// Збереження конфігурації
export const saveConfig = (config) => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
};

// Динамічна валідація pollSettings
export function validatePollSettings(pollSettings) {
  for (const [pollType, options] of Object.entries(pollSettings)) {
    const keys = options.map(item => item.key);
    options.forEach(item => {
      if (!keys.includes(item.key)) {
        throw new Error(`Invalid key in "${pollType}": ${item.key}`);
      }
    });
  }
}
