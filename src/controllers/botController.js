// src/controllers/botController.js
import { Telegraf } from 'telegraf';
import {
  MORNING_QUESTIONS,
  EVENING_QUESTIONS,
  QUESTION_TYPES,
} from '../config/constants.js';
import { createUser, findUserByTGId } from '../services/userService.js';
import { sendReminder } from '../services/reminderService.js';

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /start
bot.start(async ctx => {
  const tgId = ctx.from.id.toString();
  let user = await findUserByTGId(tgId);
  if (!user) {
    user = await createUser({ tgId, name: ctx.from.first_name });
  }
  await ctx.reply(`Привіт, ${user['User Name']}! Готові до сьогоднішньої сесії? 🌱`);
});

// тестові команди
bot.command('morning', async ctx => {
  const tgId = ctx.from.id.toString();
  await sendReminder(bot, tgId, MORNING_QUESTIONS, QUESTION_TYPES.MORNING);
});

bot.command('evening', async ctx => {
  const tgId = ctx.from.id.toString();
  await sendReminder(bot, tgId, EVENING_QUESTIONS, QUESTION_TYPES.EVENING);
});
