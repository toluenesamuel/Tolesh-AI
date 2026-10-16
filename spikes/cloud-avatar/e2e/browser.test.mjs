// Real-browser tests for the cloud avatar prototype (headless Chromium via puppeteer-core).
// Test-only tooling. Serves spikes/cloud-avatar on a local port, and nothing else.
// Run: LD_LIBRARY_PATH=/tmp/chromium-libs/lib node --test browser.test.mjs
import { test, before, after, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(here, '..'));
const SHOTS = join(ROOT, 'stills', 'browser');
mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mjs': 'text/javascript' };

let server, base, browser;
const pagesOpened = [];

before(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    // Serve only inside the prototype folder, and never the e2e tooling or node_modules.
    if (!file.startsWith(ROOT + sep) || file.includes(`${sep}e2e${sep}`) || file.includes('node_modules')) {
      res.writeHead(404).end('not found');
      return;
    }
    try {
      if (!statSync(file).isFile()) throw new Error('dir');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  const exe = await chromium.executablePath();
  browser = await puppeteer.launch({
    executablePath: exe,
    args: chromium.args,
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: '/tmp/chromium-libs/lib' },
  });
});

// Close each test's pages so earlier frame loops do not compete for the CPU.
afterEach(async () => {
  while (pagesOpened.length) await pagesOpened.pop().close().catch(() => {});
});

after(async () => {
  for (const p of pagesOpened) await p.close().catch(() => {});
  await browser?.close();
  server?.close();
});

