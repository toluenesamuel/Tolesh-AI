/**
 * Tolesh app shell — wires the orb, voice, and chat API into one honest
 * state machine: idle → listening → thinking → speaking (→ error), with
 * interruption (stop / new speech), a text-input fallback at all times, and
 * an offline state when the browser loses its connection.
 */
import './styles.css';
import { Hud, type HudState } from './hud';
import { Voice, voiceSupport } from './voice';
import { createSpeechQueue } from './speech-queue';
import { api, ApiError } from './api';
import { loadSettings, saveSettings, shouldResumeListening, type ToleshSettings } from './settings';
import { reconnectDelayMs } from './reconnect';
import { ICON_SPRITE, icon } from './icons';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
${ICON_SPRITE}
<a class="skip-link" href="#composer">Skip to message box</a>
<div class="app" id="root">
  <header class="topbar">
    <button type="button" class="icon-btn labelled" id="history-toggle" aria-expanded="false" aria-controls="history-panel">
      ${icon('menu')}<span class="btn-label">History</span>
    </button>
    <div class="brand">
      ${icon('logo', 'brand-mark')}
      <span class="wordmark">TOLESH</span>
      <small class="brand-sub">Personal AI</small>
    </div>
    <div class="topbar-end">
      <div class="status-pill" id="status-pill">
        <span class="status-dot" id="status-dot" aria-hidden="true"></span>
        <span class="status-text" id="status-text">connecting…</span>
      </div>
      <button type="button" class="icon-btn labelled" id="settings-toggle" aria-expanded="false" aria-controls="settings-panel">
        ${icon('sliders')}<span class="btn-label">Settings</span>
      </button>
    </div>
  </header>

  <div class="scrim" id="scrim" hidden></div>

  <div class="shell" id="shell">
    <aside class="history" id="history-panel" hidden aria-label="Conversation history">
      <div class="panel-head">
        <h2 class="panel-title">History</h2>
        <button type="button" class="btn small" id="new-chat" aria-label="Start a new conversation">${icon('plus')}<span>New</span></button>
        <button type="button" class="icon-btn history-close" id="history-close" aria-label="Close history">${icon('close')}</button>
      </div>
      <ul class="history-list" id="history-list"></ul>
      <p class="history-empty" id="history-empty" hidden>No conversations yet.</p>
    </aside>

    <div class="workspace">
      <main class="stage" aria-label="Tolesh assistant">
        <div class="orb-wrap">
          <canvas id="orb" aria-hidden="true"></canvas>
        </div>
        <div class="state-label" id="state-label" role="status">idle</div>
      </main>

      <section class="transcript" id="transcript" aria-label="Conversation transcript" aria-live="polite"></section>

      <div class="dock">
        <aside class="onboarding" id="onboarding" hidden aria-labelledby="onboarding-title">
          <p class="onboarding-title" id="onboarding-title"><strong>Hi, I’m Tolesh.</strong></p>
          <p>
            Talk with the microphone button in Chromium browsers, or just type. Replies stream in as text and are spoken
            sentence by sentence. Press <b>Stop</b> or <b>Escape</b> any time to interrupt me.
          </p>
          <p>
            Tolesh saves your conversations on the server it runs on, and each message is sent to the AI provider that
            server is set up to use. You can delete or export any conversation from History. Voice input and spoken
            replies use your browser’s speech features; with some browsers your voice may be processed by the browser’s
            speech service.
          </p>
          <button type="button" class="btn small" id="onboarding-ok">Got it</button>
        </aside>

        <form class="composer" id="controls" aria-label="Message composer">
          <button type="button" class="round-btn mic" id="mic" aria-label="Start voice input" aria-pressed="false">${icon('mic')}</button>
          <input class="input" id="text-input" name="message" type="text" autocomplete="off" spellcheck="false"
                 enterkeyhint="send" placeholder="Type to Tolesh…" aria-label="Message Tolesh" maxlength="8000" />
          <button type="submit" class="btn primary send" id="send">${icon('send')}<span class="btn-label">Send</span></button>
          <button type="button" class="btn stop-btn" id="stop" hidden>${icon('stop')}<span class="btn-label">Stop</span></button>
        </form>

        <p class="footnote" id="footnote"></p>
      </div>
    </div>
  </div>

  <aside class="settings" id="settings-panel" hidden aria-labelledby="settings-title">
    <div class="panel-head">
      <h2 class="panel-title" id="settings-title">Settings</h2>
      <button type="button" class="icon-btn" id="settings-close" aria-label="Close settings">${icon('close')}</button>
    </div>
    <div class="settings-body">
      <label class="setting-row toggle-row">
        <input type="checkbox" id="setting-speech" />
        <span>Speak replies aloud</span>
      </label>
      <label class="setting-row slider-row">
        <span>Speech rate</span>
        <input type="range" id="speech-rate" min="0.5" max="2" step="0.1" aria-label="Speech rate" />
        <output id="rate-out" for="speech-rate"></output>
      </label>
      <label class="setting-row toggle-row">
        <input type="checkbox" id="hands-free" />
        <span>Hands-free (listen again after each reply)</span>
      </label>
      <p class="setting-note">Settings are saved only in this browser. They are not sent to the Tolesh server.</p>
    </div>
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
const shell = document.querySelector<HTMLElement>('#shell')!;
const scrim = document.querySelector<HTMLElement>('#scrim')!;
const historyPanel = document.querySelector<HTMLElement>('#history-panel')!;
const historyToggle = document.querySelector<HTMLButtonElement>('#history-toggle')!;
const historyClose = document.querySelector<HTMLButtonElement>('#history-close')!;
const historyList = document.querySelector<HTMLUListElement>('#history-list')!;
const historyEmpty = document.querySelector<HTMLElement>('#history-empty')!;
const newChatBtn = document.querySelector<HTMLButtonElement>('#new-chat')!;
const settingsPanel = document.querySelector<HTMLElement>('#settings-panel')!;
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!;
const settingsClose = document.querySelector<HTMLButtonElement>('#settings-close')!;
const speechToggle = document.querySelector<HTMLInputElement>('#setting-speech')!;
const rateSlider = document.querySelector<HTMLInputElement>('#speech-rate')!;
const rateOut = document.querySelector<HTMLOutputElement>('#rate-out')!;
const handsFreeToggle = document.querySelector<HTMLInputElement>('#hands-free')!;
const onboardingCard = document.querySelector<HTMLElement>('#onboarding')!;
const onboardingOk = document.querySelector<HTMLButtonElement>('#onboarding-ok')!;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Drawers are modal below 1024px. From 1024px the history list is a docked sidebar.
const overlayQuery = window.matchMedia('(max-width: 1023px)');

