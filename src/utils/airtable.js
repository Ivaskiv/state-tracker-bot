import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

export const getUserByTgId = async (tgId) => {
  return new Promise((resolve, reject) => {
    base('Users').select({
      filterByFormula: `{tg_user_id} = '${tgId}'`,
      maxRecords: 1,
    }).firstPage((err, records) => {
      if (err) return reject(err);
      resolve(records?.[0]);
    });
  });
};

export const createUser = async (fields) => {
  return new Promise((resolve, reject) => {
    base('Users').create([{ fields }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
};

export const updateUser = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');

  return new Promise((resolve, reject) => {
    base('Users').update([{ id: user.id, fields }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
};

export const getUsers = async () => {
  return new Promise((resolve, reject) => {
    base('Users').select().all((err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
};

export const createRecord = async (record) => {
  return new Promise((resolve, reject) => {
    base('Records').create([{ fields: record }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
};

export const getPhrases = async (type) => {
  return new Promise((resolve, reject) => {
    base('Phrases').select({
      filterByFormula: `{Type} = '${type}' AND {Used} = FALSE`,
    }).firstPage((err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
};

export const markPhraseUsed = async (id) => {
  return new Promise((resolve, reject) => {
    base('Phrases').update([{ id, fields: { Used: true } }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
};

export const createPhrase = async (fields) => {
  return new Promise((resolve, reject) => {
    base('Phrases').create([{ fields }], (err, records) => {
      if (err) return reject(err);
      resolve(records[0]);
    });
  });
};

export const getRecordsByUserAndDate = async (userId, startDate, endDate) => {
  return new Promise((resolve, reject) => {
    base('Records').select({
      filterByFormula: `AND({userId} = '${userId}', {timestamp} >= '${startDate}', {timestamp} < '${endDate}')`,
    }).all((err, records) => {
      if (err) return reject(err);
      resolve(records);
    });
  });
};