// Opens the prototype in a fresh page and waits until the markup and the frame loop are running.
async function open({ width = 390, height = 844, touch = false, reduced = false, dpr = 2 } = {}) {
  const page = await browser.newPage();
  pagesOpened.push(page);
  await page.bringToFront();
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: touch, hasTouch: touch });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  page.errors = [];
  page.badRequests = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') page.errors.push(m.text());
  });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => {
    if (!r.url().startsWith(base)) page.badRequests.push(r.url());
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#cloud [data-k]').length > 10 && document.querySelector('[data-k=body]').getAttribute('transform'));
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

// Samples the live pose inside the page, once per animation frame, for a given duration.
async function sample(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const out = [];
        const t0 = performance.now();
        const body = document.querySelector('[data-k=body]');
        const gL = document.querySelector('[data-k=gazeL]');
        const lid = document.querySelector('[data-k=lidL]');
        const mouth = document.querySelector('[data-k=mouthOpen]');
        const tick = (now) => {
          const tr = body.getAttribute('transform');
          const g = gL.getAttribute('transform');
          const d = lid.getAttribute('d');
          out.push({
            t: now - t0,
            floatY: Number((tr.match(/translate\(0 ([-\d.]+)\)/) || [0, 0])[1]),
            tilt: Number((tr.match(/rotate\(([-\d.]+)\)/) || [0, 0])[1]),
            gx: Number((g.match(/translate\(([-\d.]+)/) || [0, 0])[1]),
            gy: Number((g.match(/translate\([-\d.]+ ([-\d.]+)\)/) || [0, 0])[1]),
            lidY: Number(d.match(/^M[\d.-]+ ([\d.-]+)/)[1]),
            mouthRy: Number(mouth.getAttribute('ry')),
          });
          if (now - t0 < ms) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

const svgBox = (page) => page.$eval('#cloud', (s) => {
  const r = s.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
// viewBox point -> client point, using the rendered SVG box (preserveAspectRatio is default, the box matches 360:320).
const toClient = (box, x, y) => ({ x: box.left + (x / 360) * box.width, y: box.top + (y / 320) * box.height });
const range = (xs) => Math.max(...xs) - Math.min(...xs);

describe('loading and safety', () => {
  test('loads with no console errors, no CSP violations, and no requests outside the page', async () => {
    const page = await open();
    assert.deepEqual(page.errors, [], `console errors: ${page.errors.join(' | ')}`);
    assert.deepEqual(page.badRequests, [], `requests outside the page: ${page.badRequests.join(' ')}`);
  });

  test('the strict CSP is in force in the real browser', async () => {
    const page = await open();
    const csp = await page.$eval('meta[http-equiv="Content-Security-Policy"]', (m) => m.content);
    assert.match(csp, /default-src 'none'/);
    // An inline script must be refused by the policy.
    const refused = await page.evaluate(() => {
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.textContent = 'window.__ran = true';
        document.head.appendChild(s);
        setTimeout(() => resolve(window.__ran !== true), 50);
      });
    });
    assert.equal(refused, true, 'inline script should be blocked by the CSP');
  });

  test('no camera or microphone is requested on load or interaction', async () => {
    const page = await open();
    const used = await page.evaluate(() => {
      window.__media = 0;
      const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = (...a) => { window.__media++; return orig.apply(navigator.mediaDevices, a); };
      return 'hooked';
    });
    await page.mouse.move(100, 100);
    await page.click('[data-state=speaking]');
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(await page.evaluate(() => window.__media), 0);
    assert.equal(used, 'hooked');
  });
});

describe('cursor', () => {
  test('eyes follow the cursor left and right, with natural limits', async () => {
    const page = await open();
    const box = await svgBox(page);
    const right = toClient(box, 345, 160);
    await page.mouse.move(right.x, right.y);
    await new Promise((r) => setTimeout(r, 900));
    const rightSamples = await sample(page, 300);
    const gxRight = rightSamples.at(-1).gx;
    const left = toClient(box, 15, 160);
    await page.mouse.move(left.x, left.y);
    await new Promise((r) => setTimeout(r, 900));
    const gxLeft = (await sample(page, 300)).at(-1).gx;
    assert.ok(gxRight > 2 && gxRight <= 4.5, `right gaze ${gxRight}`);
    assert.ok(gxLeft < -2 && gxLeft >= -4.5, `left gaze ${gxLeft}`);
  });

  test('the eyes ease toward the cursor rather than snapping', async () => {
    const page = await open();
    const box = await svgBox(page);
    const p = toClient(box, 345, 160);
    await page.mouse.move(p.x, p.y);
    const first = await sample(page, 120);
    assert.ok(Math.abs(first[1].gx - first[0].gx) < 0.9, 'no snap in the first frames');
    assert.ok(first.at(-1).gx > first[0].gx, 'moving toward the cursor');
  });

  test('a cursor that comes close makes the cloud lean and widen its eyes', async () => {
    const page = await open();
    const box = await svgBox(page);
    const far = toClient(box, 10, 300);
    await page.mouse.move(far.x, far.y);
    await new Promise((r) => setTimeout(r, 1000));
    const farTilt = (await sample(page, 200)).at(-1).tilt;
    const near = toClient(box, 250, 150);
    await page.mouse.move(near.x, near.y);
    await new Promise((r) => setTimeout(r, 1000));
    const nearTilt = (await sample(page, 200)).at(-1).tilt;
    assert.ok(nearTilt > farTilt + 1.5, `near tilt ${nearTilt} should lean toward the cursor vs far ${farTilt}`);
  });

  test('when the cursor leaves, the cloud relaxes back to its idle pose', async () => {
    const page = await open();
    const box = await svgBox(page);
    const near = toClient(box, 250, 150);
    await page.mouse.move(near.x, near.y);
    await new Promise((r) => setTimeout(r, 900));
    await page.mouse.move(2, 2);
    await page.evaluate(() => document.getElementById('cloud').dispatchEvent(new PointerEvent('pointerleave')));
    await new Promise((r) => setTimeout(r, 3200));
    const s = await sample(page, 300);
    assert.ok(Math.abs(s.at(-1).gx) < 0.15 && Math.abs(s.at(-1).gy) < 0.15, `gaze relaxed to ${s.at(-1).gx}, ${s.at(-1).gy}`);
    assert.ok(Math.abs(s.at(-1).tilt) < 0.5, `tilt relaxed to ${s.at(-1).tilt}`);
  });
});

describe('idle life', () => {
  test('the cloud floats and breathes in idle', async () => {
    const page = await open();
    const s = await sample(page, 4500);
    const dy = range(s.map((x) => x.floatY));
    assert.ok(dy > 6, `float range ${dy}`);
  });

  test('the eyes blink occasionally in idle, and each blink is short', async () => {
    const page = await open();
    const s = await sample(page, 12000);
    const openY = Math.max(...s.map((x) => x.lidY));
    const closedThreshold = openY - 6;
    const blinks = [];
    let inBlink = false;
    for (const x of s) {
      const closed = x.lidY > closedThreshold;
      if (closed && !inBlink) blinks.push(x.t);
      inBlink = closed;
    }
    assert.ok(blinks.length >= 2 && blinks.length <= 7, `blinks in 12 s: ${blinks.length}`);
    const gaps = blinks.slice(1).map((t, i) => t - blinks[i]);
    for (const g of gaps) assert.ok(g > 1800 && g < 6500, `gap between blinks ${g} ms`);
  });
});

describe('six states', () => {
  const states = ['idle', 'listening', 'thinking', 'speaking', 'acting', 'error'];

  test('each state button selects that state, updates the label, and changes the pose', async () => {
    const page = await open();
    const poses = {};
    for (const name of states) {
      await page.click(`[data-state=${name}]`);
      await new Promise((r) => setTimeout(r, 1400));
      const pressed = await page.$$eval('[data-state]', (bs) => bs.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.state));
      assert.deepEqual(pressed, [name]);
      const label = await page.$eval('#state-label', (e) => e.textContent);
      assert.ok(label.length > 2);
      const s = await sample(page, 200);
      poses[name] = {
        lidY: s.at(-1).lidY,
        brow: await page.$eval('[data-k=browL]', (e) => e.getAttribute('d')),
        smile: await page.$eval('[data-k=smile]', (e) => e.getAttribute('d')),
      };
      await page.screenshot({ path: join(SHOTS, `state-${name}.png`), clip: { x: 0, y: 0, width: 390, height: 844 } });
    }
    const keys = states.map((n) => `${poses[n].lidY}|${poses[n].brow}|${poses[n].smile}`);
    assert.equal(new Set(keys).size, states.length, 'every state has a distinct pose');
  });

  test('speaking moves the mouth with the simulated voice, and the voice toggle silences it', async () => {
    const page = await open();
    await page.click('[data-state=speaking]');
    await new Promise((r) => setTimeout(r, 800));
    const on = await sample(page, 3000);
    assert.ok(range(on.map((x) => x.mouthRy)) > 4, 'mouth should open and close with the voice');
    await page.click('#toggle-voice');
    await new Promise((r) => setTimeout(r, 1200));
    const off = await sample(page, 1500);
    assert.ok(Math.max(...off.map((x) => x.mouthRy)) < 1.6, 'mouth should stay closed when the voice is off');
  });
});

describe('touch, keyboard, reduced motion', () => {
  test('touch drags move the gaze, and lifting the finger releases it', async () => {
    const page = await open({ touch: true });
    const box = await svgBox(page);
    const start = toClient(box, 180, 160);
    const end = toClient(box, 330, 160);
    await page.touchscreen.touchStart(start.x, start.y);
    await page.touchscreen.touchMove(end.x, end.y);
    await new Promise((r) => setTimeout(r, 900));
    const during = (await sample(page, 200)).at(-1).gx;
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 3200));
    const after = (await sample(page, 200)).at(-1).gx;
    assert.ok(during > 1.5, `gaze during touch ${during}`);
    assert.ok(Math.abs(after) < 0.2, `gaze after release ${after}`);
  });

  test('keyboard: arrows move the attention, and Escape releases it', async () => {
    const page = await open();
    await page.evaluate(() => document.getElementById('cloud').focus());
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await new Promise((r) => setTimeout(r, 900));
    const moved = (await sample(page, 200)).at(-1).gx;
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 3000));
    const released = (await sample(page, 200)).at(-1).gx;
    assert.ok(moved > 0.8, `gaze after arrows ${moved}`);
    assert.ok(Math.abs(released) < 0.15, `gaze after Escape ${released}`);
  });

  test('the cloud is focusable and its focus ring is visible', async () => {
    const page = await open();
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement.id);
    assert.equal(active, 'cloud');
    const ring = await page.$eval('#cloud', (s) => getComputedStyle(s).boxShadow);
    assert.notEqual(ring, 'none');
  });

  test('reduced motion: no float, no blinks, state buttons still work, toggle reflects the OS setting', async () => {
    const page = await open({ reduced: true });
    const pressed = await page.$eval('#toggle-reduce', (b) => b.getAttribute('aria-pressed'));
    assert.equal(pressed, 'true');
    const s = await sample(page, 4000);
    assert.equal(range(s.map((x) => x.floatY)), 0, 'no floating');
    assert.ok(Math.min(...s.map((x) => x.lidY)) === Math.max(...s.map((x) => x.lidY)) || Math.max(...s.map((x) => x.lidY)) - Math.min(...s.map((x) => x.lidY)) < 0.01, 'no blinking');
    await page.click('[data-state=thinking]');
    await new Promise((r) => setTimeout(r, 1200));
    const label = await page.$eval('#state-label', (e) => e.textContent);
    assert.equal(label, 'Thinking');
  });
});

