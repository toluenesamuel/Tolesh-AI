// Browser tests for the phone probe after the cloud replaced the orb.
// Serves spikes/phone-probe only. Headless Chromium with a fake microphone and test tone.
// Run from spikes/cloud-avatar/e2e:  LD_LIBRARY_PATH=/tmp/chromium-libs/lib node --test probe.browser.test.mjs
import { test, before, after, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const PROBE = join(here, '..', '..', 'phone-probe');
const SHOTS = join(here, '..', 'stills', 'browser');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

let server, browser, base;
const pagesOpened = [];

before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    const file = normalize(join(PROBE, rel));
    if (!file.startsWith(PROBE + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      statSync(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [
      ...chromium.args,
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: '/tmp/chromium-libs/lib' },
  });
});

after(async () => {
  for (const p of pagesOpened) await p.close().catch(() => {});
  await browser?.close();
  server?.close();
});

// Close every page after each test, so frame loops from earlier tests do not compete for the CPU.
afterEach(async () => {
  while (pagesOpened.length) await pagesOpened.pop().close().catch(() => {});
});

async function open({ reduced = false } = {}) {
  const page = await browser.newPage();
  pagesOpened.push(page);
  await page.bringToFront();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  page.errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text());
  });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => {
    if (!r.url().startsWith(base)) page.errors.push(`external request ${r.url()}`);
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#orb [data-k=body]');
  await new Promise((r) => setTimeout(r, 600));
  return page;
}

async function closeAll() {
  while (pagesOpened.length) await pagesOpened.pop().close().catch(() => {});
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pose(page) {
  return page.evaluate(() => {
    const q = (k) => document.querySelector(`#orb [data-k=${k}]`);
    return {
      body: q('body').getAttribute('transform'),
      mouthRy: Number(q('mouthOpen').getAttribute('ry')),
      mouthOpacity: Number(q('mouthOpen').getAttribute('fill-opacity')),
      glow: Number(q('glowCyan').getAttribute('fill-opacity')),
    };
  });
}

async function setMode(page, mode) {
  await page.click(`[data-mode=${mode}]`);
  await sleep(250);
}

describe('probe: the cloud renders and the controls work', () => {
  test('loads with no console errors, no external requests, and a drawn cloud', async () => {
    const page = await open();
    const shape = await page.evaluate(() => document.querySelectorAll('#orb [data-k]').length);
    // 14 keyed parts: body, ground, glows, both lids and lid edges, brows, gaze groups, smile, mouth.
    assert.equal(shape, 14, `cloud markup drawn, ${shape} keyed parts`);
    assert.deepEqual(page.errors, [], page.errors.join(' | '));
  });

  test('each mode button selects its state and changes the label', async () => {
    const page = await open();
    const expect = { idle: 'Idle', listening: 'Listening', processing: 'Processing', speaking: 'Speaking', acting: 'Acting', error: 'Error' };
    for (const [mode, label] of Object.entries(expect)) {
      await setMode(page, mode);
      const got = await page.evaluate(() => ({
        pressed: document.querySelector(`.modes [data-mode=${document.getElementById('stage').dataset.mode}]`)?.getAttribute('aria-pressed'),
        status: document.getElementById('status').textContent,
      }));
      assert.equal(got.pressed, 'true', `${mode} button pressed`);
      assert.equal(got.status, label, `${mode} label`);
    }
    assert.deepEqual(page.errors, [], page.errors.join(' | '));
  });

  test('error explains itself calmly and says how to clear it', async () => {
    const page = await open();
    await setMode(page, 'error');
    const detail = await page.$eval('#statusDetail', (e) => e.textContent);
    assert.ok(/did not work/.test(detail) && /Tap Idle/.test(detail), detail);
    assert.ok(!/fail|error|fault|your fault/i.test(detail.replace('Error', '')), 'does not blame the user');
  });

  test('speaking with no real audio keeps the mouth closed (no faked speech)', async () => {
    const page = await open();
    await setMode(page, 'speaking');
    await sleep(1500);
    const p = await pose(page);
    assert.equal(p.mouthOpacity, 0, `mouth opacity with no audio ${p.mouthOpacity}`);
    assert.ok(/no audio/i.test(await page.$eval('#statusDetail', (e) => e.textContent)));
  });

  test('simulated reply moves the mouth from the real output analyser, and stops with it', async () => {
    const page = await open();
    await setMode(page, 'speaking');
    await page.click('#simBtn');
    const seen = [];
    for (let i = 0; i < 25; i++) {
      await sleep(120);
      seen.push((await pose(page)).mouthRy);
    }
    const range = Math.max(...seen) - Math.min(...seen);
    assert.ok(range > 1, `mouth moves with the test voice, range ${range}`);
    assert.equal(await page.$eval('#voiceState', (e) => e.textContent), 'playing');
    await page.click('#simStop');
    await sleep(800);
    const after = await pose(page);
    assert.equal(after.mouthOpacity, 0, 'mouth closes when the reply stops');
    assert.deepEqual(page.errors, [], page.errors.join(' | '));
  });

  test('microphone: starting it turns the level on, and listening reacts to it', async () => {
    const page = await open();
    await setMode(page, 'listening');
    await sleep(400);
    const idleGlow = (await pose(page)).glow;
    await page.click('#micOn');
    await sleep(2500);
    const micState = await page.$eval('#micState', (e) => e.textContent);
    const levelText = await page.$eval('#levelText', (e) => e.textContent);
    assert.equal(micState, 'on', `mic state ${micState}`);
    assert.ok(/rms/.test(levelText), levelText);
    const glows = [];
    for (let i = 0; i < 15; i++) {
      await sleep(100);
      glows.push((await pose(page)).glow);
    }
    const glowRange = Math.max(...glows) - Math.min(...glows);
    assert.ok(glowRange > 0.01 || Math.max(...glows) > idleGlow, `glow follows the mic, range ${glowRange}, idle ${idleGlow}`);
    await page.click('#micOff');
    assert.deepEqual(page.errors, [], page.errors.join(' | '));
  });

  test('pause freezes the cloud, and resume moves it again', async () => {
    const page = await open();
    await setMode(page, 'idle');
    await page.click('#pauseBtn');
    await sleep(300);
    const a = await pose(page);
    await sleep(1200);
    const b = await pose(page);
    assert.equal(a.body, b.body, 'frozen while paused');
    await page.click('#pauseBtn');
    await sleep(800);
    const c = await pose(page);
    assert.notEqual(b.body, c.body, 'moves again after resume');
  });

  test('reduced motion: the cloud still draws and state changes still show', async () => {
    const page = await open({ reduced: true });
    await setMode(page, 'acting');
    await sleep(600);
    const label = await page.$eval('#status', (e) => e.textContent);
    assert.equal(label, 'Acting');
    const p = await pose(page);
    assert.match(p.body, /^translate\(0 -?0(\.0+)?\)/, `no float with reduced motion: ${p.body}`);
  });

  test('a screenshot of each mode is saved for review', async () => {
    const page = await open();
    for (const mode of ['idle', 'listening', 'processing', 'speaking', 'acting', 'error']) {
      await setMode(page, mode);
      await sleep(900);
      await page.screenshot({ path: join(SHOTS, `probe-${mode}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    }
    assert.deepEqual(page.errors, [], page.errors.join(' | '));
  });
});
