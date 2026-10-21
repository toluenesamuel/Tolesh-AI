/**
 * Latency probe — repeatable before/after measurement for the chat pipeline.
 *
 * Measures, per run, against a running Tolesh server:
 *   ttfb            — time to first SSE byte (or JSON response start)
 *   firstDelta      — time to the first answer delta (stream mode)
 *   firstSentence   — time to the first complete sentence (when TTS starts)
 *   total           — time to the full reply
 *
 * Usage: node scripts/latency.mjs [--runs 5] [--model ID] [--mode stream|json]
 * Requires DAHL_API_KEY (and DAHL_BASE_URL) in the environment or server/.env.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Load server/.env if present (never prints secrets).
try {
  const env = readFileSync(path.join(root, 'server', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const args = process.argv.slice(2);
const get = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const RUNS = Number(get('--runs', '5'));
const MODEL = get('--model', process.env.DAHL_MODEL ?? '');
const MODE = get('--mode', 'stream');
const BASE = get('--base', 'http://127.0.0.1:8787');

if (!process.env.DAHL_API_KEY) {
  console.error('DAHL_API_KEY not set (env or server/.env). Nothing to measure — exiting.');
  process.exit(1);
}

const PROMPT = 'In one short sentence: what is the fastest animal on land?';

async function createConversation() {
  const res = await fetch(`${BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const { conversation } = await res.json();
  return conversation.id;
}

/** One measured run. Returns timings in ms. */
async function measure() {
  const cid = await createConversation();
  const t0 = performance.now();
  let ttfb = null;
  let firstDelta = null;
  let firstSentence = null;
  let acc = '';
  const res = await fetch(`${BASE}/api/chat${MODE === 'stream' ? '/stream' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: cid, message: PROMPT }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  if (MODE === 'stream') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const t = performance.now();
      const { done, value } = await reader.read();
      if (done) break;
      if (ttfb === null) ttfb = t - t0;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let j;
        try {
          j = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (typeof j.delta === 'string') {
          if (firstDelta === null) firstDelta = performance.now() - t0;
          acc += j.delta;
          // first complete sentence = earliest moment TTS can start
          const m = acc.match(/[.!?](\s|$)/);
          if (m && firstSentence === null) firstSentence = performance.now() - t0;
        } else if (line.startsWith('event:')) {
          // done/error blocks carry their payload on the next data line
        }
      }
    }
  } else {
    const body = await res.json();
    if (ttfb === null) ttfb = performance.now() - t0;
    firstDelta = ttfb;
    acc = body.reply ?? '';
    if (acc) firstSentence = performance.now() - t0;
  }
  const total = performance.now() - t0;
  return { ttfb, firstDelta, firstSentence, total, chars: acc.length, reply: acc.slice(0, 60) };
}

const rows = [];
for (let i = 0; i < RUNS; i++) {
  try {
    const r = await measure();
    rows.push(r);
    console.log(
      `run ${i + 1}: ttfb=${r.ttfb?.toFixed(0)}ms firstDelta=${r.firstDelta?.toFixed(0)}ms firstSentence=${r.firstSentence?.toFixed(0)}ms total=${r.total.toFixed(0)}ms chars=${r.chars}`
    );
  } catch (err) {
    console.error(`run ${i + 1} FAILED: ${err.message}`);
  }
}
if (rows.length === 0) {
  console.error('no successful runs');
  process.exit(1);
}
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
console.log(`\nmode=${MODE} model=${MODEL || '(default)'} runs=${rows.length}`);
console.log(`median ttfb:          ${med(rows.map((r) => r.ttfb)).toFixed(0)}ms`);
console.log(`median firstDelta:    ${med(rows.map((r) => r.firstDelta)).toFixed(0)}ms`);
console.log(`median firstSentence: ${med(rows.map((r) => r.firstSentence)).toFixed(0)}ms  ← TTS could start here`);
console.log(`median total:         ${med(rows.map((r) => r.total)).toFixed(0)}ms`);
