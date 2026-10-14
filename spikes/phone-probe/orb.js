// Throwaway probe renderer: one full-screen quad and one fragment shader (WebGL2).
// No libraries. Colours are the working palette from docs/FRONTEND_IMPLEMENTATION_PLAN.md §3.3.

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
uniform float u_t;
uniform float u_level;
uniform float u_speak;
uniform float u_active;
uniform float u_error;
uniform vec3 u_color;
out vec4 o;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float r = length(p);
  float a = atan(p.y, p.x);
  float wob = 0.012 * sin(3.0 * a + u_t * 1.3) + 0.008 * sin(5.0 * a - u_t * 0.9);
  wob *= (1.0 - 0.7 * u_error);
  float amp = 0.02 + 0.10 * u_level + 0.08 * u_speak;
  float radius = 0.28 + amp * 0.5 * sin(u_t * 2.0) + wob * (1.0 + u_level + u_speak);
  float aa = 1.5 / min(u_res.x, u_res.y);
  float core = 1.0 - smoothstep(radius - aa, radius + aa, r);
  float glow = exp(-pow((r - radius) * 6.0, 2.0)) * (0.6 + 0.4 * sin(u_t * 3.0));
  float ring = (1.0 - smoothstep(0.008, 0.016, abs(r - (radius + 0.10)))) * max(u_active, u_error);
  float seg = step(0.0, sin(a * 4.0 + u_t * 2.0));
  ring *= mix(1.0, seg, u_active);
  float intensity = clamp(core * 0.85 + glow * 0.5 + ring * 0.9, 0.0, 1.0);
  o = vec4(u_color * intensity, intensity); // premultiplied alpha
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
  for (const n of ['u_res', 'u_t', 'u_level', 'u_speak', 'u_active', 'u_error', 'u_color']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  let scale = 1;
  const state = { lost: false };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state.lost = true; });

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

  return {
    kind: 'webgl2',
    resize,
    setScale(s) { scale = s; return resize(); },
    // p = { t, speed, level, speak, active, error, color }
    draw(p) {
      if (state.lost) return false;
      const { w, h } = resize();
      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_t, p.t * p.speed);
      gl.uniform1f(U.u_level, p.level);
      gl.uniform1f(U.u_speak, p.speak);
      gl.uniform1f(U.u_active, p.active);
      gl.uniform1f(U.u_error, p.error);
      gl.uniform3f(U.u_color, p.color[0], p.color[1], p.color[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
  };
}

// Canvas 2D fallback used when WebGL2 is unavailable. Same states, simpler drawing.
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
  return {
    kind: 'canvas2d',
    resize,
    setScale(s) { scale = s; return resize(); },
    draw(p) {
      const { w, h } = resize();
      ctx.clearRect(0, 0, w, h);
      const c = p.color.map((v) => Math.round(v * 255));
      const r = Math.min(w, h) * (0.28 + 0.05 * p.level + 0.04 * p.speak);
      const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r * 1.3);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.95)`);
      g.addColorStop(0.7, `rgba(${c[0]},${c[1]},${c[2]},0.35)`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      return true;
    },
  };
}
