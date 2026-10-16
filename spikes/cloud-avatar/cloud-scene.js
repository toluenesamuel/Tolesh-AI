// Geometry and SVG markup for the Tolesh cloud avatar (v2).
// Original work written for this project. Pure functions only: no DOM access, no network, no filters.
//
// v2 design: one cohesive cloud silhouette (a single closed outline, not overlapping circles),
// soft white volume with a blue rim, large blue eyes behind transparent glasses with electric-blue
// frames, dark brows and a friendly mouth. Every animated element carries data-k="<key>".
// poseAttrs(pose) returns the attribute values for those keys. The browser updates attributes per
// frame, and standalone stills use the same builder, so the stills and the live page share geometry.

export const VIEW = { w: 360, h: 320, cx: 180, cy: 160 };

const CX = 180;
const CY = 160;
const RX = 136; // base ellipse half-width before lobes
const RY = 92; // base ellipse half-height before lobes

// Lobes are bumps added to the base ellipse, in pixels, at an angle (degrees, 0 = right, 90 = down).
// Negative amplitude flattens the underside. Widths are in radians.
const BUMPS = [
  { a: -90, A: 32, w: 0.42 }, // crown
  { a: -135, A: 26, w: 0.36 }, // top left puff
  { a: -45, A: 30, w: 0.36 }, // top right puff
  { a: -170, A: 16, w: 0.3 }, // left shoulder
  { a: -10, A: 18, w: 0.3 }, // right shoulder
  { a: 165, A: 16, w: 0.3 }, // lower left puff
  { a: 15, A: 16, w: 0.3 }, // lower right puff
  { a: 90, A: -16, w: 0.5 }, // flatter underside
];

const deg = (d) => (d * Math.PI) / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fmt = (n) => Number(n.toFixed(2));

// Outline radius (from the centre) at angle theta.
export function outlineRadius(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const base = (RX * RY) / Math.sqrt((RY * c) ** 2 + (RX * s) ** 2);
  let r = base;
  for (const b of BUMPS) r += b.A * Math.exp(-((wrap(theta - deg(b.a)) / b.w) ** 2));
  return r;
}

