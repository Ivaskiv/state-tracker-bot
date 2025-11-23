// src/api/aiMentor.js

import { Router } from 'express';
import aiAnalyzer from '../features/aiMentor/analyzer.js';
import airtable from '../config/airtableClient.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/ai-mentor/analyze
 * Проаналізувати стан користувача
 */
router.post('/analyze', async (req, res) => {
  try {
    const { tg_id } = req.body;

    if (!tg_id) {
      return res.status(400).json({
        success: false,
        error: 'tg_id обов\'язковий'
      });
    }

    logger.info('[AI Mentor API] Analysis request', { tg_id });

    // Знайти користувача
    const users = await airtable('Users')
      .select({
        filterByFormula: `{TG_ID} = '${tg_id}'`,
        maxRecords: 1
      })
      .firstPage();

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Користувача не знайдено'
      });
    }

    const userId = users[0].id;

    // Проаналізувати
    const result = await aiAnalyzer.analyzeUser(userId);

    res.json(result);

  } catch (error) {
    logger.error('[AI Mentor API] Analysis error', { 
      error: error.message 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-mentor/should-offer
 * Перевірити чи треба показати пропозицію
 */
router.post('/should-offer', async (req, res) => {
  try {
    const { tg_id } = req.body;

    if (!tg_id) {
      return res.status(400).json({
        success: false,
        error: 'tg_id обов\'язковий'
      });
    }

    // Знайти користувача
    const users = await airtable('Users')
      .select({
        filterByFormula: `{TG_ID} = '${tg_id}'`,
        maxRecords: 1
      })
      .firstPage();

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Користувача не знайдено'
      });
    }

    const userId = users[0].id;

    // Перевірити
    const shouldShow = await aiAnalyzer.shouldShowOffer(userId);

    res.json({
      success: true,
      should_show_offer: shouldShow
    });

  } catch (error) {
    logger.error('[AI Mentor API] Should offer error', { 
      error: error.message 
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;