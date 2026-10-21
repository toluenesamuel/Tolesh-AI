/**
 * Tolesh HUD core — the holographic orb.
 *
 * One luminous core and two rings, drawn on a 2D canvas. Each state has its
 * own treatment, and every motion is tied to a real signal:
 *   idle       slow 4 s breath, cyan core
 *   listening  rings react to the real microphone level (AnalyserNode)
 *   thinking   a violet arc orbits the rings while a request is in flight
 *   speaking   reacts only to real speech-boundary progress (speech-queue)
 *   error      steady rose ring, no motion
 *   offline    dimmed, dashed ring, no motion
 *
 * Colours mirror the design tokens in styles.css. Colour changes cross-fade
 * over 900 ms. prefers-reduced-motion draws one static frame per state and
 * redraws only on state change or resize. Degrades when canvas is unavailable.
 */

export type HudState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline';

export interface HudOptions {
  canvas: HTMLCanvasElement;
  reducedMotion?: boolean;
}

type Palette = { core: string; ring: string; glow: string; glowAlpha: number };

/** Mirrors --accent, --think, --speak, --danger, --offline in styles.css. */
export const STATE_PALETTE: Record<HudState, Palette> = {
  idle: { core: '#38BDF8', ring: '#0EA5E9', glow: '#38BDF8', glowAlpha: 0.22 },
  listening: { core: '#38D8F0', ring: '#22D3EE', glow: '#38D8F0', glowAlpha: 0.34 },
  thinking: { core: '#A597FF', ring: '#7C6CF0', glow: '#A597FF', glowAlpha: 0.3 },
  speaking: { core: '#5EF2C2', ring: '#2DD4BF', glow: '#5EF2C2', glowAlpha: 0.32 },
  error: { core: '#FB7185', ring: '#E11D48', glow: '#FB7185', glowAlpha: 0.3 },
  offline: { core: '#94A3B8', ring: '#475569', glow: '#94A3B8', glowAlpha: 0.12 },
};

