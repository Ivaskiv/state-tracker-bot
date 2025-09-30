// src/services/reportService.js
import responseService from '../dialogue/services/responseService.js'; // ДОДАНО ІМПОРТ
import { chat } from './openaiClient.js';

const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

const buildDataset = (records) => records.map(r => ({
  State: r.fields['State'] || '',
  Goal: r.fields['Goal'] || '',
  EnergyGain: r.fields['Energy Gain'] || '',
  EnergyLoss: r.fields['Energy Loss'] || '',
  Programs: r.fields['Programs'] || '',
  Victory: r.fields['Victory'] || '',
  Summary: r.fields['Summary'] || '',
  Affirmation: r.fields['Affirmation'] || '',
}));

const analysisPrompt = (dataset, period) => `
Ти — експертний коуч трансформації рівня Tony Robbins + Simon Sinek + Tim Ferriss, який аналізує щоденні рефлексії для виявлення внутрішньої сили, шаблонів поведінки та точок росту.

Принципи роботи:
- Говори з позиції "ти вже маєш силу всередині"
- Виділяй ресурси та можливості, а не проблеми
- Блокуючі програми називай прямо, але з підтримкою
- Пропонуй конкретні мікро-дії, не загальні поради

Проаналізуй ${period} дані користувача:

${dataset.map((d, i) => `День ${i+1}: Стан=${d.State}; Ціль=${d.Goal}; +Енергія=${d.EnergyGain}; -Енергія=${d.EnergyLoss}; Програми=${d.Programs}; Перемога=${d.Victory}`).join('\n')}

Формат відповіді:
🌟 Внутрішня сила: [2-3 речення про прояви самоцінності, рішучості]
🔍 Важливі закономірності: [2-3 речення про шаблони]  
💡 Точки росту: [1-2 речення про програми для трансформації]
⚡️ Практичні кроки:
• [Дія на завтра]
• [Вправа для стану]
• [Мікро-вибір для посилення]

До 150 слів, українською мовою, підтримуючий тон.
`;

export const generateReport = async (tgId, days) => {
  try {
    const records = await responseService.getUserRecords(tgId, days);
    
    if (!records.length) {
      return '📭 Недостатньо даних для звіту. Продовжуй щоденні відповіді.';
    }

    const dataset = buildDataset(records);
    const period = days === 7 ? '7-денні' : '30-денні';
    
    const report = await chat([
      { role: 'system', content: 'Ти коуч-аналітик. Дотримуйся суворого формату з інструкції. Українською. До 150 слів.' },
      { role: 'user', content: analysisPrompt(dataset, period) },
    ], 'gpt-4o-mini', 400);

    return report || '📭 Не вдалося згенерувати звіт. Спробуй пізніше.';
  } catch (error) {
    console.error('[generateReport] Помилка:', error);
    return '📭 Помилка генерації звіту. Спробуй пізніше.';
  }
};

export const sendReport = async (bot, tgId, type) => {
  const days = type === 'weekly' ? WEEK_DAYS : MONTH_DAYS;
  const report = await generateReport(tgId, days);
  await bot.telegram.sendMessage(tgId, type === 'weekly' ? '📊 Твій щотижневий AI-звіт:' : '📈 Твій щомісячний AI-звіт:');
  await bot.telegram.sendMessage(tgId, report);
};

// ДОДАТИ НИЖЧЕ (опційно, якщо потрібно зберігати звіти)
export async function saveReportToAirtable(base, { tgId, userName, period, reportText, days }) {
  const [rec] = await base('Reports').create([{
    fields: {
      TG_id: String(tgId),
      'User Name': userName || 'Користувач',
      Period: period,              // 'Weekly' | 'Monthly'
      Days: days,
      Report_Text: reportText,
      Created_At: new Date().toISOString(),
    }
  }]);
  return rec?.id;
}
const generateWeeklyReport = async (tgId) => {
  const weekData = await getWeekData(tgId);
  
  return `📊 ТИЖНЕВИЙ ЗВІТ (${weekData.period})

🎯 Перемоги:
${weekData.wins.map((w, i) => `${i + 1}. ${w}`).join('\n')}

⚡ Де йде енергія: ${weekData.energyFlow.join(', ')}
💧 Де зливається: ${weekData.energyLeaks.join(', ')}

📈 Виконання: ${weekData.completionRate}%
🎯 Навички фокусу: ${weekData.skillsFocus.join(', ')}

📅 ПЛАН ТИЖНЯ:
${weekData.nextWeekActions.map((a, i) => `${i + 1}. ${a.action} (${a.time}, результат: ${a.metric})`).join('\n')}

💪 Виклик: зроби п.1 завтра і напиши 'ЗРОБИЛА'.`;
};

// 👇 ДОДАЙ ЦЕ
const reportService = {
  generateReport,
  sendReport,
  saveReportToAirtable,
  generateWeeklyReport
};
export default reportService;