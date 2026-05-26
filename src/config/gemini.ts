import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('[gemini]: GEMINI_API_KEY is missing in environment');
  process.exit(1);
}

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const genAI = new GoogleGenAI({ apiKey });

export default genAI;
