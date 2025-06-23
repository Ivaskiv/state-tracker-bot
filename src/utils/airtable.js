import Airtable from 'airtable';
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

export const getUserByTgId = async (tgId) => {
  return new Promise((resolve, reject) => {
    base('Users').select({ filterByFormula: `{tg_id} = '${tgId}'` }).firstPage((err, records) => {
      if (err) return reject(err);
      resolve(records?.[0]);
    });
  });
};

export const updateUser = (id, fields) => {
  return base('Users').update([{ id, fields }]);
};

export const createUser = (fields) => {
  return base('Users').create(fields);
};
