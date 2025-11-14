// src/funnels/registration/flow.js
import FunnelEngine from '../../core/funnelEngine.js';
import { REGISTRATION_CONFIG, TILDA_PAYLOADS } from './constants.js';
import { validateName, validateEmail } from '../../../utils/validators.js';

const engine = new FunnelEngine(REGISTRATION_CONFIG);

// Почати реєстрацію
export async function startRegistration(ctx, payload) {
  const tgId = ctx.from.id;
  const firstName = ctx.from.first_name;

  // Парсинг Tilda payload
  const meta = TILDA_PAYLOADS[payload] || { source: 'direct' };

  await engine.start(tgId, {
    firstName,
    ...meta,
  });

  return {
    step: 0,
    message: REGISTRATION_CONFIG.messages.name.title,
    keyboard: 'registration_name', // ID клавіатури
  };
}

// Наступний крок
export async function nextStep(ctx, answer) {
  const tgId = ctx.from.id;
  const progress = await engine.getProgress(tgId);
  const currentStep = REGISTRATION_CONFIG.steps[progress.fields.current_step];

  // Валідація
  const validation = validateStep(currentStep.id, answer);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Збереження
  await base(REGISTRATION_CONFIG.table).update(progress.id, {
    [currentStep.field]: validation.value,
  });

  await engine.nextStep(tgId);

  // Наступний крок або завершення
  if (progress.fields.current_step + 1 >= REGISTRATION_CONFIG.steps.length) {
    await engine.complete(tgId, { points: 20 });
    
    // Redirect за payload
    const redirect = progress.fields.metadata?.redirect;
    return {
      completed: true,
      redirect,
      message: REGISTRATION_CONFIG.messages.complete,
    };
  }

  const nextStep = REGISTRATION_CONFIG.steps[progress.fields.current_step + 1];
  return {
    step: progress.fields.current_step + 1,
    message: REGISTRATION_CONFIG.messages[nextStep.id].title,
    keyboard: `registration_${nextStep.id}`,
  };
}

// Валідація кроків
function validateStep(stepId, answer) {
  switch (stepId) {
    case 'name':
      return validateName(answer);
    case 'email':
      return answer === '/skip' ? { valid: true, value: null } : validateEmail(answer);
    case 'timezone':
      return { valid: true, value: answer };
    default:
      return { valid: false, error: 'Unknown step' };
  }
}