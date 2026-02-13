# Future development ideas

Suggestions to make Space Music more interesting to watch and listen to.

---

## Prioritization by ease of implementation (minimal user help)

Assumes the implementer can edit code and fetch from the internet; "easy" means little or no input from you (e.g. no custom assets or design choices).

**Easiest (code only, no assets, can do fully without you):**

| Idea | Why easy |
|------|----------|
| Catchy riffs (section 3) | Replace scale arrays with note+duration riffs; scheduling logic already exists. Pure data + small code change. |
| Jazz ensemble roles (section 4) | Rename instruments and align riffs to roles (bass = walking, drums = groove). No new tech. |
| Puck appearance | Draw a glow, star, or simple shape in Canvas instead of one circle. No assets. |
| Hit feedback | On trigger, set a "lastHitTime" per instrument; in draw(), draw a ring or brighter stroke if within last ~200 ms. |
| Tempo control | One slider or buttons; set `Tone.Transport.bpm`. Same pattern as existing speed sliders. |
| More instruments (6–8) | More entries in instrument arrays and layout (e.g. circle with n points). No new concepts. |

**Easy (code + simple graphics or one-time lookup):**

| Idea | Why easy |
|------|----------|
| Instrument avatars as simple shapes | Inline SVG or Canvas paths (e.g. piano = rounded rect with keys, drum = circle, horn = cone). No external art; recognizability is "good enough" without cute polish. |
| Background / mood | Gradient or simple particle field in Canvas. Straightforward animation. |
| Key/scale control | Transpose function for note names; riff data as intervals or transpose-on-the-fly. Moderate code. |

**Moderate (code is doable; assets or choices may need you):**

| Idea | Why moderate |
|------|--------------|
| Real instruments via samples | Tone.Sampler wiring is straightforward. I can fetch and use a single, clearly licensed free pack (e.g. from Tone.js examples or a CC0 source) and document it; if you want a specific piano or drum set, you may need to supply files or pick from options. |
| Polished "cute" avatars | Simple geometric avatars are easy; "cute" illustrated icons usually need either you to supply art or me to generate and you to approve. |

**Harder (needs your input or assets):**

| Idea | Why harder |
|------|------------|
| Custom or high-quality samples | Legal and good-sounding piano/brass/drums often require you to provide WAV/MP3 or to choose from a shortlist I find. |
| Multiple riffs per instrument | Code is easy; writing several good riffs per instrument is design work you might want to steer. |

**Suggested order if implementing with minimal back-and-forth:**  
(1) Riffs + jazz roles, (2) Puck + hit feedback + tempo, (3) Simple avatars (inline SVG), (4) Background, (5) Key control, (6) Sampler + one free sample set, (7) More instruments or variation.

---

## 1. Instrument avatars (visual)

**Current:** Colored circles with text labels (Synth, AM, Pluck, FM, Bass).

**Idea:** Replace with small, recognizable graphics for each instrument so the scene reads as an ensemble at a glance.

- **Cute/stylized icons:** Simple SVG or small PNG sprites (e.g. piano keys, trumpet bell, drum, bass, sax) so each node looks like "that instrument" instead of a generic circle. Could be flat, line-art, or lightly animated (e.g. bounce when playing).
- **Placement:** Draw the graphic centered in the hit area; keep the existing collision radius so gameplay is unchanged. Optional: drop text labels once the icon is clear, or show label on hover.
- **Implementation:** Add an `avatar` or `iconUrl` (or inline SVG) per instrument; in `draw()`, render image/SVG instead of (or on top of) the circle. Reuse the same pulse (scale + color) when playing.

---

## 2. Real instruments (audio)

**Current:** Five synthesizers (saw, sine, pluck, FM, triangle bass). Same musical role; timbre is the only difference.

**Idea:** Model a small jazz-style ensemble with distinct roles: piano, bass, drums, brass (trombone/trumpet), and maybe sax or guitar.

**Options:**

- **Samples (most realistic):** Use Tone.Sampler (or similar) with short, loop-friendly samples (e.g. one note per key for piano, a few hits for drums, a phrase or single note for brass). You need a small set of WAV/MP3 assets; royalty-free or self-recorded. Each "instrument" is then a Sampler loaded with that set; patterns trigger the right sample at the right time. Pros: very recognizable, "real" feel. Cons: asset size, need to design or source samples.
- **Synthesis that suggests real instruments:** Keep everything in code but shape oscillators and filters to suggest piano (bright attack, fast decay), brushed snare (noise + tone), trombone (brassy filter + vibrato), etc. Tone has no built-in "piano" or "trombone" but you can get close with envelopes and filters. Pros: no assets, small bundle. Cons: still synthetic.
- **Hybrid:** Sampler for piano and drums (high impact), synthesis for bass and one lead (e.g. brass or sax) to limit asset count.

