// Утиліти та клавіатури
// src/services/wheelBalance/utils.js
import { LIFE_SPHERES, SPHERE_FIELDS, NOTE_FIELDS } from '../../config/constants.js';

export const buildScoreKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '0', callback_data: 'wheel_score_0' },
        { text: '1', callback_data: 'wheel_score_1' },
        { text: '2', callback_data: 'wheel_score_2' },
        { text: '3', callback_data: 'wheel_score_3' },
        { text: '4', callback_data: 'wheel_score_4' },
        { text: '5', callback_data: 'wheel_score_5' }
      ],
      [
        { text: '6', callback_data: 'wheel_score_6' },
        { text: '7', callback_data: 'wheel_score_7' },
        { text: '8', callback_data: 'wheel_score_8' },
        { text: '9', callback_data: 'wheel_score_9' },
        { text: '10', callback_data: 'wheel_score_10' }
      ],
      [{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]
    ]
  }
});

export const buildExitKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [[{ text: '🚪 Вийти', callback_data: 'wheel_exit' }]]
  }
});

export const getWheelInfo = () => ({
  message: 
    `🎯 КОЛЕСО БАЛАНСУ\n\n` +
    `📋 8 сфер життя:\n${LIFE_SPHERES.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
    `⏱ 5-10 хвилин\n📊 AI-аналіз результатів\n\nГотова почати?`,
  keyboard: {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Так, почати!', callback_data: 'wheel_start' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  }
});

export const todayISO = () => new Date().toISOString().split('T')[0];

export { LIFE_SPHERES, SPHERE_FIELDS, NOTE_FIELDS };