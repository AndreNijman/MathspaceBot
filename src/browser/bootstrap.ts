import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../util/config.js';
import { logger } from '../util/log.js';

export interface BrowserSession {
  browser: Browser;
  page: Page;
}

const LOGIN_URL = 'https://mathspace.co/login';

export async function bootstrapBrowser(): Promise<BrowserSession> {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
  await performLogin(page);

  logger.info('Logged into Mathspace');
  return { browser, page };
}

async function performLogin(page: Page): Promise<void> {
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.type('input[type="email"]', config.mathspaceEmail, { delay: 25 });
  await page.type('input[type="password"]', config.mathspacePassword, { delay: 25 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
}
