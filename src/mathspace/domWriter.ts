import { Page } from 'puppeteer';
import { logger } from '../util/log.js';

const SELECTORS = {
  mathTextarea: '.mq-editable-field .mq-textarea textarea, [class*="primaryLatexInput"] .mq-textarea textarea',
  multipleChoiceOption: '[role="radiogroup"] [role="radio"], [class*="multipleChoiceOption"], button[role="radio"]',
  submitButton: 'button[data-testid="submit"], button.submit, button[aria-label="Check"]',
  nextButton: '[data-testid="next-btn"], button.next-question'
};

export class MathspaceDomWriter {
  constructor(private readonly page: Page) {}

  async fillAnswer(answer: string): Promise<void> {
    logger.debug('Filling answer', { answerSnippet: answer.slice(0, 40) });
    await this.page.evaluate(
      async (selectors, value) => {
        const input = document.querySelector<HTMLTextAreaElement>(selectors.mathTextarea);
        if (input) {
          input.focus();
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 30));
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
          return;
        }
        const options = Array.from(document.querySelectorAll<HTMLElement>(selectors.multipleChoiceOption));
        const normalized = value.trim().toLowerCase();
        const target = options.find((option) => option.textContent?.trim().toLowerCase() === normalized);
        if (target) {
          target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
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
