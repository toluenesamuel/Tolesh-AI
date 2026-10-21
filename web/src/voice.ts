/**
 * Voice module — Web Speech API (browser-native, no keys, no cloud).
 *
 * Platform reality (documented honestly in the UI):
 * - SpeechRecognition: Chromium/Edge only (webkitSpeechRecognition). Firefox/Safari: absent.
 * - speechSynthesis: broad support; voice quality varies by OS.
 * - Not full duplex: we pause recognition while the assistant speaks to avoid
 *   the mic hearing its own TTS (feedback loop). Not continuous listening.
 */

export type VoiceSupport = {
  recognition: boolean;
  synthesis: boolean;
};

export function voiceSupport(): VoiceSupport {
  const w = window as unknown as Record<string, unknown>;
  return {
    recognition: 'SpeechRecognition' in w || 'webkitSpeechRecognition' in w,
    synthesis: 'speechSynthesis' in window,
  };
}

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): RecognitionLike | null {
  const w = window as unknown as Record<string, any>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor() as RecognitionLike;
  rec.lang = navigator.language || 'en-NG';
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}

export type ListenHandlers = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onLevel?: (level: number) => void; // 0..1 mic amplitude for the HUD
  onError?: (kind: 'not_allowed' | 'no_speech' | 'network' | 'unsupported' | 'error', message: string) => void;
  onEnd?: () => void;
};

export class Voice {
  #rec: RecognitionLike | null = null;
  #listening = false;
  #speaking = false;
  #stream: MediaStream | null = null;
  #audioCtx: AudioContext | null = null;
  #analyser: AnalyserNode | null = null;
  #levelRaf = 0;
  #handlers: ListenHandlers;

  constructor(handlers: ListenHandlers) {
    this.#handlers = handlers;
  }

  get listening() {
    return this.#listening;
  }
  get speaking() {
    return this.#speaking;
  }

  /** Start listening (mic + recognition). Errors surface honestly. */
  async start() {
    if (this.#listening) return;
    if (!voiceSupport().recognition) {
      this.#handlers.onError?.('unsupported', 'Speech recognition is not supported in this browser — use the text input.');
      return;
    }
    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      this.#handlers.onError?.(
        name === 'NotAllowedError' ? 'not_allowed' : 'error',
        name === 'NotAllowedError' ? 'Microphone permission denied.' : 'Microphone unavailable.'
      );
      return;
    }
    this.#startLevelMeter();
    const rec = createRecognition();
    if (!rec) {
      this.#handlers.onError?.('unsupported', 'Speech recognition unavailable.');
      this.#cleanupMic();
      return;
    }
    this.#rec = rec;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      this.#handlers.onPartial?.(finalText + interim);
    };
    rec.onerror = (e: any) => {
      const kind = e?.error === 'not-allowed' ? 'not_allowed' : e?.error === 'no-speech' ? 'no_speech' : e?.error === 'network' ? 'network' : 'error';
      this.#handlers.onError?.(kind, `Speech recognition error: ${e?.error ?? 'unknown'}`);
    };
    rec.onend = () => {
      this.#listening = false;
      this.#cleanupMic();
      if (finalText.trim()) this.#handlers.onFinal(finalText.trim());
      else this.#handlers.onEnd?.();
    };
    this.#listening = true;
    try {
      rec.start();
    } catch {
      this.#listening = false;
      this.#cleanupMic();
      this.#handlers.onError?.('error', 'Could not start speech recognition.');
    }
  }

  stop() {
    this.#rec?.stop();
  }

  /** Speak text aloud; pauses recognition during playback (feedback protection). */
  speak(text: string, { onEnd }: { onEnd?: () => void } = {}) {
    if (!voiceSupport().synthesis) {
      onEnd?.();
      return;
    }
    // Avoid feedback loops: never recognize while speaking.
    if (this.#listening) this.stop();
    this.#speaking = true;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = navigator.language || 'en-NG';
    utter.rate = 1.02;
    utter.pitch = 1.0;
    // Prefer an English voice; pick the first available otherwise.
    const voices = speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en[-_](NG|GB|US)/i.test(v.lang)) ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
    if (preferred) utter.voice = preferred;
    utter.onend = () => {
      this.#speaking = false;
      onEnd?.();
    };
    utter.onerror = () => {
      this.#speaking = false;
      onEnd?.();
    };
    speechSynthesis.cancel(); // interrupt any current speech (interruption support)
    speechSynthesis.speak(utter);
  }

  /** Stop speaking immediately (user interruption). */
  cancelSpeech() {
    if (voiceSupport().synthesis) speechSynthesis.cancel();
    this.#speaking = false;
  }

  #startLevelMeter() {
    if (!this.#stream) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.#audioCtx = new Ctx();
      const src = this.#audioCtx.createMediaStreamSource(this.#stream);
      const analyser = this.#audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      this.#analyser = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!this.#analyser) return;
        this.#analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length) / 255;
        this.#handlers.onLevel?.(Math.min(1, rms * 2.5));
        this.#levelRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // level meter is decorative; recognition still works without it
    }
  }

  #cleanupMic() {
    cancelAnimationFrame(this.#levelRaf);
    this.#analyser = null;
    this.#stream?.getTracks().forEach((t) => t.stop());
    this.#stream = null;
    void this.#audioCtx?.close().catch(() => {});
    this.#audioCtx = null;
    this.#handlers.onLevel?.(0);
  }
}
