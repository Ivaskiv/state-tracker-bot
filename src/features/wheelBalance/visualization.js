// ========================================
// src/features/wheelBalance/visualization.js
// ========================================
import { LIFE_SPHERES } from '../../config/index.js';

/**
 * Намалювати колесо балансу як текст
 */
export const drawWheelText = (scores) => {
  if (scores.length !== 8) return 'Некоректні дані';

  const wheel = scores.map((score, i) => {
    const sphere = LIFE_SPHERES[i];
    const bar = '█'.repeat(score) + '░'.repeat(10 - score);
    return `${sphere.label.padEnd(20)} [${bar}] ${score}/10`;
  });

  return wheel.join('\n');
};

/**
 * Отримати описовий текст стану балансу
 */
export const getWheelStatus = (scores) => {
  const avg = (scores.reduce((a, b) => a + b) / scores.length).toFixed(1);
  const strong = scores.filter(s => s >= 8).length;
  const weak = scores.filter(s => s <= 5).length;

  if (avg >= 8.5) return '🌟 Практично ідеальний баланс!';
  if (avg >= 7.5) return '✅ Добрий баланс';
  if (avg >= 6) return '⚠️ Середньо, є місце для покращення';
  return '❌ Потребує серйозної роботи';
};

console.log('✅ [wheelBalance/visualization] Завантажено');