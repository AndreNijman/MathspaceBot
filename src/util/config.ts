import dotenv from 'dotenv';
import { logger } from './log.js';

dotenv.config();

export interface Config {
  openAiApiKey: string;
  openAiModel: string;
  openAiTokenCostAudPer1K: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_AUD_PER_1K = 0.09;

function parseNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    logger.warn(`Invalid number for ${name}, falling back to default`);
    return fallback;
  }
  return parsed;
}

export const config: Config = {
  openAiApiKey: requireEnv('OPENAI_API_KEY'),
  openAiModel: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  openAiTokenCostAudPer1K: parseNumberEnv('OPENAI_AUD_PER_1K_TOKENS', DEFAULT_AUD_PER_1K)
};

logger.info('Loaded configuration', { model: config.openAiModel });
