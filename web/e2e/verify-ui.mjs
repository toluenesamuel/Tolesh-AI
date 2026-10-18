/**
 * Browser E2E for the Tolesh HUD (playwright-core over the system Chrome).
 * Proves in a real browser: boot + provider status, HUD canvas rendering,
 * sending a text message → honest no_key error, history panel open + delete,
 * and New-chat reset. Run with both servers up:
 *   node web/e2e/verify-ui.mjs
 */
import { chromium } from 'playwright-core';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // 1. Boot: status pill shows the honest no-key state
  await page.waitForFunction(() =>
    (document.querySelector('#status-text')?.textContent ?? '').length > 0
  );
  const status = await page.textContent('#status-text');
  check('boot: status pill', /no AI provider key/i.test(status ?? ''), `pill="${status}"`);

  // 2. HUD canvas rendered with size
  const canvasBox = await page.locator('#orb').boundingBox();
  check('HUD canvas rendered', !!canvasBox && canvasBox.width > 50 && canvasBox.height > 50,
    JSON.stringify(canvasBox));

  // 3. State label starts idle
  const state = await page.textContent('#state-label');
  check('state label idle', state === 'idle', `state="${state}"`);

  // 4. Send a text message → state flips to 'error' (chat path only) and the
  // honest no_key message lands as the LAST transcript bubble
  await page.fill('#text-input', 'you dey?');
  await page.click('#send');
  await page.waitForFunction(() => document.querySelector('#state-label')?.textContent === 'error', {
    timeout: 10000,
  });
  const lastMsg = await page.textContent('.transcript .msg:last-child');
  check('honest no_key error shown for chat', /provider key/i.test(lastMsg ?? ''), lastMsg ?? '');

  // 5. History panel lists conversations
  await page.click('#history-toggle');
  await page.waitForFunction(() => document.querySelectorAll('.history-item').length >= 1);
  const historyCount = await page.locator('.history-item').count();
  check('history lists conversations', historyCount >= 1, `count=${historyCount}`);

  // 6. Open the first conversation — its (persisted) message appears
  await page.click('.history-item .history-open');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.msg')].some((m) => m.textContent?.includes('you dey?'))
  );
  check('open conversation loads persisted messages', true);

  // 7. Delete flow: arm, then confirm; list shrinks
  const before = await page.locator('.history-item').count();
  await page.click('.history-item .history-delete'); // arm
  await page.click('.history-item .history-delete'); // confirm
  await page.waitForFunction(
    (n) => document.querySelectorAll('.history-item').length < n,
    before
  );
  check('delete removes conversation from history', true);

  // 8. New chat clears transcript
  await page.click('#new-chat');
  const transcriptLen = await page.locator('#transcript .msg').count();
  check('new chat clears transcript', transcriptLen === 0, `msgs=${transcriptLen}`);

  // 9. No unexpected console errors (allow Web Speech/network 503 which surface in UI)
  const fatal = consoleErrors.filter((e) => !/favicon|speech|503|Failed to load resource/.test(e));
  check('no unexpected console errors', fatal.length === 0, fatal.join(' | '));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`.replace('failed', `${failed}`));
  process.exit(failed === 0 ? 0 : 1);
} finally {
  await browser.close();
}
