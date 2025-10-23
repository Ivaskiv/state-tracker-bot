// src/services/dailySessions/service.js
// ✅ COMPLETE: Uses flow.js functions, no duplicate records, all saves go through flow

import { QUESTIONS, QUESTION_PARSERS } from '../../config/index.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';
import * as flow from '../../features/dailySessions/flow.js';
import { getBase, tables } from '../../config/database.js';
import { chat } from './openaiClient.js';
import { todayISO } from '../../utils/helpers.js';

const base = getBase();

// ════════════════════════════════════════════════════════════
// 💾 SESSION STATE HELPERS — Always use flow.js
// ════════════════════════════════════════════════════════════

/**
 * Check if session is complete
 * Returns true if all questions answered
 */
export const checkAndCompleteSession = async (tgId, sessionType) => {
  try {
    // ✅ Use flow.js
    const rec = await flow.getOrCreateTodayResponse(tgId);
    if (!rec) return false;

    const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
    const fields = rec.fields;

    const allAnswered = questions.every((q, i) => {
      const fieldName = `${sessionType === 'morning' ? 'Q_m_' : 'Q_e_'}${i + 1}`;
      return fields[fieldName] && String(fields[fieldName]).trim() !== '';
    });

    if (allAnswered) {
      logger.info(`[dailySessions] ✅ Session complete: ${sessionType} for ${tgId}`);
      return true;
    }
    return false;
  } catch (e) {
    logger.error('[dailySessions] checkAndCompleteSession:', e);
    return false;
  }
};

/**
 * Restart a session (clear fields)
 */
export const restartSession = async (tgId, sessionType) => {
  try {
    // ✅ Use flow.js
    const rec = await flow.getOrCreateTodayResponse(tgId);
    
    if (sessionType === 'morning') {
      await flow.clearMorningFields(rec.id);
      await flow.setResponsesCurrentActivity(rec.id, null);
    } else {
      await flow.clearEveningFields(rec.id);
      await flow.setResponsesCurrentActivity(rec.id, null);
    }
    
    logger.info(`[dailySessions] ✅ Session restarted: ${sessionType} for ${tgId}`);
  } catch (e) {
    logger.error('[dailySessions] restartSession:', e);
  }
};

/**
 * Exit session (set to pending)
 */
export const exitSession = async (tgId) => {
  try {
    // ✅ Use flow.js
    const rec = await flow.getOrCreateTodayResponse(tgId);
    const nextMorningField = flow.getNextMorningField(rec.fields);
    
    if (nextMorningField) {
      await flow.setResponsesCurrentActivity(rec.id, 'morning_pending');
    }
    
    logger.info(`[dailySessions] ✅ Session exited for ${tgId}`);
  } catch (e) {
    logger.error('[dailySessions] exitSession:', e);
  }
};

// ════════════════════════════════════════════════════════════
// 🎯 FOCUS PARSING — ONE record, no duplicates
// ════════════════════════════════════════════════════════════

/**
 * Parse user's daily focus with AI and save to ONE record
 * ✅ NO DUPLICATES: Uses getOrCreateTodayResponse()
 */
export const parseFocus = async (tgId, focusText, existingGoals = [], monthlyGoals = []) => {
  try {
    // ✅ Get ONE record for today
    const rec = await flow.getOrCreateTodayResponse(tgId);
    
    logger.info(`[dailySessions] Parsing focus for ${tgId}`);

    // Call AI to analyze focus
    const aiAnalysis = await chat([
      {
        role: 'system',
        content: `Ти експерт-розпарсер Daily Focus.
        
На вхід:
- Фокус дня (текст користувача)
- Річні цілі (опц.)
- Цілі місяця (опц.)

Видай JSON:
{
  "main_priority": "одна речення про основний фокус",
  "daily_actions": [
    {"action": "конкретна дія", "time": "HH:MM або 'зараз'", "duration_min": 25, "result": "вимірюваний результат"},
    {"action": "...", "time": "...", "duration_min": 25, "result": "..."},
    {"action": "...", "time": "...", "duration_min": 25, "result": "..."}
  ],
  "connected_to_goal": "яка із цілей це стосується",
  "estimated_impact": "high|medium|low"
}`
      },
      {
        role: 'user',
        content: `
Мій фокус сьогодні: ${focusText}
${existingGoals.length > 0 ? `Річні цілі: ${existingGoals.map(g => g.Goal_Text).join(', ')}` : ''}
${monthlyGoals.length > 0 ? `Цілі місяця: ${monthlyGoals.map(g => g.text).join(', ')}` : ''}`
      }
    ], 'gpt-4o-mini', 800);
    
    const parsed = JSON.parse(aiAnalysis);
    
    // ✅ UPDATE the ONE record
    await base(tables.RESPONSES).update(rec.id, {
      Daily_Focus: focusText.substring(0, 500),
      Daily_Action_1: parsed.daily_actions[0]?.action || null,
      Daily_Action_2: parsed.daily_actions[1]?.action || null,
      Daily_Action_3: parsed.daily_actions[2]?.action || null,
      Goal_Connection: parsed.connected_to_goal || null,
      Focus_Priority: parsed.estimated_impact || 'medium',
      Focus_AI_Analysis: JSON.stringify(parsed)
    });
    
    logger.info(`[dailySessions] ✅ Focus parsed and saved to record ${rec.id}`);
    
    return {
      success: true,
      analysis: parsed,
      actions_count: parsed.daily_actions.length
    };
    
  } catch (error) {
    logger.error('[parseFocus] ❌', error);
    return { success: false, error: error.message };
  }
};

