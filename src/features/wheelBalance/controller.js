// src/features/wheelBalance/controller.js
// Форматування для відображення
import { wheelService } from './service.js';
import { LIFE_SPHERES } from '../../config/index.js';
import { getNumberEmoji } from '../../config/constantsMisc.js';


export const wheelController = {
  getWheelQuestionBeautiful: (sphere, step) => {
    const totalSteps = LIFE_SPHERES.length;
    const progressPercent = wheelService.getProgressPercent(step);
    const progressBar = wheelService.getProgressBar(progressPercent);
    const question = wheelService.getQuestion(sphere, step);
 
    const stepEmoji = getNumberEmoji(step);
 let message = `📍 Сфера ${stepEmoji}/${totalSteps}: ${sphere.label.toUpperCase()}\n`;
    message += `${progressBar}\n\n`;
    message += `${question.question}\n\n`;
    message += `${question.hint}`;

    return message;
  },
  getWheelInfoSimple: (sphere, step) => {
    const question = wheelService.getQuestion(sphere, step);
    
    return ` ${sphere.emoji} ${sphere.label}
 ${question.emoji} ${question.title}
 ${question.question}
 ${question.hint}
Оціни від 0 до 10: `;
  },

  getWheelQuestionQuick: (sphere, step) => {
    const question = wheelService.getQuestion(sphere, step);
    return `${sphere.emoji} ${question.title}\n\n💭 ${question.hint}`;
  },
};