// Graceful degradation: if canvas 2D is unavailable the app still works, the
// orb hides, and the text state label carries the state alone.
let hud: Hud;
try {
  hud = new Hud({ canvas, reducedMotion });
  window.addEventListener('resize', hud.resize);
} catch {
  canvas.hidden = true;
  hud = { setState: () => {}, setLevel: () => {}, resize: () => {}, stop: () => {}, destroy: () => {} } as unknown as Hud;
}

/** Idle is the resting state; 'boot' shows "connecting" while the server is checked. */
type Phase = 'boot' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline';
const HUD_FOR_PHASE: Record<Phase, HudState> = {
  boot: 'idle',
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  error: 'error',
  offline: 'offline',
};

let phase: Phase = 'boot';
let conversationId: string | null = null;
let abortChat: AbortController | null = null;
/** True when this deployment has no reachable Tolesh server (static host, no API). */
let siteUnconnected = false;

/* ---------- settings (localStorage, storage-block safe) ---------- */
let settings: ToleshSettings = loadSettings();

/* ---------- speech output (sentence-queue TTS) ----------
 * Speaks only the final answer, sentence by sentence, starting at the first
 * complete sentence. The 'speaking' state starts when the engine reports
 * playback has begun, and HUD level pulses come from real boundary events. */
const support = voiceSupport();
let activeQueue: ReturnType<typeof createSpeechQueue> | null = null;

function cancelSpeechNow() {
  activeQueue?.cancel();
  activeQueue = null;
  voice.cancelSpeech();
}

const speechSynthAvailable = support.synthesis && 'speechSynthesis' in window ? window.speechSynthesis : null;

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
      // Done while still 'thinking' means the reply had nothing to speak.
      if (phase === 'speaking' || phase === 'thinking') toIdle();
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
    addMessage('assistant', message, 'error-msg');
    if (kind === 'not_allowed' || kind === 'unsupported') setFootnote();
    if (phase === 'listening') toIdle();
  },
  onEnd: () => {
    // Recognition can end right after a final transcript handed us to
    // 'thinking'; don't stomp that in-flight state.
    if (phase === 'listening') toIdle();
  },
});

