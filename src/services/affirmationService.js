import { AFFIRMATIONS, KEYBOARDS } from "../utils/affirmations.js";

export const affirmationService = {
  async sendRandomAffirmation(ctx) {
    try {
      const affirmation = await AFFIRMATIONS.getRandom();
      const message = `✨ Твоя афірмація:\n\n${affirmation}\n\nПовтори її кілька разів і відчуй силу цих слів. 💫`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, KEYBOARDS.BACK_TO_MENU);
      } else {
        await ctx.reply(message, KEYBOARDS.MAIN_MENU);
      }

    } catch (error) {
      console.error('Send affirmation error:', error);
      await ctx.reply('Виникла помилка при відправці афірмації. Спробуйте ще раз.');
    }
  },

  async sendMotivationalMessage(ctx, emotion = 'general') {
    try {
      let message = '';
      
      switch (emotion.toLowerCase()) {
        case 'страх':
        case 'fear':
          message = `🌟 Я бачу, що ти відчуваєш страх. Це нормально - страх показує, що ти на межі свого зростання.

Пам'ятай: "Моя сила більша за мої страхи. Я обираю крок вперед, навіть коли страшно."

Зроби один маленький крок прямо зараз. Ти можеш це! 💪`;
          break;

        case 'тривога':
        case 'anxiety':
          message = `💙 Тривога - це сигнал того, що ти піклуєшся про результат. Давай перенаправимо цю енергію.

Дихай глибоко. Повтори: "Я контролюю те, що можу контролювати. Я довіряю процесу."

Ти сильніша, ніж здається. Один вдих за раз. 🌸`;
          break;

        case 'сум':
        case 'sadness':
          message = `🤗 Дозволь собі відчути це. Сум - не твій ворог, він показує глибину твоєї душі.

"Я дозволяю собі відчувати і одночасно обираю рухатися вперед. Моє серце велике і сильне."

Завтра обов'язково буде кращий день. Тримайся. 🌅`;
          break;

        default:
          message = `✨ Пам'ятай: кожен день - це нова можливість стати кращою версією себе.

"Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом."

Ти можеш більше, ніж думаєш. Йди вперед! 🚀`;
      }
      
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, KEYBOARDS.SUPPORT_MENU);
      } else {
        await ctx.reply(message, KEYBOARDS.SUPPORT_MENU);
      }
      
    } catch (error) {
      console.error('Send motivational message error:', error);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.');
    }
  },

  getRandomAffirmation() {
    const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
    return AFFIRMATIONS[randomIndex];
  },

  async sendDailyAffirmation(bot, telegramId) {
    try {
      const affirmation = this.getRandomAffirmation();
      const message = `🌅 Доброго ранку! Ось твоя афірмація на день:\n\n${affirmation}\n\nХай цей день принесе тобі силу та натхнення! ✨`;
      
      await bot.telegram.sendMessage(telegramId, message);
      console.log(`Daily affirmation sent to user ${telegramId}`);
    } catch (error) {
      console.error(`Failed to send daily affirmation to ${telegramId}:`, error);
    }
  }
};