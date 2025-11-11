// 📁 src/features/freeVideoFunnel/database.js
// Airtable-only CRUD для прогресу відео-воронки

import { getBase, tables, getOneByFormula, createRows, updateRows } from '../../config/database.js';
import { INITIAL_LIVES, TOTAL_VIDEOS, TIME_LIMIT_HOURS, AIRTABLE_FIELDS } from './constants.js';

const base = getBase();
const TABLE = tables.FREE_FUNNEL; // 👉 переконайся, що в мапі database.tables є 'Free_Funnel'

/** Допоміжне: нормалізуємо JSON-список завершених відео */
function parseCompleted(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  try { return JSON.parse(v) ?? []; } catch { return []; }
}
function stringifyCompleted(arr) {
  return JSON.stringify([ ...new Set(arr.map(Number).filter(Boolean)) ].sort((a,b)=>a-b));
}

/** Мапер Airtable -> локальний об’єкт прогресу */
function mapRow(row) {
  const f = row.fields || {};
  const vids = parseCompleted(f[AIRTABLE_FIELDS.VIDEOS_COMPLETED]);
  return {
    _id: row.id,
    user_id: Number(f[AIRTABLE_FIELDS.USER_ID]) || 0,
    current_video: Number(f[AIRTABLE_FIELDS.CURRENT_VIDEO]) || 0,
    videos_completed: vids,
    lives_remaining: Number(f[AIRTABLE_FIELDS.LIVES_REMAINING] ?? INITIAL_LIVES),
    channel_subscribed: Boolean(f[AIRTABLE_FIELDS.CHANNEL_SUBSCRIBED]),
    bonus_activated: Boolean(f[AIRTABLE_FIELDS.BONUS_ACTIVATED]),
    time_expired: Boolean(f[AIRTABLE_FIELDS.TIME_EXPIRED]),
    started_at: f[AIRTABLE_FIELDS.STARTED_AT] ? new Date(f[AIRTABLE_FIELDS.STARTED_AT]) : new Date(),
    last_activity: f[AIRTABLE_FIELDS.LAST_ACTIVITY] ? new Date(f[AIRTABLE_FIELDS.LAST_ACTIVITY]) : new Date(),
    completed_at: f[AIRTABLE_FIELDS.COMPLETED_AT] ? new Date(f[AIRTABLE_FIELDS.COMPLETED_AT]) : null,
  };
}

/** Пошук запису по user_id */
async function findRow(userId) {
  const uid = String(userId);
  const byText = `{${AIRTABLE_FIELDS.USER_ID}}='${uid}'`;
  // Якщо поле збережене як текст — цього достатньо. Якщо як число — Airtable сам кастоне.
  const row = await getOneByFormula(TABLE, byText);
  return row ? mapRow(row) : null;
}

/** Створити дефолтний запис */
async function createDefault(userId) {
  const fields = {
    [AIRTABLE_FIELDS.USER_ID]: String(userId),
    [AIRTABLE_FIELDS.CURRENT_VIDEO]: 0,
    [AIRTABLE_FIELDS.VIDEOS_COMPLETED]: stringifyCompleted([]),
    [AIRTABLE_FIELDS.LIVES_REMAINING]: INITIAL_LIVES,
    [AIRTABLE_FIELDS.CHANNEL_SUBSCRIBED]: false,
    [AIRTABLE_FIELDS.BONUS_ACTIVATED]: false,
    [AIRTABLE_FIELDS.TIME_EXPIRED]: false,
    [AIRTABLE_FIELDS.STARTED_AT]: new Date().toISOString(),
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
    [AIRTABLE_FIELDS.COMPLETED_AT]: null,
  };
  const [created] = await createRows(TABLE, [{ fields }]);
  return mapRow(created);
}

/** Оновити поля по recordId */
async function patch(recordId, partial) {
  const fields = {};
  for (const [k, v] of Object.entries(partial)) {
    fields[k] = v;
  }
  const [updated] = await updateRows(TABLE, [{ id: recordId, fields }]);
  return mapRow(updated);
}

/** Публічні методи (інтерфейс як у твоєму попередньому storage.js) */

// 1) Отримати або створити прогрес
export async function getOrCreateFunnelProgress(userId) {
  const existing = await findRow(userId);
  if (existing) return existing;
  return await createDefault(userId);
}

// 2) Оновити поточне відео
export async function updateCurrentVideo(userId, videoNumber) {
  const row = await getOrCreateFunnelProgress(userId);
  return await patch(row._id, {
    [AIRTABLE_FIELDS.CURRENT_VIDEO]: Number(videoNumber),
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });
}

// 3) Позначити відео як завершене
export async function markVideoCompleted(userId, videoNumber) {
  const row = await getOrCreateFunnelProgress(userId);
  const cur = new Set(row.videos_completed);
  cur.add(Number(videoNumber));

  const updated = await patch(row._id, {
    [AIRTABLE_FIELDS.VIDEOS_COMPLETED]: stringifyCompleted([...cur]),
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });

  // повертаємо актуалізований стан
  return updated;
}

