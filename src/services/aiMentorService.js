// src/aiMentor/services/aiMentorService.js
import { chat } from '../../services/openaiClient.js';
import { AI_MENTOR_PROMPTS, AI_MENTOR_CONFIG } from '../../config/constants.js';

// Utils
import { 
  validateAndEnhanceSMARTActions,
  getSMARTFallbackActions 
} from '../../utils/smartActionsValidator.js';

import { 
  prepareSmartPrompt, 
  prepareAdvicePrompt,
  prepareFeedbackPrompt 
} from '../../utils/promptBuilder.js';

// Services
import { 
  buildUserContext,
  getUserContextForAdvice,
  getUserHistory 
} from './userContextBuilder.js';

import { 
  saveAIConversation,
  saveGeneratedActionsToConversation,
  saveMicroActionsData 
} from './conversationStorage.js';

import activityTracker from '../../services/activityTracker.js';

const systemPrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;

// ==========================================
// CORE: ГЕНЕРАЦІЯ МІКРО-ДІЙ
// ==========================================

async function generateMicroActions(focusGoal, state, tgId) {
  console.log(`[aiMentorService] 🎯 Генерація мікро-дій для ${tgId}`);

  try {
    const userContext = await buildUserContext(tgId);
    const promptData = prepareSmartPrompt(focusGoal, state, userContext);
    
    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptData }
      ],
      'gpt-4o-mini',
      500
    );
    
    const validated = await parseAndValidate(response, focusGoal, state);
    await saveMicroActionsData(tgId, validated);
    
    console.log(`[aiMentorService] 🎉 Згенеровано ${validated.microActions.length} дій`);
    return validated;

  } catch (error) {
    console.error('[aiMentorService] ❌ Помилка:', error.message);
    return await handleGenerationError(tgId, focusGoal, state);
  }
}

async function parseAndValidate(response, focusGoal, state) {
  try {
    const parsed = JSON.parse(response);
    return validateAndEnhanceSMARTActions(parsed, focusGoal, state);
  } catch (error) {
    console.error(`[aiMentorService] ❌ Парсинг помилка:`, error.message);
    return getSMARTFallbackActions(focusGoal, state);
  }
}

async function handleGenerationError(tgId, focusGoal, state) {
  const fallbackActions = getSMARTFallbackActions(focusGoal, state);
  
  try {
    await activityTracker.saveMicroActions(tgId, fallbackActions.microActions);
  } catch (saveError) {
    console.error('[handleGenerationError] Збереження помилка:', saveError.message);
  }
  
  return fallbackActions;
}

// ==========================================
// AI ДІАЛОГ: ПОРАДИ
// ==========================================

async function generatePersonalizedAdvice(question, tgId) {
  console.log(`[aiMentorService] 💡 Порада для: "${question}"`);

  try {
    const userContext = await getUserContextForAdvice(tgId);
    const prompt = prepareAdvicePrompt(question, userContext);

    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      300
    );

    await saveAIConversation(tgId, question, response, 'advice');
    return response || getDefaultAdvice();
    
  } catch (error) {
    console.error('[generatePersonalizedAdvice] Помилка:', error);
    return getDefaultAdvice();
  }
}

// ==========================================
// AI ДІАЛОГ: ФІДБЕК
// ==========================================

async function provideDayFeedback(responses, state, goal, tgId) {
  try {
    const prompt = prepareFeedbackPrompt(responses, state, goal);

    const feedback = await chat(
      [
        { role: 'system', content: AI_MENTOR_PROMPTS.FEEDBACK_PROMPT },
        { role: 'user', content: prompt }
      ],
      'gpt-4o-mini',
      200
    );

    if (tgId) {
      await saveAIConversation(tgId, 'День завершено', feedback, 'feedback');
    }

    return feedback || AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  } catch (error) {
    console.error('[provideDayFeedback] Помилка:', error);
    return AI_MENTOR_CONFIG.FALLBACK_FEEDBACK;
  }
}

// ==========================================
// UTILITIES
// ==========================================

function getDefaultAdvice() {
  return "🎯 Твоє питання важливе!\n💡 Почни з одного маленького кроку\n✨ Ти на правильному шляху! 💪";
}

// Deprecated (зворотна сумісність)
function getFallbackActions(focusGoal, state) {
  return getSMARTFallbackActions(focusGoal, state);
}

// ==========================================
// EXPORTS - ТІЛЬКИ ПУБЛІЧНИЙ API
// ==========================================

export default {
  // Основні функції
  generateMicroActions,
  generatePersonalizedAdvice,
  provideDayFeedback,
  getFallbackActions
};