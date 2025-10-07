// src/aiMentor/services/aiMentorCore.js
import { chat } from '../openaiClient.js';
import { AI_TYPES } from '../../config/constants.js';
import aiMentorService from './aiMentorService.js';
import actionGenerator from '../core/processors/actionGenerator.js';

export const processAIRequest = async (type, payload, context = {}) => {
  console.log(`[aiMentorCore] 🧠 Processing ${type}`);

  try {
    let result;

    switch(type) {
      case AI_TYPES.MORNING:
      case AI_TYPES.EVENING:
        result = await aiMentorService.provideDayFeedback(
          payload.responses,
          payload.state,
          payload.goal,
          payload.tgId
        );
        break;

      case AI_TYPES.SMART_CONVERT:
        result = await aiMentorService.generateMicroActions(
          payload.focusGoal,
          payload.state,
          payload.tgId
        );
        break;

      case AI_TYPES.TRIGGER:
        result = await aiMentorService.generatePersonalizedAdvice(
          payload.question,
          payload.tgId
        );
        break;

      case AI_TYPES.WEEKLY:
      case AI_TYPES.MONTHLY:
        result = await aiMentorService.generateSummary(type, payload);
        break;

      default:
        throw new Error(`[aiMentorCore] ❌ Unknown AI type: ${type}`);
    }

    let actions = [];
    if (result?.needsActions) {
      actions = await actionGenerator.generate(payload, result);
    }

    return {
      text: result.text || result.feedback || result,
      actions: result.actions || actions || [],
      meta: {
        type,
        timestamp: new Date().toISOString(),
        triggers: result.triggers || [],
        classification: result.classification || null
      }
    };

  } catch (error) {
    console.error('[aiMentorCore] ❌ Error:', error);
    return {
      text: "Виникла помилка при обробці запиту. Спробуй ще раз.",
      actions: [],
      meta: { type, timestamp: new Date().toISOString() }
    };
  }
};

export default { processAIRequest, AI_TYPES };
