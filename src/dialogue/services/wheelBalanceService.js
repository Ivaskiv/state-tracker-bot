import airtable from '../../db/airtable.js';
import { WB_TABLE, WB_FIELDS, WB_STATUS } from '../constants.js';
import { getUserDateString } from '../../utils/timezoneUtils.js';

const table = airtable(WB_TABLE);

export async function getActiveWheel(tgId) {
  const formula = `AND({${WB_FIELDS.TG_ID}}='${tgId}', {${WB_FIELDS.STATUS}}='${WB_STATUS.ACTIVE}')`;
  const records = await table.select({ filterByFormula: formula, maxRecords: 1 }).firstPage();
  return records[0] || null;
}

export async function startWheelBalance(user) {
  const tgId = user['TG_id'];
  const name = user['User Name'] || 'Користувач';
  const dateStr = getUserDateString(tgId); // "YYYY-MM-DD" під вашу TZ (за замовч. Europe/Kiev)

  return table.create({
    [WB_FIELDS.TG_ID]: tgId.toString(),
    [WB_FIELDS.USER_NAME]: name,
    [WB_FIELDS.DATE]: dateStr,
    [WB_FIELDS.STATUS]: WB_STATUS.ACTIVE,
    [WB_FIELDS.STEP]: 1,
  });
}
