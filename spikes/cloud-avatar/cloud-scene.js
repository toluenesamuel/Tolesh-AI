// Cloud geometry and SVG markup for the Tolesh cloud prototype.
// Original work written for this project. Pure functions only (no DOM access, no network).
//
// Every animated element carries data-k="<key>". poseAttrs(pose) returns the attribute values
// for those keys. The browser updates attributes each frame; the same builder renders
// standalone SVG stills, so the stills and the live page share one source of geometry.

export const VIEW = { w: 360, h: 320, cx: 180, cy: 160 };

// Lobes are circles. The body is their union (a clipPath), so the silhouette has no seams.
export const LOBES = [
  { x: 180, y: 112, r: 70 }, // crown
  { x: 118, y: 150, r: 56 }, // left shoulder
  { x: 244, y: 148, r: 58 }, // right shoulder
  { x: 146, y: 94, r: 48 }, // top left
  { x: 218, y: 92, r: 44 }, // top right
  { x: 70, y: 190, r: 36 }, // far left small lobe
  { x: 292, y: 188, r: 38 }, // far right small lobe
  { x: 112, y: 212, r: 44 }, // base left
  { x: 180, y: 222, r: 50 }, // base centre
  { x: 250, y: 212, r: 44 }, // base right
];

export const EYES = { L: { x: 150, y: 168 }, R: { x: 210, y: 168 } };
export const EYE_RX = 10;
export const EYE_RY = 14.5;
export const PUPIL_R = 6;
export const GAZE_MAX = { x: 4.5, y: 6 }; // pupil travel in viewBox units at full gaze
export const MOUTH = { x: 180, y: 206 };
export const BROW_Y = 134;
export const GROUND_Y = 288;

const fmt = (n) => Number(n.toFixed(2));

// Inner corners of the eyes: left eye's inner corner is on its right (+x), right eye's on its left.
const innerSign = (side) => (side === 'L' ? 1 : -1);

// Height of the lid edge at horizontal offset dx from the eye centre.
// open: 1 = fully open (edge at the top of the eye), 0 = closed to the centre line.
// tilt: positive raises the inner corner (a worried or focused look). Range about -1..1.
export function lidY(side, open, tilt, dx) {
  const e = EYES[side];
  const base = e.y - EYE_RY * open;
  return base - tilt * innerSign(side) * dx * 0.35;
}

// Region below the lid edge. Used as a clipPath; the eye shape clips it again.
export function lidPathD(side, open, tilt) {
  const e = EYES[side];
  const x0 = e.x - 14;
  const x1 = e.x + 14;
  return `M${fmt(x0)} ${fmt(lidY(side, open, tilt, -14))} L${fmt(x1)} ${fmt(lidY(side, open, tilt, 14))} L${fmt(x1)} ${e.y + 30} L${fmt(x0)} ${e.y + 30} Z`;
}

export function lidEdgeD(side, open, tilt) {
  const e = EYES[side];
  return `M${fmt(e.x - 12)} ${fmt(lidY(side, open, tilt, -12))} L${fmt(e.x + 12)} ${fmt(lidY(side, open, tilt, 12))}`;
}

// Brows: raise moves both up (+) or down (-). worry lifts the inner end.
export function browD(side, raise, worry) {
  const e = EYES[side];
  const inner = innerSign(side);
  const yBase = BROW_Y - 5 * raise;
  const yInner = yBase - 6 * worry;
  const yOuter = yBase + 0.5 * worry;
  const xOuter = e.x - 14 * inner;
  const xInner = e.x + 14 * inner;
  const yMid = (yOuter + yInner) / 2 - 2.2; // a soft arch, not a flat bar
  return `M${fmt(xOuter)} ${fmt(yOuter)} Q${fmt((xOuter + xInner) / 2)} ${fmt(yMid)} ${fmt(xInner)} ${fmt(yInner)}`;
}

// Smile is positive (corners up), 0 is flat, negative is a gentle frown.
export function smileD(smile) {
  const y = MOUTH.y - 2;
  return `M${MOUTH.x - 14} ${y} Q${MOUTH.x} ${fmt(y + 12 * smile)} ${MOUTH.x + 14} ${y}`;
}

