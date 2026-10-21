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
import { loadSettings, saveSettings, shouldResumeListening, type ToleshSettings } from './settings';
import { reconnectDelayMs } from './reconnect';

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
      <button type="button" class="btn ghost" id="settings-toggle" aria-expanded="false"
              aria-controls="settings-panel" aria-label="Toggle settings">⚙ Settings</button>
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

    <section class="settings" id="settings-panel" hidden aria-label="Settings">
      <h2>Settings</h2>
      <label class="setting-row">
        <input type="checkbox" id="setting-speech" />
        <span>Speak replies aloud</span>
      </label>
      <label class="setting-row">
        <span>Speech rate</span>
        <input type="range" id="speech-rate" min="0.5" max="2" step="0.1" aria-label="Speech rate" />
        <output id="rate-out" for="speech-rate"></output>
      </label>
      <label class="setting-row">
        <input type="checkbox" id="hands-free" />
        <span>Hands-free (listen again after each reply)</span>
      </label>
      <p class="setting-note">Settings are stored only in this browser (localStorage). Nothing is sent anywhere.</p>
    </section>

    <aside class="onboarding" id="onboarding" hidden aria-label="Welcome">
      <p><strong>Hi, I'm Tolesh.</strong></p>
      <p>
        Talk with the 🎙 button (Chromium browsers), or just type. Replies stream in as text and are spoken
        sentence by sentence. Press <b>Stop</b> or <b>Escape</b> any time to interrupt me. Your conversations
        stay on this machine, and you can delete or export them from History.
      </p>
      <button type="button" class="btn" id="onboarding-ok">Got it</button>
    </aside>
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
const settingsPanel = document.querySelector<HTMLElement>('#settings-panel')!;
const speechToggle = document.querySelector<HTMLInputElement>('#setting-speech')!;
const rateSlider = document.querySelector<HTMLInputElement>('#speech-rate')!;
const rateOut = document.querySelector<HTMLOutputElement>('#rate-out')!;
const handsFreeToggle = document.querySelector<HTMLInputElement>('#hands-free')!;
const onboardingCard = document.querySelector<HTMLElement>('#onboarding')!;
const onboardingOk = document.querySelector<HTMLButtonElement>('#onboarding-ok')!;
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!;

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

/* ---------- settings (localStorage, storage-block safe) ---------- */
let settings: ToleshSettings = loadSettings();

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
    rate: settings.speechRate,
    onSpeakStart: () => {
      setPhase('speaking');
    },
    onLevel: (v) => {
      if (phase === 'speaking') hud.setLevel(v);
    },
    onDone: () => {
      if (phase === 'speaking') toIdle();
      activeQueue = null;
      // Hands-free: after a fully-spoken reply, listen again automatically.
      if (shouldResumeListening(settings, support) && phase === 'idle') {
        setPhase('listening');
        void voice.start();
      }
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

/* ---------- settings panel ---------- */

function reflectSettings() {
  speechToggle.checked = settings.speechEnabled;
  rateSlider.value = String(settings.speechRate);
  rateOut.value = settings.speechRate.toFixed(1) + '×';
  handsFreeToggle.checked = settings.handsFree;
  speechToggle.disabled = !speechSynthAvailable;
  rateSlider.disabled = !speechSynthAvailable;
}

function changeSettings(change: Partial<ToleshSettings>) {
  settings = saveSettings(settings, change);
  reflectSettings();
  // If speech was just switched off mid-sentence, stop now; switching it on
  // takes effect on the next reply (the queue is created per turn).
  if (settings.speechEnabled === false) cancelSpeechNow();
}

speechToggle.addEventListener('change', () => changeSettings({ speechEnabled: speechToggle.checked }));
rateSlider.addEventListener('input', () => changeSettings({ speechRate: Number(rateSlider.value) }));
handsFreeToggle.addEventListener('change', () => changeSettings({ handsFree: handsFreeToggle.checked }));

settingsToggle.addEventListener('click', () => {
  const willShow = settingsPanel.hidden;
  settingsPanel.hidden = !willShow;
  settingsToggle.setAttribute('aria-expanded', String(willShow));
});

/* ---------- onboarding (first run only) ---------- */
const ONBOARDING_KEY = 'tolesh.onboarded.v1';
function seenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return true; // storage blocked — don't nag; the footnote carries the info
  }
}
if (!seenOnboarding()) onboardingCard.hidden = false;
onboardingOk.addEventListener('click', () => {
  onboardingCard.hidden = true;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // storage blocked — explainer will show again next load; acceptable
  }
});

/* ---------- conversation export (privacy + recovery) ---------- */
async function exportConversation(id: string) {
  try {
    const { conversation } = await api.getConversation(id);
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tolesh-${conversation.id}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not export conversation.';
    addMessage('assistant', `⚠️ ${msg}`, 'error-msg');
  }
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
  const exp = document.createElement('button');
  exp.type = 'button';
  exp.className = 'history-export';
  exp.textContent = '⬇';
  exp.setAttribute('aria-label', `Export conversation: ${title}`);
  exp.addEventListener('click', () => void exportConversation(id));
  li.append(open, del, exp);
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
  const queue = speechSynthAvailable && settings.speechEnabled ? startSpeechQueue() : null;
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
      // Speech disabled or unsupported — the streamed bubble is the answer.
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
  reflectSettings();
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
    void reconnectPoller();
  }
}

/**
 * After a failed boot, retry the health check with backoff (reconnect.ts).
 * On recovery the pill flips to the provider state and history reloads —
 * the user does not have to know about refreshing. Gives up honestly after
 * MAX_RECONNECT_ATTEMPTS and leaves the offline pill up.
 */
async function reconnectPoller() {
  for (let attempt = 1; ; attempt++) {
    const delay = reconnectDelayMs(attempt);
    if (delay === null) return; // stays offline; refresh retries manually
    await new Promise((r) => setTimeout(r, delay));
    try {
      const { providers, active } = await api.providers();
      const current = providers.find((p) => p.id === active);
      if (current?.available) setStatus('ok', `${current.label} connected`);
      else setStatus('warn', 'no AI provider key');
      void refreshHistory();
      if (phase === 'error') setPhase('idle');
      return;
    } catch {
      // still down — next attempt after the computed delay
    }
  }
}

void boot();
