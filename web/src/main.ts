/**
 * Tolesh app shell — wires the HUD, voice, and chat API into one honest
 * state machine: idle → listening → thinking → speaking (→ error), with
 * interruption (stop / new speech) and a text-input fallback at all times.
 */
import './styles.css';
import { Hud, type HudState } from './hud';
import { Voice, voiceSupport } from './voice';
import { createSpeechQueue } from './speech-queue';
import { api } from './api';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="app">
    <header class="topbar">
      <button type="button" class="btn ghost" id="history-toggle" aria-expanded="false"
              aria-controls="history-panel" aria-label="Toggle conversation history">☰ History</button>
      <div class="brand">TOLESH <small>personal AI</small></div>
      <div class="status-pill" id="status-pill">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">connecting…</span>
      </div>
    </header>

    <div class="shell">
      <aside class="history" id="history-panel" hidden aria-label="Conversation history">
        <div class="history-head">
          <span>History</span>
          <button type="button" class="btn ghost" id="new-chat" aria-label="Start a new conversation">＋ New</button>
        </div>
        <ul class="history-list" id="history-list"></ul>
        <p class="history-empty" id="history-empty" hidden>No conversations yet.</p>
      </aside>

      <main class="stage" aria-label="Tolesh assistant">
        <div class="orb-wrap">
          <canvas id="orb" aria-hidden="true"></canvas>
          <div class="state-label" id="state-label" aria-live="off">idle</div>
        </div>
      </main>
    </div>

    <section class="transcript" id="transcript" aria-live="polite" aria-label="Conversation transcript"></section>

    <form class="controls" id="controls">
      <button type="button" class="btn mic" id="mic" aria-label="Start voice input" aria-pressed="false">🎙</button>
      <input class="input" id="text-input" type="text" autocomplete="off"
             placeholder="Type to Tolesh…" aria-label="Message Tolesh" maxlength="8000" />
      <button type="submit" class="btn" id="send">Send</button>
      <button type="button" class="btn stop-btn" id="stop" hidden>Stop</button>
    </form>

    <p class="footnote" id="footnote"></p>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#orb')!;
const stateLabel = document.querySelector<HTMLDivElement>('#state-label')!;
const statusDot = document.querySelector<HTMLSpanElement>('#status-dot')!;
const statusText = document.querySelector<HTMLSpanElement>('#status-text')!;
const transcript = document.querySelector<HTMLElement>('#transcript')!;
const form = document.querySelector<HTMLFormElement>('#controls')!;
const input = document.querySelector<HTMLInputElement>('#text-input')!;
const sendBtn = document.querySelector<HTMLButtonElement>('#send')!;
const micBtn = document.querySelector<HTMLButtonElement>('#mic')!;
const stopBtn = document.querySelector<HTMLButtonElement>('#stop')!;
const footnote = document.querySelector<HTMLElement>('#footnote')!;
const historyPanel = document.querySelector<HTMLElement>('#history-panel')!;
const historyToggle = document.querySelector<HTMLButtonElement>('#history-toggle')!;
const historyList = document.querySelector<HTMLUListElement>('#history-list')!;
const historyEmpty = document.querySelector<HTMLElement>('#history-empty')!;
const newChatBtn = document.querySelector<HTMLButtonElement>('#new-chat')!;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Graceful degradation: if canvas 2D is unavailable the app still works —
// the orb hides and the text state label carries the state alone.
let hud: Hud;
try {
  hud = new Hud({ canvas, reducedMotion });
  window.addEventListener('resize', hud.resize);
} catch {
  canvas.hidden = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hud = { setState: () => {}, setLevel: () => {}, resize: () => {}, stop: () => {}, destroy: () => {} } as unknown as Hud;
}

type Phase = 'boot' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
let phase: Phase = 'boot';
let conversationId: string | null = null;
let abortChat: AbortController | null = null;

/* ---------- speech output (sentence-queue TTS) ----------
 * Speaks only the final answer, sentence by sentence, starting at the first
 * complete sentence instead of waiting for the whole reply. HUD level pulses
 * come from real utterance progress (boundary events), not random motion. */
const support = voiceSupport();
let activeQueue: ReturnType<typeof createSpeechQueue> | null = null;

function cancelSpeechNow() {
  activeQueue?.cancel();
  activeQueue = null;
  voice.cancelSpeech();
}

const speechSynthAvailable =
  support.synthesis && 'speechSynthesis' in window ? window.speechSynthesis : null;

function startSpeechQueue(): ReturnType<typeof createSpeechQueue> {
  cancelSpeechNow(); // never overlap with leftover speech
  const queue = createSpeechQueue(speechSynthAvailable!, {
    onSpeakStart: () => {
      setPhase('speaking');
    },
    onLevel: (v) => {
      if (phase === 'speaking') hud.setLevel(v);
    },
    onDone: () => {
      if (phase === 'speaking') toIdle();
      activeQueue = null;
    },
  });
  activeQueue = queue;
  return queue;
}
const voice = new Voice({
  onPartial: (text) => setPartial(text),
  onFinal: (text) => {
    void submit(text);
  },
  onLevel: (v) => {
    if (phase === 'listening') hud.setLevel(v);
  },
  onError: (kind, message) => {
    addMessage('assistant', `⚠️ ${message}`, 'error-msg');
    if (kind === 'not_allowed' || kind === 'unsupported') setFootnote();
    if (phase === 'listening') toIdle();
  },
  onEnd: () => {
    // Recognition can also end right after a final transcript handed us to
    // 'thinking'; don't stomp that in-flight state.
    if (phase === 'listening') toIdle();
  },
});

