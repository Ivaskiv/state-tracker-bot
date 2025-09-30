// src/services/smartTaskService.js
export const smartifyTask = async (taskTitle, userContext) => {
  // Перевіряємо наявність часу
  if (!hasTimeIndicator(taskTitle)) {
    const slot = await suggestTimeSlot(userContext);
    taskTitle = addTimeToTask(taskTitle, slot);
  }
  
  // Перевіряємо метрику результату
  if (!hasMetric(taskTitle)) {
    const metric = await suggestMetric(taskTitle);
    taskTitle = addMetricToTask(taskTitle, metric);
  }
  
  // Розбиваємо великі задачі
  if (estimatedDuration(taskTitle) > 25) {
    return splitIntoChunks(taskTitle, 25);
  }
  
  return {
    title: taskTitle,
    planned_minutes: extractDuration(taskTitle),
    result_metric: extractMetric(taskTitle),
    planned_start: extractTime(taskTitle)
  };
};