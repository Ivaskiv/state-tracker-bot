// src/utils/smartActionsValidator.js
import { generateTimeSlot, formatTime } from './timeUtils.js';

/**
 * Валідація та покращення SMART-дій
 */
export function validateAndEnhanceSMARTActions(parsed, focusGoal, state) {
  const now = new Date();
  const isResourceful = isStateResourceful(state);

  const enhancedActions = (parsed.microActions || []).map((action, index) => {
    const enhanced = { ...action };

    if (!enhanced.time || !enhanced.time.includes('-')) {
      enhanced.time = generateTimeSlot(now, index, enhanced.duration_min || 15);
    }

    if (!enhanced.result_metric || enhanced.result_metric.length < 3) {
      enhanced.result_metric = suggestMetricForAction(enhanced.action, focusGoal);
    }

    if (!enhanced.duration_min || enhanced.duration_min < 5) {
      enhanced.duration_min = [25, 15, 10][index] || 10;
    }

    if (!isResourceful && enhanced.duration_min > 20) {
      enhanced.duration_min = 15;
      enhanced.tip = 'Короткий крок для збереження енергії';
    }

    if (!enhanced.priority) {
      enhanced.priority = ['висока', 'середня', 'низька'][index] || 'низька';
    }

    return enhanced;
  });

  return {
    microActions: enhancedActions,
    state_booster: parsed.state_booster || getStateBooster(state),
    weekly_milestone: parsed.weekly_milestone || `Прогрес до: ${focusGoal}`,
    motivation: parsed.motivation || 'Дія — це твоя мова проти страху. Почни зараз! 💪',
    generated_at: now.toISOString(),
    smart_validated: true
  };
}

/**
 * Fallback SMART-дії
 */
export function getSMARTFallbackActions(focusGoal, state) {
  const now = new Date();
  const isResourceful = isStateResourceful(state);
  
  const duration1 = isResourceful ? 25 : 15;
  const time1 = generateTimeSlot(now, 0, duration1);
  const time2 = generateTimeSlot(now, 1, 10);

  return {
    microActions: [
      {
        action: isResourceful
          ? `Зроби 2 конкретні кроки до: ${focusGoal}`
          : `Зроби 1 простий крок до: ${focusGoal}`,
        time: time1,
        duration_min: duration1,
        result_metric: '1 крок завершено',
        priority: 'висока',
        tip: 'Почни з найпростішого'
      },
      {
        action: 'Підтримай енергію: 5-10 хв активність',
        time: time2,
        duration_min: 10,
        result_metric: '10 хв відновлення',
        priority: 'середня',
        tip: 'Підтримка стану'
      },
      {
        action: 'Вдячність: 3 речі + 1 перемога',
        time: 'будь-коли',
        duration_min: 5,
        result_metric: '4 записи',
        priority: 'низька',
        tip: 'Легка підтримка'
      }
    ],
    state_booster: getStateBooster(state),
    weekly_milestone: `Прогрес до: ${focusGoal}`,
    motivation: 'Маленькі кроки → великі результати! 💪',
    generated_at: now.toISOString(),
    smart_validated: true,
    is_fallback: true
  };
}

// ==========================================
// METRICS & STATE HELPERS
// ==========================================

export function suggestMetricForAction(actionText, goalText) {
  const action = (actionText || '').toLowerCase();
  
  const metrics = {
    'напис|текст': '300-500 слів',
    'дзвін|телефон': '1 розмова',
    'лід|клієнт': '3-5 лідів',
    'план|страт': '1 сторінка',
    'код|програм': '50-100 рядків',
    'email|лист': '5 листів',
    'зустріч|мітинг': '1 зустріч'
  };

  for (const [pattern, metric] of Object.entries(metrics)) {
    if (new RegExp(pattern).test(action)) return metric;
  }

  return '1 завдання';
}

export function getStateBooster(state) {
  const s = (state || '').toLowerCase();
  
  const boosters = [
    { pattern: /втом|мало.*енергі/, action: '5 хв прогулянка або дихання (4-4-4)' },
    { pattern: /стрес|тривог/, action: '10 хв медитація або музика' },
    { pattern: /розсіян|фокус/, action: '2 хв Deep Work + вимкнення сповіщень' }
  ];

  for (const { pattern, action } of boosters) {
    if (pattern.test(s)) return action;
  }

  return '5 хв фізична активність';
}

export function isStateResourceful(state) {
  const s = (state || '').toLowerCase();
  return s.includes('енергі') || s.includes('ресурс') || s.includes('сила');
}