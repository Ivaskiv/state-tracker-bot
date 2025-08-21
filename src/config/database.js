// src/config/database.js
import Airtable from "airtable";
import dotenv from "dotenv";
dotenv.config();

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

export const tables = {
  USERS: "Users",
  SUBSCRIPTIONS: "Subscriptions",
  USER_REFLECTIONS: "User Reflections",
  MORNING_RESPONSES: "Morning_Responses",
  EVENING_RESPONSES: "Evening_Responses",
  AFFIRMATIONS: "Affirmations",
  USER_AFFIRMATIONS: "User Affirmations"
};

export const getBase = () => base;
