// src/api/cabinet.js

import { Router } from 'express';
import cabinetService from '../services/cabinetService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/cabinet/dashboard
 * Отримати дані для кабінету користувача
 * Query: tg_id або email
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { tg_id, email } = req.query;

    if (!tg_id && !email) {
      return res.status(400).json({ 
        success: false,
        error: 'tg_id або email обов\'язкові' 
      });
    }

    logger.info('[Cabinet API] Dashboard request', { tg_id, email });

    const dashboard = await cabinetService.getDashboard({ tg_id, email });

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    logger.error('[Cabinet API] Dashboard error', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cabinet/courses
 * Отримати курси користувача
 */
router.get('/courses', async (req, res) => {
  try {
    const { tg_id } = req.query;

    if (!tg_id) {
      return res.status(400).json({ 
        success: false,
        error: 'tg_id обов\'язковий' 
      });
    }

    const courses = await cabinetService.getUserCourses(tg_id);

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    logger.error('[Cabinet API] Courses error', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cabinet/gamification
 * Отримати статистику геймифікації
 */
router.get('/gamification', async (req, res) => {
  try {
    const { tg_id } = req.query;

    if (!tg_id) {
      return res.status(400).json({ 
        success: false,
        error: 'tg_id обов\'язковий' 
      });
    }

    const gamification = await cabinetService.getGamification(tg_id);

    res.json({
      success: true,
      data: gamification
    });

  } catch (error) {
    logger.error('[Cabinet API] Gamification error', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;