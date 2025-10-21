// src/features/wheelBalance/analysis.js — ВИПРАВЛЕНО

import { chat } from '../../services/openaiClient.js';
import logger from '../../utils/logger.js';
import { LIFE_SPHERES } from '../../config/index.js';

/**
 * ✅ ВИПРАВЛЕНО: Правильна генерація аналізу з конвертацією назв
 */
export const generateWheelAnalysis = (scores = []) => {
  const totalSpheres = LIFE_SPHERES.length;
  const safe = Array.isArray(scores) ? scores.slice(0, totalSpheres) : [];
  while (safe.length < totalSpheres) safe.push(0);

  const total = safe.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const avg = +(total / totalSpheres).toFixed(1);

  const strong = [];
  const weak = [];

  for (let i = 0; i < totalSpheres; i++) {
    const label = String(LIFE_SPHERES[i]?.label || LIFE_SPHERES[i]?.key || `Сфера ${i + 1}`);
    const score = Number(safe[i]) || 0;
    if (score >= 8) strong.push(`${label} (${score})`);
    if (score <= 5) weak.push(`${label} (${score})`);
  }

  let out = `✅ Середній бал: ${avg}/10\n\n`;
  if (strong.length) out += `🌟 Сильні: ${strong.join(', ')}\n`;
  if (weak.length)   out += `⚡ Увага: ${weak.join(', ')}\n`;
  out += `\n🎯 Зосередься на сферах ≤5 — це точки росту.\n\n📈 Відстежуй прогрес щомісяця.`;

  return out;
};

/**
 * ✅ SYSTEM PROMPT для коуча
 */
const getSystemPrompt = () => {
  return `Ти — експертний коуч з Life Wheel Analysis.
Стиль: конкретний, без пафосу, практичний, емпатійний.
Мова: українська.
Довжина: 200-300 слів максимум.
Завдання: дати короткий, дійсно корисний аналіз та 2-3 конкретні дії на місяць.`;
};

/**
 * ✅ ВИПРАВЛЕНО: Промпт правильно готується
 */
const buildWheelAnalysisPrompt = (scoresArr, sphereNames) => {
  const pairs = scoresArr.map((score, i) => ({
    name: sphereNames[i] || `Сфера ${i + 1}`,
    score: Number(score)
  }));

  const avg = (scoresArr.reduce((a, b) => a + b, 0) / 8).toFixed(1);
  const weak = pairs.filter(p => p.score <= 5);
  const strong = pairs.filter(p => p.score >= 8);

  let prompt = `🎡 **АНАЛІЗ КОЛЕСА БАЛАНСУ**\n\n`;
  
  prompt += `Оцінки користувача (0-10):\n`;
  pairs.forEach(p => {
    prompt += `• ${p.name}: ${p.score}\n`;
  });

  prompt += `\n📊 Статистика:\n`;
  prompt += `• Середня оцінка: ${avg}/10\n`;
  prompt += `• Сильні сфери (≥8): ${strong.map(s => s.name).join(', ') || 'немає'}\n`;
  prompt += `• Для розвитку (≤5): ${weak.map(s => s.name).join(', ') || 'немає'}\n`;

  prompt += `\n✅ ТВОЯ ЗАДАЧА:\n`;
  prompt += `1. Коротко оціни баланс (1 речення)\n`;
  prompt += `2. Назви 1-2 найважливіші точки росту\n`;
  prompt += `3. Дай 2-3 конкретних дій на місяць (з часом, тривалістю, результатом)\n`;
  prompt += `4. Мотивуючий висновок (без пафосу)\n\n`;
  prompt += `Форматуй як звіт для користувача (готовий для Telegram).`;

  return prompt;
};

/**
 * ✅ ВИПРАВЛЕНО: Fallback з правильною конвертацією
 */
const createFallbackAnalysis = (scoresArr, sphereNames = null) => {
  try {
    // ✅ ВИПРАВЛЕНО: Отримуємо РЯДКОВІ назви, а не об'єкти
    const names = sphereNames && sphereNames.length === 8
      ? sphereNames.map(n => String(n))
      : LIFE_SPHERES.map(s => String(s.label || s.key));

    const avg = (scoresArr.reduce((a, b) => a + b, 0) / 8).toFixed(1);

    // ✅ ВИПРАВЛЕНО: Правильно фільтруємо та показуємо
    const pairs = scoresArr.map((score, i) => ({
      name: names[i],
      score
    }));

    const strong = pairs.filter(p => p.score >= 8);
    const weak = pairs.filter(p => p.score <= 5);

    let analysis = '';

    // 1️⃣ Середня оцінка
    analysis += `✅ **Твій баланс: ${avg}/10**\n\n`;

    // 2️⃣ Сильні сфери
    if (strong.length > 0) {
      analysis += `🌟 **Сильні сфери (≥8):**\n`;
      strong.forEach(s => {
        analysis += `• ${String(s.name)}: ${s.score}/10\n`;
      });
      analysis += '\n';
    }

    // 3️⃣ Для розвитку
    if (weak.length > 0) {
      analysis += `⚡ **Для розвитку (≤5):**\n`;
      weak.forEach(w => {
        analysis += `• ${String(w.name)}: ${w.score}/10\n`;
      });
      analysis += '\n';
    } else {
      analysis += `⚡ **Для розвитку:** всі сфери в нормі!\n\n`;
    }

    // 4️⃣ Конкретні дії
    analysis += `🎯 **Конкретні дії на місяць:**\n`;
    if (weak.length > 0) {
      const top = weak[0];
      analysis += `• **Дія 1:** Покращити "${top.name}" на 2-3 пункти\n`;
      analysis += `  ⏱️ 25 хв/день, щодня\n`;
      analysis += `  📍 Результат: ${top.score} → ${top.score + 2}/10\n\n`;
    }

    analysis += `• **Дія 2:** Визнач одну сферу для глибокого дослідження\n`;
    analysis += `  ⏱️ 1 година на рефлексію\n\n`;

    analysis += `• **Дія 3:** Запиши одну дію на кожен день цього тижня\n`;
    analysis += `  ⏱️ Вечір перед сном, 5 хв\n\n`;

    // 5️⃣ Мотивація
    if (avg >= 8) {
      analysis += `📈 **Висновок:** Твій баланс практично ідеальний! Фокусуйся на утриманні висот. 🚀`;
    } else if (avg >= 6) {
      analysis += `📈 **Висновок:** Добрий прогрес! Обери 1-2 сфери на фокус і розвивай їх послідовно. 💪`;
    } else if (avg >= 4) {
      analysis += `📈 **Висновок:** Час для активних змін! Почни з найслабшої сфери, роб маленькі кроки. 🎯`;
    } else {
      analysis += `📈 **Висновок:** Баланс потребує серйозної роботи. Але ТИ можеш це змінити! Почни ЗАРАЗ. 🔥`;
    }

    return analysis;

  } catch (error) {
    logger.error('[wheelBalance/analysis] ❌ Помилка fallback:', error.message);
    
    // Ультра-fallback
    return (
      `✅ **Колесо балансу завершено!**\n\n` +
      `📊 Твої оцінки збережено.\n\n` +
      `🎯 Рекомендація: переглянь результати та встанови один фокус на наступний місяць.\n\n` +
      `📈 Обновлюй колесо раз на місяць для відстеження прогресу. 💪`
    );
  }
};

console.log('✅ [wheelBalance/analysis] Аналіз ВИПРАВЛЕНО (без [object Object])');