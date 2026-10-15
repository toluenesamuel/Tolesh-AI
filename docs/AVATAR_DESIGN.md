# Tolesh avatar design (proposal for review)

Status: **proposal, not approved.** Nothing here replaces the existing orb in `spikes/phone-probe/`. The approval gate is at the end of this document.

Skill used: `ai-avatar` (Pancat009/ai-avatar-skill, MIT, commit `ca4ee96`), installed at `.agents/skills/ai-avatar/`. See `SOURCE.md` there for the installation record. The skill is a character-design workflow built for human OCs. Tolesh is an abstract AI companion, so only its method was applied: lock the visual anchors first, then write the identity, prompts, and consistency rules. Steps for human bodies (face, three-view, portrait sets) were not applied.

## 1. Visual anchor (locked for all previews)

- **Art style:** premium abstract luminous orb. Translucent glass with volumetric internal light and soft gradients. Product-render quality, not cartoon, not sticker, no hard outlines.
- **Palette (5):**

| Role | Hex | Source |
|---|---|---|
| Primary (electric blue) | `#3D9BFF` | Liquid Core base, `spikes/phone-probe/orb.js` |
| Deep blue | `#1A3FA8` | Liquid Core deep tone |
| Shadow navy | `#07102A` | new |
| Ice highlight | `#CFEFFF` | new |
| Cyan accent (speaking) | `#6FD3FF` | FRONTEND_IMPLEMENTATION_PLAN §3.3 |

- **Background:** near-black navy `#05070F`.
- **Negative prompt (applied to every render):** human face, person, animal, cartoon, anime, emoji, sticker or pasted-on look, hard black outline, text, watermark, lens-flare clutter, purple or pink gradient, creepy or staring eye, multiple eyes.
- **Seed:** the image tool does not expose seeds. Consistency comes from the identical anchor text in every call. The live shader will be the real consistency lock once implemented.
- **Composition:** vertical 9:16, one centred orb filling about 60% of frame width (the phone width target from FRONTEND plan §3.7).

## 2. Identity card (adapted for an AI)

- **Name:** Tolesh. **Species:** AI companion, never presented as human.
- **Presentation:** male-presenting persona, carried mainly by voice, name, and manner (PERSONALITY_AND_EMOTION_SPEC §1). Visually the avatar should read as steady, grounded, and understated. It should not be ornamental, soft-pastel, or cute. An abstract orb cannot carry gender alone, so this is a decision for you (§6).
- **Traits to express visually:** calm, focused, warm, attentive. No flattery or drama.

## 3. Concepts and renders

Renders: `spikes/avatar-preview/img/`. Preview page: `spikes/avatar-preview/index.html`. Each render was generated with the same anchor text. The image tool returns one image per call, so three concepts were rendered each at idle and speaking.

**Concept A, Steady Lumen.** Clear electric-blue glass sphere. An almond-shaped eye made of light, with a fibrous iris, a dark pupil, and a catchlight. Speaking adds horizontal light streaks through the glass.
- Strength: the most premium depth and glass quality.
- Risk: the eye reads as a literal human eyeball with a lid. That conflicts with D-19 ("no face") and can read as an "all-seeing eye" symbol.

**Concept B, Deep Well.** Deep navy sphere with electric-blue currents under the surface. A glowing iris ring with a dark pupil. Speaking intensifies the currents.
- Strength: the most atmospheric and living-looking movement. Low glare.
- Risk: the ringed eye reads as a lens or a sinister "evil eye" glow, especially at small sizes.

**Concept C, Halo Eclipse.** Bright electric-blue sphere with a thin cyan crescent halo. A dark disc with a horizontal slit of light. Speaking brightens the halo.
- Strength: the cleanest, most legible at phone size. The slit is the calmest and least face-like option. The halo gives a memorable mark.
- Risk: the black disc can read as a hole or eclipse. It has less internal depth than A or B.

## 4. Recommendation (my lean, for your decision)

No concept fully meets every brief item yet. The brief asks for premium depth, a distinctive living eye, and no face. My lean is **C's structure with B's internal currents and a softer, slit-like eye that opens and closes** (blink and widen). That keeps depth and calm and avoids the literal eyeball and the sinister ring. It fits the live shader approach already in `spikes/phone-probe/` (the eye uniforms), so the next step would be a shader study, not new art.

This is a recommendation only. Nothing is integrated.

## 5. State behaviour (to be built and tested in the live shader)

Stills here show idle and speaking only. Listening, thinking, acting, error, and paused must be built in the live orb and checked in motion, not in stills. Transitions should be continuous (no jumps in shape, size, or colour). Reduced motion gets a static version of each state.

## 6. Decisions needed from you

1. **Eye vs D-19.** D-19 is approved as "abstract orb, no face in v1". An eye is close to a face. Do you want to amend D-19 to allow an abstract eye, or keep the orb eye-free?
2. **Concept.** A, B, C, or the recommended hybrid?
3. **Male presentation.** Keep it to voice, name, and manner only, or should the visuals also lean steadier and less ornamental?
4. **Replacement.** Only after your approval should the existing orb in `spikes/phone-probe/` be replaced. Until then it stays unchanged.

## 7. What was not done

- No three-view, portrait, or outfit sets (human-character outputs, not applicable).
- No roleplay `system_prompt.md` (Tolesh's persona is governed by PERSONALITY_AND_EMOTION_SPEC.md).
- No application code, no dependency installs, no change to `spikes/phone-probe/`.
- No image seed control (tool limitation).
- Stills are not animation. They do not prove the living behaviour.
