// src/services/activityTracker.js - ПОВНА ВЕРСІЯ З АНАЛІЗОМ

import userService from './userService.js';
import responseService from './responseService.js';
import { getBase, tables } from '../config/database.js';
import { ACTIVITY_TRIGGERS } from '../config/constants.js';

const base = getBase();

// ===== ЗБЕРЕЖЕННЯ МІКРО-ДІЙ =====

// ===== ОНОВЛЕННЯ СТАТУСУ ДІЇ =====
export const updateActionStatus = async (tgId, actionText, status) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.MICRO_ACTIONS || 'MICRO_ACTIONS')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}", {Action_Text}="${actionText}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length > 0) {
      await base(tables.MICRO_ACTIONS || 'MICRO_ACTIONS').update(records[0].id, {
        Status: status,
        Completed_At: status === 'completed' ? new Date().toISOString() : null
      });
      
      console.log(`[activityTracker] ✅ Статус дії оновлено: ${status}`);
      
      // ✅ ПІСЛЯ ОНОВЛЕННЯ - ПЕРЕРАХОВУЄМО СТАТИСТИКУ ДНЯ
      await calculateDailyStats(tgId);
    }
    
  } catch (error) {
    console.error('[updateActionStatus] Помилка:', error);
  }
};

// ===== РОЗРАХУНОК ДЕННОЇ СТАТИСТИКИ =====
export const calculateDailyStats = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[activityTracker] 📊 Розрахунок статистики дня для ${tgId}`);
    
    // 1. Перевіряємо ранкові/вечірні питання
    const responses = await responseService.getUserRecords(tgId, 1);
    const todayResponse = responses.find(r => 
      r.fields?.Date_Response?.startsWith(today)
    );
    
    const morningCompleted = !!todayResponse?.fields?.Q_m_6;
    const eveningCompleted = !!todayResponse?.fields?.Q_e_5;
    const hasVictory = !!todayResponse?.fields?.Q_e_5;
    
    // 2. Підраховуємо мікро-дії
    const actions = await base(tables.MICRO_ACTIONS || 'MICRO_ACTIONS')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`
      })
      .firstPage();
    
    const actionsPlanned = actions.length;
    const actionsCompleted = actions.filter(a => a.fields.Status === 'completed').length;
    const completionRate = actionsPlanned > 0 
      ? Math.round((actionsCompleted / actionsPlanned) * 100) 
      : 0;
    
    // 3. AI взаємодії
    const aiConversations = await base(tables.AI_CONVERSATIONS || 'AI_Conversations')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`
      })
      .firstPage();
    
    // 4. Перевіряємо чи вже є запис за сьогодні
    const existingStats = await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    const statsData = {
      TG_id: String(tgId),
      Date: today,
      Morning_Completed: morningCompleted,
      Evening_Completed: eveningCompleted,
      Actions_Planned: actionsPlanned,
      Actions_Completed: actionsCompleted,
      Completion_Rate: completionRate,
      Has_Victory: hasVictory,
      AI_Interactions: aiConversations.length
    };
    
    // 5. Оновлюємо або створюємо
    if (existingStats.length > 0) {
      await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS').update(existingStats[0].id, statsData);
      console.log(`[activityTracker] 🔄 Оновлено статистику дня`);
    } else {
      await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS').create(statsData);
      console.log(`[activityTracker] ✅ Створено статистику дня`);
    }
    
    console.log(`[activityTracker] 📊 Completion rate: ${completionRate}% (${actionsCompleted}/${actionsPlanned})`);
    
    return {
      completionRate,
      actionsCompleted,
      actionsPlanned,
      hasVictory,
      morningCompleted,
      eveningCompleted
    };
    
  } catch (error) {
    console.error('[calculateDailyStats] Помилка:', error);
    return null;
  }
};

// ===== ВЕЧІРНІЙ ПІДРАХУНОК (викликати після завершення вечірніх питань) =====
// export const finalizeDay = async (tgId) => {
//   try {
//     console.log(`[activityTracker] 🌙 Фіналізація дня для ${tgId}`);
    
//     const stats = await calculateDailyStats(tgId);
    
//     if (!stats) return;
    
//     // Оновлюємо лічильники користувача
//     if (!stats.morningCompleted || !stats.eveningCompleted) {
//       // Пропущений день
//       await updateMissedDays(tgId, true);
//     } else {
//       // День завершено успішно - скидаємо лічильник
//       await updateMissedDays(tgId, false);
//     }
    
//     // Оновлюємо current_activity_ts
// await userService.updateUserActivity(tgId);
    
//     console.log(`[activityTracker] ✅ День фіналізовано`);
//     await badgeService.checkAndAwardBadges(tgId);

//   } catch (error) {
//     console.error('[finalizeDay] Помилка:', error);
//   }
// };
// src/services/activityTracker.js - ВИПРАВЛЕННЯ finalizeDay

// ===== ВЕЧІРНІЙ ПІДРАХУНОК (викликати після завершення вечірніх питань) =====
export const finalizeDay = async (tgId) => {
  try {
    console.log(`[activityTracker] 🌙 Фіналізація дня для ${tgId}`);
    
    const stats = await calculateDailyStats(tgId);
    
    if (!stats) return;
    
    // Оновлюємо лічильники користувача
    if (!stats.morningCompleted || !stats.eveningCompleted) {
      // Пропущений день
      await updateMissedDays(tgId, true);
    } else {
      // День завершено успішно - скидаємо лічильник
      await updateMissedDays(tgId, false);
      
      // ✅ ПЕРЕВІРЯЄМО ТА ПРИСВОЮЄМО БЕЙДЖІ
      console.log(`[activityTracker] 🎖️ Перевірка бейджів після успішного дня`);
      const badgeService = (await import('./badgeService.js')).default;
      await badgeService.checkAndAwardBadges(tgId);
    }
    
    // Оновлюємо current_activity_ts
    await userService.updateUserActivity(tgId);
    
    console.log(`[activityTracker] ✅ День фіналізовано`);

  } catch (error) {
    console.error('[finalizeDay] Помилка:', error);
  }
};
// ===== ПЕРЕВІРКА COMPLETION RATE ЗА ТИЖДЕНЬ =====
export const checkWeeklyCompletionRate = async (tgId) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const stats = await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", IS_AFTER({Date}, "${weekAgoStr}"))`,
        sort: [{ field: 'Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (stats.length === 0) return 0;
    
    // Середній completion rate за тиждень
    const totalRate = stats.reduce((sum, s) => sum + (s.fields.Completion_Rate || 0), 0);
    const avgCompletionRate = Math.round(totalRate / stats.length);
    
    // Дні з перемогами
    const daysWithVictories = stats.filter(s => s.fields.Has_Victory).length;
    const victoryRate = Math.round((daysWithVictories / stats.length) * 100);
    
    console.log(`[activityTracker] 📊 Тижневий аналіз для ${tgId}:`);
    console.log(`  - Completion rate: ${avgCompletionRate}%`);
    console.log(`  - Victory rate: ${victoryRate}%`);
    console.log(`  - Днів з даними: ${stats.length}`);
    
    // Оновлюємо low_activity_weeks якщо < 30%
    if (avgCompletionRate < ACTIVITY_TRIGGERS.LOW_COMPLETION_RATE) {
      await updateLowActivityWeeks(tgId, true);
    } else {
      await updateLowActivityWeeks(tgId, false);
    }
    
    return {
      avgCompletionRate,
      victoryRate,
      totalDays: stats.length,
      daysWithVictories
    };
    
  } catch (error) {
    console.error('[checkWeeklyCompletionRate] Помилка:', error);
    return null;
  }
};

