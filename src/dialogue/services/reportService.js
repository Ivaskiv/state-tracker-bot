// src/services/reportService.js
import { findAll } from './airtableService.js';
import { chat } from './openaiClient.js';
import { getBase, tables } from '../config/database.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';

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

export const saveReportToAirtable = async (tgId, userName, reportType, reportContent, reflectionsIncluded) => {
  try {
    const base = getBase();
    
    const reportRecord = await base(tables.USER_REPORTS).create([{
      fields: {
        'User ID': String(tgId),
        'User Name': userName,
        'Report Created Datetime': getUserDateTime(tgId),
        'Report Type': reportType,
        'Telegram Report Message': reportContent,
        'Summary': reportContent.substring(0, 500),
        'Reflections Included': reflectionsIncluded,
        'Email Sent': false,
        'PDF Report Link': ''
      }
    }]);

    console.log(`[reportService] ✅ Збережено звіт ${reportType} для користувача ${tgId}, ID: ${reportRecord[0].id}`);
    return reportRecord[0];
  } catch (error) {
    console.error('[reportService] ❌ Помилка збереження звіту:', error);
    throw error;
  }
};

export const generateReport = async (tgId, days) => {
  try {
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
  } catch (error) {
    console.error('[reportService] ❌ Помилка генерації звіту:', error);
    return '📭 Помилка при створенні звіту.';
  }
};

export const sendReport = async (bot, tgId, type) => {
  try {
    const days = type === 'weekly' ? WEEK_DAYS : MONTH_DAYS;
    const report = await generateReport(tgId, days);
    
    const base = getBase();
    const userRecords = await base(tables.USERS).select({
      filterByFormula: `{TG_id}="${tgId}"`,
      maxRecords: 1
    }).firstPage();

    const userName = userRecords.length > 0 ? userRecords[0].fields['User Name'] : 'Користувач';
    
    const reportHeader = type === 'weekly' ? '📊 Твій щотижневий AI-звіт:' : '📈 Твій щомісячний AI-звіт:';
    await bot.telegram.sendMessage(tgId, reportHeader);
    await bot.telegram.sendMessage(tgId, report);

    await saveReportToAirtable(tgId, userName, type === 'weekly' ? 'Weekly' : 'Monthly', report, days);
    
    console.log(`[reportService] ✅ Відправлено та збережено ${type} звіт для користувача ${tgId}`);
  } catch (error) {
    console.error('[reportService] ❌ Помилка відправки звіту:', error);
    await bot.telegram.sendMessage(tgId, '❌ Помилка при створенні звіту. Спробуйте пізніше.');
  }
};