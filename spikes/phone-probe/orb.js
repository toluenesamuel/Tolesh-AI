// Throwaway probe renderer for the companion orb (WebGL2 with a 2D fallback). No libraries.
// Design goals: a symmetric sphere with soft lighting, a rim glow, a smooth halo and gentle motion.
// Shape rules: the outline uses only even harmonics (cos 2a, cos 4a), so it stays mirror-symmetric.
// Odd harmonics, which made the earlier blob lopsided, are not used.
// Colours are the working palette from docs/FRONTEND_IMPLEMENTATION_PLAN.md §3.3 (unchanged).

export const STATES = {
  idle:      { color: [0.561, 0.639, 0.761], speed: 0.6, active: 0, error: 0 },
  listening: { color: [0.310, 0.890, 0.784], speed: 1.0, active: 0, error: 0 },
  thinking:  { color: [0.961, 0.725, 0.306], speed: 0.8, active: 0, error: 0 },
  speaking:  { color: [0.435, 0.827, 1.000], speed: 1.0, active: 0, error: 0 },
  acting:    { color: [0.710, 0.949, 0.420], speed: 0.9, active: 1, error: 0 },
  error:     { color: [1.000, 0.541, 0.541], speed: 0.2, active: 0, error: 1 },
};

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_t;        // phase in seconds (frozen when reduced motion is on)
uniform float u_motion;   // 1 = animate, 0 = reduced motion
uniform float u_level;    // smoothed voice level, 0..1
uniform float u_speak;    // smoothed output level, 0..1
uniform float u_active;   // 0..1, acting arc
uniform float u_error;    // 0..1, calm and dim
uniform vec3 u_color;
out vec4 o;

const float R0 = 0.30;    // base radius in units of the short canvas side

