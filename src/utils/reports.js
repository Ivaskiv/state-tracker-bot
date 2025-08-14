// src/utils/reports.js

import { getUserResponses } from "./airtable.js";


/**
 * Формує щотижневий звіт користувача
 * @param {string} tg_user_id - Telegram ID користувача
 * @returns {string} - Текст звіту
 */
export async function generateWeeklyReport(tg_user_id) {
  try {
    // Отримуємо відповіді користувача за останній тиждень
    const responses = await getUserResponses(tg_user_id, 'week');

    if (!responses || responses.length === 0) return 'Немає даних за тиждень.';

    // Збираємо дані за категоріями
    const energyLeak = responses
      .filter(r => r.question.includes('Де я сьогодні злила енергію?'))
      .map(r => r.answer)
      .join('\n— ');

    const programs = responses
      .filter(r => r.question.includes('Яка програма або переконання активувалась сьогодні?'))
      .map(r => r.answer)
      .join('\n— ');

    const dailyState = responses
      .filter(r => r.question.includes('Який мій стан сьогодні?'))
      .map(r => r.answer)
      .join('\n— ');

    const energySources = responses
      .filter(r => r.question.includes('Що мене сьогодні наповнило енергією?'))
      .map(r => r.answer)
      .join('\n— ');

    const focusGoal = responses
      .filter(r => r.question.includes('На яку одну ціль я фокусуюсь сьогодні?'))
      .map(r => r.answer)
      .join('\n— ');

    const wins = responses
      .filter(r => r.question.includes('Сьогодні я'))
      .map(r => r.answer)
      .join('\n— ');

    const release = responses
      .filter(r => r.question.includes('Що варто відпустити'))
      .map(r => r.answer)
      .join('\n— ');

    const strengthen = responses
      .filter(r => r.question.includes('Що посилити'))
      .map(r => r.answer)
      .join('\n— ');

    // Формуємо текст звіту
    const report = `
Привіт! 🌱
Ось твій AI-звіт за останній тиждень:

🔻 Витоки енергії:
— ${energyLeak || 'немає даних'}

🚧 Блокуючі програми:
— ${programs || 'немає даних'}

🧭 Стан тижня:
— ${dailyState || 'немає даних'}

🌊 Наповнення:
— ${energySources || 'немає даних'}

🎯 Ціль у фокусі:
— ${focusGoal || 'немає даних'}

🏆 Внутрішні перемоги:
— ${wins || 'немає даних'}

🕳 Що варто відпустити:
— ${release || 'немає даних'}

💡 Що посилити:
— ${strengthen || 'немає даних'}

☀️ Наступний крок:
— Обери: [___]  
— Дій із: [стану ___]
`;

    return report;

  } catch (err) {
    console.error('Error generating weekly report:', err);
    return 'Помилка при формуванні тижневого звіту.';
  }
}

/**
 * Формує щомісячний звіт користувача
 * @param {string} tg_user_id - Telegram ID користувача
 * @returns {string} - Текст звіту
 */
export async function generateMonthlyReport(tg_user_id) {
  try {
    // Отримуємо відповіді користувача за останній місяць
    const responses = await getUserResponses(tg_user_id, 'month');

    if (!responses || responses.length === 0) return 'Немає даних за місяць.';

    // Аналіз стану місяця
    const states = responses
      .filter(r => r.question.includes('Який мій стан сьогодні?'))
      .map(r => r.answer);

    const dominantState = states.length ? states.sort((a,b) =>
      states.filter(v => v===b).length - states.filter(v => v===a).length
    )[0] : 'немає даних';

    // Переконання
    const programs = responses
      .filter(r => r.question.includes('Яка програма або переконання активувалась сьогодні?'))
      .map(r => r.answer)
      .join('\n— ');

    // Роль
    const roles = responses
      .filter(r => r.question.includes('Хто я сьогодні?'))
      .map(r => r.answer)
      .join('\n— ');

    // Цілі
    const goals = responses
      .filter(r => r.question.includes('Мої 10 цілей'))
      .map(r => r.answer)
      .join('\n— ');

    // Джерела енергії
    const energySources = responses
      .filter(r => r.question.includes('Що мене сьогодні наповнило енергією?'))
      .map(r => r.answer)
      .join('\n— ');

    // Прориви
    const wins = responses
      .filter(r => r.question.includes('Сьогодні я'))
      .map(r => r.answer)
      .join('\n— ');

    // Блоки
    const release = responses
      .filter(r => r.question.includes('Що стримувало'))
      .map(r => r.answer)
      .join('\n— ');

    // Нова точка сили
    const newPower = responses
      .filter(r => r.question.includes('Твоя нова точка сили'))
      .map(r => r.answer)
      .join('\n— ');

    const report = `
Привіт! 🌟  
Ось твій AI-звіт за місяць:

🧠 Стан місяця:  
— Найчастіше ти була в стані: ${dominantState || 'немає даних'}

🚧 Програми місяця:  
— ${programs || 'немає даних'}

🎭 Твоя роль у реальності:  
— ${roles || 'немає даних'}

🎯 Цілі:  
— Топ повторювані цілі: ${goals || 'немає даних'}

🌈 Джерело енергії:  
— ${energySources || 'немає даних'}

🔥 Прориви:  
— ${wins || 'немає даних'}

🕳 Що стримувало:  
— ${release || 'немає даних'}

⚡️ Нова точка сили:  
— ${newPower || 'немає даних'}

📌 Рекомендація на місяць:  
— Дій із стану: [...]  
— Обирай: [...]  
— Фокус: [...]
`;

    return report;

  } catch (err) {
    console.error('Error generating monthly report:', err);
    return 'Помилка при формуванні місячного звіту.';
  }
}
