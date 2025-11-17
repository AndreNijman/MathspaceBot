import { AnswerMode } from '../state/state.js';

export interface ModeBehavior {
  shouldAutoSubmit: boolean;
  minDelayMs: number;
  maxDelayMs: number;
}

export function resolveModeBehavior(mode: AnswerMode): ModeBehavior {
  switch (mode) {
    case 'instant':
      return { shouldAutoSubmit: true, minDelayMs: 0, maxDelayMs: 0 };
    case 'semi':
      return { shouldAutoSubmit: false, minDelayMs: 0, maxDelayMs: 0 };
    case 'delayed':
      return { shouldAutoSubmit: true, minDelayMs: 800, maxDelayMs: 2500 };
    default:
      return { shouldAutoSubmit: false, minDelayMs: 0, maxDelayMs: 0 };
  }
}

export function randomDelay(behavior: ModeBehavior): number {
  if (behavior.minDelayMs === 0 && behavior.maxDelayMs === 0) {
    return 0;
  }
  const { minDelayMs, maxDelayMs } = behavior;
  return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}
