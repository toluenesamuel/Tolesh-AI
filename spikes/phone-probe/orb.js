// Orb renderer for the demo (WebGL2, with a Canvas 2D fallback). No libraries.
// Design: "Liquid Core". A translucent electric-blue sphere with slow inner colour flow,
// a rim glow and a soft halo. The outline uses only even harmonics (cos 2a, cos 4a), so it stays mirror-symmetric.
// State shows through an accent colour on the rim, halo and glow, plus motion specific to each state.
import { approach, ACCENT, BASE, DEEP } from './state.js';

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_t;        // phase in seconds (frozen when paused or reduced motion)
uniform float u_motion;   // 1 = animate, 0 = reduced motion
uniform float u_level;    // smoothed listening level, 0..1
uniform float u_speak;    // smoothed output level, 0..1
uniform float u_active;   // 0..1, acting arc
uniform float u_err;      // 0..1, calm and dim
uniform float u_circ;     // 0..1, processing circulation
uniform float u_flowAmp;  // 0..1, inner colour contrast
uniform float u_bright;   // global brightness (paused, error dim)
uniform float u_tint;     // 0..1, how much the accent mixes into the body and halo
uniform vec2 u_gaze;     // simulated gaze, roughly -0.4..0.4 (no camera)
uniform float u_open;    // lid openness, 0..1.2 (0 = closed line)
uniform float u_pupil;   // 0 = small, 1 = large
uniform vec3 u_accent;
uniform vec3 u_base;
uniform vec3 u_deep;
out vec4 o;