/** Cross-fade duration between states, in seconds. */
export const BLEND_SECONDS = 0.9;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, alpha: number): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(3)})`;
}

function rgb(c: Rgb): string {
  return rgba(c, 1);
}

/** Central HUD controller. */
export class Hud {
  #canvas;
  #ctx;
  #state: HudState = 'idle';
  #from: HudState = 'idle';
  #blend = 1; // 0..1 progress of the colour cross-fade from #from to #state
  #blendStart = 0;
  #level = 0; // smoothed audio level 0..1
  #targetLevel = 0;
  #t = 0;
  #raf = 0;
  #running = false;
  #reducedMotion: boolean;
  #dpr = 1;

  constructor({ canvas, reducedMotion }: HudOptions) {
    this.#canvas = canvas;
    this.#reducedMotion = reducedMotion ?? false;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.#ctx = ctx;
    this.#resize();
    if (!this.#reducedMotion) this.#start();
    else this.#drawFrame(0); // single static frame
  }

  #resize() {
    const { clientWidth, clientHeight } = this.#canvas;
    this.#dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#canvas.width = Math.max(1, Math.floor(clientWidth * this.#dpr));
    this.#canvas.height = Math.max(1, Math.floor(clientHeight * this.#dpr));
    if (this.#reducedMotion) this.#drawFrame(0);
  }

  resize = () => this.#resize();

  setState(s: HudState) {
    if (this.#state === s) return;
    this.#from = this.#state;
    this.#state = s;
    this.#blendStart = this.#t;
    this.#blend = this.#reducedMotion ? 1 : 0;
    if (this.#reducedMotion) this.#drawFrame(0);
  }

  getState(): HudState {
    return this.#state;
  }

  /** Audio level 0..1 from the real mic analyser or real speech-boundary progress. */
  setLevel(v: number) {
    this.#targetLevel = Math.max(0, Math.min(1, v));
  }

  #start() {
    if (this.#running) return;
    this.#running = true;
    const loop = (now: number) => {
      if (!this.#running) return;
      this.#t = now / 1000;
      this.#level += (this.#targetLevel - this.#level) * 0.25;
      if (this.#blend < 1) this.#blend = Math.min(1, (this.#t - this.#blendStart) / BLEND_SECONDS);
      this.#drawFrame(this.#t);
      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#raf);
  }

  destroy() {
    this.stop();
  }

  #colors() {
    const to = STATE_PALETTE[this.#state];
    const from = STATE_PALETTE[this.#from];
    const k = this.#blend;
    return {
      core: mixRgb(hexToRgb(from.core), hexToRgb(to.core), k),
      ring: mixRgb(hexToRgb(from.ring), hexToRgb(to.ring), k),
      glow: mixRgb(hexToRgb(from.glow), hexToRgb(to.glow), k),
      glowAlpha: from.glowAlpha + (to.glowAlpha - from.glowAlpha) * k,
    };
  }

  #drawFrame(t: number) {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) * 0.5;
    const motion = !this.#reducedMotion;
    const live = this.#state === 'listening' || this.#state === 'speaking';
    const colors = this.#colors();
    const offline = this.#state === 'offline';
    const alertState = this.#state === 'error';
    ctx.clearRect(0, 0, w, h);

    const breath = motion ? Math.sin(t * 1.57) * 0.03 : 0; // ~4 s cycle
    const react = motion || live ? this.#level * 0.18 : 0;
    const coreR = base * (0.34 + breath + react);
    const ringR = base * (0.62 + breath * 0.4 + react * 0.5);

    // Halo
    const glow = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, ringR * 1.35);
    glow.addColorStop(0, rgba(colors.glow, colors.glowAlpha * (offline ? 0.6 : 1)));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Outer dashed ring. Static for error and offline.
    ctx.save();
    ctx.translate(cx, cy);
    if (motion && !alertState && !offline) ctx.rotate(t * 0.15);
    ctx.strokeStyle = rgb(colors.ring);
    ctx.globalAlpha = offline ? 0.55 : 1;
    ctx.lineWidth = Math.max(1, base * 0.012);
    ctx.setLineDash([base * 0.05, base * 0.035]);
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Inner solid ring, counter-rotating.
    ctx.save();
    ctx.translate(cx, cy);
    if (motion && !alertState && !offline) ctx.rotate(-t * 0.1);
    ctx.strokeStyle = rgb(colors.core);
    ctx.globalAlpha = offline ? 0.3 : 0.55;
    ctx.lineWidth = Math.max(1, base * 0.008);
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Thinking: a violet arc orbits the outer ring (one turn every 2.4 s).
    if (this.#state === 'thinking' && motion) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((t * Math.PI * 2) / 2.4);
      ctx.strokeStyle = rgb(colors.core);
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = Math.max(2, base * 0.02);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 1.08, 0, Math.PI * 0.55);
      ctx.stroke();
      ctx.restore();
    }

    // Core
    const core = ctx.createRadialGradient(cx, cy - coreR * 0.25, coreR * 0.1, cx, cy, coreR);
    core.addColorStop(0, offline ? 'rgba(226,232,240,0.7)' : '#ffffff');
    core.addColorStop(0.35, rgb(colors.core));
    core.addColorStop(1, 'rgba(2,8,20,0.9)');
    ctx.globalAlpha = offline ? 0.6 : 1;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Live ticks around the core: listening (mic) and speaking (boundary progress).
    if (live && motion) {
      ctx.strokeStyle = rgb(colors.core);
      ctx.lineWidth = Math.max(1, base * 0.006);
      const tickBase = coreR * 1.25;
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const wobble = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
        const len = base * (0.02 + wobble * 0.05 * (0.3 + this.#level));
        ctx.globalAlpha = 0.35 + 0.4 * wobble;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * tickBase, cy + Math.sin(angle) * tickBase);
        ctx.lineTo(cx + Math.cos(angle) * (tickBase + len), cy + Math.sin(angle) * (tickBase + len));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
