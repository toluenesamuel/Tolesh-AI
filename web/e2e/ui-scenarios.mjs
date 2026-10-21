/**
 * Browser scenarios against a REAL Tolesh server and a SCRIPTED fake provider.
 * Nothing here calls a model. The fake provider replies with fixed text so
 * the checks are exact:
 *   - reasoning inside the provider reply must never reach the screen, the
 *     saved history, or speech
 *   - a reply cut off by the output limit shows a visible note
 *   - an interrupted stream shows an honest error (no fake "finished" answer)
 *   - the current date reaches the model
 *   - reply mode defaults to 'mirror' (Pidgin is opt-in)
 *
 * Requires a Chromium binary: set CHROME_PATH (and CHROME_ARGS if needed).
 *   CHROME_PATH=/path/to/chrome node web/e2e/ui-scenarios.mjs
 * It starts its own fake provider, API server and Vite dev server on
 * free-looking test ports and stops them at the end.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const webDir = join(here, '..');
const serverDir = join(webDir, '..', 'server');
const FAKE = 9931;
const API = 8797;
const VITE = 5197;
const tmp = mkdtempSync(join(tmpdir(), 'tolesh-ui-'));
const children = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const THINK_OPEN = '<' + 'think' + '>';
const THINK_CLOSE = '</' + 'think' + '>';
const SECRET = 'SECRET-PLAN-XYZ';

/** Scripted provider: the chosen reply depends on a keyword in the last user message. */
function scripted(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  if (/TRUNCATE/.test(last)) {
    return { chunks: ['The first part of the answer ', 'then it stops mid'], finish: 'length' };
  }
  if (/INTERRUPT/.test(last)) {
    return { chunks: ['Partial before the cut '], finish: null, interrupt: true };
  }
  if (/ECHO_SYSTEM/.test(last)) {
    const dateLine = system.split('\n').find((l) => l.startsWith('Current date and time')) ?? 'NO DATE';
    const mode = system.includes('Reply language (Pidgin mode)') ? 'pidgin' : 'mirror';
    return { chunks: [`${dateLine} | mode=${mode}`], finish: 'stop' };
  }
  // Reasoning is split across chunk boundaries on purpose.
  return {
    chunks: [`${THINK_OPEN}${SECRET} step one`, ` step two${THINK_CLOSE}Wetin`, ' dey? Two plus two na four.'],
    finish: 'stop',
  };
}

