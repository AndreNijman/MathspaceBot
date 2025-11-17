import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from '../util/log.js';

export interface BrowserSession {
  browser: Browser;
  page: Page;
}

const MATHSPACE_URL = 'https://mathspace.co/accounts/login';

export async function bootstrapBrowser(): Promise<BrowserSession> {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.goto(MATHSPACE_URL, { waitUntil: 'networkidle2' });
  logger.info('Please log in to Mathspace manually, then open the desired task.');

  return { browser, page };
}
