import { Page } from 'puppeteer';
import { logger } from '../util/log.js';

export function registerPageEvents(page: Page): void {
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      logger.info('Navigation', { url: frame.url() });
    }
  });

  page.on('load', () => logger.debug('Page load event fired'));
  page.on('error', (error) => logger.error('Page error', { error }));
  page.on('pageerror', (error) => logger.error('Page runtime error', { error }));
}
