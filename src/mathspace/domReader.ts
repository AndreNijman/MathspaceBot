import { Page } from 'puppeteer';
import { logger } from '../util/log.js';
import { MathspaceFeedback, MathspaceQuestionContext, MathspaceQuestionType } from './types.js';

const SELECTORS = {
  taskRoot: '#react-app-hook',
  questionHeader: '[class*="ProblemHeaderRightColumn"]',
  subproblem: 'div[class^="subproblem"]',
  optionCandidates: ['[role="radiogroup"] [role="radio"]', 'button[role="radio"]', '[class*="multipleChoiceOption"]'],
  workingStep: '[data-testid="working-step"]',
  feedbackBanner: '[data-testid="feedback"], .feedback-message, [class*="feedbackMessage"]',
  correctionText: '[data-testid="correct-answer"], .correct-answer, [class*="correctAnswer"]'
} as const;

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
      const headerNode = document.querySelector<HTMLElement>(selectors.questionHeader);
      const headerText = headerNode?.textContent?.trim() || '';

      const subproblemNodes = Array.from(document.querySelectorAll<HTMLElement>(selectors.subproblem));
      const subproblemText = subproblemNodes
        .map((node) => {
          const clone = node.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('button, svg').forEach((element) => element.remove());
          return clone.textContent?.replace(/\b(Help|Lesson|Calculator)\b/gi, '').trim();
        })
        .filter(Boolean)
        .join('\n');

      const questionText = [headerText, subproblemText].filter(Boolean).join('\n\n').trim();
      if (!questionText) {
        return null;
      }

      const optionsSet = new Set<string>();
      selectors.optionCandidates.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
          const text = node.textContent?.trim();
          if (text) {
            optionsSet.add(text);
          }
        });
      });
      const options = Array.from(optionsSet);

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
          const header = document.querySelector(selectors.questionHeader);
          const subproblem = document.querySelector(selectors.subproblem);
          const headerText = header?.textContent?.trim() || '';
          const subText = subproblem?.textContent?.trim() || '';
          const text = [headerText, subText].filter(Boolean).join('\n').trim();
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
