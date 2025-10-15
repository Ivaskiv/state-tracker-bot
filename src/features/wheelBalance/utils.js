// src/features/wheelBalance/utils.js
import { LIFE_SPHERES } from '../../config/constants.js';

export const getWheelInfo = (sphere, step) =>
  `🎯 **КОЛЕСО БАЛАНСУ**\n\n` +
  `📍 Сфера ${step}/8: **${sphere.label}**\n\n` +
  `${sphere.description}\n\n` +
  `Оціни від 0 до 10:`;

export const todayISO = () => new Date().toISOString().split('T')[0];

// Якщо комусь потрібно — можеш експортувати також масив сфер:
export { LIFE_SPHERES };
