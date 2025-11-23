// src/tilda/keyboards.js

import { TILDA_CONFIG } from "./config.js";
import { TILDA_CALLBACKS } from "./constants.js";


export const getTildaKeyboards = {
  cabinet: (url, accessLevel) => {
    const buttons = [[{ text: '🔗 Відкрити кабінет', url }]];
    
    if (accessLevel === TILDA_CONFIG.ACCESS_LEVELS.FREE || 
        accessLevel === TILDA_CONFIG.ACCESS_LEVELS.TRIAL) {
      buttons.push([
        { text: '⬆️ Оформити підписку', callback_data: TILDA_CALLBACKS.UPGRADE_ACCESS }
      ]);
    }
    
    buttons.push([
      { text: '🔄 Оновити посилання', callback_data: TILDA_CALLBACKS.REFRESH_TOKEN }
    ]);
    
    buttons.push([
      { text: '🏠 До меню', callback_data: 'main_menu' }
    ]);
    
    return {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    };
  },
  
  upgrade: () => ({
    reply_markup: {
      inline_keyboard: [
        [{ text: '💎 Оформити підписку', callback_data: TILDA_CALLBACKS.UPGRADE_ACCESS }],
        [{ text: '📊 Мої підписки', callback_data: TILDA_CALLBACKS.VIEW_SUBSCRIPTION }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  })
};

console.log('✅ [Tilda Keyboards] Завантажено');