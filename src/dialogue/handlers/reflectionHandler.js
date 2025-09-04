// src/handlers/reflectionHandler.js
import reflectionService from '../services/reflectionService.js';

const reflectionHandler = {
  async startMorningQuestions(ctx) {
    ctx.session.questionType = 'morning';
    ctx.session.currentIndex = 0;
    await reflectionService.sendNextMorningQuestion(ctx);
  },

  async startEveningQuestions(ctx) {
    ctx.session.questionType = 'evening';
    ctx.session.currentIndex = 0;
    await reflectionService.sendNextEveningQuestion(ctx);
  },

  async handleMorningAnswer(ctx, text) {
    await reflectionService.saveMorningAnswer(ctx, text);
    await reflectionService.sendNextMorningQuestion(ctx);
  },

  async handleEveningAnswer(ctx, text) {
    await reflectionService.saveEveningAnswer(ctx, text);
    await reflectionService.sendNextEveningQuestion(ctx);
  },

  async skipQuestion(ctx) {
    if (ctx.session.questionType === 'morning') {
      await reflectionService.skipMorningQuestion(ctx);
    } else if (ctx.session.questionType === 'evening') {
      await reflectionService.skipEveningQuestion(ctx);
    } else {
      await ctx.reply("Немає активного питання для пропуску.");
    }
  }
};

export default reflectionHandler;
