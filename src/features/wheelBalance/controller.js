// src/features/wheelBalance/controller.js

import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import { wheelService } from './service.js';
import { WHEEL_CONFIG } from './config.js';
import { LIFE_SPHERES, getNumberEmoji } from '../../config/constants.js';

const tgIdOf = (ctx) => String(ctx.from?.id || ctx.chat?.id);
const cfgWithRecord = (recordId) => ({ ...WHEEL_CONFIG, recordId });

const formatWheelQuestion = (sphere, stepIndex, totalSteps) => {
  const progressPercent = wheelService.getProgressPercent(stepIndex);
  const progressBar = wheelService.getProgressBar(progressPercent);
  const q = wheelService.getQuestion(sphere, stepIndex);
  const stepEmoji = getNumberEmoji(stepIndex + 1);

  let message = `📍 Сфера ${stepEmoji}/${totalSteps}: ${sphere.label.toUpperCase()}\n`;
  message += `${progressBar}\n\n`;
  message += `${q.question}\n\n`;
  message += `💡 ${q.hint}`;

  return message;
};

const askCurrent = async (ctx) => {
  const tgId = tgIdOf(ctx);
  let session = await QE.getSessionState(tgId, WHEEL_CONFIG);
  
  if (!session) {
    session = await QE.initializeSession(tgId, WHEEL_CONFIG);
  }

  const { currentIndex, isCompleted } = session;
  
  if (isCompleted) {
    await ctx.reply('✅ Колесо балансу завершено!', keyboards.mainMenuKeyboard());
    return true;
  }

  const sphere = LIFE_SPHERES[currentIndex];
  const totalSteps = LIFE_SPHERES.length;
  
  if (!sphere) {
    logger.warn(`[wheel] Сфера не знайдена для індексу ${currentIndex}`);
    await ctx.reply('❌ Помилка завантаження питання', keyboards.mainMenuKeyboard());
    return false;
  }

  const text = formatWheelQuestion(sphere, currentIndex, totalSteps);
  const kb = keyboards.wheelNumberKeyboard();

  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  return true;
};

const writeAnswerAndMove = async (ctx, rawAnswer) => {
  const tgId = tgIdOf(ctx);
  let session = await QE.getSessionState(tgId, WHEEL_CONFIG);
  
  if (!session) {
    session = await QE.initializeSession(tgId, WHEEL_CONFIG);
  }

  const { currentIndex, recordId, isCompleted } = session;

  if (isCompleted) {
    await ctx.reply('✅ Колесо вже завершено', keyboards.mainMenuKeyboard());
    return true;
  }

  const sphere = LIFE_SPHERES[currentIndex];
  const q = wheelService.getQuestion(sphere, currentIndex);

  const v = QE.validateAnswer(rawAnswer, q, WHEEL_CONFIG);
  
  if (!v.valid) {
    const err = v.error || '❌ Будь ласка, обери число від 0 до 10';
    const kb = keyboards.wheelNumberKeyboard();
    await ctx.reply(err, { ...kb });
    return true;
  }

  const processed = WHEEL_CONFIG.processAnswer
    ? WHEEL_CONFIG.processAnswer(v.value ?? rawAnswer, currentIndex)
    : v.value ?? rawAnswer;

  await QE.saveAnswer(tgId, cfgWithRecord(recordId), currentIndex, processed);

  const stepNext = QE.getNextStep(WHEEL_CONFIG, currentIndex);
  
  if (stepNext.isCompleted) {
    await ctx.reply(
      '🎉 Колесо балансу заповнено!\n\nДякую за розповідь про себе.',
      keyboards.mainMenuKeyboard()
    );
    logger.info(`[wheel] Завершено для ${tgId}`);
    return true;
  }

  await askCurrent(ctx);
  return true;
};

export const handleWheelStart = async (ctx) => {
  try {
    const tgId = tgIdOf(ctx);
    logger.info(`[wheel] Початок для ${tgId}`);
    
    const state = await QE.getSessionState(tgId, WHEEL_CONFIG);
    
    if (state && state.isCompleted) {
      await ctx.reply('✅ Твоє Колесо балансу вже заповнено!', keyboards.mainMenuKeyboard());
      return true;
    }

    await askCurrent(ctx);
    return true;
  } catch (e) {
    logger.error('[handleWheelStart]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleWheelAnswer = async (ctx) => {
  try {
    const answer = String(ctx.message?.text || '').trim();
    
    if (!answer) return false;

    const tgId = tgIdOf(ctx);
    const state = await QE.getSessionState(tgId, WHEEL_CONFIG);

    if (!state || state.isCompleted) {
      return false;
    }

    return writeAnswerAndMove(ctx, answer);
  } catch (e) {
    logger.error('[handleWheelAnswer]', e);
    return false;
  }
};

export const handleWheelCallback = async (ctx) => {
  try {
    const data = String(ctx.update?.callback_query?.data || '');
    
    if (data.startsWith('wheel_')) {
      const score = data.slice('wheel_'.length);
      return writeAnswerAndMove(ctx, score);
    }

    return false;
  } catch (e) {
    logger.error('[handleWheelCallback]', e);
    return false;
  }
};

export const completeWheel = async (tgId, scoreData) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextWheelDate = nextDate.toISOString().split('T')[0];

    const wheelRecord = await base(tables.WHEEL_BALANCE).create([{
      fields: {
        TG_id: String(tgId),
        Status: 'Completed',
        Completed_Date: today,
        Next_Wheel_Date: nextWheelDate,
        Total_Score: scoreData.total || 0,
        Health: scoreData.health || 0,
        Housing: scoreData.housing || 0,
        Career_Business: scoreData.career || 0,
        Finance: scoreData.finance || 0,
        Relationships: scoreData.relationships || 0,
        Self_Growth: scoreData.selfGrowth || 0,
        Rest_Leisure: scoreData.leisure || 0,
        Spirituality: scoreData.spirituality || 0
      }
    }], { typecast: true });

    logger.info(`[wheel] ✅ Completed for ${tgId}, next: ${nextWheelDate}`);
    return wheelRecord;
  } catch (e) {
    logger.error('[wheel/completeWheel]', e);
    throw e;
  }
};

export default {
  handleWheelStart,
  handleWheelAnswer,
  handleWheelCallback,
  completeWheel
};