function setPhase(p: Phase) {
  phase = p;
  hud.setState(HUD_FOR_PHASE[p]);
  if (p !== 'listening') hud.setLevel(0);
  stateLabel.textContent = p === 'boot' ? 'connecting' : p;
  app.dataset.phase = p;
  micBtn.setAttribute('aria-pressed', String(p === 'listening'));
  micBtn.classList.toggle('listening', p === 'listening');
  micBtn.setAttribute('aria-label', p === 'listening' ? 'Stop voice input' : 'Start voice input');
  micBtn.innerHTML = icon(p === 'listening' ? 'stop' : 'mic');
  const busy = p === 'thinking';
  // Send stays clickable while speaking so a typed message interrupts playback.
  sendBtn.disabled = busy || siteUnconnected;
  micBtn.disabled = busy || siteUnconnected;
  stopBtn.hidden = !(p === 'speaking' || p === 'thinking');
  input.disabled = busy || siteUnconnected;
  syncTyping();
}

function toIdle() {
  setPhase('idle');
}

const root = document.querySelector<HTMLElement>('#root')!;
const vv = window.visualViewport;

/** Keep the layout within the visible area, so the composer stays above the on-screen keyboard. */
function syncViewport() {
  const height = vv ? vv.height : window.innerHeight;
  const top = vv ? vv.offsetTop : 0;
  root.style.setProperty('--vvh', `${Math.round(height)}px`);
  root.style.setProperty('--vvt', `${Math.round(top)}px`);
}
vv?.addEventListener('resize', syncViewport);
vv?.addEventListener('scroll', syncViewport);
window.addEventListener('resize', syncViewport);
syncViewport();

/** While typing on a phone, the orb steps aside so the transcript keeps its room. */
function syncTyping() {
  const typing = document.activeElement === input && !input.disabled;
  root.classList.toggle('typing', typing);
  hud.resize();
}
input.addEventListener('focus', syncTyping);
input.addEventListener('blur', () => requestAnimationFrame(syncTyping));

function setStatus(kind: 'ok' | 'warn' | 'err', text: string) {
  statusDot.className = `status-dot ${kind === 'ok' ? '' : kind}`;
  statusText.textContent = text;
}

function setFootnote() {
  const bits: string[] = [];
  if (!support.recognition) bits.push('Voice input needs a Chromium-based browser. Text input works everywhere.');
  if (!support.synthesis) bits.push('Spoken replies are not supported in this browser.');
  if (support.recognition && support.synthesis)
    bits.push('Voice uses your browser’s speech features. Hands-free listening pauses while Tolesh speaks.');
  footnote.textContent = bits.join(' ');
}

