// src/features/affirmations/controller.js
import * as flow from './flow.js';
import keyboards from '../../utils/keyboards.js';
import { typing } from '../../utils/typing.js';

export const showAffirmation = async (ctx, type = 'general') => {
  try {
    await typing(ctx);
    const affirmation = flow.getRandomAffirmation(type);
    const emoji = type === 'morning' ? '🌞' : type === 'evening' ? '🌙' : '💎';
    
    await ctx.reply(
      `${emoji} *АФІРМАЦІЯ*\n\n"${affirmation}"\n\n✨ Вір у себе!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Наступна', callback_data: `affirmation_next_${type}` }],
            [{ text: '🏠 До меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('[affirmations] ❌', error);
  }
};