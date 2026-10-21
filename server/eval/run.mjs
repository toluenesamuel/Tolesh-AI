#!/usr/bin/env node
/**
 * Live eval runner: sends the cases in cases.json through a RUNNING Tolesh
 * server (streaming route), scores each reply and writes a JSON report.
 *
 *   node eval/run.mjs [--base http://127.0.0.1:8787] [--runs 3] [--out eval/results/x.json]
 *
 * Exit codes:
 *   0  every automatic check passed on every run
 *   1  at least one check failed (the report says which)
 *   2  BLOCKED: no provider key configured on the server, or server unreachable.
 *      Nothing was measured. Never report this as a pass.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreReply } from './score.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, [])
);
const BASE = args.base ?? 'http://127.0.0.1:8787';
const RUNS = Math.max(1, Number(args.runs ?? 1));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = args.out ?? join(here, 'results', `run-${stamp}.json`);
const cases = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8'));

function blocked(reason) {
  console.log(`BLOCKED: ${reason}`);
  console.log('No model was called. No result is claimed.');
  process.exit(2);
}

async function json(path, init) {
  const res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...init });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Parse one streaming chat turn, measuring time to first byte, first delta and total. */
async function streamTurn(conversationId, message) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message }),
  });
  const ttfbMs = performance.now() - t0;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body?.error?.kind ?? `http_${res.status}`, status: res.status, ttfbMs };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let firstDeltaMs = null;
  let done = null;
  let streamError = null;
  for (;;) {
    const { done: eof, value } = await reader.read();
    if (eof) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let name = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      const payload = JSON.parse(data);
      if (name === 'message' && typeof payload.delta === 'string') {
        if (firstDeltaMs === null) firstDeltaMs = performance.now() - t0;
        text += payload.delta;
      } else if (name === 'done') {
        done = payload;
      } else if (name === 'error') {
        streamError = payload?.error?.kind ?? 'stream_error';
      }
    }
  }
  const totalMs = performance.now() - t0;
  if (streamError) return { error: streamError, ttfbMs, text, totalMs };
  return { text, truncated: done?.truncated === true, model: done?.model ?? null, ttfbMs, firstDeltaMs, totalMs };
}

const providers = await json('/api/providers').catch(() => null);
if (!providers || providers.status !== 200) blocked(`server not reachable at ${BASE}. Start it with: cd server && npm start`);
const active = providers.body.providers.find((p) => p.id === providers.body.active);
if (!active?.available) blocked(`no ${active?.label ?? 'provider'} key is configured on the server (server/.env). Add a key on your machine, then rerun.`);

const pinned = active.modelPinned ? active.defaultModel : '(not pinned: gateway default)';
console.log(`Provider: ${active.label} · model: ${pinned} · max_tokens: ${active.maxTokens} · reply mode: ${providers.body.replyLanguageMode ?? 'see server log'}`);

const results = [];
for (const c of cases) {
  for (let run = 1; run <= RUNS; run++) {
    const conv = await json('/api/conversations', { method: 'POST', body: JSON.stringify({ title: `eval ${c.id}` }) });
    const conversationId = conv.body?.conversation?.id;
    const turn = await streamTurn(conversationId, c.message);
    if (turn.error) {
      results.push({ id: c.id, run, pass: false, error: turn.error, ttfbMs: Math.round(turn.ttfbMs) });
      console.log(`FAIL ${c.id} run ${run}: ${turn.error}`);
      continue;
    }
    const scored = scoreReply({ text: turn.text, truncated: turn.truncated, expect: c.expect, manualReview: c.manualReview });
    const row = {
      id: c.id,
      run,
      pass: scored.pass,
      manualReview: scored.manualReview,
      model: turn.model,
      truncated: turn.truncated,
      ttfbMs: Math.round(turn.ttfbMs),
      firstDeltaMs: turn.firstDeltaMs === null ? null : Math.round(turn.firstDeltaMs),
      totalMs: Math.round(turn.totalMs),
      checks: scored.checks,
      reply: turn.text,
    };
    results.push(row);
    const failed = Object.entries(scored.checks).filter(([, v]) => !v.ok).map(([k]) => k);
    console.log(`${scored.pass ? 'PASS' : 'FAIL'} ${c.id} run ${run} · first delta ${row.firstDeltaMs} ms · total ${row.totalMs} ms${failed.length ? ` · failed: ${failed.join(', ')}` : ''}${scored.manualReview ? ' · MANUAL REVIEW' : ''}`);
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  provider: active.id,
  model: active.modelPinned ? active.defaultModel : null,
  runs: RUNS,
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  manualReview: cases.filter((c) => c.manualReview).map((c) => c.id),
  note: 'Automatic heuristics only. Pidgin and answer quality need human review.',
  results,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed}/${summary.total} automatic checks passed. Report: ${OUT}`);
process.exit(summary.passed === summary.total ? 0 : 1);
