import dotenv from 'dotenv';
dotenv.config();

export interface AiConfig {
  port: number;
  nodeEnv: string;
  geminiApiKey: string;
  geminiModel: string;
  backendApiUrl: string;
  databaseUrl: string;
}

export const config: AiConfig = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:5000/api/v1',
  databaseUrl: process.env.DATABASE_URL || ''
};

