import { getUserReflections } from '../utils/airtable.js';

/**
 * Generates a weekly report for a user based on their reflections.
 * @param {string} tgId - Telegram ID of the user
 * @returns {Promise<string>} - The generated report text
 */
export async function generateWeeklyReport(tgId) {
  try {
    // Fetch user reflections for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const reflections = await getUserReflections(tgId, null, 100);
    const responses = reflections
      .filter(r => new Date(r.fields['Record DateTime']) >= sevenDaysAgo)
      .map(r => ({
        question: r.fields['Question Type'],
        answer: r.fields['User Response'] || 'немає відповіді',
      }));

    if (!responses.length) return 'Немає даних за тиждень.';

    // Aggregate data by question type
    const energyLeak = responses
      .filter(r => r.question.includes('Де я сьогодні злила енергію'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const programs = responses
      .filter(r => r.question.includes('Яка програма або переконання активувалась сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const dailyState = responses
      .filter(r => r.question.includes('Який мій стан сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const energySources = responses
      .filter(r => r.question.includes('Що мене сьогодні наповнило енергією'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const focusGoal = responses
      .filter(r => r.question.includes('На яку одну ціль я фокусуюсь сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const wins = responses
      .filter(r => r.question.includes('Яка моя головна перемога сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const release = responses
      .filter(r => r.question.includes('Що варто відпустити'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const strengthen = responses
      .filter(r => r.question.includes('Що посилити'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    // Generate report text
    return `
Привіт! 🌱
Ось твій AI-звіт за останній тиждень:

🔻 Витоки енергії:
— ${energyLeak}

🚧 Блокуючі програми:
— ${programs}

🧭 Стан тижня:
— ${dailyState}

🌊 Наповнення:
— ${energySources}

🎯 Ціль у фокусі:
— ${focusGoal}

🏆 Внутрішні перемоги:
— ${wins}

🕳 Що варто відпустити:
— ${release}

💡 Що посилити:
— ${strengthen}

☀️ Наступний крок:
— Обери: [___]  
— Дій із: [стану ___]
`;
  } catch (err) {
    console.error('Error generating weekly report:', err.message);
    return 'Помилка при формуванні тижневого звіту.';
  }
}

/**
 * Generates a monthly report for a user based on their reflections.
 * @param {string} tgId - Telegram ID of the user
 * @returns {Promise<string>} - The generated report text
 */
export async function generateMonthlyReport(tgId) {
  try {
    // Fetch user reflections for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const reflections = await getUserReflections(tgId, null, 100);
    const responses = reflections
      .filter(r => new Date(r.fields['Record DateTime']) >= thirtyDaysAgo)
      .map(r => ({
        question: r.fields['Question Type'],
        answer: r.fields['User Response'] || 'немає відповіді',
      }));

    if (!responses.length) return 'Немає даних за місяць.';

    // Analyze dominant state
    const states = responses
      .filter(r => r.question.includes('Який мій стан сьогодні'))
      .map(r => r.answer);
    const dominantState = states.length
      ? states.sort((a, b) => states.filter(v => v === b).length - states.filter(v => v === a).length)[0]
      : 'немає даних';

    // Aggregate data by question type
    const programs = responses
      .filter(r => r.question.includes('Яка програма або переконання активувалась сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const roles = responses
      .filter(r => r.question.includes('Хто я сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const goals = responses
      .filter(r => r.question.includes('Мої 10 цілей'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const energySources = responses
      .filter(r => r.question.includes('Що мене сьогодні наповнило енергією'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const wins = responses
      .filter(r => r.question.includes('Яка моя головна перемога сьогодні'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const release = responses
      .filter(r => r.question.includes('Що стримувало'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    const newPower = responses
      .filter(r => r.question.includes('Твоя нова точка сили'))
      .map(r => r.answer)
      .join('\n— ') || 'немає даних';

    // Generate report text
    return `
Привіт! 🌟
Ось твій AI-звіт за місяць:

🧠 Стан місяця:
— Найчастіше ти була в стані: ${dominantState}

🚧 Програми місяця:
— ${programs}

🎭 Твоя роль у реальності:
— ${roles}

🎯 Цілі:
— Топ повторювані цілі: ${goals}

🌈 Джерело енергії:
— ${energySources}

🔥 Прориви:
— ${wins}

🕳 Що стримувало:
— ${release}

⚡️ Нова точка сили:
— ${newPower}

📌 Рекомендація на місяць:
— Дій із стану: [...]
— Обирай: [...]
— Фокус: [...]
`;
  } catch (err) {
    console.error('Error generating monthly report:', err.message);
    return 'Помилка при формуванні місячного звіту.';
  }
}