function setPhase(p: Phase) {
  phase = p;
  const hudState: HudState = p === 'boot' ? 'offline' : p;
  hud.setState(hudState);
  if (p !== 'listening') hud.setLevel(p === 'speaking' ? 0.45 : 0);
  stateLabel.textContent = p === 'boot' ? 'offline' : p;
  micBtn.setAttribute('aria-pressed', String(p === 'listening'));
  micBtn.classList.toggle('listening', p === 'listening');
  micBtn.setAttribute('aria-label', p === 'listening' ? 'Stop voice input' : 'Start voice input');
  micBtn.textContent = p === 'listening' ? '⏹' : '🎙';
  // Send stays clickable while speaking so a typed message interrupts playback.
  sendBtn.disabled = p === 'thinking';
  micBtn.disabled = p === 'thinking';
  stopBtn.hidden = !(p === 'speaking' || p === 'thinking');
  input.disabled = p === 'thinking';
}

function toIdle() {
  setPhase('idle');
}

function setStatus(kind: 'ok' | 'warn' | 'err', text: string) {
  statusDot.className = `status-dot ${kind === 'ok' ? '' : kind}`;
  statusText.textContent = text;
}

function setFootnote() {
  const bits: string[] = [];
  if (!support.recognition) bits.push('Voice input needs a Chromium-based browser — text input works everywhere.');
  if (!support.synthesis) bits.push('Spoken replies are not supported in this browser.');
  if (support.recognition && support.synthesis)
    bits.push('Voice uses your browser’s built-in speech engine (not full duplex; mic pauses while Tolesh speaks).');
  footnote.textContent = bits.join(' ');
}

function addMessage(role: 'user' | 'assistant', content: string, extraClass = ''): HTMLElement {
  const el = document.createElement('article');
  el.className = `msg ${role} ${extraClass}`.trim();
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = role === 'user' ? 'You' : 'Tolesh';
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = content;
  el.append(who, body);
  transcript.append(el);
  transcript.scrollTop = transcript.scrollHeight;
  return el;
}

let partialEl: HTMLElement | null = null;
function setPartial(text: string) {
  if (!partialEl) {
    partialEl = addMessage('user', text, 'pending');
  } else {
    (partialEl.querySelector('.body') as HTMLElement).textContent = text;
    transcript.scrollTop = transcript.scrollHeight;
  }
}
/** Finalize the in-place partial bubble (or drop it) — never duplicate it. */
function settlePartial(text: string | null) {
  if (partialEl) {
    if (text) {
      (partialEl.querySelector('.body') as HTMLElement).textContent = text;
      partialEl.classList.remove('pending');
    } else {
      partialEl.remove();
    }
    partialEl = null;
  }
}

async function ensureConversation() {
  if (conversationId) return conversationId;
  const { conversation } = await api.createConversation();
  conversationId = conversation.id;
  void refreshHistory();
  return conversationId;
}

/* ---------- conversation history (P4) ---------- */

function historyRow(id: string, title: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'history-item';
  li.dataset.id = id;
  if (id === conversationId) li.classList.add('active');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'history-open';
  open.textContent = title;
  open.setAttribute('aria-label', `Open conversation: ${title}`);
  open.addEventListener('click', () => void openConversation(id));
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'history-delete';
  del.textContent = '✕';
  del.setAttribute('aria-label', `Delete conversation: ${title}`);
  del.addEventListener('click', () => void deleteConversation(id, del));
  li.append(open, del);
  return li;
}

async function refreshHistory() {
  try {
    const { conversations } = await api.listConversations();
    historyList.textContent = '';
    for (const c of conversations) historyList.append(historyRow(c.id, c.title));
    historyEmpty.hidden = conversations.length > 0;
  } catch {
    // server offline — history just stays empty; status pill already says so
  }
}

async function openConversation(id: string) {
  if (phase === 'thinking' || phase === 'speaking' || phase === 'listening') {
    abortChat?.abort();
    cancelSpeechNow();
    if (phase === 'listening') voice.stop();
  }
  try {
    const { conversation } = await api.getConversation(id);
    conversationId = conversation.id;
    transcript.textContent = '';
    partialEl = null;
    for (const m of conversation.messages ?? []) {
      addMessage(m.role === 'assistant' ? 'assistant' : 'user', m.content);
    }
    if (!conversation.messages?.length) {
      addMessage('assistant', '(no messages in this conversation yet)', 'pending');
    }
    for (const li of historyList.querySelectorAll('.history-item')) {
      li.classList.toggle('active', (li as HTMLElement).dataset.id === id);
    }
    toIdle();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not load conversation.';
    addMessage('assistant', `⚠️ ${msg}`, 'error-msg');
  }
}

