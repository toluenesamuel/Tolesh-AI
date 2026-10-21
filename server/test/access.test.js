import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { accessGate, parseAllowedOrigins, originAllowed } from '../src/access.js';

function appWith(token) {
  const app = express();
  app.use(accessGate(token));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/conversations', (_req, res) => res.json({ conversations: [] }));
  return app;
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('no token configured: gate is a no-op', async () => {
  await withServer(appWith(undefined), async (base) => {
    const r = await fetch(`${base}/api/conversations`);
    assert.equal(r.status, 200);
  });
});

test('token configured: API routes need the bearer token', async () => {
  await withServer(appWith('s3cret-token-value'), async (base) => {
    assert.equal((await fetch(`${base}/api/conversations`)).status, 401);
    assert.equal((await fetch(`${base}/api/conversations`, { headers: { authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${base}/api/conversations`, { headers: { authorization: 'Basic s3cret-token-value' } })).status, 401);
    const ok = await fetch(`${base}/api/conversations`, { headers: { authorization: 'Bearer s3cret-token-value' } });
    assert.equal(ok.status, 200);
  });
});

test('health stays public and the 401 body does not echo the token', async () => {
  await withServer(appWith('s3cret-token-value'), async (base) => {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const denied = await fetch(`${base}/api/conversations`, { headers: { authorization: 'Bearer nope' } });
    const body = await denied.text();
    assert.ok(!body.includes('s3cret-token-value'));
    assert.match(body, /unauthorized/);
  });
});

test('ALLOWED_ORIGINS parsing keeps only exact https or localhost origins', () => {
  assert.deepEqual(
    parseAllowedOrigins(' https://tolesh-ai.vercel.app/ , http://evil.example , https://x.y, junk'),
    ['https://tolesh-ai.vercel.app', 'https://x.y']
  );
  assert.equal(originAllowed('https://tolesh-ai.vercel.app', ['https://tolesh-ai.vercel.app']), true);
  assert.equal(originAllowed('https://tolesh-ai.vercel.app.evil.com', ['https://tolesh-ai.vercel.app']), false);
  assert.equal(originAllowed('http://localhost:5173', []), true);
  assert.equal(originAllowed(undefined, []), true);
});