// ===== АНАЛІЗ ТИПУ ПРОБЛЕМИ (для тригерів) =====
export const analyzeProblemType = async (tgId) => {
  try {
    const records = await responseService.getUserRecords(tgId, 14);
    
    if (records.length === 0) return 'no_goals';
    
    let fearCount = 0;
    let noGoalsCount = 0;
    let procrastinationCount = 0;
    
    for (const record of records) {
      const programs = (record.fields?.Q_e_3 || '').toLowerCase();
      const state = (record.fields?.Q_m_5 || '').toLowerCase();
      const goals = record.fields?.Q_m_3 || '';
      
      if (programs.includes('страх') || programs.includes('боюсь') || programs.includes('тривога')) {
        fearCount++;
      }
      
      if (!goals || goals.length < 10) {
        noGoalsCount++;
      }
      
      if (programs.includes('відклад') || programs.includes('не роблю') || state.includes('лінь')) {
        procrastinationCount++;
      }
    }
    
    const max = Math.max(fearCount, noGoalsCount, procrastinationCount);
    
    if (max === 0) return 'no_goals';
    if (fearCount === max) return 'fear';
    if (procrastinationCount === max) return 'low_activity';
    if (noGoalsCount === max) return 'no_goals';
    
    return 'no_goals';
    
  } catch (error) {
    console.error('[analyzeProblemType] Помилка:', error);
    return 'no_goals';
  }
};

