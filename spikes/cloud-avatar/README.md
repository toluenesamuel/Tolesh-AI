# Tolesh cloud avatar (prototype)

Status: **visual prototype for review. Not integrated into the main app.** The orb in `spikes/phone-probe/` is kept as rollback until this design is approved.

## What it is

A fluffy white cloud with one cohesive silhouette, soft shading, a blue rim, large blue eyes behind transparent glasses with electric-blue frames, dark brows, and a friendly mouth. It has six states (idle, listening, thinking, speaking, acting, error) and reacts to the cursor, touch, and keyboard. It is plain HTML, SVG, CSS, and JavaScript with **no dependencies**, **no SVG filters**, and **no network, camera, or microphone access**.

The visual target is the reference image supplied with Request L (`/tmp/arena-coding-uploads/image-1.png`, outside the repo). The result is an SVG interpretation of it, not a copy.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page, strict CSP (`default-src 'none'`, `connect-src 'none'`), state buttons, toggles |
| `cloud.css` | Layout, navy environment, touch targets (48 px), focus rings |
| `cloud.js` | Browser glue: pointer, touch, keyboard, frame loop, attribute updates |
| `cloud-core.js` | Behaviour: state targets, cursor attention with an approach edge, wink, gaze limits, blinks, speech level, reduced motion |
| `cloud-scene.js` | Geometry and SVG markup: one outline, lobe creases, glasses, irises, lids, brows, mouth |
| `tools/render-stills.mjs` | Writes the SVG stills in `stills/` from the same code |
| `stills/*.svg`, `stills/states/*.png` | Review stills: six states, two cursor poses, and the wink |
| `stills/browser/*.png` | Screenshots from headless Chromium during the browser tests |
| `tests/cloud.test.mjs` | 47 Node tests (logic, geometry, markup, safety) |
| `e2e/browser.test.mjs` | 22 browser tests in headless Chromium |
| `e2e/probe.browser.test.mjs` | 9 browser tests for the phone probe page |

## Design (v2)

- **Silhouette:** one closed outline, a Catmull-Rom curve through 96 points, built from a base ellipse with lobe bumps. There are no overlapping circles.
- **Body:** a radial gradient gives the white volume and the top highlight. A blue rim stroke outlines it. Soft creases show the lobes.
- **Glasses:** two rounded lenses with a blue gradient frame, a bridge, and arms. The lenses are a transparent glass fill.
- **Eyes:** large irises with a dark pupil and two highlights. A lid cover is cut from the lens outline, so it stays inside the glasses.
- **Brows and mouth:** dark brows with a worry and raise channel. A smile line, plus an open mouth shape for speaking.
- **Environment:** dark navy, with a small cyan glow at ground level.

## Behaviour

- **Cursor movement:** the eyes follow with tanh limits. Full iris travel is 5 units across and 4 units up or down, and the irises stay inside the lenses.
- **Cursor approaching:** inside 1.45 cloud radii the cloud notices, with a small lean toward the cursor and slightly wider eyes. Hysteresis holds the state until 1.7 radii, and the cloud relaxes after 1.2 s away.
- **Playful wink:** on the first frame the cursor comes near, the right eye winks for 0.5 s. It is off with reduced motion, and in the acting and error states.
- **Idle:** gentle float (4.2 s), breathing (3.6 s), and blinks every 2.4 to 5.2 s from a seeded generator (deterministic).
- **Listening:** the brows lift with the microphone level. Only a real level from the caller drives this. The page passes the level in, and nothing is faked.
- **Thinking:** the brows move slowly, and the gaze drifts up and to the side.
- **Speaking:** the mouth follows the voice level. Without a real level, the built-in simulated voice is used, and the "Simulated voice" toggle switches it off.
- **Acting:** focused, with narrowed eyes, looking ahead. Stop is always available in the surrounding app.
- **Error:** concerned but friendly. The eyes stay open, with a gentle smile, a small apologetic brow lift, and a relaxed tilt. There is no frown and only a faint coral accent.
- **Reduced motion:** float, breathing, blinking, drift, wink, and brow motion stop. Gaze tracking and state changes still work. Follows the OS setting, with a manual toggle.
- **Keyboard:** Tab to the cloud, then arrows move a virtual cursor. Escape releases it.
- **Touch:** the stage uses `touch-action: none`, so dragging moves the gaze instead of scrolling.

## Run the tests

```sh
node --test tests/cloud.test.mjs                           # unit: expect 47 pass
cd e2e && LD_LIBRARY_PATH=/tmp/chromium-libs/lib node --test browser.test.mjs   # expect 22 pass
cd e2e && LD_LIBRARY_PATH=/tmp/chromium-libs/lib node --test probe.browser.test.mjs   # expect 9 pass
```

The browser tests need a Chromium that `@sparticuz/chromium` can run. Its libraries were extracted to `/tmp/chromium-libs/` in this sandbox. They are not part of the repo. `e2e/node_modules` is gitignored and restored with `npm ci`.

## Performance notes (headless software rendering, not a phone)

- The first version of this redesign had a large full-area halo whose opacity changed every frame. The live page dropped to 1 to 14 fps within 20 s. The halo is now a small ground glow.
- Clip paths on animated parts and full-body overlay gradients were also costly to repaint, so they were removed. Lids are cut from the lens outline instead.
- The committed prototype (`HEAD` before this redesign) held about 61 fps in every run here. The new scene holds about 26 to 61 fps under sustained load on this 2-core sandbox, and varies between runs. The gap is not closed, and it is an open item for device testing.
- Headless screenshots take much longer than the old scene's, for the same reason.

## Licence and origin

Written from scratch for this project. The cloud concept and the idea of driving SVG shapes from a parameter set were informed by `smontlouis/bible-strong-avatar-lab` (AGPL-3.0-only). **No code, markup, or asset was copied from it.** Do not copy code from that repository without a licence decision, because the AGPL applies to copied code and to network-served modifications.

## Status (2026-10-16)

- **Request L redesign:** the cloud now has a single outline, glasses, large irises, dark brows, a navy environment, and the wink on approach. Decision D-19 in `OPEN_DECISIONS.md` covers the direction.
- **Probe:** `spikes/phone-probe/cloud/` holds exact copies of `cloud-core.js` and `cloud-scene.js`. A test fails if the copies drift from these files.
- **Tests:** unit 47/47. Browser 22/22 (headless Chromium, several sizes). Probe browser 9/9. The probe browser test was corrected for the 12 keyed parts in the new markup, then re-run on its own and passed.
- **Caveats:** all browser tests run in headless Linux Chromium, not on a phone. Frame rates are indicative only.

## Not done yet

- Real phone testing: mobile performance, real microphone, touch behaviour on hardware, GPU and mid-range render cost.
- Android, Tauri and Capacitor builds.
- Connection to the main app's conversation state and voice pipeline. The main app has no code yet.
- Mapping `affect` (warm, concerned and so on) to cloud expression, and a `muted/offline` pose.
- Keyboard arrows are wired in the prototype only, not in the probe.
- Resolving the frame-rate gap against the committed prototype on real hardware.