// ════════════════════════════════════════════════════════════
// 📊 FORMATTERS (no DB changes)
// ════════════════════════════════════════════════════════════

export const formatQuestionMessage = (sessionType, questionIndex) => {
  const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
  const question = questions[questionIndex];
  if (!question) return null;

  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
  const emojiNumbers = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const currentEmoji = emojiNumbers[questionIndex + 1] || '❓';

  const questionLines = question.text.split('\n');
  const questionTitle = questionLines[0];

  return {
    text:
      `${icon} ${title}\n\n` +
      `${currentEmoji}/${questions.length} ${questionTitle}\n` +
      (question.hint ? `💡 ${question.hint}` : ''),
    field: question.field,
    total: questions.length,
  };
};

export const formatCompletionMessage = (sessionType) => {
  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
  const message = sessionType === 'morning'
    ? 'Налаштування на день готове! 💪'
    : 'Дякую за чесність! 💪';
  return `${icon} ${title} рефлексію завершено!\n\n✅ Всі відповіді збережено.\n\n${message}`;
};

export const formatRestartWarning = (sessionType) => {
  const title = sessionType === 'morning' ? 'ранкову' : 'вечірню';
  return (
    `⚠️ Ти вже пройшла ${title} рефлексію сьогодні!\n\n` +
    `Якщо почнеш заново, попередні відповіді будуть перезаписані.\n\n` +
    `Що робимо?`
  );
};

export const formatEveningWithoutMorning = (userName) => (
  `🌙 Добрий вечір, ${userName}!\n\n` +
  `⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\n` +
  `Що робимо?`
);

// ════════════════════════════════════════════════════════════
// 🔧 UTILS (no DB changes)
// ════════════════════════════════════════════════════════════

export const getStepNumber = (field) => {
  const match = field?.match(/Q_[me]_(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

export const todayStr = () => new Date().toISOString().split('T')[0];

export const normalize = (s) => String(s || '').trim();

export const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export const getHoursSince = (timestampISO) => {
  try {
    const last = new Date(timestampISO);
    const now = new Date();
    return Math.floor((now - last) / (1000 * 60 * 60));
  } catch {
    return 0;
  }
};

export const getDaysDiff = (date1, date2) => {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

// ════════════════════════════════════════════════════════════
// 📊 ANALYSIS HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Analyze action completion from evening response
 */
export const analyzeActionCompletion = (answer, todayData = {}) => {
  try {
    const lower = (answer || '').toLowerCase();
    const actions = [
      todayData?.Daily_Action_1,
      todayData?.Daily_Action_2,
      todayData?.Daily_Action_3,
    ].filter(Boolean);

    const completed = [];
    const skipped = [];
    const doneMarkers = ['✅', 'зроблено', 'виконано', 'так', '+', 'done'];
    const skipMarkers = ['⏭', 'не зроблено', 'ні', '-', 'пропустила', 'пропустив'];

    actions.forEach((act, i) => {
      const s = (act || '').toLowerCase().slice(0, 40);
      const head = s.slice(0, 10);
      const matchedDone = doneMarkers.some((m) => lower.includes(m) && lower.includes(head));
      const matchedSkip = skipMarkers.some((m) => lower.includes(m) && lower.includes(head));
      
      if (matchedDone) completed.push(i + 1);
      else if (matchedSkip) skipped.push(i + 1);
    });

    return {
      Actions_Completed_Count: completed.length || null,
      Actions_Completed_List: completed.length ? completed.join(',') : null,
      Actions_Skipped_List: skipped.length ? skipped.join(',') : null,
      Completion_Rate: actions.length
        ? Math.round((completed.length / actions.length) * 100)
        : null,
    };
  } catch (error) {
    logger.error('[dailySessions] analyzeActionCompletion:', error);
    return {};
  }
};

/**
 * Analyze goal progress from evening response
 */
export const analyzeGoalProgress = (answer) => {
  try {
    return { Goal_Progress: answer || null };
  } catch (error) {
    logger.error('[dailySessions] analyzeGoalProgress:', error);
    return {};
  }
};

// ════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ════════════════════════════════════════════════════════════

export default {
  checkAndCompleteSession,
  restartSession,
  exitSession,
  parseFocus,
  formatQuestionMessage,
  formatCompletionMessage,
  formatRestartWarning,
  formatEveningWithoutMorning,
  getStepNumber,
  todayStr,
  normalize,
  chunk,
  getHoursSince,
  getDaysDiff,
  analyzeActionCompletion,
  analyzeGoalProgress
};

console.log('✅ [dailySessions/service] Loaded - Uses flow.js, no duplicates');