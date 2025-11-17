import { bootstrapBrowser } from './browser/bootstrap.js';
import { injectPanel } from './browser/injectPanel.js';
import { registerPageEvents } from './browser/pageEvents.js';
import { MathspaceDomReader } from './mathspace/domReader.js';
import { MathspaceDomWriter } from './mathspace/domWriter.js';
import { AnswerEngine } from './engine/answerEngine.js';
import { PanelApi } from './ui/panelApi.js';
import { BotState } from './state/state.js';
import { OpenAIClient } from './services/openaiClient.js';
import { config } from './util/config.js';
import { logger } from './util/log.js';

async function main(): Promise<void> {
  const { browser, page } = await bootstrapBrowser();
  registerPageEvents(page);

  const state = new BotState();
  const panelApi = new PanelApi(page);
  const reader = new MathspaceDomReader(page);
  const writer = new MathspaceDomWriter(page);
  const openai = new OpenAIClient(config.openAiApiKey, config.openAiModel);
  const engine = new AnswerEngine({ page, reader, writer, state, openai });

  await panelApi.init({
    onStart: () => void engine.start(),
    onStop: () => void engine.stop(),
    onRefresh: () => void engine.refreshQuestion()
  });

  state.subscribe((snapshot) => {
    void panelApi.updatePanel(snapshot);
  });

  const ensurePanel = async (): Promise<void> => {
    try {
      await injectPanel(page, state.snapshot());
    } catch (error) {
      logger.warn('Panel injection failed', { error });
    }
  };

  await ensurePanel();
  page.on('load', () => {
    void ensurePanel();
  });

  process.on('SIGINT', async () => {
    logger.warn('Received SIGINT, shutting down');
    await engine.stop();
    await browser.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
