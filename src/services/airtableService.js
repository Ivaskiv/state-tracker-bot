// src/services/airtableService.js
import { getBase, tables, selectFromTable, createRows, updateRows } from '../config/database.js';

export const findOneByField = async (tableName, field, value) => {
  const records = await selectFromTable(tableName, { filterByFormula: `{${field}} = "${value}"`, maxRecords: 1 }).firstPage();
  return records[0] || null;
};

export const findAll = async (tableName, opts = {}) => selectFromTable(tableName, opts).all();

export const createOne = async (tableName, fields) => {
  const [rec] = await createRows(tableName, [{ fields }]);
  return rec;
};

export const updateOne = async (tableName, id, fields) => {
  const [rec] = await updateRows(tableName, [{ id, fields }]);
  return rec;
};

// helpers exposed for other modules (affirmations/report)
export const _raw = { getBase, tables, selectFromTable, createRows, updateRows };
