// src/utils/progress.js
export const getProgressBar = (percent) => {
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;

  if (percent === 0) return '░░░░░░░░░░ 0%';
  if (percent === 100) return '██████████ 100%';

  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
};