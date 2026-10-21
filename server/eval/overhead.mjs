#!/usr/bin/env node
/**
 * Server overhead benchmark. No real model and no network: a local fake
 * OpenAI-compatible provider replies after a fixed delay, with a fixed number of
 * streamed chunks. The numbers therefore show Tolesh's OWN added time
 * (routing, persistence, SSE relay), not model latency.
 *
 *   node eval/overhead.mjs [--server ../server] [--runs 30] [--delay 300]
 *
 * --server   path to a Tolesh server checkout (defaults to this one), so the
 *            same benchmark can run against the baseline commit.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const SERVER_DIR = resolve(opt('server', join(here, '..')));
const RUNS = Number(opt('runs', 30));
const DELAY_MS = Number(opt('delay', 300));
const CHUNKS = 40;
const CHUNK_GAP_MS = 10;
const FAKE_PORT = 9911;
const TOLESH_PORT = 8790;
const tmp = mkdtempSync(join(tmpdir(), 'tolesh-overhead-'));

const fake = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const wantsStream = JSON.parse(body || '{}').stream === true;
    setTimeout(() => {
      if (!wantsStream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model: 'fake', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      let i = 0;
      const tick = () => {
        if (i < CHUNKS) {
          res.write(`data: ${JSON.stringify({ model: 'fake', choices: [{ delta: { content: 'word ' } }] })}\n\n`);
          i++;
          setTimeout(tick, CHUNK_GAP_MS);
        } else {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      };
      tick();
    }, DELAY_MS);
  });
});

await new Promise((r) => fake.listen(FAKE_PORT, '127.0.0.1', r));

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: {
    ...process.env,
    PORT: String(TOLESH_PORT),
    HOST: '127.0.0.1',
    DB_PATH: join(tmp, 'bench.db'),
    DAHL_API_KEY: 'benchmark-only-not-a-secret',
    DAHL_BASE_URL: `http://127.0.0.1:${FAKE_PORT}/v1`,
    DAHL_MODEL: 'fake-model',
    RATE_LIMIT_PER_MINUTE: '100000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write(d));

const base = `http://127.0.0.1:${TOLESH_PORT}`;
for (let t = 0; ; t++) {
  try {
    if ((await fetch(`${base}/api/health`)).ok) break;
  } catch {
    /* not up yet */
  }
  if (t > 100) throw new Error('Tolesh server did not start');
  await new Promise((r) => setTimeout(r, 100));
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

const firstDelta = [];
const total = [];
for (let run = 0; run < RUNS; run++) {
  const conv = await (await fetch(`${base}/api/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  const t0 = performance.now();
  const res = await fetch(`${base}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: conv.conversation.id, message: `benchmark turn ${run}` }),
  });
  const reader = res.body.getReader();
  let seen = null;
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
    if (seen === null) seen = performance.now() - t0; // first byte of the first delta batch
  }
  total.push(performance.now() - t0);
  firstDelta.push(seen);
}

server.kill('SIGTERM');
fake.close();
rmSync(tmp, { recursive: true, force: true });

const idealTotal = DELAY_MS + CHUNKS * CHUNK_GAP_MS;
const report = {
  server: SERVER_DIR,
  runs: RUNS,
  fakeProviderDelayMs: DELAY_MS,
  firstByteOverheadMs: { p50: Math.round(pct(firstDelta, 50) - DELAY_MS), p95: Math.round(pct(firstDelta, 95) - DELAY_MS) },
  totalOverheadMs: { p50: Math.round(pct(total, 50) - idealTotal), p95: Math.round(pct(total, 95) - idealTotal) },
  note: 'Overhead = measured time minus the fake provider delay (and streamed duration for total). Excludes any real model time.',
};
console.log(JSON.stringify(report, null, 2));