// ===== ПЕРЕВІРКА ТРИГЕРІВ БЕЗДІЯЛЬНОСТІ =====
export const checkInactivityTriggers = async (tgId) => {
  try {
    console.log(`[activityTracker] 🔍 Перевірка тригерів для ${tgId}`);
    
    const user = await userService.getUserByTgId(tgId);
    if (!user) return null;
    
    const missedDays = user.work_missed_days || 0;
    const lowActivityWeeks = user.work_low_activity_weeks_count || 0;
    const lastActivity = user.current_activity_ts;
    
    // ТРИГЕР 1: Missed_days >= 2
    if (missedDays >= ACTIVITY_TRIGGERS.MISSED_DAYS_THRESHOLD) {
      console.log(`[activityTracker] ⚠️ Тригер 1: ${missedDays} пропущених днів`);
      
      return {
        level: 1,
        type: 'missed_days',
        message: `Бачу два пропуски поспіль. Все ок?\n\nНазви одну маленьку дію на завтра — я зафіксую.`,
        action: 'mild_reminder',
        showOffer: false
      };
    }
    
    // ТРИГЕР 2: +48 год без реакції
    if (lastActivity) {
      const hoursSinceActive = getHoursSince(lastActivity);
      
      if (hoursSinceActive >= ACTIVITY_TRIGGERS.INACTIVE_HOURS_THRESHOLD) {
        console.log(`[activityTracker] ⚠️ Тригер 2: ${hoursSinceActive} год без активності`);
        
        return {
          level: 2,
          type: 'no_response_48h',
          message: `${user['User Name'] || 'Користувач'}, результат > виправдання.\n\n💡 Пропозиція: 1 дія на 10 хв завтра. Я допоможу інтегрувати.\n\nЯку обираєш?`,
          action: 'direct_reminder',
          showOffer: false
        };
      }
    }
    
    // ТРИГЕР 3: low_activity_weeks >= 2 (ПОКАЗУЄМО ПРОПОЗИЦІЮ)
    if (lowActivityWeeks >= ACTIVITY_TRIGGERS.LOW_ACTIVITY_WEEKS_THRESHOLD) {
      console.log(`[activityTracker] ⚠️ Тригер 3: ${lowActivityWeeks} тижнів низької активності`);
      
      const problemType = await analyzeProblemType(tgId);
      
      return {
        level: 3,
        type: 'low_activity_weeks',
        problemType: problemType,
        message: `Бачу, що ти застрягла. Можу запропонувати допомогу.`,
        action: 'offer_service',
        showOffer: true
      };
    }
    
    console.log(`[activityTracker] ✅ Тригери не спрацювали для ${tgId}`);
    return null;
    
  } catch (error) {
    console.error('[activityTracker] ❌ Помилка перевірки тригерів:', error);
    return null;
  }
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

const getHoursSince = (timestampISO) => {
  try {
    const last = new Date(timestampISO);
    const now = new Date();
    return Math.floor((now - last) / (1000 * 60 * 60));
  } catch (error) {
    return 0;
  }
};

export const updateMissedDays = async (tgId, increment = true) => {
  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) return;
    
    const currentMissed = user.work_missed_days || 0;
    
    await userService.updateUserFields(tgId, {
      work_missed_days: increment ? currentMissed + 1 : 0
    });
    
    console.log(`[activityTracker] ${increment ? '➕' : '🔄'} Missed days для ${tgId}: ${increment ? currentMissed + 1 : 0}`);
    
  } catch (error) {
    console.error('[updateMissedDays] Помилка:', error);
  }
};

