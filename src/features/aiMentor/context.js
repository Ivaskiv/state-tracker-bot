// aiMentor/context.js — для AI Mentor
export const buildMorningContext = async (tgId) => {
  try {
    // 1. Отримуємо сьогодняшні відповіді
    const todayResponse = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${todayISO()}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (!todayResponse.length) return null;
    
    const today = todayResponse[0].fields;
    
    // 2. Отримуємо розпарсені дії
    const actions = await base(tables.MICRO_ACTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Date}="${todayISO()}", {Source}="user_input")`,
      })
      .all();
    
    // 3. Отримуємо останню колесо для контексту
    const lastWheel = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        sort: [{ field: 'Completed_Date', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();
    
    return {
      daily_focus: today.Daily_Focus,
      morning_answers: {
        identity: today.Q_m_1,
        strengths: today.Q_m_2,
        state: today.Q_m_5
      },
      planned_actions: actions.map(a => a.fields),
      last_wheel_analysis: lastWheel[0]?.fields.AI_Analysis || null,
      monthly_goals: today.Q_m_4
    };
    
  } catch (error) {
    logger.error('[buildMorningContext] ❌', error);
    return null;
  }
};