// Catmull-Rom through points, as cubic Bézier segments. closed = true for the body outline.
function smoothPath(pts, closed) {
  const n = pts.length;
  let d = `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

const OUTLINE_N = 96; // enough for a smooth silhouette; fewer segments keep per-frame repaint cheap
export const OUTLINE_POINTS = Array.from({ length: OUTLINE_N }, (_, i) => {
  const t = (i / OUTLINE_N) * Math.PI * 2;
  const r = outlineRadius(t);
  return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
});
export const OUTLINE_D = smoothPath(OUTLINE_POINTS, true);

// Soft creases between lobes: inset arcs that give the cloud its fluffy volume without seams.
const CREASES = [
  { a: -140, inset: 22 },
  { a: -40, inset: 22 },
  { a: -90, inset: 30 },
  { a: 150, inset: 20 },
  { a: 30, inset: 20 },
];
export const CREASE_D = CREASES.map((c) => {
  const pts = [];
  for (let k = -4; k <= 4; k++) {
    const t = deg(c.a) + (k / 4) * 0.34;
    const r = outlineRadius(t) - c.inset;
    pts.push([CX + r * Math.cos(t), CY + r * Math.sin(t)]);
  }
  return smoothPath(pts, false);
});

// Face. Lenses are rounded rectangles centred on the eyes. Eyes sit inside the lenses. No clip paths
// on the face: the irises stay inside the lens travel limits and the lids are cut from the lens outline.
export const EYES = { L: { x: 146, y: 160 }, R: { x: 214, y: 160 } };
export const LENS = { w: 60, h: 50, rx: 21 };
export const IRIS = { rx: 13.5, ry: 16.5 };
export const GAZE_MAX = { x: 5, y: 4 }; // iris travel in viewBox units at full gaze
export const MOUTH = { x: 180, y: 206 };
export const BROW_Y = 118;
export const GROUND_Y = 262;

const innerSign = (side) => (side === 'L' ? 1 : -1);

// Lid edge height at horizontal offset dx from the eye centre.
// open 1 = edge above the lens (eye fully visible), open 0 = edge below the lens (closed).
// tilt > 0 raises the inner corner (focused or worried look).
export function lidY(side, open, tilt, dx) {
  const e = EYES[side];
  const base = e.y - 30 + (1 - open) * 60;
  return base - tilt * innerSign(side) * dx * 0.35;
}

// The lens outline as a polygon: a rounded rectangle with each corner arc sampled.
function lensPolygon(side) {
  const e = EYES[side];
  const hw = LENS.w / 2;
  const hh = LENS.h / 2;
  const r = LENS.rx;
  const corners = [
    [e.x + hw - r, e.y - hh + r, -90], // top right
    [e.x + hw - r, e.y + hh - r, 0], // bottom right
    [e.x - hw + r, e.y + hh - r, 90], // bottom left
    [e.x - hw + r, e.y - hh + r, 180], // top left
  ];
  const pts = [];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= 6; k++) {
      const a = ((a0 + k * 15) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

// Sutherland-Hodgman: keep the part of a polygon where g(p) >= 0. g is linear along each edge.
function keepWhere(poly, g) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ga = g(a);
    const gb = g(b);
    if (ga >= 0) out.push(a);
    if (ga >= 0 !== gb >= 0) {
      const t = ga / (ga - gb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Lid cover: the part of the lens above the lid edge. The cover is cut from the lens outline itself,
// so no clip-path is needed. Clip paths on animated groups were very slow to repaint in the browser.
// Fully open returns an empty path (nothing to draw).
export function lidD(side, open, tilt) {
  const e = EYES[side];
  const poly = keepWhere(lensPolygon(side), (p) => lidY(side, open, tilt, p[0] - e.x) - p[1]);
  if (poly.length < 3) return 'M0 0';
  return `M${poly.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(' L')} Z`;
}

// Brows: raise moves both up (+). worry lifts the inner end (apologetic or concerned).
export function browD(side, raise, worry) {
  const e = EYES[side];
  const inner = innerSign(side);
  const yOuter = BROW_Y - 5 * raise + 0.5 * worry;
  const yInner = BROW_Y - 5 * raise - 7 * worry;
  const xOuter = e.x - 30 * inner;
  const xInner = e.x + 22 * inner;
  const yMid = (yOuter + yInner) / 2 - 4; // a soft arch
  return `M${fmt(xOuter)} ${fmt(yOuter)} Q${fmt((xOuter + xInner) / 2)} ${fmt(yMid)} ${fmt(xInner)} ${fmt(yInner)}`;
}

// Smile: positive corners up, 0 is a flat line. Mouth centre stays put.
export function smileD(smile) {
  const y = MOUTH.y - 6;
  return `M${MOUTH.x - 14} ${y} Q${MOUTH.x} ${fmt(y + 25 * smile)} ${MOUTH.x + 14} ${y}`;
}

// Build an element string. A[key] (from poseAttrs) overrides the base attributes.
function node(tag, base, A, key, inner) {
  const merged = { ...base, ...(key && A[key] ? A[key] : {}) };
  if (key) merged['data-k'] = key;
  const attrs = Object.entries(merged)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  return inner === undefined ? `<${tag}${attrs}/>` : `<${tag}${attrs}>${inner}</${tag}>`;
}

function lensX(side) {
  return EYES[side].x - LENS.w / 2;
}

function faceMarkup(A) {
  const parts = [];
  // Bridge between the lenses.
  const bridgeY = EYES.L.y - 6;
  parts.push(
    node('path', { d: `M${EYES.L.x + LENS.w / 2} ${bridgeY} Q${CX} ${bridgeY - 9} ${EYES.R.x - LENS.w / 2} ${bridgeY}`, fill: 'none', stroke: 'url(#cl-frame)', 'stroke-width': 3.4, 'stroke-linecap': 'round' }, A, null),
  );
  // Arms run back toward the sides of the head.
  for (const side of ['L', 'R']) {
    const e = EYES[side];
    const ox = side === 'L' ? e.x - LENS.w / 2 : e.x + LENS.w / 2;
    const dir = side === 'L' ? -1 : 1;
    parts.push(
      node('path', { d: `M${fmt(ox)} ${e.y - 8} Q${fmt(ox + dir * 12)} ${e.y - 9} ${fmt(ox + dir * 24)} ${e.y - 4}`, fill: 'none', stroke: 'url(#cl-frame)', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.9 }, A, null),
    );
  }
  // Lenses: glass fill, then the iris, then the lid cover (cut to the lens shape), then the frame on top.
  for (const side of ['L', 'R']) {
    const e = EYES[side];
    const lx = lensX(side);
    const ly = e.y - LENS.h / 2;
    const iris = [
      node('ellipse', { cx: e.x, cy: e.y, rx: IRIS.rx, ry: IRIS.ry, fill: 'url(#cl-iris)' }, A, null),
      node('ellipse', { cx: e.x, cy: e.y, rx: IRIS.rx, ry: IRIS.ry, fill: 'none', stroke: '#8BEBFF', 'stroke-width': 1.1, 'stroke-opacity': 0.75 }, A, null),
      node('circle', { cx: e.x, cy: e.y + 0.5, r: 5.6, fill: '#050B22' }, A, null),
      node('circle', { cx: fmt(e.x - 4.6), cy: fmt(e.y - 5.4), r: 3.8, fill: '#FFFFFF' }, A, null),
      node('circle', { cx: fmt(e.x + 4.2), cy: fmt(e.y + 4.6), r: 1.8, fill: '#FFFFFF', 'fill-opacity': 0.85 }, A, null),
    ].join('');
    parts.push(
      node('rect', { x: lx, y: ly, width: LENS.w, height: LENS.h, rx: LENS.rx, fill: 'url(#cl-glass)' }, A, null),
      node('g', {}, A, `gaze${side}`, iris),
      node('path', { d: lidD(side, 1, 0), fill: 'url(#cl-lid)' }, A, `lid${side}`),
      node('rect', { x: lx, y: ly, width: LENS.w, height: LENS.h, rx: LENS.rx, fill: 'none', stroke: 'url(#cl-frame)', 'stroke-width': 3.6 }, A, null),
      // A static glint on the glass.
      node('path', { d: `M${fmt(lx + 9)} ${fmt(ly + 12)} Q${fmt(lx + 13)} ${fmt(ly + 8)} ${fmt(lx + 19)} ${fmt(ly + 7)}`, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-opacity': 0.5 }, A, null),
    );
  }
  // Brows: dark, confident, separate from the glasses.
  parts.push(node('path', { d: browD('L', 0, 0), fill: 'none', stroke: '#16264A', 'stroke-width': 5.4, 'stroke-linecap': 'round' }, A, 'browL'));
  parts.push(node('path', { d: browD('R', 0, 0), fill: 'none', stroke: '#16264A', 'stroke-width': 5.4, 'stroke-linecap': 'round' }, A, 'browR'));
  // Mouth: a smile line, plus an open shape for speaking.
  parts.push(node('path', { d: smileD(0.4), fill: 'none', stroke: '#14285A', 'stroke-width': 3.4, 'stroke-linecap': 'round' }, A, 'smile'));
  parts.push(node('ellipse', { cx: MOUTH.x, cy: MOUTH.y, rx: 6, ry: 2, fill: '#0E1E4E', 'fill-opacity': 0 }, A, 'mouthOpen'));
  return parts.join('');
}

// Attribute-keyed body markup. A is the attribute map (poseAttrs output), or {} for defaults.
export function cloudInnerMarkup(A = {}) {
  const defs = `<defs>
    <radialGradient id="cl-body" cx="40%" cy="28%" r="80%">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.42" stop-color="#F6FAFF"/>
      <stop offset="0.78" stop-color="#DCE9F8"/>
      <stop offset="1" stop-color="#B2C9E8"/>
    </radialGradient>
    <linearGradient id="cl-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C4F6FF"/>
      <stop offset="0.5" stop-color="#4DBBFF"/>
      <stop offset="1" stop-color="#2A6BE0"/>
    </linearGradient>
    <linearGradient id="cl-frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#C6F8FF"/>
      <stop offset="0.5" stop-color="#2FA6FF"/>
      <stop offset="1" stop-color="#1A6FE8"/>
    </linearGradient>
    <linearGradient id="cl-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E8F8FF" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#9EDBFF" stop-opacity="0.07"/>
    </linearGradient>
    <linearGradient id="cl-lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#DCEAF9"/>
    </linearGradient>
    <radialGradient id="cl-iris" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#7AD2FF"/>
      <stop offset="0.5" stop-color="#2468E6"/>
      <stop offset="1" stop-color="#0A1E66"/>
    </radialGradient>
    <radialGradient id="cl-halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#3B9BFF" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#2F7BFF" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#2F7BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cl-coral" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FF8A8A" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#FF8A8A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cl-ground" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0B2A6B" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#0B2A6B" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  // Glows sit under the cloud, at ground level. They are kept small on purpose: a large glow whose
  // opacity changes every frame forces a repaint of its whole area, which made the live page stutter.
  const halo = node('ellipse', { cx: CX, cy: GROUND_Y + 2, rx: 128, ry: 14, fill: 'url(#cl-halo)', 'fill-opacity': 0 }, A, 'glowCyan');
  const coral = node('ellipse', { cx: CX, cy: GROUND_Y + 2, rx: 96, ry: 10, fill: 'url(#cl-coral)', 'fill-opacity': 0 }, A, 'glowCoral');
  const ground = node('ellipse', { cx: CX, cy: GROUND_Y, rx: 118, ry: 9, fill: 'url(#cl-ground)', 'fill-opacity': 0.5 }, A, 'ground');

  // The body is one fill (the radial gradient carries the highlight and the shade), the soft creases,
  // a rim stroke, and the face. No clip paths and no full-body overlays: those were the main repaint cost.
  const creases = CREASE_D.map((d) => `<path d="${d}" fill="none" stroke="#6F93C6" stroke-opacity="0.16" stroke-width="5" stroke-linecap="round"/>`).join('');
  const bodyInner = [
    node('path', { d: OUTLINE_D, fill: 'url(#cl-body)' }, A, null),
    creases,
    `<path d="${OUTLINE_D}" fill="none" stroke="url(#cl-rim)" stroke-width="2.4" stroke-linejoin="round"/>`,
    faceMarkup(A),
  ].join('');
  const body = node('g', {}, A, 'body', bodyInner);

  return `${defs}${halo}${coral}${ground}${body}`;
}

