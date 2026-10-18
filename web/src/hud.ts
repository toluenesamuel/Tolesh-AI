/**
 * Tolesh HUD core — the circular holographic orb.
 * Canvas 2D (GPU-friendly enough at this size; WebGL is a later upgrade),
 * transform/opacity CSS for the DOM shell. Respects prefers-reduced-motion
 * with a calm static equivalent. Degrades to a static ring when canvas or
 * rAF is unavailable.
 */

export type HudState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline';

export interface HudOptions {
  canvas: HTMLCanvasElement;
  reducedMotion?: boolean;
}

const STATE_COLORS: Record<HudState, { core: string; ring: string; glow: string }> = {
  idle: { core: '#00d4ff', ring: '#0e7490', glow: 'rgba(0,212,255,0.25)' },
  listening: { core: '#22d3ee', ring: '#06b6d4', glow: 'rgba(34,211,238,0.35)' },
  thinking: { core: '#38bdf8', ring: '#2563eb', glow: 'rgba(56,189,248,0.3)' },
  speaking: { core: '#67e8f9', ring: '#0891b2', glow: 'rgba(103,232,249,0.4)' },
  error: { core: '#fb7185', ring: '#be123c', glow: 'rgba(251,113,133,0.3)' },
  offline: { core: '#64748b', ring: '#334155', glow: 'rgba(100,116,139,0.2)' },
};

/** Central HUD controller. */
export class Hud {
  #canvas;
  #ctx;
  #state: HudState = 'idle';
  #level = 0; // audio level 0..1 (drives orb reactivity)
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

  /** @param {HudState} s */
  setState(s: HudState) {
    if (this.#state === s) return;
    this.#state = s;
    if (this.#reducedMotion) this.#drawFrame(0);
  }

  getState(): HudState {
    return this.#state;
  }

  /** Audio level 0..1 (from mic analyser or TTS approximation). */
  setLevel(v: number) {
    this.#targetLevel = Math.max(0, Math.min(1, v));
  }

  #start() {
    if (this.#running) return;
    this.#running = true;
    const loop = (now: number) => {
      if (!this.#running) return;
      this.#t = now / 1000;
      // ease audio level toward target (cheap smoothing)
      this.#level += (this.#targetLevel - this.#level) * 0.25;
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

  #drawFrame(t: number) {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) * 0.5;
    const colors = STATE_COLORS[this.#state];
    ctx.clearRect(0, 0, w, h);

    const pulse = this.#reducedMotion ? 0 : Math.sin(t * 2) * 0.03;
    const react = this.#level * 0.18;
    const coreR = base * (0.34 + pulse + react);
    const ringR = base * (0.62 + pulse * 0.4 + react * 0.5);

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, ringR * 1.35);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Outer ring (dashed, slowly rotating when not reduced-motion)
    ctx.save();
    ctx.translate(cx, cy);
    if (!this.#reducedMotion) ctx.rotate(t * 0.15);
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = Math.max(1, base * 0.012);
    ctx.setLineDash([base * 0.05, base * 0.035]);
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Mid ring (solid, opposite rotation)
    ctx.save();
    ctx.translate(cx, cy);
    if (!this.#reducedMotion) ctx.rotate(-t * 0.1);
    ctx.strokeStyle = colors.core;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, base * 0.008);
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Core orb
    const core = ctx.createRadialGradient(cx, cy - coreR * 0.25, coreR * 0.1, cx, cy, coreR);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, colors.core);
    core.addColorStop(1, 'rgba(2,8,20,0.9)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Waveform ticks around the core when listening/speaking
    if ((this.#state === 'listening' || this.#state === 'speaking') && !this.#reducedMotion) {
      ctx.strokeStyle = colors.core;
      ctx.lineWidth = Math.max(1, base * 0.006);
      const tickBase = coreR * 1.25;
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        // pseudo-wave: deterministic per index + time, scaled by audio level
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
