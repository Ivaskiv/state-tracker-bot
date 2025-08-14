import { Scenes } from 'telegraf';
import { config } from '../config/config.js';
import { createDailyResponse, getTodayResponse, updateDailyResponse, incrementUserResponses } from '../utils/airtable.js';

const morningScene = new Scenes.WizardScene(
  'morning',
  async (ctx) => {
    const userId = ctx.from.id.toString();
    const existing = await getTodayResponse(userId, 'morning');
    
    if (existing) {
      await ctx.reply('Ти вже проходила ранкову сесію сьогодні! ✅\n\nВикористай /evening для вечірньої сесії.');
      return ctx.scene.leave();
    }
    
    ctx.session.responses = {};
    ctx.session.currentQuestion = 0;
    
    await ctx.reply(config.messages.morningIntro);
    await ctx.reply(`✳️ ${config.morningQuestions[0].question}`);
    
    return ctx.wizard.next();
  },
  
  async (ctx) => {
    if (!ctx.message?.text) {
      return ctx.reply('Будь ласка, надішли текстову відповідь.');
    }
    
    const currentQ = ctx.session.currentQuestion;
    const question = config.morningQuestions[currentQ];
    
    ctx.session.responses[question.key] = ctx.message.text;
    ctx.session.currentQuestion++;
    
    if (ctx.session.currentQuestion < config.morningQuestions.length) {
      const nextQuestion = config.morningQuestions[ctx.session.currentQuestion];
      await ctx.reply(`✳️ ${nextQuestion.question}`);
    } else {
      await saveResponse(ctx, 'morning');
      await ctx.reply(`${config.messages.motivationMorning}\n\n🌱 Ранкову сесію завершено! Гарного дня! ☀️`);
      return ctx.scene.leave();
    }
  }
);

const eveningScene = new Scenes.WizardScene(
  'evening',
  async (ctx) => {
    const userId = ctx.from.id.toString();
    const existing = await getTodayResponse(userId, 'evening');
    
    if (existing) {
      await ctx.reply('Ти вже проходила вечірню сесію сьогодні! ✅');
      return ctx.scene.leave();
    }
    
    ctx.session.responses = {};
    ctx.session.currentQuestion = 0;
    
    await ctx.reply(config.messages.eveningIntro);
    await ctx.reply(`✳️ ${config.eveningQuestions[0].question}`);
    
    return ctx.wizard.next();
  },
  
  async (ctx) => {
    if (!ctx.message?.text) {
      return ctx.reply('Будь ласка, надішли текстову відповідь.');
    }
    
    const currentQ = ctx.session.currentQuestion;
    const question = config.eveningQuestions[currentQ];
    
    ctx.session.responses[question.key] = ctx.message.text;
    ctx.session.currentQuestion++;
    
    if (ctx.session.currentQuestion < config.eveningQuestions.length) {
      const nextQuestion = config.eveningQuestions[ctx.session.currentQuestion];
      await ctx.reply(`✳️ ${nextQuestion.question}`);
    } else {
      await saveResponse(ctx, 'evening');
      await ctx.reply(`🌟 Підсумкова фраза:\n"${config.messages.motivationEvening}"\n\n🌙 Вечірню сесію завершено! Солодких снів!`);
      return ctx.scene.leave();
    }
  }
);

async function saveResponse(ctx, sessionType) {
  try {
    const userId = ctx.from.id.toString();
    const responses = ctx.session.responses;
    
    await createDailyResponse({
      userId,
      session_type: sessionType,
      date: new Date().toISOString().split('T')[0],
      ...responses,
      is_complete: true
    });
    
    await incrementUserResponses(userId);
  } catch (error) {
    console.error('Error saving response:', error);
    await ctx.reply('Помилка збереження відповіді. Спробуйте пізніше.');
  }
}

export { morningScene, eveningScene };