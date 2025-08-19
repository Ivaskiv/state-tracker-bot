import reflectionService from '../services/reflectionService.js';
import { skipKeyboard, mainMenuKeyboard } from '../utils/keyboards.js';

const reflectionHandler = {
  async startMorningQuestions(ctx) {
    ctx.session.questionType = 'morning';
    // приклад: починаємо перше питання
    await reflectionService.sendNextMorningQuestion(ctx);
  },

  async startEveningQuestions(ctx) {
    ctx.session.questionType = 'evening';
    await reflectionService.sendNextEveningQuestion(ctx);
  },

  async handleMorningQuestion(ctx) {
    await reflectionService.sendNextMorningQuestion(ctx);
  },

  async handleEveningQuestion(ctx) {
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
    }
  }
};

export default reflectionHandler;