async function deleteConversation(id: string, btn: HTMLButtonElement) {
  // Two-step confirm inline (no native dialogs): first click arms, second deletes.
  if (btn.dataset.armed !== 'true') {
    btn.dataset.armed = 'true';
    btn.textContent = 'sure?';
    btn.classList.add('armed');
    setTimeout(() => {
      btn.dataset.armed = 'false';
      btn.textContent = '✕';
      btn.classList.remove('armed');
    }, 3000);
    return;
  }
  try {
    await api.deleteConversation(id);
    if (id === conversationId) {
      conversationId = null;
      transcript.textContent = '';
      partialEl = null;
      addMessage('assistant', 'Conversation deleted. Start a new one below.', 'pending');
    }
    await refreshHistory();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not delete conversation.';
    addMessage('assistant', `⚠️ ${msg}`, 'error-msg');
  }
}

historyToggle.addEventListener('click', () => {
  const willShow = historyPanel.hidden;
  historyPanel.hidden = !willShow;
  document.querySelector('.shell')?.classList.toggle('history-open', willShow);
  historyToggle.setAttribute('aria-expanded', String(willShow));
  if (willShow) void refreshHistory();
});

newChatBtn.addEventListener('click', () => {
  if (phase === 'listening') voice.stop();
  abortChat?.abort();
  cancelSpeechNow();
  conversationId = null;
  transcript.textContent = '';
  partialEl = null;
  for (const li of historyList.querySelectorAll('.history-item')) li.classList.remove('active');
  toIdle();
  input.focus();
});

async function submit(text: string) {
  const message = text.trim();
  if (!message || phase === 'thinking') return;
  // Reuse the live partial bubble if voice handed us this text; otherwise
  // add a fresh user bubble (typed input).
  if (partialEl && (partialEl.querySelector('.body') as HTMLElement).textContent === message) {
    settlePartial(message);
  } else {
    settlePartial(null);
    addMessage('user', message);
  }
  input.value = '';
  cancelSpeechNow();
  setPhase('thinking');
  abortChat = new AbortController();
  // Streaming: answer deltas render into a growing bubble and feed the
  // sentence-queue TTS, so the first audible sentence starts as soon as the
  // text exists. Deltas are already reasoning-free (server-side extraction).
  let bubble: HTMLElement | null = null;
  let bubbleBody: HTMLElement | null = null;
  const queue = speechSynthAvailable ? startSpeechQueue() : null;
  try {
    const cid = await ensureConversation();
    const { reply, model } = await api.chatStream(cid, message, {
      signal: abortChat.signal,
      onDelta: (delta) => {
        if (!bubble || !bubbleBody) {
          bubble = addMessage('assistant', delta);
          bubbleBody = bubble.querySelector('.body') as HTMLElement;
        } else {
          bubbleBody.textContent += delta;
          transcript.scrollTop = transcript.scrollHeight;
        }
        queue?.enqueue(delta);
      },
    });
    void refreshHistory();
    queue?.finish();
    if (!queue) {
      // No speech support in this browser — the streamed bubble is the answer.
      setPhase('idle');
    }
    // With synthesis: the queue drives speaking → idle via onDone.
    void model; // (kept for future provider label display)
    void reply; // bubble already shows the streamed text
  } catch (err) {
    queue?.cancel();
    if (err instanceof DOMException && err.name === 'AbortError') {
      toIdle();
      return;
    }
    const msg = err instanceof Error ? err.message : 'Something went wrong.';
    addMessage('assistant', `⚠️ ${msg}`, 'error-msg');
    setPhase('error');
    setStatus('err', 'error');
    // Return to idle after a beat so the user can retry; honest error stays in transcript.
    setTimeout(() => {
      if (phase === 'error') toIdle();
    }, 2500);
  } finally {
    abortChat = null;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void submit(input.value);
});

micBtn.addEventListener('click', () => {
  if (phase === 'listening') {
    voice.stop();
    return;
  }
  if (phase === 'speaking') cancelSpeechNow();
  setPhase('listening');
  void voice.start();
});

stopBtn.addEventListener('click', () => {
  abortChat?.abort();
  cancelSpeechNow();
  toIdle();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    abortChat?.abort();
    cancelSpeechNow();
    if (phase === 'listening') voice.stop();
    toIdle();
  }
});

async function boot() {
  setFootnote();
  void refreshHistory();
  try {
    const { providers, active } = await api.providers();
    const current = providers.find((p) => p.id === active);
    if (current?.available) {
      setStatus('ok', `${current.label} connected`);
    } else {
      setStatus('warn', 'no AI provider key');
      addMessage(
        'assistant',
        '⚠️ No AI provider key is configured on the server yet. Chat will answer honestly that it cannot reach a model until DAHL_API_KEY (or another provider) is set in server/.env.',
        'error-msg'
      );
    }
    setPhase('idle');
  } catch {
    setStatus('err', 'server offline');
    addMessage('assistant', '⚠️ Cannot reach the Tolesh server. Start it with: cd server && npm start', 'error-msg');
    setPhase('error');
  }
}

void boot();
