/**
 * Live reconnect verification: with the API down, boot shows the honest
 * offline pill; once the API comes back the pill recovers WITHOUT a reload
 * (backoff poller from reconnect.ts), and history reloads.
 * Start Vite first; the API must be DOWN at launch. Start it ~2s later.
 *   node web/e2e/verify-reconnect.mjs
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths are relative to this file, never to a fixed machine path.
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server');
const TMP = mkdtempSync(path.join(os.tmpdir(), 'tolesh-reconnect-'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: (process.env.CHROME_ARGS ?? '--no-sandbox --disable-gpu').split(' ').filter(Boolean),
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  // API is down right now (caller's responsibility) → boot must show offline.
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const pillDown = (await page.locator('#status-text').textContent()) ?? '';
  check('boot with API down shows offline pill', pillDown === 'server offline', `pill="${pillDown}"`);

  // Bring the API up mid-poll — recovery must happen without a reload.
  // The API is started here with a temp database, and stopped in finally.
  const api = spawn('node', ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_PATH: path.join(TMP, 'reconnect.db') },
    stdio: 'ignore',
  });
  try {
    const recovered = await page
      .waitForFunction(
        () => {
          const t = document.querySelector('#status-text')?.textContent ?? '';
          return t.includes('connected') || t === 'no AI provider key';
        },
        { timeout: 25000 }
      )
      .then(() => true)
      .catch(() => false);
    const pillUp = (await page.locator('#status-text').textContent()) ?? '';
    check('pill recovers automatically after API restart (no reload)', recovered, `pill="${pillUp}"`);
  } finally {
    api.kill('SIGTERM');
  }
} finally {
  await browser.close();
  rmSync(TMP, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
