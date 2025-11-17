import { Page } from 'puppeteer';
import { MathspaceDomReader } from '../mathspace/domReader.js';
import { MathspaceDomWriter } from '../mathspace/domWriter.js';
import { MathspaceAnswer, MathspaceFeedback, MathspaceQuestionContext } from '../mathspace/types.js';
import { BotState } from '../state/state.js';
import { logger } from '../util/log.js';
import { OpenAIClient } from '../services/openaiClient.js';
import { resolveModeBehavior, randomDelay } from './modes.js';

const SYSTEM_PROMPT = 'You are a math solver that must return answers only in the exact format the UI expects.';

export interface AnswerEngineOptions {
  page: Page;
  reader: MathspaceDomReader;
  writer: MathspaceDomWriter;
  state: BotState;
  openai: OpenAIClient;
}

export class AnswerEngine {
  private stopRequested = false;
  private loopInFlight = false;

  constructor(private readonly options: AnswerEngineOptions) {}

  async start(): Promise<void> {
    if (this.loopInFlight) {
      this.options.state.setRunning(true);
      this.stopRequested = false;
      return;
    }
    this.stopRequested = false;
    this.options.state.setRunning(true);
    this.loopInFlight = true;
    void this.runLoop();
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.options.state.setRunning(false);
  }

  async refreshQuestion(): Promise<void> {
    const context = await this.options.reader.readQuestionContext();
    if (context) {
      logger.info('Question refreshed', { snippet: context.questionText.slice(0, 60) });
    }
  }

  private async runLoop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await this.processQuestion();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Processing question failed', { message });
        this.options.state.setError(message);
        this.options.state.recordRetry();
        await this.options.page.waitForTimeout(2000);
      }
      await this.options.page.waitForTimeout(250);
    }
    this.loopInFlight = false;
  }

  private async processQuestion(): Promise<void> {
    const context = await this.options.reader.readQuestionContext();
    if (!context) {
      await this.options.page.waitForTimeout(750);
      return;
    }

    const cachedAnswer = this.options.state.recallAnswer(context);
    const answer = cachedAnswer ?? (await this.generateAnswer(context));
    await this.options.writer.fillAnswer(answer.raw);

    const behavior = resolveModeBehavior(this.options.state.snapshot().mode);
    if (behavior.shouldAutoSubmit) {
      const delay = randomDelay(behavior);
      if (delay > 0) {
        await this.options.page.waitForTimeout(delay);
      }
      await this.options.writer.submit();
    }

    const feedback = await this.waitForFeedback(behavior.shouldAutoSubmit ? 8000 : 120000);
    if (feedback) {
      this.options.state.recordAnswerResult(feedback.wasCorrect);
      if (feedback.wasCorrect) {
        this.options.state.rememberAnswer(context, answer);
        this.options.state.setError(undefined);
      } else if (feedback.correctAnswer) {
        this.options.state.rememberAnswer(context, { raw: feedback.correctAnswer, confidence: 1 });
        this.options.state.setError(feedback.feedbackText || 'Incorrect');
      } else {
        this.options.state.setError(feedback.feedbackText || 'Incorrect');
      }
    }

    if (behavior.shouldAutoSubmit) {
      await this.options.writer.goToNextQuestion();
    }

    const advanced = await this.options.reader.waitForQuestionChange(
      context.questionText,
      behavior.shouldAutoSubmit ? 25000 : 120000
    );
    if (!advanced) {
      if (behavior.shouldAutoSubmit) {
        logger.warn('Question did not change after submission');
        this.options.state.setError('Question did not advance');
      } else {
        logger.debug('Awaiting manual submission or navigation');
      }
      return;
    }

    this.options.state.setError(undefined);
  }

  private async generateAnswer(context: MathspaceQuestionContext): Promise<MathspaceAnswer> {
    const prompt = this.composePrompt(context);
    logger.info('Requesting GPT answer', { type: context.type });
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.options.openai.createChatCompletion([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]);
        const parsed = this.parseModelResponse(context, response);
        if (!parsed) {
          throw new Error('Unable to parse OpenAI response');
        }
        return { raw: parsed, confidence: 0.6 };
      } catch (error) {
        logger.warn('OpenAI call failed', {
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });
        if (attempt === attempts) {
          throw error instanceof Error ? error : new Error(String(error));
        }
        await this.sleep(500 * attempt);
      }
    }
    throw new Error('Could not generate answer after multiple attempts');
  }

  private composePrompt(context: MathspaceQuestionContext): string {
    const lines: string[] = [];
    lines.push('Use the following Mathspace question context to determine the answer.');
    lines.push(`Question Type: ${context.type}`);
    lines.push('Question:');
    lines.push(context.questionText);
    if (context.options?.length) {
      lines.push('Options:');
      context.options.forEach((option, index) => {
        const label = String.fromCharCode(65 + index);
        lines.push(`${label}. ${option}`);
      });
      lines.push('Respond with the exact option text or its corresponding letter.');
    } else {
      lines.push('Respond with only the final numeric or textual answer with no explanation.');
    }
    if (context.previousSteps?.length) {
      lines.push('Previous working or hints:');
      context.previousSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    }
    if (context.feedback) {
      lines.push(`Prior feedback: ${context.feedback}`);
    }
    return lines.join('\n');
  }

  private parseModelResponse(context: MathspaceQuestionContext, response: string): string | null {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^Answer:?/i, '').trim();

    if (context.type === 'multiple_choice' && context.options?.length) {
      const letterMatch = cleaned.match(/^([A-Z])/i);
      if (letterMatch) {
        const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        const option = context.options[index];
        if (option) {
          return option;
        }
      }
      const normalized = cleaned.toLowerCase();
      const option = context.options.find((opt) => opt.toLowerCase() === normalized);
      if (option) {
        return option;
      }
    }
    return cleaned || null;
  }

  private async waitForFeedback(timeout: number): Promise<MathspaceFeedback | null> {
    const start = Date.now();
    while (Date.now() - start < timeout && !this.stopRequested) {
      const feedback = await this.options.reader.readFeedback();
      if (feedback) {
        return feedback;
      }
      await this.sleep(400);
    }
    return null;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