// 4) Втрата життя
export async function loseLife(userId, reason = 'unknown') {
  const row = await getOrCreateFunnelProgress(userId);
  const lives = Math.max(0, Number(row.lives_remaining) - 1);

  const updated = await patch(row._id, {
    [AIRTABLE_FIELDS.LIVES_REMAINING]: lives,
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });

  // (Опціонально) Логи в окрему таблицю — додай у database.tables, якщо треба
  // try { await createRows('Funnel_Life_Logs', [{ fields: { user_id: String(userId), reason, lives_remaining: lives } }]); } catch {}

  return updated;
}

// 5) Втратити всі життя (час вийшов)
export async function loseAllLives(userId, reason = 'time_expired') {
  const row = await getOrCreateFunnelProgress(userId);
  const updated = await patch(row._id, {
    [AIRTABLE_FIELDS.LIVES_REMAINING]: 0,
    [AIRTABLE_FIELDS.TIME_EXPIRED]: true,
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });
  return updated;
}

// 6) Позначити підписку
export async function markChannelSubscribed(userId, subscribed = true) {
  const row = await getOrCreateFunnelProgress(userId);
  return await patch(row._id, {
    [AIRTABLE_FIELDS.CHANNEL_SUBSCRIBED]: !!subscribed,
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });
}

// 7) Активувати бонус
export async function activateBonus(userId) {
  const row = await getOrCreateFunnelProgress(userId);
  return await patch(row._id, {
    [AIRTABLE_FIELDS.BONUS_ACTIVATED]: true,
    [AIRTABLE_FIELDS.COMPLETED_AT]: new Date().toISOString(),
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
  });
}

// 8) Статистика прогресу
export async function getFunnelStats(userId) {
  const row = await getOrCreateFunnelProgress(userId);

  const videosCompleted = row.videos_completed || [];
  const totalVideos = TOTAL_VIDEOS;
  const completionRate = Math.round((videosCompleted.length / totalVideos) * 100);

  const now = new Date();
  const startedAt = row.started_at ? new Date(row.started_at) : now;
  const timeElapsedMin = Math.max(0, Math.floor((now - startedAt) / 1000 / 60));
  const timeRemaining = Math.max(0, (TIME_LIMIT_HOURS * 60) - timeElapsedMin);

  return {
    userId: row.user_id,
    currentVideo: row.current_video,
    videosCompleted: videosCompleted.length,
    totalVideos,
    completionRate,
    livesRemaining: row.lives_remaining,
    channelSubscribed: row.channel_subscribed,
    bonusActivated: row.bonus_activated,
    timeElapsed: timeElapsedMin,
    timeRemaining,
    isExpired: row.time_expired || timeRemaining === 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

// 9) Перевірка закінчення часу
export async function checkTimeExpired(userId) {
  const stats = await getFunnelStats(userId);
  if (stats.timeRemaining === 0 && !stats.isExpired) {
    await loseAllLives(userId, 'time_expired');
    return true;
  }
  return stats.isExpired;
}

// 10) Рестарт воронки
export async function resetFunnelProgress(userId) {
  const row = await getOrCreateFunnelProgress(userId);
  const updated = await patch(row._id, {
    [AIRTABLE_FIELDS.CURRENT_VIDEO]: 0,
    [AIRTABLE_FIELDS.VIDEOS_COMPLETED]: stringifyCompleted([]),
    [AIRTABLE_FIELDS.LIVES_REMAINING]: INITIAL_LIVES,
    [AIRTABLE_FIELDS.CHANNEL_SUBSCRIBED]: false,
    [AIRTABLE_FIELDS.BONUS_ACTIVATED]: false,
    [AIRTABLE_FIELDS.TIME_EXPIRED]: false,
    [AIRTABLE_FIELDS.STARTED_AT]: new Date().toISOString(),
    [AIRTABLE_FIELDS.LAST_ACTIVITY]: new Date().toISOString(),
    [AIRTABLE_FIELDS.COMPLETED_AT]: null,
  });
  return updated;
}

// 11) Кандидати для нагадувань (години з моменту старту)
export async function getUsersForReminders(hoursElapsed) {
  // Airtable не вміє складні дати як SQL, тож фільтр робимо спрощено:
  // Виберемо тих, у кого bonus_activated=false, time_expired=false, lives_remaining>0, і roughly по started_at.
  const page = await base(TABLE)
    .select({
      fields: Object.values(AIRTABLE_FIELDS),
      filterByFormula: `AND(
        NOT({${AIRTABLE_FIELDS.BONUS_ACTIVATED}}),
        NOT({${AIRTABLE_FIELDS.TIME_EXPIRED}}),
        {${AIRTABLE_FIELDS.LIVES_REMAINING}}>0
      )`,
      pageSize: 100
    })
    .all();

  // Фільтруємо по годиннику в коді
  const res = [];
  for (const r of page) {
    const row = mapRow(r);
    const hours = Math.floor((Date.now() - row.started_at.getTime()) / 1000 / 60 / 60);
    if (hours === Number(hoursElapsed)) {
      res.push({
        user_id: row.user_id,
        lives_remaining: row.lives_remaining,
        current_video: row.current_video,
        videos_completed: row.videos_completed,
      });
    }
  }
  return res;
}