const float R0 = 0.30;    // base radius, in units of the short canvas side

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / s;
  float r = length(p);
  float a = atan(p.y, p.x);

  // Outline: uniform breathing plus even harmonics only, so it stays mirror-symmetric.
  float breathe = 0.010 * sin(u_t * 0.9) * u_motion;
  float pulse = 0.5 + 0.5 * sin(u_t * 1.7);
  float ampV = (0.004 * u_level + 0.003 * u_speak) * (0.6 + 0.4 * pulse) * u_motion;
  float calm = 1.0 - u_err;
  float deform = ((0.0025 * u_motion + ampV) * cos(2.0 * a) + (0.0010 * u_motion + 0.5 * ampV) * cos(4.0 * a)) * calm;
  float R = R0 * (1.0 + breathe) + deform;

  float aa = 1.5 / s;
  float d = r - R;
  float body = 1.0 - smoothstep(-aa, aa, d);
  float outside = max(d, 0.0);
  float halo = exp(-outside * 14.0) * (0.28 + 0.30 * u_level + 0.22 * u_speak + 0.10 * u_active) * (1.0 - 0.5 * u_err);

  // Inner flow: a domain-warped field. Processing rotates it, which does not change the outline.
  vec2 q = p / R;
  float ang = u_circ * u_t * 0.8;
  vec2 f = vec2(cos(ang) * q.x - sin(ang) * q.y, sin(ang) * q.x + cos(ang) * q.y);
  float w1 = sin(3.0 * f.x + 1.2 * sin(2.1 * f.y + u_t * 0.5) + u_t * 0.4);
  float w2 = sin(3.0 * f.y - u_t * 0.35 + 1.1 * sin(2.6 * f.x - u_t * 0.3));
  float fv = clamp(0.5 + u_flowAmp * (0.25 * w1 + 0.25 * w2), 0.0, 1.0);

  // Sphere shading from the normalised disc position, lit from the upper left.
  float qz = sqrt(max(1.0 - dot(q, q), 0.0));
  vec3 n = vec3(q, qz);
  vec3 L = normalize(vec3(-0.5, 0.55, 0.67));
  float ndl = dot(n, L);
  float shade = 0.45 + 0.55 * clamp((ndl + 0.2) / 1.2, 0.0, 1.0);
  vec3 tint = mix(u_base, u_accent, u_tint);
  vec3 inner = mix(u_deep, tint, fv);
  float rimv = (1.0 - qz) * (1.0 - qz);
  rimv = rimv * rimv;
  float nucleus = exp(-dot(q, q) * 6.0) * (0.30 + 0.35 * u_level + 0.25 * u_speak);
  vec3 col = inner * shade
           + u_accent * rimv * (1.1 + 0.5 * u_speak + 0.3 * u_err + 0.4 * u_level)
           + u_accent * nucleus * 0.6;
  // Speaking: a soft wave travels out from the core, driven by the output level.
  float wave = 0.5 + 0.5 * cos(r * 14.0 - u_t * 5.0);
  col += u_accent * wave * u_speak * 0.20 * (1.0 - clamp(r / R, 0.0, 1.0));
  // Soft specular highlight.
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float hh = max(dot(n, H), 0.0);
  float h2 = hh * hh; float h4 = h2 * h2; float h8 = h4 * h4; float h16 = h8 * h8;
  col += vec3(h16 * 0.25);
  col = clamp(col, 0.0, 1.0);

  // Eye: one luminous lens centred in the body. Gaze moves the iris; openness sets the lids.
  float W = 0.44;
  float ke = 1.5 / (s * R);
  float openC = clamp(u_open, 0.0, 1.2);
  float eh = 0.22 * openC * sqrt(max(0.0, 1.0 - (q.x / W) * (q.x / W)));
  float lens = 1.0 - smoothstep(-ke, ke, abs(q.y) - eh);
  lens *= 1.0 - smoothstep(W - 0.02, W, abs(q.x));
  float eyeM = lens * body;
  vec2 ic = q - u_gaze * 0.16;
  float ir = length(ic);
  float irisR = 0.17;
  float pr = mix(0.045, 0.085, clamp(u_pupil, 0.0, 1.0));
  float irisM = 1.0 - smoothstep(irisR - ke, irisR + ke, ir);
  float pupM = 1.0 - smoothstep(pr - ke, pr + ke, ir);
  float fib = 0.5 + 0.5 * sin(atan(ic.y, ic.x) * 22.0 + ir * 40.0);
  vec3 irisCol = mix(tint * 1.15, u_deep * 0.5, smoothstep(0.55 * irisR, irisR, ir)) * (0.85 + 0.3 * fib);
  vec3 scl = mix(tint, vec3(0.85, 0.95, 1.0), 0.5);
  float hl1 = 1.0 - smoothstep(0.0, 0.035, length(ic - vec2(-0.06, 0.07)));
  float hl2 = 1.0 - smoothstep(0.0, 0.012, length(ic - vec2(0.05, -0.05)));
  vec3 eyeCol = mix(scl, irisCol, irisM);
  eyeCol = mix(eyeCol, vec3(0.02, 0.03, 0.07), pupM);
  eyeCol += vec3(hl1 * 0.9 + hl2 * 0.5) * irisM * (1.0 - pupM);
  col = mix(col, eyeCol, eyeM * 0.92);
  float lidLine = (1.0 - smoothstep(0.0, 2.2 * ke, abs(abs(q.y) - eh))) * (1.0 - smoothstep(W - 0.02, W, abs(q.x)));
  col += u_accent * lidLine * 0.6 * body;
  col = clamp(col, 0.0, 1.0);

  // Acting: a smooth sweeping arc on the halo.
  float sweep = 0.5 + 0.5 * cos(a - u_t * 1.6);
  float arc = sweep * sweep * sweep;
  float dr = (r - (R + 0.075)) * 55.0;
  float ring = exp(-dr * dr) * arc * u_active;

  float ext = halo + ring;
  vec3 extc = (tint * halo + u_accent * ring) / max(ext, 1e-4);
  float alpha = clamp(body * u_bright + ext * (1.0 - body), 0.0, 1.0);
  vec3 rgb = col * body * u_bright + extc * ext * (1.0 - body);
  rgb = min(rgb, vec3(alpha));
  o = vec4(rgb, alpha); // premultiplied alpha
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

// How fast each value eases: [rise per second, fall per second].
const EASE = {
  level: [18, 5], speak: [18, 6], active: [6, 6], err: [4, 4],
  speed: [3, 3], flowAmp: [3, 3], circ: [3, 3], bright: [4, 4], tint: [3, 3],
  gx: [6, 6], gy: [6, 6], open: [25, 25], pupil: [5, 5],
};

