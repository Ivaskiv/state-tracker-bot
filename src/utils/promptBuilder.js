// src/utils/promptBuilder.js
import { getPrompt } from '../services/prompts/index.js';
import { getCurrentTimeFormatted } from './timeUtils.js';
import { isStateResourceful } from './smartActionsValidator.js';

/**
 * Підготовка промпту для SMART мікро-дій
 */
export function prepareSmartPrompt(focusGoal, state, userContext) {
  const currentTime = getCurrentTimeFormatted();
  const isResourceful = isStateResourceful(state);

  const promptText = getPrompt('smart_convert', { focusGoal, state, userContext }).user;

  return `${promptText}

Контекст:
- Продуктивність: ${userContext.avgProductivity}%
- Тип фокусу: ${userContext.typicalFocusTime}
- Час: ${currentTime}
- Ресурсний стан: ${isResourceful ? 'так' : 'ні'}

Поверни валідний JSON: {microActions, state_booster, weekly_milestone, motivation}`;
}

/**
 * Підготовка промпту для персоналізованої поради
 */
export function prepareAdvicePrompt(question, userContext) {
  return `Ти AI-наставник рівня Tony Robbins.

Питання: "${question}"

Контекст: ${JSON.stringify(userContext, null, 2)}

Дай персоналізовану відповідь (до 100 слів):
- Інсайт про ситуацію
- 1-2 конкретні мікро-дії
- Мотиваційне закриття
- Українською мовою

Формат:
🎯 [інсайт]
💡 [конкретні дії]
✨ [мотивація]`;
}

/**
 * Промпт для фідбеку дня
 */
export function prepareFeedbackPrompt(responses, state, goal) {
  return `Ціль: "${goal}"
Стан: "${state}"
Відповіді: ${JSON.stringify(responses)}

Короткий фідбек (до 100 слів): досягнення + рекомендація на завтра.`;
}