export const updateLowActivityWeeks = async (tgId, increment = true) => {
  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) return;
    
    const currentWeeks = user.work_low_activity_weeks_count || 0;
    
    await userService.updateUserFields(tgId, {
      work_low_activity_weeks_count: increment ? currentWeeks + 1 : 0
    });
    
    console.log(`[activityTracker] ${increment ? '➕' : '🔄'} Low activity weeks для ${tgId}: ${increment ? currentWeeks + 1 : 0}`);
    
  } catch (error) {
    console.error('[updateLowActivityWeeks] Помилка:', error);
  }
};

// src/services/activityTracker.js - РОЗКОМЕНТУВАТИ МЕТОД

export const incrementAIInteractions = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Перевіряємо чи є запис за сьогодні
    const existingStats = await base(tables.ACTIVITY_STATS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (existingStats.length > 0) {
      const currentCount = existingStats[0].fields.AI_Interactions || 0;
      await base(tables.ACTIVITY_STATS).update(existingStats[0].id, {
        AI_Interactions: currentCount + 1
      });
    } else {
      await base(tables.ACTIVITY_STATS).create({
        TG_id: String(tgId),
        Date: today,
        AI_Interactions: 1,
        Morning_Completed: false,
        Evening_Completed: false,
        Actions_Planned: 0,
        Actions_Completed: 0,
        Completion_Rate: 0,
        Has_Victory: false
      });
    }
    
    console.log(`[activityTracker] ✅ AI взаємодія зафіксована для ${tgId}`);
    
  } catch (error) {
    console.error('[incrementAIInteractions] Помилка:', error);
  }
};


// src/services/activityTracker.js - ВИПРАВЛЕННЯ saveMicroActions

export const saveMicroActions = async (tgId, actions, conversationId = null) => {
  console.log(`[activityTracker] 💾 Збереження мікро-дій для ${tgId}`);
  console.log(`[activityTracker] - Кількість дій: ${actions?.length || 0}`);
  console.log(`[activityTracker] - Conversation ID: ${conversationId || 'none'}`);
  
  try {
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      console.log(`[activityTracker] ⚠️ Немає дій для збереження`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // ✅ ПРАВИЛЬНИЙ ФОРМАТ: масив об'єктів з полем fields
    const records = actions.map(action => ({
      fields: {
        TG_id: String(tgId),
        Date: today,
        Action_Text: action.action || action.Action_Text || '',
        Time_Planned: action.time || action.Time_Planned || 'будь-коли',
        Duration_Min: action.duration_min || action.Duration_Min || 15,
        Result_Metric: action.result_metric || action.Result_Metric || 'виконано',
        Priority: action.priority || action.Priority || 'середня',
        Status: 'pending',
        Source: 'ai_generated',
        Created_At: new Date().toISOString(),
        // ✅ ЗВ'ЯЗОК З ДІАЛОГОМ (якщо є ID)
        ...(conversationId && { Linked_Conversation: [conversationId] }),
        // ✅ ПОВ'ЯЗАНА ЦІЛЬ (якщо є)
        ...(action.related_goal && { Related_Goal: action.related_goal })
      }
    }));
    
    console.log(`[activityTracker] 📤 Відправка ${records.length} записів до Airtable...`);
    console.log(`[activityTracker] 📝 Перший запис:`, JSON.stringify(records[0], null, 2));
    
    const created = await base(tables.MICRO_ACTIONS).create(records, { typecast: true });
    
    console.log(`[activityTracker] ✅ Збережено ${created.length} мікро-дій`);
    
    return created;
    
  } catch (error) {
    console.error('[activityTracker] ❌ Помилка збереження:', error.message);
    if (error.statusCode) {
      console.error('[activityTracker] Status:', error.statusCode);
    }
    if (error.error) {
      console.error('[activityTracker] Error type:', error.error);
    }
    console.error('[activityTracker] Stack:', error.stack);
  }
};

// src/services/activityTracker.js - ДОДАТИ ЦІ МЕТОДИ

/**
 * ===== СТАТИСТИКА ЗА ОСТАННІ N ДНІВ =====
 */
export const getLastNDaysStats = async (tgId, days = 7) => {
  try {
    console.log(`[activityTracker] 📊 Статистика за останні ${days} днів для ${tgId}`);
    
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    
    const stats = await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", IS_AFTER({Date}, "${dateFromStr}"))`,
        sort: [{ field: 'Date', direction: 'desc' }]
      })
      .all();
    
    const result = stats.map(record => ({
      date: record.fields.Date,
      morningCompleted: record.fields.Morning_Completed || false,
      eveningCompleted: record.fields.Evening_Completed || false,
      actionsPlanned: record.fields.Actions_Planned || 0,
      actionsCompleted: record.fields.Actions_Completed || 0,
      completionRate: record.fields.Completion_Rate || 0,
      hasVictory: record.fields.Has_Victory || false,
      aiInteractions: record.fields.AI_Interactions || 0
    }));
    
    console.log(`[activityTracker] ✅ Отримано ${result.length} днів статистики`);
    
    return result;
    
  } catch (error) {
    console.error('[getLastNDaysStats] Помилка:', error);
    return [];
  }
};

