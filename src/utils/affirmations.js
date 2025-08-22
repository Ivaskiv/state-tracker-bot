// src/utils/affirmations.js
import { chat } from '../services/openaiClient.js';
import { selectFromTable, updateRows } from '../config/database.js';

export const getAffirmation = async () => {
  try {
    const txt = await chat([
      { role: 'system', content: 'Ти створюєш унікальні короткі афірмації українською (8–20 слів), теплі, підтримуючі, без кліше.' },
      { role: 'user', content: 'Згенеруй одну афірмацію українською для впевненості/цілей/зростання.' },
    ], 'gpt-4o-mini', 60);
    if (txt) return txt;
  } catch {}

  // fallback з Airtable
  const recs = await selectFromTable('Affirmations', { filterByFormula: '{Used} = FALSE()', maxRecords: 50 }).firstPage();
  if (!recs.length) return 'Завдяки щоденній праці я впевнено просуваюся до своїх цілей.';
  const pick = recs[Math.floor(Math.random() * recs.length)];
  await updateRows('Affirmations', [{ id: pick.id, fields: { Used: true } }]);
  return pick.fields['Affirmation'] || 'Я обираю силу, ясність і дію сьогодні.';
};
