# MathspaceBot

Automates Mathspace question workflows with Puppeteer while delegating answer generation to OpenAI's GPT models. Inspired by the EducationPerfectedAgain architecture but rewritten in TypeScript with a modular structure and floating control panel injected into Mathspace sessions.

## Features
- Opens Mathspace in Chromium and lets you log in manually.
- Injects a draggable overlay with status, counters, and mode selection.
- Three answer modes:
  - **Instant** – auto-fill and submit immediately.
  - **Semi** – fill answers but wait for the user to submit.
  - **Delayed** – auto-submit after a human-like randomized delay.
- Captures question context (stem, options, prior steps, feedback) and crafts GPT prompts.
- Retries OpenAI calls with exponential backoff and caches correct answers locally during the session.
- Tracks correctness/retries and surfaces errors directly in the overlay.

## Prerequisites
- Node.js 18+ (tested with Node 18 and 20; Node 25 works running the compiled JS output).
- npm (ships with Node.js).
- A Mathspace account with active tasks.
- OpenAI API access with the `gpt-5` (or compatible) model enabled.

## Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and add your OpenAI credentials:
   ```env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-5      # optional override
   ```
3. Build and run:
   ```bash
   npm run dev   # compiles TypeScript to dist/ and launches the bot
   ```
   The same compiled output can be launched later with `npm start`.

## Usage Flow
1. A Chromium window opens on the Mathspace login page.
2. Log in manually, navigate to the task you want to automate, and wait for the overlay to appear once the workspace loads.
3. Use the overlay buttons or keyboard shortcuts:
   - `Alt+S` – toggle start/stop.
   - `Alt+R` – refresh question context.
   - `Alt+1/2/3` – Instant/Semi/Delayed modes.
4. When running, the bot reads the current question, calls GPT, and fills the answer according to the selected mode. Errors or feedback are shown in the overlay.

## Project Structure
```
src/
├── main.ts                    # Entry point
├── browser/
│   ├── bootstrap.ts           # Puppeteer launch & login
│   ├── injectPanel.ts         # Overlay injection script
│   └── pageEvents.ts          # Navigation/error logging hooks
├── engine/
│   ├── answerEngine.ts        # GPT prompts, caching, submission loop
│   └── modes.ts               # Instant/Semi/Delayed timing logic
├── mathspace/
│   ├── domReader.ts           # Extract question/options/feedback
│   ├── domWriter.ts           # Fill inputs, click submit/next
│   └── types.ts               # Shared Mathspace structures
├── services/openaiClient.ts   # Minimal Chat Completions wrapper
├── state/state.ts             # In-memory stats & answer cache
├── ui/panelApi.ts             # Bridge between overlay and Node
└── util/
    ├── config.ts              # dotenv-backed config loader
    └── log.ts                 # Colored console logger
```

Selectors inside `mathspace/domReader.ts` and `mathspace/domWriter.ts` are centralized to make future UI adjustments easier.

## Notes & Limitations
- This project does not persist cached answers between runs; memory resets when you restart the bot.
- Selectors are best guesses—tweak them if Mathspace updates its DOM.
- GPT responses are parsed heuristically. For exotic question formats, inspect console logs and adapt `composePrompt`/`parseModelResponse` as required.
- Network access is required both for Mathspace and OpenAI. Failures are logged and counted as retries.

## Scripts
- `npm run dev` – compile TypeScript to `dist/` and execute the app.
- `npm run build` – compile TypeScript only (useful for CI).
- `npm start` – run the already compiled JS in `dist/`.

## Security
- Never commit `.env`. It is gitignored by default. Treat your Mathspace and OpenAI credentials as secrets.

## License
MIT
