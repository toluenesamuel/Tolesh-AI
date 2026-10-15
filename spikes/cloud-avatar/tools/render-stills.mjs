// Writes standalone SVG stills for each state and two cursor poses. Run: node tools/render-stills.mjs
// Output goes to stills/*.svg. Rasterise with any SVG tool to get PNG for review.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCloudController, STATE_NAMES } from '../cloud-core.js';
import { cloudStandaloneSvg, poseAttrs } from '../cloud-scene.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(here, 'stills');
mkdirSync(out, { recursive: true });

// Settle each pose for 3 s at 60 fps with motion frozen, so the still shows the target pose.
function settle(name, pointer = null) {
  const ctrl = createCloudController({ seed: 7, reducedMotion: true });
  ctrl.setState(name);
  ctrl.setPointer(pointer);
  let pose;
  for (let i = 1; i <= 180; i++) pose = ctrl.frame(1 / 60, i / 60);
  return pose;
}

const jobs = STATE_NAMES.map((n) => [n, n, null]);
jobs.push(['idle-cursor-near', 'idle', { x: 262, y: 150 }]);
jobs.push(['idle-cursor-far', 'idle', { x: 340, y: 300 }]);
for (const [file, state, pointer] of jobs) {
  const pose = settle(state, pointer);
  writeFileSync(join(out, `${file}.svg`), cloudStandaloneSvg(poseAttrs(pose), 2));
  console.log(`wrote stills/${file}.svg (${state}, pointer ${pointer ? JSON.stringify(pointer) : 'none'})`);
}
