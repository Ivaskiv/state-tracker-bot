// src/services/aiMentorCore.js
import { chat } from './openaiClient.js';           // якщо потрібен
import aiMentorService from './aiMentorService.js';
import actionGenerator from './actionGenerator.js';
import responseProcessor from './responseProcessor.js';
import { getPrompt } from './prompts/index.js';     // можна залишити для загальних use-cases

export const AI_TYPES = {
  MORNING: 'morning',
  EVENING: 'evening',
  SMART_CONVERT: 'smart_convert',
  TRIGGER: 'trigger',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  GENERAL: 'general'
};

export const processAIRequest = async (type, payload, context = {}) => {
  console.log(`[aiMentorCore] 🧠 Processing ${type}`);
  try {
    let result;
    switch(type) {
      case AI_TYPES.MORNING:
        result = await aiMentorService.provideMorningFeedback(
          payload.state, payload.goal, payload.qualities, payload.tgId
        );
        break;

      case AI_TYPES.EVENING:
        result = await aiMentorService.provideDayFeedback(
          payload.responses, payload.state, payload.goal, payload.tgId
        );
        break;

      case AI_TYPES.SMART_CONVERT:
        result = await aiMentorService.generateMicroActions(
          payload.focusGoal, payload.state, payload.tgId
        );
        break;

      case AI_TYPES.TRIGGER:
        result = await aiMentorService.generatePersonalizedAdvice(
          payload.question, payload.tgId
        );
        break;

      case AI_TYPES.WEEKLY:
      case AI_TYPES.MONTHLY:
        result = await aiMentorService.generateSummary(type, payload);
        break;

      case AI_TYPES.GENERAL:
        result = await aiMentorService.generatePersonalizedAdvice(
          payload.question, payload.tgId
        );
        break;

      default:
        throw new Error(`Unknown AI type: ${type}`);
    }

    const processed = await responseProcessor.process(result, type);

    let actions = processed.actions || [];
    if (processed.needsActions && actions.length === 0) {
      actions = await actionGenerator.generate(payload, processed);
    }

    return {
      text: processed.text || processed.feedback || result,
      actions,
      meta: {
        type,
        timestamp: new Date().toISOString(),
        triggers: processed.triggers || [],
        classification: processed.classification || null,
        needsFollowUp: processed.needsFollowUp || false
      }
    };
  } catch (error) {
    console.error('[aiMentorCore] ❌ Error:', error);
    return {
      text: "Виникла помилка при обробці запиту. Спробуй ще раз.",
      actions: [],
      meta: { type, timestamp: new Date().toISOString(), error: error.message }
    };
  }
};

export default { processAIRequest, AI_TYPES };