function addMessage(role: 'user' | 'assistant', content: string, extraClass = ''): HTMLElement {
  const el = document.createElement('article');
  el.className = `msg ${role} ${extraClass}`.trim();
  const who = document.createElement('span');
  who.className = 'who';
  if (extraClass.includes('error-msg')) {
    who.innerHTML = `${icon('alert', 'who-ico')}<span>Tolesh</span>`;
  } else {
    who.textContent = role === 'user' ? 'You' : 'Tolesh';
  }
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
/** Finalize the in-place partial bubble (or drop it), never duplicating it. */
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

/* ---------- drawers: history (sidebar / drawer) and settings (sheet) ---------- */

let historyOpen = !overlayQuery.matches; // docked by default on wide screens
let lastOpener: HTMLElement | null = null;

function historyIsOverlay() {
  return historyOpen && overlayQuery.matches;
}

function syncDrawers() {
  const settingsOpen = !settingsPanel.hidden;
  shell.classList.toggle('history-open', historyOpen);
  historyPanel.hidden = !historyOpen;
  historyToggle.setAttribute('aria-expanded', String(historyOpen));
  settingsToggle.setAttribute('aria-expanded', String(settingsOpen));
  scrim.hidden = !(historyIsOverlay() || settingsOpen);
  root.classList.toggle('drawer-open', historyIsOverlay() || settingsOpen);
}

function firstFocusable(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [href]');
}

function openHistory() {
  lastOpener = historyToggle;
  historyOpen = true;
  syncDrawers();
  void refreshHistory();
  if (historyIsOverlay()) firstFocusable(historyPanel)?.focus();
}

function closeHistory(restoreFocus: boolean) {
  const wasModal = historyIsOverlay();
  historyOpen = false;
  syncDrawers();
  if (restoreFocus && wasModal) (lastOpener ?? historyToggle).focus();
}

function openSettings() {
  lastOpener = settingsToggle;
  settingsPanel.hidden = false;
  reflectSettings();
  syncDrawers();
  firstFocusable(settingsPanel)?.focus();
}

function closeSettings(restoreFocus: boolean) {
  settingsPanel.hidden = true;
  syncDrawers();
  if (restoreFocus) (lastOpener ?? settingsToggle).focus();
}

/** Keeps Tab inside an open modal drawer. */
function trapFocus(e: KeyboardEvent, container: HTMLElement) {
  const items = [
    ...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href]'),
  ].filter((el) => el.offsetParent !== null);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

historyToggle.addEventListener('click', () => {
  if (historyOpen) closeHistory(true);
  else openHistory();
});
historyClose.addEventListener('click', () => closeHistory(true));
settingsToggle.addEventListener('click', () => {
  if (settingsPanel.hidden) openSettings();
  else closeSettings(true);
});
settingsClose.addEventListener('click', () => closeSettings(true));
scrim.addEventListener('click', () => {
  if (!settingsPanel.hidden) closeSettings(true);
  if (historyIsOverlay()) closeHistory(true);
});
overlayQuery.addEventListener('change', () => syncDrawers());

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

/* ---------- onboarding (first run only) ---------- */
const ONBOARDING_KEY = 'tolesh.onboarded.v1';
function seenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return true; // storage blocked: don't nag; the footnote carries the info
  }
}
if (!seenOnboarding()) onboardingCard.hidden = false;
onboardingOk.addEventListener('click', () => {
  onboardingCard.hidden = true;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // storage blocked: explainer will show again next load; acceptable
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
    addMessage('assistant', msg, 'error-msg');
  }
}

/* ---------- conversation history ---------- */

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
  const exp = document.createElement('button');
  exp.type = 'button';
  exp.className = 'icon-btn history-export';
  exp.innerHTML = icon('download');
  exp.setAttribute('aria-label', `Export conversation: ${title}`);
  exp.addEventListener('click', () => void exportConversation(id));
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'icon-btn history-delete';
  del.innerHTML = icon('trash');
  del.setAttribute('aria-label', `Delete conversation: ${title}`);
  del.addEventListener('click', () => void deleteConversation(id, del));
  li.append(open, exp, del);
  return li;
}

async function refreshHistory() {
  if (siteUnconnected) return;
  try {
    const { conversations } = await api.listConversations();
    historyList.textContent = '';
    for (const c of conversations) historyList.append(historyRow(c.id, c.title));
    historyEmpty.hidden = conversations.length > 0;
  } catch {
    // server offline: history just stays empty; the status pill already says so
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
    addMessage('assistant', msg, 'error-msg');
  }
}

