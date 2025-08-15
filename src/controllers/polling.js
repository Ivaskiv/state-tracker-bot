import { Scenes, Markup } from 'telegraf';
import { 
  createMorningResponse, getTodayMorningResponse, 
  createEveningResponse, getTodayEveningResponse, 
  getRandomAffirmation 
} from '../utils/airtable.js';

const confirmKeyboard = Markup.inlineKeyboard([
  Markup.button.callback('✅ Підтвердити', 'confirm'),
  Markup.button.callback('❌ Скасувати', 'cancel')
]);

// ===== MORNING SCENE =====
export const morningScene = new Scenes.BaseScene('morning');

morningScene.enter(async (ctx) => {
  const todayResponse = await getTodayMorningResponse(ctx.from.id.toString());
  if (todayResponse && todayResponse.fields.completed) {
    await ctx.reply('Ви вже пройшли ранкову сесію сьогодні.');
    return ctx.scene.leave();
  }

  await ctx.reply('Доброго ранку! 🌅\nЯк ти почуваєшся сьогодні? Вибери свій стан або напиши свій варіант.');
  ctx.scene.state.answers = {};
});

morningScene.on('text', async (ctx) => {
  ctx.scene.state.answers.mood = ctx.message.text;
  await ctx.reply('Що б ти хотів/ла зробити сьогодні для себе?', confirmKeyboard);
});

morningScene.action('confirm', async (ctx) => {
  const answers = ctx.scene.state.answers;
  if (!answers.mood) return ctx.reply('Будь ласка, спочатку введіть відповідь.');

  await createMorningResponse({
    user_id: ctx.from.id.toString(),
    user_name: ctx.from.first_name,
    date: new Date().toISOString().split('T')[0],
    mood: answers.mood,
    goal: answers.goal || '',
    completed: true
  });

  const affirm = await getRandomAffirmation();
  await ctx.reply(`Дякую! Твоя ранкова афірмація на сьогодні:\n"${affirm}"`);
  await ctx.answerCbQuery();
  ctx.scene.leave();
});

morningScene.action('cancel', async (ctx) => {
  await ctx.reply('Ранкова сесія скасована. Можеш почати її знову командою /morning.');
  await ctx.answerCbQuery();
  ctx.scene.leave();
});

// ===== EVENING SCENE =====
export const eveningScene = new Scenes.BaseScene('evening');

eveningScene.enter(async (ctx) => {
  const todayResponse = await getTodayEveningResponse(ctx.from.id.toString());
  if (todayResponse && todayResponse.fields.completed) {
    await ctx.reply('Ви вже пройшли вечірню сесію сьогодні.');
    return ctx.scene.leave();
  }

  await ctx.reply('Добрий вечір! 🌙\nЯк пройшов твій день? Поділись своїми думками.');
  ctx.scene.state.answers = {};
});

eveningScene.on('text', async (ctx) => {
  ctx.scene.state.answers.reflection = ctx.message.text;
  await ctx.reply('Що ти зробив/ла для себе сьогодні?', confirmKeyboard);
});

eveningScene.action('confirm', async (ctx) => {
  const answers = ctx.scene.state.answers;
  if (!answers.reflection) return ctx.reply('Будь ласка, спочатку введіть відповідь.');

  await createEveningResponse({
    user_id: ctx.from.id.toString(),
    user_name: ctx.from.first_name,
    date: new Date().toISOString().split('T')[0],
    reflection: answers.reflection,
    action: answers.action || '',
    completed: true
  });

  const affirm = await getRandomAffirmation();
  await ctx.reply(`Дякую! Твоя вечірня афірмація на сьогодні:\n"${affirm}"`);
  await ctx.answerCbQuery();
  ctx.scene.leave();
});

eveningScene.action('cancel', async (ctx) => {
  await ctx.reply('Вечірня сесія скасована. Можеш почати її знову командою /evening.');
  await ctx.answerCbQuery();
});
