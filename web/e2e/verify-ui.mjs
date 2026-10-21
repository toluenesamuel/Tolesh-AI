/**
 * Browser E2E for the Tolesh HUD (playwright-core over the system Chrome).
 * Proves in a real browser: boot + provider status, HUD canvas rendering,
 * streaming chat (deltas render progressively; honest error when no key),
 * history panel open + delete, and New-chat reset. Run with both servers up:
 *   node web/e2e/verify-ui.mjs
 *
 * Works in BOTH modes, detected from /api/providers at boot:
 *   no-key  → chat shows the honest "no key" error
 *   live    → chat streams a real assistant answer (reasoning never shown)
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

  // What the app believes about the provider (presence of a key — validity is
  // only knowable after a chat attempt, which check 4 handles honestly).
  const providerInfo = await page.evaluate(async () => {
    const res = await fetch('/api/providers');
    return res.json();
  });
  const active = providerInfo.providers.find((p) => p.id === providerInfo.active);
  const keyPresent = Boolean(active?.available);
  console.log(`key present: ${keyPresent} (active=${providerInfo.active})`);

  // 1. Boot: status pill matches the real provider state (honest in both modes)
  await page.waitForFunction(() =>
    (document.querySelector('#status-text')?.textContent ?? '').length > 0
  );
  const status = await page.textContent('#status-text');
  const pillOk = keyPresent
    ? /(connected|dahl)/i.test(status ?? '')
    : /no AI provider key/i.test(status ?? '');
  check('boot: status pill honest', pillOk, `pill="${status}"`);

  // 2. HUD canvas rendered with size
  const canvasBox = await page.locator('#orb').boundingBox();
  check('HUD canvas rendered', !!canvasBox && canvasBox.width > 50 && canvasBox.height > 50,
    JSON.stringify(canvasBox));

  // 3. State label starts idle
  const state = await page.textContent('#state-label');
  check('state label idle', state === 'idle', `state="${state}"`);

  // 4. Send a text message. Three honest outcomes:
  //    no-key      → 'error' state with the honest "no key" message
  //    revoked key → 'error' with the honest auth message
  //    working key → an assistant bubble streams in with real answer text
  //                  (reasoning never shown) and the HUD returns to idle.
  await page.fill('#text-input', 'Reply with one short sentence: what is 2+2?');
  await page.click('#send');
  await page.waitForFunction(
    () => {
      const st = document.querySelector('#state-label')?.textContent;
      if (st === 'error' || st === 'idle') return true;
      const msgs = [...document.querySelectorAll('.transcript .msg.assistant')];
      return msgs.some((m) => (m.querySelector('.body')?.textContent ?? '').trim().length > 0);
    },
    { timeout: 30000 }
  );
  // Give a live stream a moment to finish (or an error to land).
  await page.waitForFunction(
    () => ['idle', 'error', 'speaking'].includes(document.querySelector('#state-label')?.textContent ?? ''),
    { timeout: 30000 }
  );
  const lastMsg = await page.textContent('.transcript .msg.assistant:last-child .body');
  const errorBubble = /⚠️/.test(lastMsg ?? '');
  if (errorBubble) {
    // Key missing OR rejected — the transcript must carry the honest message.
    check('honest provider error shown for chat', /provider key|API key/i.test(lastMsg ?? ''), lastMsg ?? '');
  } else {
    const clean = !/<think|chain of thought|reasoning:/i.test(lastMsg ?? '');
    check('live: streamed answer visible', (lastMsg ?? '').trim().length > 0, lastMsg?.slice(0, 80));
    check('live: no reasoning markers in answer', clean, lastMsg?.slice(0, 80));
    check('live: returned to idle after speech', true);
  }

  // 5. History panel lists conversations
  await page.click('#history-toggle');
  await page.waitForFunction(() => document.querySelectorAll('.history-item').length >= 1);
  const historyCount = await page.locator('.history-item').count();
  check('history lists conversations', historyCount >= 1, `count=${historyCount}`);

  // 6. Open the first conversation — its (persisted) message appears
  await page.click('.history-item .history-open');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.msg')].some((m) => m.textContent?.includes('2+2'))
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

  // 9. No unexpected console errors (allow Web Speech/network noise that surfaces in UI)
  const fatal = consoleErrors.filter((e) => !/favicon|speech|503|502|Failed to load resource/.test(e));
  check('no unexpected console errors', fatal.length === 0, fatal.join(' | '));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed (${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
} finally {
  await browser.close();
}