/**
 * ===== ОТРИМАННЯ ЗАГАЛЬНОЇ СТАТИСТИКИ КОРИСТУВАЧА =====
 */
export const getUserTotalStats = async (tgId) => {
  try {
    console.log(`[activityTracker] 📊 Загальна статистика для ${tgId}`);
    
    const allStats = await base(tables.ACTIVITY_STATS || 'ACTIVITY_STATS')
      .select({
        filterByFormula: `{TG_id}="${tgId}"`,
        sort: [{ field: 'Date', direction: 'desc' }]
      })
      .all();
    
    if (allStats.length === 0) {
      return {
        totalDays: 0,
        completedDays: 0,
        totalActionsPlanned: 0,
        totalActionsCompleted: 0,
        avgCompletionRate: 0,
        totalAIInteractions: 0,
        daysWithVictories: 0,
        currentStreak: 0,
        maxStreak: 0
      };
    }
    
    const completedDays = allStats.filter(r => 
      r.fields.Morning_Completed && r.fields.Evening_Completed
    ).length;
    
    const totalActionsPlanned = allStats.reduce((sum, r) => 
      sum + (r.fields.Actions_Planned || 0), 0
    );
    
    const totalActionsCompleted = allStats.reduce((sum, r) => 
      sum + (r.fields.Actions_Completed || 0), 0
    );
    
    const avgCompletionRate = totalActionsPlanned > 0
      ? Math.round((totalActionsCompleted / totalActionsPlanned) * 100)
      : 0;
    
    const totalAIInteractions = allStats.reduce((sum, r) => 
      sum + (r.fields.AI_Interactions || 0), 0
    );
    
    const daysWithVictories = allStats.filter(r => 
      r.fields.Has_Victory
    ).length;
    
    // Розрахунок поточного та максимального streak
    const { currentStreak, maxStreak } = calculateStreaks(allStats);
    
    return {
      totalDays: allStats.length,
      completedDays,
      totalActionsPlanned,
      totalActionsCompleted,
      avgCompletionRate,
      totalAIInteractions,
      daysWithVictories,
      currentStreak,
      maxStreak
    };
    
  } catch (error) {
    console.error('[getUserTotalStats] Помилка:', error);
    return null;
  }
};

/**
 * ===== РОЗРАХУНОК ПОТОЧНОГО ТА МАКСИМАЛЬНОГО STREAK =====
 */
const calculateStreaks = (allStats) => {
  if (allStats.length === 0) return { currentStreak: 0, maxStreak: 0 };
  
  // Сортуємо за датою (найновіші спочатку)
  const sorted = [...allStats].sort((a, b) => 
    new Date(b.fields.Date) - new Date(a.fields.Date)
  );
  
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Розрахунок поточного streak
  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i].fields;
    const recordDate = new Date(record.Date);
    recordDate.setHours(0, 0, 0, 0);
    
    if (!record.Morning_Completed || !record.Evening_Completed) {
      break;
    }
    
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    
    if (recordDate.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Розрахунок максимального streak
  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i].fields;
    
    if (record.Morning_Completed && record.Evening_Completed) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  return { currentStreak, maxStreak };
};

export default {
  saveMicroActions,
  updateActionStatus,
  calculateDailyStats,
  finalizeDay,
  checkWeeklyCompletionRate,
  analyzeProblemType,
  checkInactivityTriggers,
  updateMissedDays,
  updateLowActivityWeeks,
  incrementAIInteractions,
  getLastNDaysStats,       
  getUserTotalStats        

};