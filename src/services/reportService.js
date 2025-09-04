// src/services/reportService.js
import { findAll } from './airtableService.js';
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
Ти — експертний коуч трансформації рівня Tony Robbins + Simon Sinek + Tim Ferriss...
(див. інструкцію з "AI Analytics" із вимогами та форматом відповіді).
Проаналізуй ${period} дані:

${dataset.map((d, i) => `День ${i+1}: State=${d.State}; Goal=${d.Goal}; +${d.EnergyGain}; -${d.EnergyLoss}; Programs=${d.Programs}; Victory=${d.Victory}`).join('\n')}
`;

export const generateReport = async (tgId, days) => {
  const sinceISO = new Date(Date.now() - days * 86400000).toISOString();
  const recs = await findAll('USER_REFLECTIONS', {
    filterByFormula: `AND({User ID} = "${tgId}", IS_AFTER({Record DateTime}, "${sinceISO}"))`,
    sort: [{ field: 'Record DateTime', direction: 'asc' }],
  });

  if (!recs.length) return '📭 Недостатньо даних для звіту. Продовжуй щоденні відповіді.';

  const ds = buildDataset(recs);
  const text = await chat([
    { role: 'system', content: 'Ти коуч-аналітик. Дотримуйся суворого формату з інструкції AI Analytics. Українською. До 150 слів.' },
    { role: 'user', content: analysisPrompt(ds, `${days}-денні`) },
  ], 'gpt-4o-mini', 300);

  return text || '📭 Недостатньо даних для звіту.';
};

export const sendReport = async (bot, tgId, type) => {
  const days = type === 'weekly' ? WEEK_DAYS : MONTH_DAYS;
  const report = await generateReport(tgId, days);
  await bot.telegram.sendMessage(tgId, type === 'weekly' ? '📊 Твій щотижневий AI-звіт:' : '📈 Твій щомісячний AI-звіт:');
  await bot.telegram.sendMessage(tgId, report);
};
