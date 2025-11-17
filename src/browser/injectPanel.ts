import { Page } from 'puppeteer';
import { BotStateSnapshot } from '../state/state.js';
import { logger } from '../util/log.js';

type PanelCommandPayload =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'refresh' }
  | { type: 'mode'; mode: 'instant' | 'semi' | 'delayed' };

interface PanelBridgeWindow extends Window {
  mathspaceBotPanel?: {
    update: (state: BotStateSnapshot) => void;
  };
  mathspaceBotHandleCommand?: (command: PanelCommandPayload) => void;
}

const PANEL_BOOTSTRAP = (initialState: BotStateSnapshot): void => {
  const globalWindow = window as PanelBridgeWindow;

  const installPanel = (): void => {
    if (globalWindow.mathspaceBotPanel) {
      globalWindow.mathspaceBotPanel.update(initialState);
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'mathspace-bot-panel';
    panel.style.position = 'fixed';
    panel.style.top = '16px';
    panel.style.right = '16px';
    panel.style.zIndex = '999999';
    panel.style.background = 'rgba(8, 11, 19, 0.92)';
    panel.style.color = '#fff';
    panel.style.padding = '12px';
    panel.style.borderRadius = '8px';
    panel.style.width = '240px';
    panel.style.fontFamily = 'Inter, Arial, sans-serif';
    panel.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)';
    panel.style.cursor = 'grab';

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    panel.addEventListener('mousedown', (event) => {
      if ((event.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      dragOffsetX = event.clientX - panel.getBoundingClientRect().left;
      dragOffsetY = event.clientY - panel.getBoundingClientRect().top;
      panel.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (event) => {
      if (!isDragging) return;
      panel.style.left = `${event.clientX - dragOffsetX}px`;
      panel.style.top = `${event.clientY - dragOffsetY}px`;
      panel.style.right = 'auto';
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.cursor = 'grab';
    });

    const statusEl = document.createElement('div');
    statusEl.style.fontSize = '12px';
    statusEl.style.opacity = '0.75';

    const countersEl = document.createElement('div');
    countersEl.style.marginTop = '4px';
    countersEl.style.fontSize = '13px';
    countersEl.style.whiteSpace = 'pre-line';

    const buttonsRow = document.createElement('div');
    buttonsRow.style.display = 'flex';
    buttonsRow.style.gap = '4px';
    buttonsRow.style.marginTop = '8px';

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Start';
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';

    [toggleBtn, refreshBtn].forEach((btn) => {
      btn.style.flex = '1';
      btn.style.padding = '6px';
      btn.style.border = 'none';
      btn.style.borderRadius = '4px';
      btn.style.background = '#3f77ff';
      btn.style.color = '#fff';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
    });

    refreshBtn.style.background = '#3f3f46';

    const triggerCommand = (command: PanelCommandPayload): void => {
      globalWindow.mathspaceBotHandleCommand?.(command);
    };

    toggleBtn.addEventListener('click', () => {
      const action: PanelCommandPayload['type'] = currentState.isRunning ? 'stop' : 'start';
      triggerCommand({ type: action } as PanelCommandPayload);
    });
    refreshBtn.addEventListener('click', () => triggerCommand({ type: 'refresh' }));

    const modeRow = document.createElement('div');
    modeRow.style.display = 'flex';
    modeRow.style.gap = '4px';
    modeRow.style.marginTop = '8px';

    const modes: Array<{ key: 'instant' | 'semi' | 'delayed'; label: string }> = [
      { key: 'instant', label: 'Instant' },
      { key: 'semi', label: 'Semi' },
      { key: 'delayed', label: 'Delayed' }
    ];

    modes.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.mode = key;
      btn.style.flex = '1';
      btn.style.padding = '6px';
      btn.style.border = '1px solid #52525b';
      btn.style.borderRadius = '4px';
      btn.style.background = 'transparent';
      btn.style.color = '#fff';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => triggerCommand({ type: 'mode', mode: key }));
      modeRow.appendChild(btn);
    });

    panel.append(statusEl, countersEl, buttonsRow, modeRow);
    buttonsRow.append(toggleBtn, refreshBtn);
    document.body?.appendChild(panel);

    const setModeButtonState = (mode: string): void => {
      modeRow.querySelectorAll('button').forEach((btn) => {
        if (btn instanceof HTMLButtonElement) {
          const active = btn.dataset.mode === mode;
          btn.style.background = active ? '#2563eb' : 'transparent';
        }
      });
    };

    let currentState = initialState;

    window.addEventListener('keydown', (event) => {
      if (!event.altKey) return;
      switch (event.key.toLowerCase()) {
        case 'r':
          triggerCommand({ type: 'refresh' });
          break;
        case 's':
          triggerCommand({ type: currentState.isRunning ? 'stop' : 'start' });
          break;
        case '1':
          triggerCommand({ type: 'mode', mode: 'instant' });
          break;
        case '2':
          triggerCommand({ type: 'mode', mode: 'semi' });
          break;
        case '3':
          triggerCommand({ type: 'mode', mode: 'delayed' });
          break;
        default:
          return;
      }
      event.preventDefault();
    });

    const updatePanel = (state: BotStateSnapshot): void => {
      currentState = state;
      const modeLabel = state.mode.charAt(0).toUpperCase() + state.mode.slice(1);
      const statusLabel = state.isRunning ? 'Running' : 'Idle';
      statusEl.textContent = `Status: ${statusLabel} | Mode: ${modeLabel}`;
      countersEl.textContent = `Answered ${state.answered} • Correct ${state.correct} • Retries ${state.retries}`;
      setModeButtonState(state.mode);
      if (state.lastError) {
        countersEl.textContent += `\nError: ${state.lastError}`;
      }
      toggleBtn.textContent = state.isRunning ? 'Stop' : 'Start';
      toggleBtn.style.background = state.isRunning ? '#ff5d5d' : '#3f77ff';
    };

    globalWindow.mathspaceBotPanel = {
      update: updatePanel
    };

    updatePanel(initialState);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPanel, { once: true });
  } else {
    installPanel();
  }
};

export async function injectPanel(page: Page, initialState: BotStateSnapshot): Promise<void> {
  await page.evaluate(PANEL_BOOTSTRAP, initialState);
  logger.info('Panel injected');
}