const fake = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const parsed = JSON.parse(body || '{}');
    const script = scripted(parsed.messages ?? []);
    if (!parsed.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'fake-model', choices: [{ message: { content: script.chunks.join('') }, finish_reason: script.finish }] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const c of script.chunks) {
      res.write(`data: ${JSON.stringify({ model: 'fake-model', choices: [{ delta: { content: c } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 25));
    }
    if (script.interrupt) {
      res.destroy(); // connection drops: no finish_reason, no [DONE]
      return;
    }
    res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: script.finish }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

async function waitForHttp(url, tries = 200) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`not reachable: ${url}`);
}

function start(cmd, args, cwd, env) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  children.push(child);
  return child;
}

let browser;
try {
  await new Promise((r) => fake.listen(FAKE, '127.0.0.1', r));
  start(process.execPath, ['src/index.js'], serverDir, {
    PORT: String(API),
    HOST: '127.0.0.1',
    DB_PATH: join(tmp, 'ui.db'),
    DAHL_API_KEY: 'ui-test-not-a-secret',
    DAHL_BASE_URL: `http://127.0.0.1:${FAKE}/v1`,
    DAHL_MODEL: 'fake-model',
    RATE_LIMIT_PER_MINUTE: '100000',
    MODEL_MAX_RETRIES: '0',
  });
  await waitForHttp(`http://127.0.0.1:${API}/api/health`);
  start(join(webDir, 'node_modules', '.bin', 'vite'), ['--port', String(VITE), '--strictPort', '--host', '127.0.0.1'], webDir, {
    TOLESH_API: `http://127.0.0.1:${API}`,
  });
  await waitForHttp(`http://127.0.0.1:${VITE}/`);

  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: (process.env.CHROME_ARGS ?? '--no-sandbox --disable-gpu').split(' ').filter(Boolean),
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  await page.goto(`http://127.0.0.1:${VITE}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /connected/i.test(document.querySelector('#status-text')?.textContent ?? ''), null, { timeout: 15000 }).then(
    () => check('boot: provider reported connected', true),
    () => check('boot: provider reported connected', false, document.title)
  );

  const send = async (text) => {
    await page.fill('#text-input', text);
    await page.click('#send');
    const settled = await page
      .waitForFunction(() => ['idle', 'error'].includes(document.querySelector('#state-label')?.textContent ?? ''), null, { timeout: 20000 })
      .then(() => true, () => false);
    if (!settled) {
      const diag = await page.evaluate(() => ({
        state: document.querySelector('#state-label')?.textContent,
        bubbles: [...document.querySelectorAll('.transcript .msg')].map((m) => m.className + ': ' + (m.textContent ?? '').slice(0, 90)),
      }));
      console.log('DIAG (send did not settle):', JSON.stringify(diag));
    }
    await page.waitForTimeout(150);
    // The newest assistant bubble that is not an error note.
    return page.evaluate(() => {
      const bubbles = [...document.querySelectorAll('.transcript .msg.assistant')].filter((m) => !m.classList.contains('error-msg'));
      return bubbles.at(-1)?.querySelector('.body')?.textContent ?? '';
    });
  };

  // 1. Reasoning never reaches the screen, split across stream chunks.
  const answer = await send('Explain two plus two.');
  check('reasoning: answer shown exactly', answer.trim() === 'Wetin dey? Two plus two na four.', JSON.stringify(answer));
  const pageText = await page.evaluate(() => document.body.innerText);
  check('reasoning: nothing from the provider reasoning in the page', !pageText.includes(SECRET) && !pageText.includes('step one'));

  // 2. Saved history matches what was displayed (persistence and display agree).
  const convs = await page.evaluate(async () => (await (await fetch('/api/conversations')).json()).conversations);
  const latest = convs[0];
  const stored = await page.evaluate(async (id) => (await (await fetch(`/api/conversations/${id}`)).json()).conversation.messages, latest.id);
  const storedReply = stored.filter((m) => m.role === 'assistant').at(-1)?.content ?? '';
  check('history: stored reply equals displayed reply', storedReply.trim() === answer.trim(), JSON.stringify(storedReply));
  check('history: stored reply has no reasoning', !storedReply.includes(SECRET) && !storedReply.includes('<think'));

  // 3. Truncated reply: partial text is shown and the user is told.
  const cut = await send('Please TRUNCATE this answer.');
  check('truncated: partial text shown', cut.includes('The first part of the answer'), JSON.stringify(cut.slice(0, 80)));
  const note = await page.evaluate(() => [...document.querySelectorAll('.transcript .msg')].some((m) => /cut off before it finished/.test(m.textContent ?? '')));
  check('truncated: visible cut-off note', note);

  // 4. Interrupted stream: an honest error, not a silent "finished" answer.
  const broke = await send('Now INTERRUPT the stream.');
  const errorShown = await page.evaluate(() => [...document.querySelectorAll('.transcript .msg')].some((m) => /interrupted before it finished/.test(m.textContent ?? '')));
  check('interrupted: honest error shown', errorShown, JSON.stringify(broke.slice(0, 60)));
  check('interrupted: partial text stays visible', broke.includes('Partial before the cut'));
  // The app shows 'error' for ~2.5 s, then returns to idle. Measure that, do not assume it.
  const recovered = await page
    .waitForFunction(() => document.querySelector('#state-label')?.textContent === 'idle', null, { timeout: 6000 })
    .then(() => true, () => false);
  const stateAfter = await page.textContent('#state-label');
  check('interrupted: UI recovers to idle within 6 s', recovered, `state=${stateAfter}`);
  const inputEnabled = await page.isEnabled('#text-input');
  check('interrupted: input is usable again', inputEnabled);

  // 5. Date context and reply mode, as the model received them.
  const echo = await send('ECHO_SYSTEM what is the date');
  const year = echo.match(/\d{4}/)?.[0];
  check('date: current date reached the model', /Current date and time: .*2026/.test(echo) && year === '2026', JSON.stringify(echo.slice(0, 120)));
  check('mode: default reply mode is mirror (Pidgin is opt-in)', echo.includes('mode=mirror'), echo.slice(-30));

  // 6. No unexpected console errors (speech APIs are absent in this headless browser).
  const fatal = consoleErrors.filter((e) => !/favicon|speech|503|502|Failed to load resource|interrupted|NetworkError|net::ERR/.test(e));
  check('no unexpected console errors', fatal.length === 0, fatal.join(' | ').slice(0, 200));
} catch (err) {
  check('scenario run completed', false, String(err?.message ?? err).slice(0, 300));
} finally {
  await browser?.close().catch(() => {});
  for (const c of children) c.kill('SIGTERM');
  fake.close();
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed.`);
console.log('UNVERIFIED here: real speech output and recognition (no speech engine in this headless browser).');
process.exit(failed === 0 ? 0 : 1);