void main() {
  float s = min(u_res.x, u_res.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / s;
  float r = length(p);
  float a = atan(p.y, p.x);

  // Breathing: a uniform scale, so it stays perfectly round.
  float breathe = 0.010 * sin(u_t * 0.9) * u_motion;

  // Voice deformation: only even harmonics, so the outline stays symmetric.
  float pulse = 0.5 + 0.5 * sin(u_t * 1.7);
  float ampV = (0.004 * u_level + 0.003 * u_speak) * (0.6 + 0.4 * pulse) * u_motion;
  float calm = 1.0 - u_error;
  float deform = ((0.0025 * u_motion + ampV) * cos(2.0 * a)
                + (0.0010 * u_motion + 0.5 * ampV) * cos(4.0 * a)) * calm;

  float R = R0 * (1.0 + breathe) + deform;

  float aa = 1.5 / s;
  float d = r - R;
  float body = 1.0 - smoothstep(-aa, aa, d);
  float outside = max(d, 0.0);
  float halo = exp(-outside * 16.0) * (0.30 + 0.35 * u_level + 0.20 * u_speak) * (1.0 - 0.5 * u_error);

  // Sphere normal from the normalised disc position.
  vec2 q = p / R;
  float qz = sqrt(max(1.0 - dot(q, q), 0.0));
  vec3 n = vec3(q, qz);
  vec3 L = normalize(vec3(-0.5, 0.55, 0.67));  // light from the upper left
  float ndl = dot(n, L);
  float wrap = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float hh = max(dot(n, H), 0.0);
  float spec = hh * hh * hh * hh * hh * hh * hh * hh * 0.35;   // soft highlight, hh^8
  float rim = (1.0 - qz) * (1.0 - qz);
  rim = rim * rim * 0.9;                                      // edge glow

  // Slow internal flow, smooth and symmetric about the centre.
  float flow = 0.5 + 0.5 * sin(q.x * 2.4 + u_t * 0.6 + 1.3 * sin(q.y * 1.8 - u_t * 0.45));
  float flowAmt = mix(1.0, mix(0.92, 1.08, flow), u_motion);

  vec3 base = u_color * (0.22 + 0.78 * wrap) * flowAmt;
  base += u_color * rim;
  base += vec3(spec);
  base += u_color * u_speak * 0.22 * (1.0 - min(length(q), 1.0));
  base = clamp(base, 0.0, 1.0);

  // Acting: a smooth sweeping arc on the halo (no hard segments).
  float sweep = 0.5 + 0.5 * cos(a - u_t * 1.6);
  float arcMask = sweep * sweep * sweep;
  float dr = (r - (R + 0.075)) * 55.0;
  float ring = exp(-dr * dr) * arcMask * u_active;

  float ext = halo + ring;
  float alpha = clamp(body + ext * (1.0 - body), 0.0, 1.0);
  vec3 rgb = base * body + u_color * ext * (1.0 - body);
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

// Shared easing: colour and levels glide (attack fast, release slower). Reduced motion snaps.
function makeSmoother() {
  const cur = { color: [0.561, 0.639, 0.761], level: 0, speak: 0, active: 0, error: 0, phase: 0 };
  let lastNow = null;
  return {
    cur,
    step(p) {
      const dt = lastNow === null ? 0 : Math.min(0.1, (p.now - lastNow) / 1000);
      lastNow = p.now;
      if (p.reduced) {
        cur.color = p.color.slice();
        cur.level = p.level; cur.speak = p.speak; cur.active = p.active; cur.error = p.error;
        return cur;
      }
      const kc = 1 - Math.exp(-dt * 5);
      for (let i = 0; i < 3; i++) cur.color[i] += (p.color[i] - cur.color[i]) * kc;
      const ease = (k, target, rise, fall) => k + (target - k) * (1 - Math.exp(-dt * (target > k ? rise : fall)));
      cur.level = ease(cur.level, p.level, 18, 5);
      cur.speak = ease(cur.speak, p.speak, 18, 6);
      cur.active = ease(cur.active, p.active, 6, 6);
      cur.error = ease(cur.error, p.error, 4, 4);
      cur.phase += dt * p.speed;
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
  // One oversized triangle covers the whole viewport.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['u_res', 'u_t', 'u_motion', 'u_level', 'u_speak', 'u_active', 'u_error', 'u_color']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  let scale = 1;
  const lost = { v: false };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost.v = true; });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    return { w, h };
  }

  const sm = makeSmoother();
  return {
    kind: 'webgl2',
    resize,
    setScale(s) { scale = s; return resize(); },
    // p = { now (ms), speed, level, speak, active, error, color, reduced }
    draw(p) {
      if (lost.v) return false;
      const c = sm.step(p);
      const { w, h } = resize();
      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_t, c.phase);
      gl.uniform1f(U.u_motion, p.reduced ? 0 : 1);
      gl.uniform1f(U.u_level, c.level);
      gl.uniform1f(U.u_speak, c.speak);
      gl.uniform1f(U.u_active, c.active);
      gl.uniform1f(U.u_error, c.error);
      gl.uniform3f(U.u_color, c.color[0], c.color[1], c.color[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
  };
}

// Canvas 2D fallback (no WebGL2). Same palette, same symmetric sphere look, simpler lighting.
export function createOrb2D(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let scale = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  }
  const sm = makeSmoother();
  const rgb = (c, k = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${k})`;
  return {
    kind: 'canvas2d',
    resize,
    setScale(s) { scale = s; return resize(); },
    draw(p) {
      const { w, h } = resize();
      const c = sm.step(p);
      const cx = w / 2, cy = h / 2;
      const s = Math.min(w, h);
      const R = s * (0.30 + 0.012 * c.level + 0.008 * c.speak);
      ctx.clearRect(0, 0, w, h);

      // Halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.7);
      halo.addColorStop(0, rgb(c.color, 0.30 + 0.25 * c.level));
      halo.addColorStop(1, rgb(c.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, Math.PI * 2); ctx.fill();

      // Body: lit from the upper left
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      body.addColorStop(0, rgb([Math.min(1, c.color[0] + 0.45), Math.min(1, c.color[1] + 0.45), Math.min(1, c.color[2] + 0.45)], 0.98));
      body.addColorStop(0.55, rgb(c.color, 0.95));
      body.addColorStop(1, rgb(c.color.map((v) => v * 0.35), 0.98));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // Acting: soft arc on the halo, smooth sweep
      if (c.active > 0.01) {
        const sweep = (Math.sin(c.phase * 1.6) + 1) / 2;
        ctx.strokeStyle = rgb(c.color, 0.6 * c.active);
        ctx.lineWidth = Math.max(2, s * 0.012);
        ctx.beginPath();
        ctx.arc(cx, cy, R + s * 0.075, sweep * Math.PI * 2, sweep * Math.PI * 2 + Math.PI * 0.6);
        ctx.stroke();
      }
      return true;
    },
  };
}
