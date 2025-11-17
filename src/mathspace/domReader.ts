import { Page } from 'puppeteer';
import { logger } from '../util/log.js';
import { MathspaceFeedback, MathspaceQuestionContext, MathspaceQuestionType } from './types.js';

const SELECTORS = {
  taskRoot: '[data-testid="workspace-root"], .workspace-container',
  questionStem: '[data-testid="question"]',
  answerInput: 'input[data-testid="answer-input"], .answer-input input',
  multipleChoiceOption: '[data-testid="choice"], .multiple-choice-option',
  workingStep: '[data-testid="working-step"]',
  feedbackBanner: '[data-testid="feedback"], .feedback-message',
  correctionText: '[data-testid="correct-answer"], .correct-answer',
  nextQuestionButton: '[data-testid="next-btn"], button.next-question'
};

export class MathspaceDomReader {
  constructor(private readonly page: Page) {}

  async ensureInsideTask(): Promise<boolean> {
    try {
      await this.page.waitForSelector(SELECTORS.taskRoot, { timeout: 10000 });
      logger.info('Detected Mathspace task workspace');
      return true;
    } catch (error) {
      logger.warn('Unable to confirm Mathspace task view', { error });
      return false;
    }
  }

  async readQuestionContext(): Promise<MathspaceQuestionContext | null> {
    const context = await this.page.evaluate((selectors) => {
      const stem = document.querySelector(selectors.questionStem);
      if (!stem) {
        return null;
      }
      const questionText = stem.textContent?.trim() || '';
      const optionNodes = Array.from(document.querySelectorAll(selectors.multipleChoiceOption));
      const options = optionNodes
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);
      const previousSteps = Array.from(document.querySelectorAll(selectors.workingStep))
        .map((node) => (node.textContent || '').trim())
        .filter(Boolean);

      const feedbackNode = document.querySelector(selectors.feedbackBanner);
      const feedback = feedbackNode?.textContent?.trim() || null;

      let type: MathspaceQuestionType = 'short_answer';
      if (options.length > 0) {
        type = 'multiple_choice';
      } else if (previousSteps.length > 0) {
        type = 'steps';
      }

      return {
        type,
        questionText,
        options: options.length ? options : undefined,
        previousSteps: previousSteps.length ? previousSteps : undefined,
        feedback
      } satisfies MathspaceQuestionContext;
    }, SELECTORS);

    if (!context) {
      logger.warn('Failed to read question context');
      return null;
    }

    logger.debug('Question context captured', {
      questionSnippet: context.questionText.slice(0, 80),
      type: context.type
    });
    return context;
  }

  async readFeedback(): Promise<MathspaceFeedback | null> {
    const feedback = await this.page.evaluate((selectors) => {
      const feedbackNode = document.querySelector(selectors.feedbackBanner);
      const correctionNode = document.querySelector(selectors.correctionText);
      if (!feedbackNode) {
        return null;
      }
      const text = feedbackNode.textContent?.trim() || '';
      const wasCorrect = /correct/i.test(text) && !/incorrect/i.test(text);
      return {
        wasCorrect,
        feedbackText: text,
        correctAnswer: correctionNode?.textContent?.trim()
      } satisfies MathspaceFeedback;
    }, SELECTORS);

    return feedback;
  }

  async waitForQuestionChange(previousQuestionText: string, timeout = 20000): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        (
          selectors,
          previous
        ) => {
          const stem = document.querySelector(selectors.questionStem);
          const text = stem?.textContent?.trim() || '';
          return text && text !== previous;
        },
        { timeout },
        SELECTORS,
        previousQuestionText
      );
      return true;
    } catch {
      return false;
    }
  }
}
