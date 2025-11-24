// src/core/gamification/sync.js
import axios from 'axios';
import { getUserByTgId } from '../../services/users.js';
import { getUserStats } from '../../services/stats.js';
import { getProgressLevel } from './engine.js';

const TILDA_API = process.env.TILDA_API_URL || 'https://your-site.tilda.ws/api';

export const syncToTilda = async (tgId, data) => {
  try {
    await axios.post(`${TILDA_API}/gamification`, {
      tgId,
      timestamp: new Date().toISOString(),
      ...data
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    return true;
  } catch (e) {
    console.error('[gamification/sync]', e.message);
    return false;
  }
};

export const syncFullProfile = async (tgId) => {
  try {
    const user = await getUserByTgId(tgId);
    const stats = await getUserStats(tgId);
    const level = getProgressLevel(user.fields.Total_Points || 0);
    
    const badges = user.fields.Badges 
      ? user.fields.Badges.split(',').map(b => b.trim()).filter(Boolean) 
      : [];
    
    const profileData = {
      tgId,
      userName: user.fields['User_Name'],
      email: user.fields.Email,
      
      // Гейміфікація
      points: user.fields.Total_Points || 0,
      level: level.level,
      levelIcon: level.icon,
      levelName: level.userName,
      levelColor: level.color,
      progress: level.progress,
      nextLevelPoints: level.nextLevel?.pointsRequired || null,
      
      // Бейджі
      badges: badges,
      badgesCount: badges.length,
      
      // Стріки
      currentStreak: user.fields.Current_Streak || 0,
      maxStreak: user.fields.Max_Streak || 0,
      
      // Статистика
      stats: {
        totalActiveDays: stats?.totalActiveDays || 0,
        videosCompleted: stats?.videosCompleted || 0,
        wheelBalanceCompleted: stats?.wheelBalanceCompleted || 0,
        totalAIInteractions: stats?.totalAIInteractions || 0,
        completedSessions: stats?.completedSessions || 0,
        weeklyReportsCompleted: stats?.weeklyReportsCompleted || 0
      },
      
      // Підписка
      subscriptionStatus: user.fields['Subscription_Status'],
      subscriptionPlan: user.fields['Active_Subscription_Plan'],
      subscriptionEndDate: user.fields.End_Date,
      
      // Мета
      lastActivity: user.fields.Last_Activity,
      updatedAt: new Date().toISOString()
    };
    
    await axios.post(`${TILDA_API}/profile`, profileData, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    
    return true;
  } catch (e) {
    console.error('[gamification/syncFull]', e.message);
    return false;
  }
};

export const syncPointsUpdate = async (tgId, points, reason) => {
  try {
    await axios.post(`${TILDA_API}/points`, {
      tgId,
      points,
      reason,
      timestamp: new Date().toISOString()
    }, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    return true;
  } catch (e) {
    console.error('[gamification/syncPoints]', e.message);
    return false;
  }
};

export const syncBadgeAwarded = async (tgId, badgeKey, badgeData) => {
  try {
    await axios.post(`${TILDA_API}/badge`, {
      tgId,
      badgeKey,
      badgeName: badgeData.title,
      badgeIcon: badgeData.icon,
      badgePoints: badgeData.points,
      timestamp: new Date().toISOString()
    }, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    return true;
  } catch (e) {
    console.error('[gamification/syncBadge]', e.message);
    return false;
  }
};

export const syncStreakUpdate = async (tgId, currentStreak, maxStreak) => {
  try {
    await axios.post(`${TILDA_API}/streak`, {
      tgId,
      currentStreak,
      maxStreak,
      timestamp: new Date().toISOString()
    }, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    return true;
  } catch (e) {
    console.error('[gamification/syncStreak]', e.message);
    return false;
  }
};

export const syncLevelUp = async (tgId, newLevel, levelData) => {
  try {
    await axios.post(`${TILDA_API}/levelup`, {
      tgId,
      level: newLevel,
      levelName: levelData.userName,
      levelIcon: levelData.icon,
      timestamp: new Date().toISOString()
    }, {
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TILDA_API_KEY
      }
    });
    return true;
  } catch (e) {
    console.error('[gamification/syncLevelUp]', e.message);
    return false;
  }
};

// Webhook для отримання даних з Tilda
export const handleTildaWebhook = async (req, res) => {
  try {
    const { tgId, action } = req.body;
    
    if (!tgId) {
      return res.status(400).json({ error: 'tgId required' });
    }
    
    switch (action) {
      case 'get_profile':
        await syncFullProfile(tgId);
        res.json({ success: true });
        break;
        
      case 'get_gamification':
        const user = await getUserByTgId(tgId);
        const level = getProgressLevel(user.fields.Total_Points || 0);
        const badges = user.fields.Badges?.split(',').filter(Boolean) || [];
        
        res.json({
          points: user.fields.Total_Points || 0,
          level: level.level,
          levelIcon: level.icon,
          levelName: level.userName,
          badges: badges,
          streak: user.fields.Current_Streak || 0
        });
        break;
        
      default:
        res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[tilda/webhook]', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
};