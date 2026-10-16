# Tolesh cloud avatar (prototype)

Status: **visual prototype for review. Not integrated.** The orb in `spikes/phone-probe/` is unchanged.

## What it is

A soft white cloud with sculpted lobes, dimensional shading, and two expressive eyes. It has six states (idle, listening, thinking, speaking, acting, error) and reacts to the cursor, touch, and keyboard. It is plain HTML, SVG, CSS, and JavaScript with **no dependencies** and **no network, camera, or microphone access**.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page, strict CSP (`default-src 'none'`, `connect-src 'none'`), state buttons, toggles |
| `cloud.css` | Layout, touch targets (48 px), focus rings, dark theme |
| `cloud.js` | Browser glue: pointer, touch, keyboard, frame loop, attribute updates |
| `cloud-core.js` | Behaviour: state targets, cursor attention with hysteresis, gaze limits, blinks, speech level, reduced motion |
| `cloud-scene.js` | Geometry and SVG markup (lobes, eyes, lids, brows, mouth, shading) |
| `tools/render-stills.mjs` | Writes the stills in `stills/` from the same code |
| `stills/*.svg`, `stills/*.png` | Review stills: six states and two cursor poses |
| `tests/cloud.test.mjs` | 31 Node tests (logic, markup, safety) |

## Behaviour

- **Cursor movement:** the eyes follow with tanh limits (they ease toward the edge and never leave their socket). Movement eases with a 0.12 s half-life.
- **Cursor approaching:** inside 1.45 cloud radii the cloud notices: a small lean toward the cursor and slightly wider eyes. Hysteresis holds the state until 1.7 radii, and the cloud relaxes after 1.2 s away.
- **Idle:** gentle float (4.2 s), breathing (3.6 s), and blinks every 2.4 to 5.2 s from a seeded generator (deterministic).
- **Listening, thinking, acting, error:** each has a target pose. Changes ease over time (half-life 0.3 s), so there are no jumps.
- **Speaking:** the mouth follows the voice level. Without a real level, a deterministic simulated voice is used. The "Simulated voice" toggle switches it off.
- **Reduced motion:** float, breathing, blinking, and drift stop. Gaze tracking and state changes still work. Follows the OS setting, with a manual toggle.
- **Keyboard:** Tab to the cloud, then arrows move a virtual cursor. Escape releases it.
- **Touch:** the stage uses `touch-action: none`, so dragging moves the gaze instead of scrolling.

## Run the tests

```sh
node --test tests/cloud.test.mjs
```

Expected: 31 pass, 0 fail. These tests cover logic, markup, and safety. **They do not test rendering in a browser**, which has not been done.

## Licence and origin

Written from scratch for this project. The cloud concept and the idea of driving SVG shapes from a parameter set were informed by `smontlouis/bible-strong-avatar-lab` (AGPL-3.0-only). **No code, markup, or asset was copied from it.** Do not copy code from that repository without a licence decision, because the AGPL applies to copied code and to network-served modifications.

## Status (2026-10-16)

- **Approved** as Tolesh's visual identity and **replaces the orb entirely** (Request K). Decision D-19 in `OPEN_DECISIONS.md`.
- **Integrated into the phone probe** (`spikes/phone-probe/`) as exact copies in `spikes/phone-probe/cloud/`. A test fails if the copies drift from these files. See that folder's README, "Cloud replacement".
- **Phase 2 changes:** a friendlier error face (open eyes, gentle smile, relaxed tilt, no frown); natural speech motion (irregular syllables, pauses, vowel-like mouth width, slow head sway, brow lifts on emphasis); listening follows a separate microphone input (`setInputLevel`); smoother transitions, checked by a unit test that limits per-frame change.
- **Tests:** unit `tests/cloud.test.mjs` 36/36. Browser `e2e/browser.test.mjs` 22/22 (headless Chromium, 390×844 and other sizes). Probe browser `e2e/probe.browser.test.mjs` 9/9 (fake microphone and test tone).
- **Blur filters removed:** SVG blur re-ran every frame and cost about a third of the frame rate in headless Chromium. Radial gradients give the same soft look.
- **Caveats:** all browser tests run in headless Linux Chromium, not on a phone. Frame rates are indicative only. The bundled Chromium comes from the npm package `@sparticuz/chromium`.

## Not done yet

- Real phone testing (mobile performance, real microphone, touch behaviour on hardware). Headless tests cannot show this.
- Connection to the main app's conversation state and voice pipeline. The main app has no code yet.
- Mapping `affect` (warm, concerned and so on) to cloud expression, and a `muted/offline` pose.
- Keyboard arrows are wired in the prototype only, not in the probe.
