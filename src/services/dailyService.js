import responseService from './responseService.js';
import logger from '../utils/logger.js';

const dailyService = {

  async handleText(ctx, text, userStep) {
    try {
      const { tgId, sessionType, questionNumber } = userStep;

      if (sessionType === 'morning') {
        await responseService.saveMorningAnswer(tgId, questionNumber, text);
      } else if (sessionType === 'evening') {
        await responseService.saveEveningAnswer(tgId, questionNumber, text);
      }

      return true;
    } catch (error) {
      logger.error('[dailyService] ❌ handleText:', error);
      throw error;
    }
  },

  async handleCallback(ctx, data) {
    // обробка кнопок, наприклад завершення сесії
    const { tgId, action } = data;
    if (action === 'exit') await this.exitSession(ctx, data.sessionType);
  },

  async startSession(ctx, type) {
    const tgId = ctx.from.id;
    const completed = await responseService.isSessionCompleted(tgId, type);
    if (completed) return ctx.reply(`Сесія ${type} вже завершена ✅`);
    return ctx.reply(`Починаємо ${type} сесію 📝`);
  },

async restartSession(ctx, type) {
  const tgId = ctx.from.id;
  const isMorning = type === 'morning';
  const record = await responseService._getTodayRecord(tgId);

  if (record) {
    // Скидаємо попередні відповіді для ранкової сесії
    const fieldsToReset = {};
    for (let i = 1; i <= 6; i++) {
      fieldsToReset[`Q_m_${i}`] = null;
    }
    fieldsToReset.Current_Activity = null;

    await responseService._createOrUpdateRecord(tgId, fieldsToReset);
  }

  // Тепер запускаємо сесію заново
  return this.startSession(ctx, type);
},
  async continueEveningSession(ctx) {
    const tgId = ctx.from.id;
    return ctx.reply('Продовжуємо вечірню сесію 🌙');
  },

  async exitSession(ctx, type) {
    const tgId = ctx.from.id;
    await responseService.saveAffirmationAndFinalize(tgId, type, null);
    return ctx.reply(`Сесія ${type} завершена ✅`);
  }
};

export default dailyService;
