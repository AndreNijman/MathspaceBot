import { Page } from 'puppeteer';
import { AnswerMode, BotStateSnapshot } from '../state/state.js';
import { logger } from '../util/log.js';

export type PanelCommand =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'refresh' }
  | { type: 'mode'; mode: AnswerMode };

export interface PanelHandlers {
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onModeChange: (mode: AnswerMode) => void;
}

export class PanelApi {
  private initialized = false;

  constructor(private readonly page: Page) {}

  async init(handlers: PanelHandlers): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.page.exposeFunction('mathspaceBotHandleCommand', (command: PanelCommand) => {
      logger.debug('Panel command received', command);
      switch (command.type) {
        case 'start':
          handlers.onStart();
          break;
        case 'stop':
          handlers.onStop();
          break;
        case 'refresh':
          handlers.onRefresh();
          break;
        case 'mode':
          handlers.onModeChange(command.mode);
          break;
        default:
          break;
      }
    });

    this.initialized = true;
  }

  async updatePanel(state: BotStateSnapshot): Promise<void> {
    await this.page.evaluate((panelState) => {
      (globalThis as MathspaceBotPanelBridge | undefined)?.mathspaceBotPanel?.update(panelState);
    }, state);
  }
}

interface MathspaceBotPanelBridge {
  mathspaceBotPanel?: {
    update: (state: BotStateSnapshot) => void;
  };
}
