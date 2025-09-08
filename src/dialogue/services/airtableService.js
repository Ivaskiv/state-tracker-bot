import { getBase } from '../config/database.js';

const base = getBase();

export const findAll = async (tableName, options = {}) => {
  return await base(tableName).select(options).all();
};