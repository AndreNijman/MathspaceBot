import { MathspaceAnswer, MathspaceQuestionContext } from '../mathspace/types.js';

export type AnswerMode = 'instant' | 'semi' | 'delayed';

export interface BotStateSnapshot {
  isRunning: boolean;
  mode: AnswerMode;
  answered: number;
  correct: number;
  retries: number;
  lastError?: string;
  activity: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  audSpent: number;
}

export interface QuestionMemoryEntry {
  questionText: string;
  answer: MathspaceAnswer;
}

type Listener = (snapshot: BotStateSnapshot) => void;

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export class BotState {
  private snapshotState: BotStateSnapshot = {
    isRunning: false,
    mode: 'semi',
    answered: 0,
    correct: 0,
    retries: 0,
    lastError: undefined,
    activity: 'Idle',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    audSpent: 0
  };

  private readonly listeners = new Set<Listener>();
  private readonly memory = new Map<string, QuestionMemoryEntry>();

  constructor(private readonly tokenCostAudPer1K = 0.09) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): BotStateSnapshot {
    return { ...this.snapshotState };
  }

  setRunning(isRunning: boolean): void {
    this.snapshotState.isRunning = isRunning;
    this.emit();
  }

  setMode(mode: AnswerMode): void {
    this.snapshotState.mode = mode;
    this.emit();
  }

  setError(message?: string): void {
    this.snapshotState.lastError = message;
    this.emit();
  }

  setActivity(message: string): void {
    this.snapshotState.activity = message;
    this.emit();
  }

  recordTokenUsage(usage?: TokenUsage): void {
    if (!usage) {
      return;
    }
    const prompt = usage.promptTokens ?? 0;
    const completion = usage.completionTokens ?? 0;
    const total = usage.totalTokens ?? prompt + completion;
    this.snapshotState.promptTokens += prompt;
    this.snapshotState.completionTokens += completion;
    this.snapshotState.totalTokens += total;
    const audIncrement = (total / 1000) * this.tokenCostAudPer1K;
    this.snapshotState.audSpent += audIncrement;
    this.emit();
  }

  recordAnswerResult(wasCorrect: boolean): void {
    this.snapshotState.answered += 1;
    if (wasCorrect) {
      this.snapshotState.correct += 1;
    }
    this.emit();
  }

  recordRetry(): void {
    this.snapshotState.retries += 1;
    this.emit();
  }

  rememberAnswer(context: MathspaceQuestionContext, answer: MathspaceAnswer): void {
    const key = this.hashQuestion(context);
    this.memory.set(key, { questionText: context.questionText, answer });
  }

  recallAnswer(context: MathspaceQuestionContext): MathspaceAnswer | undefined {
    const key = this.hashQuestion(context);
    return this.memory.get(key)?.answer;
  }

  private hashQuestion(context: MathspaceQuestionContext): string {
    return `${context.type}::${context.questionText.trim().toLowerCase()}`;
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
