import dotenv from 'dotenv';
import { logger } from './log.js';

dotenv.config();

export interface Config {
  mathspaceEmail: string;
  mathspacePassword: string;
  openAiApiKey: string;
  openAiModel: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEFAULT_MODEL = 'gpt-5';

export const config: Config = {
  mathspaceEmail: requireEnv('MATHSPACE_EMAIL'),
  mathspacePassword: requireEnv('MATHSPACE_PASSWORD'),
  openAiApiKey: requireEnv('OPENAI_API_KEY'),
  openAiModel: process.env.OPENAI_MODEL || DEFAULT_MODEL
};

logger.info('Loaded configuration', { model: config.openAiModel });
