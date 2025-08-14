// src/bot.js
import { Telegraf, Scenes, session } from 'telegraf';
import { config } from './config/config.js';
import { getUserByTgId, createUser, updateUser } from './utils/airtable.js';
import { morningScene, eveningScene } from './controllers/polling.js';
import { paymentScene } from './controllers/payment.js';
import { createKeyboard } from './utils/helpers.js';
import { getRandom } from './utils/quotes.js';

const bot = new Telegraf(config.botToken);
const stage = new Scenes.Stage([
  morningScene,
  eveningScene,
  paymentScene
]);

bot.use(session());
bot.use(stage.middleware());

// ===== START COMMAND =====
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  let user = await getUserByTgId(userId);

  if (!user) {
    user = await createUser({
      TG_id: userId,
      username: ctx.from.username || '',
      first_name: ctx.from.first_name || 'Unknown',
      subscription_plan: 'trial',
      Status: 'Active',
      Paid: false,
      lastActive: new Date().toISOString()
    });

    await ctx.reply(config.messages.welcome, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.subscription)
      }
    });
    return;
  }

  await updateUser(userId, { lastActive: new Date().toISOString() });

  const isActive = user.fields.Status === 'Active';
  const isPaid = user.fields.Paid === true;

  if (isActive && isPaid) {
    await ctx.reply(
      `Вітаю, ${user.fields.first_name}! 👋\n\nТвоя підписка активна.\nВикористовуй /morning або /evening для сесій.`
    );
  } else {
    await ctx.reply(config.messages.subscriptionExpired, {
      reply_markup: {
        inline_keyboard: createKeyboard(config.keyboard.subscription)
      }
    });
  }
});

// ===== MORNING COMMAND =====
bot.command('morning', async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = await getUserByTgId(userId);

  if (!user) return ctx.reply('Користувач не знайдений.');
  await updateUser(userId, { lastActive: new Date().toISOString() });

  if (user.fields.Status !== 'Active' || user.fields.Paid !== true) {
    return ctx.reply(config.messages.subscriptionExpired, {
      reply_markup: { inline_keyboard: createKeyboard(config.keyboard.subscription) }
    });
  }

  ctx.scene.enter('morning');
});

// ===== EVENING COMMAND =====
bot.command('evening', async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = await getUserByTgId(userId);

  if (!user) return ctx.reply('Користувач не знайдений.');
  await updateUser(userId, { lastActive: new Date().toISOString() });

  if (user.fields.Status !== 'Active' || user.fields.Paid !== true) {
    return ctx.reply(config.messages.subscriptionExpired, {
      reply_markup: { inline_keyboard: createKeyboard(config.keyboard.subscription) }
    });
  }

  ctx.scene.enter('evening');
});

// ===== SUBSCRIPTION ACTION =====
bot.action(/^sub_(.+)/, async (ctx) => {
  const plan = ctx.match[1];
  ctx.session.selectedPlan = plan;
  ctx.scene.enter('payment');
});

// ===== SUPPORT ACTION =====
bot.action(/^support_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  let message;

  switch(type) {
    case 'motivation':
      message = config.messages.motivationMorning;
      break;
    case 'calm':
      message = "🧘 Зроби глибокий вдих... Все під контролем. Ти справляєшся.";
      break;
    case 'focus':
      message = "🎯 Одна ціль. Один крок. Зараз. Ти можеш це.";
      break;
  }

  await ctx.answerCbQuery();
  await ctx.reply(message);
});

// ===== TEXT MESSAGES =====
bot.on('text', async (ctx) => {
  if (ctx.message.text === '+' || ctx.message.text.toLowerCase() === 'ок') {
    const motivation = getRandom([
      config.messages.motivationMorning,
      config.messages.motivationEvening,
      "💪 Ти сильніша, ніж думаєш!",
      "🌟 Кожен крок веде до мети!",
      "✨ Ти вже на правильному шляху!"
    ]);

    await ctx.reply(motivation);
  }
});

// ===== ERROR HANDLER =====
bot.catch((err) => {
  console.error('Bot error:', err);
});

export { bot };