Recommendation: start with a defined "jazz quintet" (e.g. piano, double bass, drums, trombone, sax) and either (a) add a Sampler for 1–2 instruments and keep the rest synthetic, or (b) design a set of short riffs that work with Tone.Sampler for all five once you have samples.

---

## 3. Catchy riffs instead of simple scales

**Current:** Each instrument plays a fixed 5-note scale (or its reverse) on a loop; same rhythm and density for all.

**Idea:** Give each instrument a short, memorable riff (melody or rhythm) so that when the puck hits, you hear a recognizable "part" rather than a generic run.

- **Design:** 4–8 note phrases per instrument, with rhythm (e.g. eighth notes, syncopation, rests). Could be in a shared key (e.g. C minor or Bb for jazz) so layers always harmonize. Each instrument has a different rhythm and contour (e.g. bass: walking pattern; piano: chord stabs or a two-bar lick; drums: kick/snare/hi-hat pattern; brass: short melodic hook).
- **Implementation:** Replace `INSTRUMENT_PATTERNS` (and any scale logic) with per-instrument **riffs**: arrays of `{ note: string, duration: string }` (or similar) with optional rest. In `playPatternNow` and `makePattern`, schedule from the riff and loop every 2 or 4 bars. Optionally vary the loop length per instrument (e.g. drums 2 bars, piano 4 bars).
- **Variation:** Store 2–3 riffs per instrument and pick one when the instrument is first triggered (or rotate on each restart) so the same ensemble can sound slightly different each run.

---

## 4. Jazz ensemble roles (piano, bass, drums, brass, etc.)

**Idea:** Make the five slots map to a classic small jazz lineup so both sound and visuals tell a coherent story.

- **Suggested lineup (example):**  
  - Piano (chords or comping).  
  - Double bass (walking or simple groove).  
  - Drums (kick, snare, hi-hat pattern; can be a single Sampler or a few one-shots).  
  - Trombone or trumpet (short melodic phrase or stab).  
  - Sax (counter-melody or second phrase).

- **Why it helps:** Listeners immediately understand "this is a band." Avatars (piano, bass, drums, horn, sax) reinforce that. Riffs can be written to fit these roles (bass = low and rhythmic, drums = timekeeping, horns = melody).

- **Implementation:** Same as sections 2 and 3: define one "instrument" config per role (avatar, sound source, riff), then the existing puck logic (toggle on/off, random next, layering) stays the same.

---

## 5. Other improvements

- **Puck appearance:** Replace the plain circle with a small sprite or glow (e.g. note shape, spark, or "sound wave") so the traveling element is more visually interesting and readable against the instruments.
- **Background and mood:** Subtle gradient or slow-moving background (e.g. soft particles or a dim grid) to give a "stage" or "space" feel without distracting from the instruments and puck.
- **Hit feedback:** When the puck hits an instrument, add a brief flash, ring, or particle burst around that instrument so the moment of impact is clearer.
- **More instruments:** Increase from 5 to 6–8 once the lineup and riffs are defined; keep the same mechanics (random next, toggle, layers). More layers = richer texture but also more density; consider a simple "max active instruments" or ducking if it gets muddy.
- **Tempo control:** Expose Tone.Transport.bpm (e.g. a slider or preset buttons: 80, 100, 120) so users can slow down or speed up the whole piece without changing puck/instrument movement speed.
- **Key/scale control:** Optional selector for key (C, Bb, etc.) so riffs transpose and stay in harmony when the user changes key.

---

## Suggested order of work (by impact)

1. **Riffs (section 3):** Define 5 short riffs in code and plug them into the current synths. No new assets; immediate gain in catchiness and recognizability.  
2. **Avatars (section 1):** Add simple SVG or image icons per instrument so the scene reads as "instruments" not "circles."  
3. **Real instruments (section 2):** Introduce Tone.Sampler for one or two instruments (e.g. piano, drums) and align the rest with a jazz-ensemble plan (section 4).  
4. **Polish (section 5):** Puck graphic, hit feedback, tempo/key controls, then consider more instruments or variation (multiple riffs per instrument).

---

## Technical notes

- **Assets:** If using samples, keep them short and sparse (one shot or one loop per note/hit) to control bundle size. Consider loading Samplers after "Start audio" so the initial page stays light. See [SAMPLES.md](SAMPLES.md) for source and license of sample packs used.
- **Tone.Sampler:** Fits well with riffs: trigger attack/release by note name and duration; loop a sequence of those. Same pattern as current `playPatternNow` / `makePattern` but with a Sampler instead of a Synth.
- **Drawing:** Canvas `drawImage()` for PNG/SVG-in-canvas, or keep DOM/SVG overlays for avatars if you prefer (position absolutely over the canvas using the same x, y as the instrument center).