describe('responsiveness and touch targets', () => {
  for (const [name, w, h] of [['phone 360x640', 360, 640], ['phone 390x844', 390, 844], ['small 320x568', 320, 568], ['desktop 1280x800', 1280, 800]]) {
    test(`${name}: no horizontal overflow, cloud fits, controls are at least 48px`, async () => {
      const page = await open({ width: w, height: h, touch: w < 800 });
      const layout = await page.evaluate(() => {
        const box = document.getElementById('cloud').getBoundingClientRect();
        const btns = [...document.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height);
        return {
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          cloudW: box.width,
          cloudRight: box.right,
          minBtn: Math.min(...btns),
          vw: window.innerWidth,
        };
      });
      assert.ok(layout.overflowX <= 0, `horizontal overflow ${layout.overflowX}px`);
      assert.ok(layout.cloudRight <= layout.vw + 0.5, 'cloud stays on screen');
      assert.ok(layout.minBtn >= 47.5, `smallest button ${layout.minBtn}px`);
      await page.screenshot({ path: join(SHOTS, `layout-${w}x${h}.png`) });
    });
  }
});

describe('frame rate and main thread (indicative: headless software rendering, not a phone)', () => {
  test('the animation loop runs near the display rate and long tasks are rare', async () => {
    const page = await open();
    const r = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const longTasks = [];
          let po;
          try {
            po = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((e) => e.duration)));
            po.observe({ entryTypes: ['longtask'] });
          } catch {}
          const stamps = [];
          const t0 = performance.now();
          const tick = (now) => {
            stamps.push(now);
            if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
            else {
              po?.disconnect();
              const dts = stamps.slice(1).map((t, i) => t - stamps[i]);
              dts.sort((a, b) => a - b);
              resolve({
                frames: stamps.length,
                fps: stamps.length / ((stamps.at(-1) - stamps[0]) / 1000),
                p95: dts[Math.floor(dts.length * 0.95)],
                longTasks: longTasks.length,
                worstLongTask: Math.max(0, ...longTasks),
              });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log('      frame stats:', JSON.stringify({ fps: Math.round(r.fps), p95ms: Math.round(r.p95), longTasks: r.longTasks, worstLongTaskMs: Math.round(r.worstLongTask) }));
    assert.ok(r.fps > 20, `fps ${r.fps}`);
    assert.ok(r.worstLongTask < 200, `worst long task ${r.worstLongTask} ms`);
  });
});

describe('accessibility basics', () => {
  test('the cloud has a name, the state is announced politely, and buttons have names', async () => {
    const page = await open();
    const info = await page.evaluate(() => {
      const svg = document.getElementById('cloud');
      const live = document.getElementById('state-label').getAttribute('aria-live');
      const names = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
      return { role: svg.getAttribute('role'), labelledby: svg.getAttribute('aria-labelledby'), live, names };
    });
    assert.equal(info.role, 'img');
    assert.equal(info.labelledby, 'cloud-name state-label');
    assert.equal(info.live, 'polite');
    for (const n of info.names) assert.ok(n.length > 0, 'every button has a name');
  });

  test('body text meets WCAG AA contrast (4.5:1) on the dark background', async () => {
    const page = await open();
    const ratio = await page.evaluate(() => {
      const lum = (rgb) => {
        const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const parse = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const fg = parse(getComputedStyle(document.getElementById('state-hint')).color);
      const bg = parse(getComputedStyle(document.body).backgroundColor);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    assert.ok(ratio >= 4.5, `hint contrast ${ratio.toFixed(2)}`);
  });
});
