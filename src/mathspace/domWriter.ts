import { Page } from 'puppeteer';
import { logger } from '../util/log.js';

const SELECTORS = {
  answerInput: 'input[data-testid="answer-input"], .answer-input input',
  multipleChoiceOption: '[data-testid="choice"], .multiple-choice-option',
  submitButton: 'button[data-testid="submit"], button.submit',
  nextButton: '[data-testid="next-btn"], button.next-question'
};

export class MathspaceDomWriter {
  constructor(private readonly page: Page) {}

  async fillAnswer(answer: string): Promise<void> {
    logger.debug('Filling answer', { answerSnippet: answer.slice(0, 40) });
    await this.page.evaluate(
      async (selectors, value) => {
        const input = document.querySelector<HTMLInputElement>(selectors.answerInput);
        if (input) {
          input.focus();
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 30));
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        const options = Array.from(document.querySelectorAll<HTMLButtonElement>(selectors.multipleChoiceOption));
        const target = options.find((option) => option.textContent?.trim().toLowerCase() === value.trim().toLowerCase());
        target?.click();
      },
      SELECTORS,
      answer
    );
  }

  async submit(): Promise<void> {
    logger.debug('Submitting answer');
    await this.page.evaluate((selectors) => {
      const btn = document.querySelector<HTMLButtonElement>(selectors.submitButton);
      btn?.click();
    }, SELECTORS);
  }

  async goToNextQuestion(): Promise<void> {
    await this.page.evaluate((selectors) => {
      const btn = document.querySelector<HTMLButtonElement>(selectors.nextButton);
      btn?.click();
    }, SELECTORS);
  }
}
