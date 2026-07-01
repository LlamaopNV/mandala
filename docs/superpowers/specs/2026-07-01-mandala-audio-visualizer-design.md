# Mandala → Live Audio Visualizer — Design

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan

## Summary

Transform the existing cursor-driven Mandala page (`index.html`, single-file p5.js
app) into a **live audio visualizer**. The user supplies music — by pasting a
YouTube link that plays in an embedded player, by connecting real tab/system
audio, or by uploading an audio file — and the mandala **generates and reacts to
the real audio spectrum** in real time. The cursor stops being the primary driver;
audio takes over.

The page remains a single static `index.html` with no build step, so it keeps
working on GitHub Pages.

## Background & key constraint

The original request was "paste a YouTube link and make a cool visualizer." The
hard constraint discovered during design:

- **No mainstream streaming embed (YouTube, YouTube Music, Spotify) exposes its
  raw audio to the page.** YouTube/YT Music iframes are cross-origin and expose no
  audio; Spotify's Web Playback SDK is DRM-protected (Widevine/EME) so Web Audio
  cannot tap it, and Spotify's precomputed Audio-Analysis API was locked down for
  new apps in Nov 2024.
- **A static page CAN do genuine real-time analysis** via the Web Audio API. The
  missing piece is a *source the browser will let us read*. Two browser capture
  doorways tap audio **downstream** of the iframe (after decode), sidestepping the
  DRM/cross-origin wall:
  1. `getDisplayMedia({ audio: true })` — tab/system audio capture (Chrome/Edge
     desktop). User shares a tab with "share tab audio" ticked; the page receives
     a live audio track of the actual song.
  2. `getUserMedia({ audio: true })` — microphone (real but noisy; not chosen as a
     primary path here).
- **File upload** (`createMediaElementSource`) gives perfect FFT with no
  permissions, but is not streaming.

**Chosen approach:** Build on a Web Audio `AnalyserNode` core fed by a source
picker whose flagship is **tab-audio capture** (real reactivity to real YouTube),
with **file upload** as the always-works fallback, plus an **embedded YouTube
player** so pasting a link is self-contained on one page.

## Architecture

Single-file `index.html`, p5.js + native Web Audio. Three cooperating parts.

### 1. Audio engine (new core)

- `AudioContext` + `AnalyserNode`, `fftSize = 2048` (1024 frequency bins).
- Resumed on a user gesture (button click) to satisfy autoplay policy.
- Per frame, `getByteFrequencyData` is reduced to driving signals:
  - **bass**, **mids**, **highs** — averaged energy over low/mid/high bin ranges.
  - **level** — overall energy.
  - **beat/kick** — a simple detector: current bass/low-band energy vs. a running
    average; a beat fires when it exceeds the average by a threshold.
- All signals are **smoothed** (exponential easing) so motion is fluid, not
  jittery. Raw beat events are momentary; band signals are eased.

### 2. Source picker

Entry overlay presents three ways to feed the engine:

- **Paste a YouTube link** → parses the video ID, loads a **visible** embedded
  YouTube iframe player on the page. Self-contained; honors the original ask.
- **Connect audio** → `getDisplayMedia({ video: true, audio: true })` (video track
  is required by Chrome to offer tab capture; we use only the audio track). The
  returned stream's audio track feeds `createMediaStreamSource(stream) → analyser`.
  **Not** routed to `destination` (the tab already plays its own sound; routing
  would double it). User instruction in UI: pick "This Tab" and tick "share tab
  audio."
- **Upload a file** → `<input type="file" accept="audio/*">` → `<audio>` element →
  `createMediaElementSource(audioEl) → analyser → destination` (routed to
  destination so the user hears it). Includes play/pause. No permissions; the
  fallback for Safari/Firefox/mobile.

Feature detection: if `getDisplayMedia` (with audio) is unavailable, hide
"Connect audio" and steer to upload.

### 3. Mandala engine (reworked mapping)

Reuse the existing rendering machinery (`drawArm`, `drawStar`, symmetry loop,
mirror, stroke styles, palettes, glow, trail, particles, presets, save,
background). Change what *drives* it:

- An **auto-sweeping brush head**: an angle advances over time, tracing points; the
  radius and stroke are modulated by audio, so the mandala draws itself
  continuously while music plays.
- Audio → parameter mapping:
  - **bass** → bloom radius, brush weight, symmetry pulse
  - **mids** → hue-shift speed + rotation speed
  - **highs** → sparkle bursts + fine jitter
  - **level** → glow / brightness
  - **beat** → pulse ring / palette flash on the kick
- The **cursor remains an optional secondary brush** (machinery already exists —
  low cost), but audio is the default driver.

## Data flow

```
music source
  ├─ YouTube link → visible embedded iframe (plays audio out of the tab)
  ├─ Connect audio → getDisplayMedia stream → MediaStreamSource ┐
  └─ Upload file   → <audio> → MediaElementSource → destination ┤
                                                                 ▼
                                                            AnalyserNode
                                                                 │ per-frame FFT
                                                                 ▼
                                          bass / mids / highs / level / beat (smoothed)
                                                                 │
                                                                 ▼
                                              mandala parameter mapping → p5 render
```

## UI changes

- **Entry overlay** reworked: explains the flow and offers *Paste YouTube link*,
  *Connect audio*, *Upload a file*.
- **Music widget** repurposed to show the connected source and a disconnect/stop
  control (plus play/pause + volume for the file path).
- **Panel:** keep all existing art-direction controls. Add a small **Audio**
  section: *Reactivity amount*, *Bass/Treble emphasis*, *Beat flash* toggle.

## Error handling

- `getDisplayMedia` denied or returns no audio track → friendly message; suggest
  Upload instead.
- Unsupported browser (no tab audio: Safari/Firefox/mobile) → feature-detect, hide
  "Connect audio", show Upload.
- File decode error → message.
- Silent/empty stream (user forgot "share audio") → hint: "did you tick *share
  audio*?"
- `AudioContext` resumed on the button gesture (autoplay policy).

## Testing

Visual/interactive static page with no existing test harness — verification is
**manual**:

1. Serve locally; **Upload a file** → confirm the mandala reacts to bass/beats.
2. **Connect a tab** playing a YouTube song → confirm real reactivity.
3. **Deny** the share prompt → confirm graceful fallback to Upload.
4. Confirm feature-detection hides "Connect audio" where unsupported.

Driven with the `/run` + `verify` skills once built. Optionally a tiny
synthetic-signal self-check during development.

## Scope / YAGNI

**In:** Web Audio analyser core; three-source picker (YouTube embed / tab capture /
file); reworked audio→mandala mapping reusing existing visuals; three audio
controls; error/fallback handling.

**Out:** full per-band routing matrix UI; Safari/Firefox tab-capture workarounds;
any server/backend; microphone as a primary path. One file, real reactivity.

## Kept vs. changed

- **Kept:** all mandala rendering (symmetry, mirror, stroke styles, palettes, glow,
  trail, particles, presets, save, background) and the existing panel controls.
- **Changed:** hardcoded background YouTube player → user-driven source picker;
  primary driver cursor → audio.
- **Added:** audio engine, source picker + capture, audio→visual mapping, audio
  controls, fallbacks.