async function deleteConversation(id: string, btn: HTMLButtonElement) {
  // Two-step confirm inline (no native dialogs): first press arms, second deletes.
  if (btn.dataset.armed !== 'true') {
    btn.dataset.armed = 'true';
    btn.classList.add('armed');
    btn.innerHTML = `<span class="armed-text">Confirm?</span>`;
    setTimeout(() => {
      btn.dataset.armed = 'false';
      btn.classList.remove('armed');
      btn.innerHTML = icon('trash');
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
    addMessage('assistant', msg, 'error-msg');
  }
}

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
  if (!message || phase === 'thinking' || siteUnconnected) return;
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
  transcript.setAttribute('aria-busy', 'true');
  abortChat = new AbortController();
  // Streaming: answer deltas render into a growing bubble and feed the
  // sentence-queue TTS, so the first audible sentence starts as soon as the
  // text exists. Deltas are already reasoning-free (server-side extraction).
  let bubble: HTMLElement | null = null;
  let bubbleBody: HTMLElement | null = null;
  const queue = speechSynthAvailable && settings.speechEnabled ? startSpeechQueue() : null;
  try {
    const cid = await ensureConversation();
    const { truncated } = await api.chatStream(cid, message, {
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
    if (truncated) {
      // The model stopped at its output limit. Say so; the cut-off text is in
      // history, so asking Tolesh to continue works.
      addMessage('assistant', 'That reply was cut off before it finished. Ask Tolesh to continue.', 'error-msg');
    }
    queue?.finish();
    if (!queue) {
      // Speech disabled or unsupported: the streamed bubble is the answer.
      setPhase('idle');
    }
    // With synthesis: the queue drives speaking → idle via onDone.
  } catch (err) {
    queue?.cancel();
    if (err instanceof DOMException && err.name === 'AbortError') {
      toIdle();
      return;
    }
    const msg = err instanceof Error ? err.message : 'Something went wrong.';
    addMessage('assistant', msg, 'error-msg');
    setPhase('error');
    setStatus('err', 'error');
    // Return to idle after a beat so the user can retry; honest error stays in transcript.
    setTimeout(() => {
      if (phase === 'error') toIdle();
    }, 2500);
  } finally {
    abortChat = null;
    transcript.setAttribute('aria-busy', 'false');
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
    // Escape first closes an open drawer; otherwise it interrupts Tolesh.
    if (!settingsPanel.hidden) {
      closeSettings(true);
      return;
    }
    if (historyIsOverlay()) {
      closeHistory(true);
      return;
    }
    abortChat?.abort();
    cancelSpeechNow();
    if (phase === 'listening') voice.stop();
    toIdle();
    return;
  }
  if (e.key === 'Tab') {
    if (!settingsPanel.hidden) trapFocus(e, settingsPanel);
    else if (historyIsOverlay()) trapFocus(e, historyPanel);
  }
});

/* ---------- connection and status ---------- */

/** A static host with no Tolesh API answers /api/* with 404. Retrying cannot help there. */
function isUnconnectedSite(err: unknown): boolean {
  return (
    import.meta.env.PROD &&
    !import.meta.env.VITE_API_BASE &&
    err instanceof ApiError &&
    err.status === 404
  );
}

function showUnconnectedSite() {
  siteUnconnected = true;
  setStatus('err', 'Server not connected');
  addMessage(
    'assistant',
    'Tolesh’s server is not connected to this site yet, so chat and voice are unavailable here.',
    'error-msg'
  );
  footnote.textContent = 'This build has no Tolesh server address configured.';
  setPhase('offline');
}

async function refreshStatus(): Promise<boolean> {
  try {
    const { providers, active } = await api.providers();
    const current = providers.find((p) => p.id === active);
    if (current?.available) setStatus('ok', `${current.label} connected`);
    else setStatus('warn', 'no AI provider key');
    return true;
  } catch {
    setStatus('err', 'server offline');
    return false;
  }
}

async function boot() {
  setFootnote();
  reflectSettings();
  syncDrawers();
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
        'No AI provider key is configured on the server yet. Chat will answer honestly that it cannot reach a model until DAHL_API_KEY (or another provider) is set in server/.env.',
        'error-msg'
      );
    }
    setPhase('idle');
  } catch (err) {
    if (isUnconnectedSite(err)) {
      showUnconnectedSite();
      return;
    }
    setStatus('err', 'server offline');
    addMessage('assistant', 'Cannot reach the Tolesh server. Start it with: cd server && npm start', 'error-msg');
    setPhase('error');
    void reconnectPoller();
  }
}

/**
 * After a failed boot, retry the health check with backoff (reconnect.ts).
 * On recovery the pill flips to the provider state and history reloads.
 * Gives up honestly after MAX_RECONNECT_ATTEMPTS and leaves the offline pill up.
 */
async function reconnectPoller() {
  for (let attempt = 1; ; attempt++) {
    const delay = reconnectDelayMs(attempt);
    if (delay === null) return; // stays offline; refresh retries manually
    await new Promise((r) => setTimeout(r, delay));
    if (await refreshStatus()) {
      void refreshHistory();
      if (phase === 'error' || phase === 'offline') setPhase('idle');
      return;
    }
  }
}

// Browser connectivity: show offline when the network drops while idle, and
// recover when it returns. A chat in progress is left to its own error path.
window.addEventListener('offline', () => {
  if (siteUnconnected) return;
  if (phase === 'idle' || phase === 'boot' || phase === 'error') {
    setStatus('err', 'offline');
    setPhase('offline');
  }
});
window.addEventListener('online', () => {
  if (siteUnconnected) return;
  if (phase === 'offline') {
    setPhase('idle');
    void refreshStatus();
    void refreshHistory();
  }
});

void boot();
