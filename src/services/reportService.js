// src/services/reportService.js
import base from '../config/airtable.js';

const USER_REFLECTIONS = 'User Reflections'; // якщо в тебе інша логіка — можна агрегацію з Morning_Responses/Evening_Responses

async function generateWeeklyReport(tgId) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString();

    const recs = await base(USER_REFLECTIONS).select({
      filterByFormula: `AND({User ID} = "${String(tgId)}", {Record DateTime} >= "${sinceISO}")`,
      sort: [{ field: 'Record DateTime', direction: 'asc' }],
      maxRecords: 200
    }).all();

    if (!recs.length) {
      return '❗ У тебе поки немає рефлексій за тиждень.';
    }

    // Дуже стисло і стабільно
    const stats = {
      energyG: 0,
      energyL: 0,
      victories: 0
    };

    recs.forEach(r => {
      if (r.fields['Energy Gain']) stats.energyG += 1;
      if (r.fields['Energy Loss']) stats.energyL += 1;
      if (r.fields['Victory']) stats.victories += 1;
    });

    const total = recs.length;
    const report =
`📊 ЩОТИЖНЕВИЙ ЗВІТ

📈 Записів: ${total}
⚡️ Енергія (+): ${stats.energyG}
⚡️ Енергія (–): ${stats.energyL}
🏆 Перемоги: ${stats.victories}

💡 Рекомендація:
• Продовжуй відповідати щодня
• Підсилюй те, що додає енергії
• Мінімізуй повторювані зливи енергії`;

    return report;
  } catch (e) {
    console.error('Weekly report error:', e);
    return '❌ Не вдалося сформувати тижневий звіт.';
  }
}

async function generateMonthlyReport(tgId) {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 1);
    const sinceISO = since.toISOString();

    const recs = await base(USER_REFLECTIONS).select({
      filterByFormula: `AND({User ID} = "${String(tgId)}", {Record DateTime} >= "${sinceISO}")`,
      sort: [{ field: 'Record DateTime', direction: 'asc' }],
      maxRecords: 500
    }).all();

    if (!recs.length) {
      return '❗ У тебе поки немає рефлексій за місяць.';
    }

    const report =
`📈 МІСЯЧНИЙ ЗВІТ

Ти стабільно ведеш рефлексії. Продовжуй у тому ж дусі.
Фокус наступного місяця:
• 1 дія щодня до головної цілі
• 1 вибір стану (впевненість / легкість)
• 1 мікрокрок для прогресу`;

    return report;
  } catch (e) {
    console.error('Monthly report error:', e);
    return '❌ Не вдалося сформувати місячний звіт.';
  }
}

export default {
  generateWeeklyReport,
  generateMonthlyReport
};