function makeSmoother() {
  const cur = {
    level: 0, speak: 0, active: 0, err: 0, speed: 0.5, flowAmp: 0.6, circ: 0, bright: 1, tint: 0,
    gx: 0, gy: 0, open: 1, pupil: 0.4,
    accent: ACCENT.idle.slice(), phase: 0, last: null,
  };
  return {
    cur,
    step(tgt) {
      const dt = cur.last === null ? 0 : Math.min(0.1, (tgt.now - cur.last) / 1000);
      cur.last = tgt.now;
      if (tgt.reduced) {
        // Reduced motion: no easing and no phase advance. Values snap to the target.
        for (const k of Object.keys(EASE)) cur[k] = tgt[k];
        cur.accent = tgt.accent.slice();
        return cur;
      }
      for (const k of Object.keys(EASE)) cur[k] = approach(cur[k], tgt[k], dt, EASE[k][0], EASE[k][1]);
      for (let i = 0; i < 3; i++) cur.accent[i] = approach(cur.accent[i], tgt.accent[i], dt, 5, 5);
      cur.phase += dt * cur.speed;
      return cur;
    },
  };
}

// Returns null if WebGL2 is unavailable, so the caller can use the 2D fallback.
export function createOrb(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power',
  });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['u_res', 'u_t', 'u_motion', 'u_level', 'u_speak', 'u_active', 'u_err', 'u_circ',
    'u_flowAmp', 'u_bright', 'u_tint', 'u_gaze', 'u_open', 'u_pupil', 'u_accent', 'u_base', 'u_deep']) {
    U[n] = gl.getUniformLocation(prog, n);
  }
  gl.uniform3f(U.u_base, BASE[0], BASE[1], BASE[2]);
  gl.uniform3f(U.u_deep, DEEP[0], DEEP[1], DEEP[2]);

  const lost = { v: false };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost.v = true; });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    return { w, h };
  }

  const sm = makeSmoother();
  return {
    kind: 'webgl2',
    // tgt = targetsFor(mode, opts) plus { now }
    draw(tgt) {
      if (lost.v) return false;
      const c = sm.step(tgt);
      const { w, h } = resize();
      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_t, c.phase);
      gl.uniform1f(U.u_motion, tgt.reduced ? 0 : 1);
      gl.uniform1f(U.u_level, c.level);
      gl.uniform1f(U.u_speak, c.speak);
      gl.uniform1f(U.u_active, c.active);
      gl.uniform1f(U.u_err, c.err);
      gl.uniform1f(U.u_circ, c.circ);
      gl.uniform1f(U.u_flowAmp, c.flowAmp);
      gl.uniform1f(U.u_bright, c.bright);
      gl.uniform1f(U.u_tint, c.tint);
      gl.uniform2f(U.u_gaze, c.gx, c.gy);
      gl.uniform1f(U.u_open, c.open);
      gl.uniform1f(U.u_pupil, c.pupil);
      gl.uniform3f(U.u_accent, c.accent[0], c.accent[1], c.accent[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
  };
}

// Canvas 2D fallback (no WebGL2). Same palette and states, with simpler lighting.
export function createOrb2D(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  }
  const sm = makeSmoother();
  const rgb = (c, k = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${k})`;
  const mixc = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  return {
    kind: 'canvas2d',
    draw(tgt) {
      const { w, h } = resize();
      const c = sm.step(tgt);
      const cx = w / 2, cy = h / 2, s = Math.min(w, h);
      const R = s * (0.30 + 0.012 * c.level + 0.008 * c.speak);
      ctx.clearRect(0, 0, w, h);

      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.6);
      halo.addColorStop(0, rgb(BASE, 0.30 + 0.2 * c.level));
      halo.addColorStop(1, rgb(BASE, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();

      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      body.addColorStop(0, rgb(mixc(BASE, [1, 1, 1], 0.45), 0.96 * c.bright));
      body.addColorStop(0.55, rgb(mixc(BASE, DEEP, 0.3 + 0.2 * (1 - c.flowAmp)), 0.95 * c.bright));
      body.addColorStop(1, rgb(DEEP, 0.98 * c.bright));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // Rim in the state accent.
      ctx.strokeStyle = rgb(c.accent, 0.55 * c.bright);
      ctx.lineWidth = Math.max(1.5, s * 0.006);
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.995, 0, Math.PI * 2); ctx.stroke();

      if (c.active > 0.01) {
        const start = (c.phase * 1.6) % (Math.PI * 2);
        ctx.strokeStyle = rgb(c.accent, 0.7 * c.active);
        ctx.lineWidth = Math.max(2, s * 0.012);
        ctx.beginPath();
        ctx.arc(cx, cy, R + s * 0.075, start, start + Math.PI * 0.6);
        ctx.stroke();
      }
      return true;
    },
  };
}
