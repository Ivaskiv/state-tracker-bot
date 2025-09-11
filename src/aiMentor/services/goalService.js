// src/services/goalService.js

import { getBase, tables } from "../../config/database.js";

const base = getBase();

export const saveGoal = async (tgId, goalText, priority = 5) => {
  try {
    await base(tables.USER_GOALS).create({
      TG_id: String(tgId),
      Goal_Text: goalText,
      Goal_Priority: priority,
      Status: 'active',
      Created_Date: new Date().toISOString()
    });
    console.log(`[goalService] Збережено ціль для ${tgId}`);
  } catch (error) {
    console.error('[goalService] Помилка збереження цілі:', error);
  }
};

export const saveMicroAction = async (tgId, actionText, isAIGenerated = true) => {
  try {
    await base(tables.DAILY_MICRO_ACTIONS).create({
      TG_id: String(tgId),
      Date: new Date().toISOString().split('T')[0],
      Action_Text: actionText,
      AI_Generated: isAIGenerated,
      Completed: false
    });
    console.log(`[goalService] Збережено мікро-дію для ${tgId}`);
  } catch (error) {
    console.error('[goalService] Помилка збереження мікро-дії:', error);
  }
};