// Standalone SVG document for stills. attrs is the output of poseAttrs(pose).
export function cloudStandaloneSvg(attrs = {}, size = 2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" width="${VIEW.w * size}" height="${VIEW.h * size}">${cloudInnerMarkup(attrs)}</svg>`;
}

// Map a pose (plain numbers) to attribute values for each data-k key.
export function poseAttrs(p) {
  const groundScale = Math.max(0.6, 1 - p.floatY / 60);
  const gaze = `translate(${fmt(p.gx * GAZE_MAX.x)} ${fmt(p.gy * GAZE_MAX.y)})`;
  const wink = p.wink || 0;
  const mo = p.mouthOpen;
  const ry = 0.8 + 7 * mo;
  const rxMouth = (4.5 + 3 * mo) * (1 + 0.16 * (p.mouthWide || 0));
  const ryMouth = ry * (1 - 0.14 * (p.mouthWide || 0));
  return {
    body: {
      transform: `translate(0 ${fmt(p.floatY)}) translate(${CX} ${CY}) rotate(${fmt(p.tilt)}) scale(${fmt(p.scaleX)} ${fmt(p.scaleY)}) translate(${-CX} ${-CY})`,
    },
    ground: { rx: fmt(118 * groundScale), 'fill-opacity': fmt(0.5 * groundScale) },
    glowCyan: { 'fill-opacity': fmt(Math.min(0.6, p.glowCyan * 1.6)) },
    glowCoral: { 'fill-opacity': fmt(Math.min(0.6, p.glowCoral * 1.4)) },
    lidL: { d: lidD('L', p.open, p.lidTilt) },
    // The right eye closes on a wink. The left eye stays as it is.
    lidR: { d: lidD('R', p.open * (1 - wink), p.lidTilt) },
    browL: { d: browD('L', p.raise, p.worry) },
    browR: { d: browD('R', p.raise, p.worry) },
    gazeL: { transform: gaze },
    gazeR: { transform: gaze },
    smile: { d: smileD(p.smile) },
    mouthOpen: {
      rx: fmt(rxMouth),
      ry: fmt(ryMouth),
      cy: fmt(MOUTH.y - 1 + ryMouth * 0.45),
      'fill-opacity': fmt(Math.min(1, mo * 3)),
    },
  };
}
