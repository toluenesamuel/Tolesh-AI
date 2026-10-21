/**
 * Browser E2E for Tolesh's everyday-assistant features (playwright-core over
 * the system Chrome). Covers what verify-ui.mjs does not: first-run onboarding,
 * the settings panel (persistence across reload, storage-block safety is
 * covered by unit tests), and conversation export. Run with both servers up:
 *   node web/e2e/verify-settings.mjs
 *
 * Mode-independent: works with or without a provider key — the only chat
 * interaction is none; conversations are created via the API.
 */
import { chromium } from 'playwright-core';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});
const tmpDir = await mkdtemp('/tmp/tolesh-e2e-');
try {
  // Fresh context = empty localStorage = genuine first run.
  const context = await browser.newContext({
    viewport: { width: 800, height: 700 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // 1. First-run onboarding is shown when nothing is stored.
  const onboardingShown = await page.locator('#onboarding').isVisible();
  check('onboarding shows on first run', onboardingShown);

  // 2. Dismissing it persists across reload.
  await page.locator('#onboarding-ok').click();
  await page.reload({ waitUntil: 'networkidle' });
  const onboardingGone =
    !(await page.locator('#onboarding').isVisible()) &&
    (await page.evaluate(() => localStorage.getItem('tolesh.onboarded.v1'))) === '1';
  check('onboarding dismissed + never re-shown after reload', onboardingGone);

  // 3. Settings panel opens via the toggle (aria-expanded reflects state).
  await page.locator('#settings-toggle').click();
  const panelOpen = await page.locator('#settings-panel').isVisible();
  const expanded = await page.locator('#settings-toggle').getAttribute('aria-expanded');
  check('settings panel opens, aria-expanded=true', panelOpen && expanded === 'true');

  // 4. Speech toggle persists across reload (localStorage + restored checkbox).
  await page.locator('#setting-speech').uncheck();
  const checkedAfterOff = await page.locator('#setting-speech').isChecked();
  const storedAfterOff = await page.evaluate(() => localStorage.getItem('tolesh.settings.v1'));
  const offPersisted = JSON.parse(storedAfterOff).speechEnabled === false;
  await page.reload({ waitUntil: 'networkidle' });
  const checkedAfterReload = await page.locator('#setting-speech').isChecked();
  check('speech off persists across reload', offPersisted && checkedAfterOff === false && checkedAfterReload === false);

  // 5. Rate slider updates the readout and persists.
  await page.locator('#settings-toggle').click(); // panel is closed again after reload
  await page.locator('#speech-rate').fill('1.5');
  const readout = (await page.locator('#rate-out').textContent()) ?? '';
  const rateStored = await page.evaluate(() => JSON.parse(localStorage.getItem('tolesh.settings.v1') ?? '{}').speechRate);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#settings-toggle').click();
  const rateAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('tolesh.settings.v1') ?? '{}').speechRate);
  const sliderAfterReload = await page.locator('#speech-rate').inputValue();
  check(
    'rate slider updates readout and survives reload',
    readout === '1.5×' && rateStored === 1.5 && rateAfterReload === 1.5 && sliderAfterReload === '1.5'
  );

  // 6. Hands-free persists.
  await page.locator('#hands-free').check();
  const hfStored = await page.evaluate(() => JSON.parse(localStorage.getItem('tolesh.settings.v1') ?? '{}').handsFree);
  await page.reload({ waitUntil: 'networkidle' });
  const hfChecked = await page.locator('#hands-free').isChecked();
  check('hands-free persists across reload', hfStored === true && hfChecked === true);

  // 7. Export downloads valid conversation JSON.
  const convId = await page.evaluate(async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Export check' }),
    });
    return (await res.json()).conversation.id;
  });
  await page.reload({ waitUntil: 'networkidle' });
  const row = page.locator('.history-item', { hasText: 'Export check' });
  await row.waitFor({ state: 'visible', timeout: 5000 });
  const [download] = await Promise.all([page.waitForEvent('download'), row.locator('.history-export').click()]);
  const suggested = download.suggestedFilename();
  const outPath = tmpDir + '/export.json';
  await download.saveAs(outPath);
  const exported = JSON.parse(await readFile(outPath, 'utf8'));
  check(
    'export downloads parseable conversation JSON',
    suggested === `tolesh-${convId}.json` &&
      exported.id === convId &&
      exported.title === 'Export check' &&
      Array.isArray(exported.messages)
  );

  // 8. No console errors across the whole run.
  check('no console errors', consoleErrors.length === 0, consoleErrors[0] ?? '');
} finally {
  await browser.close();
  await rm(tmpDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