// Build an element string. attrs[key] (from poseAttrs) overrides the base attributes.
function el(name, base, A, key, inner = '') {
  const merged = { ...base, ...(key && A[key] ? A[key] : {}) };
  if (key) merged['data-k'] = key;
  const attrText = Object.entries(merged)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  return inner === null ? `<${name}${attrText}/>` : `<${name}${attrText}>${inner}</${name}>`;
}

function eyeMarkup(side, A) {
  const e = EYES[side];
  const gazeKey = `gaze${side}`;
  return [
    // Socket shadow above the eye, so the eye sits into the cloud rather than on top of it.
    el('ellipse', { cx: e.x, cy: e.y - 6, rx: EYE_RX + 5, ry: EYE_RY * 0.7, fill: '#2A3F66', 'fill-opacity': 0.3, filter: 'url(#cl-soft)' }, A, null, null),
    `<g clip-path="url(#cl-lid-${side})">`,
    `<g clip-path="url(#cl-ell-${side})">`,
    el('ellipse', { cx: e.x, cy: e.y, rx: EYE_RX, ry: EYE_RY, fill: 'url(#cl-eye)' }, A, null, null),
    el(
      'g',
      {},
      A,
      gazeKey,
      [
        el('circle', { cx: e.x, cy: e.y, r: 7.5, fill: 'url(#cl-iris)', 'fill-opacity': 0.95 }, A, null, null),
        el('circle', { cx: e.x, cy: e.y, r: fmt(PUPIL_R * 0.55), fill: '#05080F' }, A, null, null),
        el('circle', { cx: fmt(e.x + 2.4), cy: fmt(e.y - 3), r: 1.7, fill: '#FFFFFF', 'fill-opacity': 0.95 }, A, null, null),
      ].join(''),
    ),
    '</g>',
    '</g>',
    el('path', { d: '', fill: 'none', stroke: '#0A1224', 'stroke-opacity': 0.5, 'stroke-width': 2, 'stroke-linecap': 'round' }, A, `lidEdge${side}`, null),
    el('path', { d: '', fill: 'none', stroke: '#1B2A4A', 'stroke-opacity': 0.38, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, A, `brow${side}`, null),
  ].join('');
}

// Attribute-keyed body markup. A is the attribute map (poseAttrs output), or {} for defaults.
export function cloudInnerMarkup(A = {}) {
  const clip = LOBES.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${l.r}"/>`).join('');
  const lobes = LOBES.map((l) => `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="url(#cl-lobe)"/>`).join('');
  const defs = `<defs>
    <radialGradient id="cl-body" cx="38%" cy="30%" r="78%">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="#F1F6FD"/>
      <stop offset="0.85" stop-color="#D3E0F3"/>
      <stop offset="1" stop-color="#AAC0DE"/>
    </radialGradient>
    <radialGradient id="cl-lobe" cx="36%" cy="30%" r="72%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.72" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.9" stop-color="#7F9CC8" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#5D7FB0" stop-opacity="0.22"/>
    </radialGradient>
    <radialGradient id="cl-iris" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#E6FAFF"/>
      <stop offset="0.45" stop-color="#6FD3FF"/>
      <stop offset="1" stop-color="#1A3FA8"/>
    </radialGradient>
    <radialGradient id="cl-eye" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#25395F"/>
      <stop offset="1" stop-color="#0A1224"/>
    </radialGradient>
    <filter id="cl-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="cl-glow" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="cl-clip">${clip}</clipPath>
    <clipPath id="cl-ell-L"><ellipse cx="${EYES.L.x}" cy="${EYES.L.y}" rx="${EYE_RX}" ry="${EYE_RY}"/></clipPath>
    <clipPath id="cl-ell-R"><ellipse cx="${EYES.R.x}" cy="${EYES.R.y}" rx="${EYE_RX}" ry="${EYE_RY}"/></clipPath>
    ${el('clipPath', { id: 'cl-lid-L' }, A, null, el('path', { d: '' }, A, 'lidL', null))}
    ${el('clipPath', { id: 'cl-lid-R' }, A, null, el('path', { d: '' }, A, 'lidR', null))}
  </defs>`;

  const ground = el('ellipse', { cx: 180, cy: GROUND_Y, rx: 104, ry: 9, fill: '#07102A', 'fill-opacity': 0.34, filter: 'url(#cl-glow)' }, A, 'ground', null);
  const glowCyan = el('ellipse', { cx: 180, cy: GROUND_Y + 2, rx: 78, ry: 6, fill: '#6FD3FF', 'fill-opacity': 0, filter: 'url(#cl-glow)' }, A, 'glowCyan', null);
  const glowCoral = el('ellipse', { cx: 180, cy: GROUND_Y + 2, rx: 60, ry: 5, fill: '#FF8A8A', 'fill-opacity': 0, filter: 'url(#cl-glow)' }, A, 'glowCoral', null);

  const bodyInner = [
    '<g clip-path="url(#cl-clip)">',
    `<rect x="0" y="0" width="${VIEW.w}" height="${VIEW.h}" fill="url(#cl-body)"/>`,
    '<ellipse cx="146" cy="82" rx="74" ry="34" fill="#FFFFFF" fill-opacity="0.9" filter="url(#cl-soft)"/>',
    '<ellipse cx="190" cy="262" rx="176" ry="64" fill="#1E3A6E" fill-opacity="0.16" filter="url(#cl-soft)"/>',
    lobes,
    '</g>',
    eyeMarkup('L', A),
    eyeMarkup('R', A),
    el('path', { d: '', fill: 'none', stroke: '#14213D', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, A, 'smile', null),
    el('ellipse', { cx: MOUTH.x, cy: MOUTH.y + 2, rx: 8, ry: 1, fill: '#14213D', 'fill-opacity': 0 }, A, 'mouthOpen', null),
  ].join('');
  const body = el('g', {}, A, 'body', bodyInner);

  return `${defs}${ground}${glowCyan}${glowCoral}${body}`;
}

// Standalone SVG document for stills. attrs is the output of poseAttrs(pose).
export function cloudStandaloneSvg(attrs = {}, size = 2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" width="${VIEW.w * size}" height="${VIEW.h * size}">${cloudInnerMarkup(attrs)}</svg>`;
}

// Map a pose (plain numbers) to attribute values for each data-k key.
export function poseAttrs(p) {
  const f = fmt;
  const groundScale = Math.max(0.6, 1 - p.floatY / 60);
  const gaze = `translate(${f(p.gx * GAZE_MAX.x)} ${f(p.gy * GAZE_MAX.y)})`;
  return {
    body: {
      transform: `translate(0 ${f(p.floatY)}) translate(180 160) rotate(${f(p.tilt)}) scale(${f(p.scaleX)} ${f(p.scaleY)}) translate(-180 -160)`,
    },
    ground: { rx: f(104 * groundScale), 'fill-opacity': f(0.34 * groundScale) },
    glowCyan: { 'fill-opacity': f(p.glowCyan) },
    glowCoral: { 'fill-opacity': f(p.glowCoral) },
    lidL: { d: lidPathD('L', p.open, p.lidTilt) },
    lidR: { d: lidPathD('R', p.open, p.lidTilt) },
    lidEdgeL: { d: lidEdgeD('L', p.open, p.lidTilt) },
    lidEdgeR: { d: lidEdgeD('R', p.open, p.lidTilt) },
    browL: { d: browD('L', p.raise, p.worry) },
    browR: { d: browD('R', p.raise, p.worry) },
    gazeL: { transform: gaze },
    gazeR: { transform: gaze },
    smile: { d: smileD(p.smile) },
    // Open mouth: narrower than the smile and hanging just below it, so it reads as talking.
    mouthOpen: {
      rx: f(4.5 + 3 * p.mouthOpen),
      ry: f(0.8 + 7 * p.mouthOpen),
      cy: f(MOUTH.y + 1 + (0.8 + 7 * p.mouthOpen) * 0.35),
      'fill-opacity': f(Math.min(1, p.mouthOpen * 3)),
    },
  };
}
