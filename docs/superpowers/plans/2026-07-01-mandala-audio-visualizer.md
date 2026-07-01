# Mandala Audio Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the cursor-driven Mandala page into a live audio visualizer that reacts to real music from a connected browser tab, an uploaded file, or an embedded YouTube player.

**Architecture:** A tiny pure-logic module (`audio-core.js`) holds all testable audio math (YouTube-ID parse, FFT→band reduction, beat detection, smoothing, feature-detect) and is unit-tested with Node's built-in test runner. `index.html` keeps the p5 render loop and adds a Web Audio `AnalyserNode` fed by a three-way source picker; the mandala is redrawn each frame by an auto-sweeping "brush head" whose radius/weight/hue/glow are modulated by the smoothed audio bands.

**Tech Stack:** p5.js 1.9 (already loaded via CDN), native Web Audio API, `getDisplayMedia` tab-audio capture, YouTube IFrame API (already loaded), Node 22 `node --test` for unit tests, `python -m http.server` for local serving.

## Global Constraints

- **No build step, static-only:** the site must run by opening `index.html` / serving the folder statically (GitHub Pages). No bundler, no npm dependencies shipped to the page. Copied verbatim from spec: "The page remains a single static `index.html` with no build step."
- **Deployable files:** `index.html` + `audio-core.js` only (both static). Test files live under `test/` and are never loaded by the page.
- **Tab capture must NOT route to `AudioContext.destination`** (the tab already plays its own sound — routing would double it). The file path MUST route to destination (so the user hears it).
- **Resume `AudioContext` on a user-gesture** (button click) to satisfy autoplay policy.
- **Browser support:** tab-audio capture targets Chrome/Edge desktop; feature-detect and fall back to file upload elsewhere. Copied from spec.
- **Reuse existing rendering machinery** (`drawArm`, `drawStar`, symmetry loop, mirror, stroke styles, palettes `PALETTE_RANGES`, glow, trail, particles, presets, save, background). Do not rewrite it.

---

### Task 1: Pure audio-core module (fully unit-tested)

**Files:**
- Create: `audio-core.js`
- Test: `test/audio-core.test.js`

**Interfaces:**
- Consumes: nothing (pure JS, no browser globals).
- Produces (global `AudioCore` in browser, `module.exports` in Node):
  - `parseYouTubeId(input: string): string | null`
  - `ease(current: number, target: number, factor: number): number`
  - `bandEnergy(freqData: Uint8Array|number[], lo: number, hi: number): number` — mean of `[lo,hi)` normalised to 0..1
  - `computeBands(freqData): { bass: number, mids: number, highs: number, level: number }` — each 0..1
  - `createBeatDetector(opts?): { push(energy: number): boolean, average: number }`
  - `canCaptureTabAudio(nav): boolean`

- [ ] **Step 1: Write the failing tests**

Create `test/audio-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const AudioCore = require('../audio-core.js');

test('parseYouTubeId: watch URL', () => {
  assert.strictEqual(
    AudioCore.parseYouTubeId('https://www.youtube.com/watch?v=WI4-HUn8dFc'),
    'WI4-HUn8dFc');
});

test('parseYouTubeId: youtu.be short URL with query', () => {
  assert.strictEqual(
    AudioCore.parseYouTubeId('https://youtu.be/WI4-HUn8dFc?t=42'),
    'WI4-HUn8dFc');
});

test('parseYouTubeId: music.youtube and shorts and bare id', () => {
  assert.strictEqual(
    AudioCore.parseYouTubeId('https://music.youtube.com/watch?v=abcdefghijk'),
    'abcdefghijk');
  assert.strictEqual(
    AudioCore.parseYouTubeId('https://www.youtube.com/shorts/abcdefghijk'),
    'abcdefghijk');
  assert.strictEqual(AudioCore.parseYouTubeId('abcdefghijk'), 'abcdefghijk');
});

test('parseYouTubeId: rejects junk', () => {
  assert.strictEqual(AudioCore.parseYouTubeId('not a url'), null);
  assert.strictEqual(AudioCore.parseYouTubeId(''), null);
  assert.strictEqual(AudioCore.parseYouTubeId(null), null);
});

test('ease: moves a fraction toward target', () => {
  assert.strictEqual(AudioCore.ease(0, 10, 0.5), 5);
  assert.strictEqual(AudioCore.ease(10, 10, 0.5), 10);
});

test('bandEnergy: mean normalised to 0..1', () => {
  // four bins all 255 -> 1.0; all 0 -> 0
  assert.strictEqual(AudioCore.bandEnergy([255, 255, 255, 255], 0, 4), 1);
  assert.strictEqual(AudioCore.bandEnergy([0, 0, 0, 0], 0, 4), 0);
  assert.strictEqual(AudioCore.bandEnergy([255, 0], 0, 2), 0.5);
  assert.strictEqual(AudioCore.bandEnergy([1, 2, 3], 0, 0), 0); // empty range
});

test('computeBands: bass-heavy signal has bass > highs', () => {
  const n = 100;
  const data = new Array(n).fill(0);
  for (let i = 0; i < 8; i++) data[i] = 255; // energy only in low bins
  const b = AudioCore.computeBands(data);
  assert.ok(b.bass > b.highs, `bass ${b.bass} should exceed highs ${b.highs}`);
  assert.ok(b.bass > 0 && b.bass <= 1);
  assert.strictEqual(AudioCore.computeBands([]).level, 0);
});

test('createBeatDetector: fires on a spike, respects refractory gap', () => {
  const bd = AudioCore.createBeatDetector({ sensitivity: 1.3, minGap: 4 });
  // build a baseline average with steady low energy
  for (let i = 0; i < 30; i++) bd.push(0.2);
  const first = bd.push(0.9);            // big spike -> beat
  const immediate = bd.push(0.9);        // within refractory -> no beat
  assert.strictEqual(first, true);
  assert.strictEqual(immediate, false);
});

test('canCaptureTabAudio: detects getDisplayMedia', () => {
  assert.strictEqual(
    AudioCore.canCaptureTabAudio({ mediaDevices: { getDisplayMedia: () => {} } }),
    true);
  assert.strictEqual(AudioCore.canCaptureTabAudio({ mediaDevices: {} }), false);
  assert.strictEqual(AudioCore.canCaptureTabAudio(undefined), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module '../audio-core.js'`.

- [ ] **Step 3: Write the module**

Create `audio-core.js`:

```js
(function (global) {
  'use strict';

  function parseYouTubeId(input) {
    if (typeof input !== 'string') return null;
    const s = input.trim();
    if (!s) return null;
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;              // bare id
    let m;
    m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);            // youtu.be/ID
    if (m) return m[1];
    m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);                 // watch?v=ID
    if (m) return m[1];
    m = s.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/); // /embed|shorts|live/ID
    if (m) return m[1];
    return null;
  }

  function ease(current, target, factor) {
    return current + (target - current) * factor;
  }

  function bandEnergy(freqData, lo, hi) {
    if (hi <= lo) return 0;
    let sum = 0;
    for (let i = lo; i < hi; i++) sum += freqData[i];
    return sum / (hi - lo) / 255;
  }

  function computeBands(freqData) {
    const n = freqData.length;
    if (!n) return { bass: 0, mids: 0, highs: 0, level: 0 };
    const bassHi = Math.max(1, Math.floor(n * 0.08));
    const midsHi = Math.max(bassHi + 1, Math.floor(n * 0.40));
    return {
      bass: bandEnergy(freqData, 0, bassHi),
      mids: bandEnergy(freqData, bassHi, midsHi),
      highs: bandEnergy(freqData, midsHi, n),
      level: bandEnergy(freqData, 0, n)
    };
  }

  function createBeatDetector(opts) {
    opts = opts || {};
    const decay = opts.decay != null ? opts.decay : 0.96;
    const sensitivity = opts.sensitivity != null ? opts.sensitivity : 1.35;
    const minGap = opts.minGap != null ? opts.minGap : 6;
    let avg = 0;
    let sinceBeat = minGap;
    return {
      push(energy) {
        sinceBeat++;
        let beat = false;
        if (avg > 0.0001 && energy > avg * sensitivity && sinceBeat >= minGap) {
          beat = true;
          sinceBeat = 0;
        }
        avg = avg * decay + energy * (1 - decay);
        return beat;
      },
      get average() { return avg; }
    };
  }

  function canCaptureTabAudio(nav) {
    return !!(nav && nav.mediaDevices &&
              typeof nav.mediaDevices.getDisplayMedia === 'function');
  }

  const AudioCore = {
    parseYouTubeId, ease, bandEnergy, computeBands,
    createBeatDetector, canCaptureTabAudio
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioCore;
  } else {
    global.AudioCore = AudioCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — all tests green (`# pass 9`, `# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add audio-core.js test/audio-core.test.js
git commit -m "feat: add pure audio-core module (parse/bands/beat) with tests"
```

---

### Task 2: Audio engine wiring in index.html

**Files:**
- Modify: `index.html` (`<head>` script tags; `<script>` block — add audio-engine state + functions; call from `setup()`/`draw()`)

**Interfaces:**
- Consumes: `AudioCore.computeBands`, `AudioCore.ease`, `AudioCore.createBeatDetector`.
- Produces (globals in the sketch script, used by later tasks):
  - `audioCtx: AudioContext | null`, `analyser: AnalyserNode | null`, `freqData: Uint8Array | null`
  - `audioSignals = { bass, mids, highs, level, beat }` (bands eased 0..1; `beat` is a boolean set true only on the frame a kick fires)
  - `ensureAudioContext(): void` — lazily creates ctx+analyser, resumes ctx
  - `connectAudioSource(node: AudioNode, { toDestination: boolean }): void` — connects a source node to the analyser (and optionally destination), disconnecting any previous source
  - `updateAudioSignals(): void` — call once per frame; refreshes `audioSignals`

- [ ] **Step 1: Add the script include**

In `index.html` `<head>`, immediately AFTER the p5 script line
(`<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>`), add:

```html
<script src="audio-core.js"></script>
```

- [ ] **Step 2: Add audio-engine state and functions**

In the sketch `<script>`, just after the `// ---------- YouTube music ----------` state
block (near `let ytPlayer = null;`), add:

```js
  // ---------- audio analysis engine ----------
  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let currentSourceNode = null;
  let beatDetector = AudioCore.createBeatDetector();
  let reactivity = 1.0; // user-controllable gain on band response (Task 5)
  const audioSignals = { bass: 0, mids: 0, highs: 0, level: 0, beat: false };

  function ensureAudioContext(){
    if (!audioCtx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function connectAudioSource(node, opts){
    ensureAudioContext();
    if (currentSourceNode){
      try { currentSourceNode.disconnect(); } catch (e) {}
    }
    currentSourceNode = node;
    node.connect(analyser);
    if (opts && opts.toDestination) node.connect(audioCtx.destination);
  }

  function updateAudioSignals(){
    if (!analyser){ audioSignals.beat = false; return; }
    analyser.getByteFrequencyData(freqData);
    const bands = AudioCore.computeBands(freqData);
    const g = reactivity;
    const f = 0.35; // easing snappiness
    audioSignals.bass  = AudioCore.ease(audioSignals.bass,  Math.min(bands.bass  * g, 1), f);
    audioSignals.mids  = AudioCore.ease(audioSignals.mids,  Math.min(bands.mids  * g, 1), f);
    audioSignals.highs = AudioCore.ease(audioSignals.highs, Math.min(bands.highs * g, 1), f);
    audioSignals.level = AudioCore.ease(audioSignals.level, Math.min(bands.level * g, 1), f);
    audioSignals.beat  = beatDetector.push(bands.bass);
  }
```

- [ ] **Step 3: Call updateAudioSignals each frame**

In `draw()`, add `updateAudioSignals();` as the FIRST line inside the function
(before the `if (autoRotate ...)` block):

```js
  function draw(){
    updateAudioSignals();

    if (autoRotate && rotateSpeed > 0){
```

- [ ] **Step 4: Manual verification — signals move with sound**

Run: `python -m http.server 8000` then open `http://localhost:8000` in Chrome.
In DevTools console, temporarily run to prove the pipeline (uses the mic just to
verify wiring; real sources come in Task 3):

```js
navigator.mediaDevices.getUserMedia({audio:true}).then(s => {
  ensureAudioContext();
  connectAudioSource(audioCtx.createMediaStreamSource(s), {toDestination:false});
  setInterval(() => console.log(JSON.stringify(audioSignals)), 500);
});
```

Expected: after granting mic, `bass/mids/highs/level` are non-zero and change when
you speak/play sound; `beat` occasionally logs `true`. Stop by reloading.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Web Audio analyser engine and per-frame signal pipeline"
```

---

### Task 3: Three-way source picker (YouTube embed / tab capture / file)

**Files:**
- Modify: `index.html` (`#enter-overlay` markup; styles for the picker; `#yt-player` sizing; sketch `<script>` — replace `onYouTubeIframeAPIReady`/entry wiring, add source functions)

**Interfaces:**
- Consumes: `ensureAudioContext`, `connectAudioSource`, `AudioCore.parseYouTubeId`, `AudioCore.canCaptureTabAudio`.
- Produces:
  - `startYouTube(url: string): boolean` — loads the id into a VISIBLE player; returns false on bad URL
  - `startTabCapture(): Promise<void>` — `getDisplayMedia`, connects audio track (no destination)
  - `startFileSource(file: File): void` — `<audio>` element → media-element source (to destination)
  - `enterVisualizer(): void` — hides overlay, shows music widget, resets brush, marks `hasEntered`

- [ ] **Step 1: Replace the entry overlay markup**

Replace the existing `#enter-overlay` block (the `<div id="enter-overlay"> … </div>`)
with:

```html
<div id="enter-overlay">
  <div class="enter-inner">
    <span class="enter-glyph">✦</span>
    <h1>MANDALA</h1>
    <p>Feed it music and it blooms. Paste a YouTube link, connect a tab that's
       already playing, or drop in an audio file.</p>

    <div class="source-block">
      <input type="text" id="ytUrl" placeholder="Paste a YouTube link…" autocomplete="off">
      <button id="ytGo" class="src-btn">Play &amp; visualize</button>
    </div>

    <div class="source-or">or</div>

    <div class="source-row">
      <button id="connectTab" class="src-btn ghost">🔊 Connect a tab’s audio</button>
      <label for="fileInput" class="src-btn ghost" id="fileLabel">🎵 Upload a file</label>
      <input type="file" id="fileInput" accept="audio/*" hidden>
    </div>

    <p class="src-hint" id="srcHint">
      Tip: for a tab, pick <b>This Tab</b> and tick <b>Share tab audio</b>.
    </p>
    <p class="src-error" id="srcError"></p>
  </div>
</div>
```

- [ ] **Step 2: Add picker styles**

In `<style>`, just before `/* ---- music widget ---- */`, add:

```css
  .source-block{ display:flex; gap:8px; margin:6px 0 10px; }
  #ytUrl{
    flex:1; padding:11px 13px; border-radius:24px;
    background:var(--select-bg); border:1px solid rgba(242,193,78,0.3);
    color:var(--ink); font-family:'Inter',sans-serif; font-size:13px;
  }
  #ytUrl:focus{ outline:1px solid var(--gold); }
  .src-btn{
    font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
    letter-spacing:0.04em; padding:11px 18px; border-radius:24px;
    border:1px solid rgba(242,193,78,0.5); color:var(--ink); white-space:nowrap;
    background:linear-gradient(90deg, rgba(242,193,78,0.20), rgba(255,62,148,0.20));
    transition: transform 0.15s ease, background 0.2s ease;
  }
  .src-btn:hover{ transform:translateY(-1px); background:linear-gradient(90deg, rgba(242,193,78,0.34), rgba(255,62,148,0.34)); }
  .src-btn.ghost{ background:rgba(255,255,255,0.03); border-color:rgba(242,193,78,0.3); font-weight:500; }
  .source-or{ color:var(--ink-dim); font-size:11px; letter-spacing:0.2em; text-transform:uppercase; margin:6px 0; }
  .source-row{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .src-hint{ font-size:11px !important; color:var(--ink-dim); margin:16px 0 0 !important; }
  .src-hint b{ color:var(--gold); font-weight:600; }
  .src-error{ font-size:12px; color:var(--magenta); margin:8px 0 0; min-height:16px; }
  #connectTab.unsupported{ display:none; }
```

- [ ] **Step 3: Make the YouTube player visible**

Replace the `#yt-player` container line:

```html
<div id="yt-player" style="position:fixed; width:0; height:0; overflow:hidden;"></div>
```

with a small visible player docked bottom-right:

```html
<div id="yt-player" style="position:fixed; right:16px; bottom:16px; width:240px; height:135px; z-index:12; border-radius:10px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); display:none;"></div>
```

- [ ] **Step 4: Rework the YouTube + entry + source wiring**

Replace the entire `onYouTubeIframeAPIReady` / `startMusic` pair AND the
`wireUpEntryAndMusic` function with the following. (Delete the old `videoId:'WI4-HUn8dFc'`
autoplay setup and the old mic-less music toggle logic; the new widget controls come in Task 5.)

```js
  // ---------- YouTube (visible, user-supplied) ----------
  let ytPlayer = null;
  let ytApiReady = false;
  let pendingVideoId = null;
  let hasEntered = false;

  function onYouTubeIframeAPIReady(){
    ytApiReady = true;
    if (pendingVideoId) createYtPlayer(pendingVideoId);
  }

  function createYtPlayer(videoId){
    document.getElementById('yt-player').style.display = 'block';
    if (ytPlayer){ ytPlayer.loadVideoById(videoId); ytPlayer.playVideo(); return; }
    ytPlayer = new YT.Player('yt-player', {
      width: '240', height: '135', videoId,
      playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0 },
      events: { onReady: (e) => e.target.playVideo() }
    });
  }

  function startYouTube(url){
    const id = AudioCore.parseYouTubeId(url);
    if (!id){ showSrcError('That doesn’t look like a YouTube link.'); return false; }
    if (ytApiReady) createYtPlayer(id); else pendingVideoId = id;
    // NOTE: the iframe plays audio out the tab; user connects it via "Connect a tab".
    showSrcHint('Now click “Connect a tab’s audio”, pick <b>This Tab</b>, and tick <b>Share tab audio</b>.');
    return true;
  }

  // ---------- tab / system audio capture ----------
  async function startTabCapture(){
    try {
      ensureAudioContext();
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const tracks = stream.getAudioTracks();
      if (tracks.length === 0){
        stream.getTracks().forEach(t => t.stop());
        showSrcError('No audio was shared. Re-try and tick “Share tab audio”.');
        return;
      }
      // We only need audio; stop the video track to save resources.
      stream.getVideoTracks().forEach(t => t.stop());
      const src = audioCtx.createMediaStreamSource(new MediaStream(tracks));
      connectAudioSource(src, { toDestination: false }); // tab already audible
      setMusicLabel('♫ live tab audio');
      enterVisualizer();
    } catch (err){
      showSrcError('Audio sharing was cancelled or blocked.');
    }
  }

  // ---------- uploaded file ----------
  let fileAudioEl = null;
  function startFileSource(file){
    ensureAudioContext();
    if (!fileAudioEl){ fileAudioEl = new Audio(); fileAudioEl.crossOrigin = 'anonymous'; }
    fileAudioEl.src = URL.createObjectURL(file);
    fileAudioEl.loop = true;
    const src = audioCtx.createMediaElementSource(fileAudioEl);
    connectAudioSource(src, { toDestination: true }); // must route so user hears it
    fileAudioEl.play();
    setMusicLabel('♫ ' + file.name);
    enterVisualizer();
  }

  function enterVisualizer(){
    document.getElementById('enter-overlay').classList.add('hidden');
    document.getElementById('music-widget').classList.add('visible');
    lastX = null; lastY = null;
    hasEntered = true;
  }

  // ---------- small UI helpers ----------
  function showSrcError(msg){ document.getElementById('srcError').innerHTML = msg; }
  function showSrcHint(msg){ document.getElementById('srcHint').innerHTML = msg; }
  function setMusicLabel(text){ const el = document.getElementById('musicLabel'); if (el) el.textContent = text; }

  function wireUpEntryAndMusic(){
    const $ = (id) => document.getElementById(id);

    $('ytGo').addEventListener('click', () => startYouTube($('ytUrl').value));
    $('ytUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') startYouTube($('ytUrl').value); });

    if (AudioCore.canCaptureTabAudio(navigator)){
      $('connectTab').addEventListener('click', startTabCapture);
    } else {
      $('connectTab').classList.add('unsupported');
      showSrcHint('Tab capture needs Chrome/Edge desktop — use <b>Upload a file</b>.');
    }

    $('fileInput').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) startFileSource(e.target.files[0]);
    });
  }
```

(`wireUpEntryAndMusic()` is already called from `setup()`; keep that call.)

- [ ] **Step 5: Manual verification — all three sources**

Run: `python -m http.server 8000`; open `http://localhost:8000` in Chrome.
- **File:** click *Upload a file*, choose an MP3 → overlay closes, music plays, and
  (after Task 4) the mandala reacts. For now confirm in console `audioSignals`
  values move: `setInterval(()=>console.log(audioSignals.level),500)`.
- **YouTube:** paste a link, click *Play & visualize* → visible player appears
  bottom-right and plays. Click *Connect a tab’s audio*, choose **This Tab** + tick
  **Share tab audio** → overlay closes; `audioSignals.level` moves with the song.
- **Bad URL:** paste `hello` → red "doesn’t look like a YouTube link" error.
- **Fallback:** in a browser without `getDisplayMedia`, the *Connect a tab* button is
  hidden and the hint points to Upload.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: three-way audio source picker (YouTube embed, tab capture, file)"
```

---

### Task 4: Audio-driven mandala engine

**Files:**
- Modify: `index.html` (sketch `<script>` — `draw()` brush-head loop; `drawMandalaStroke` signature/mapping; add beat-flash)

**Interfaces:**
- Consumes: `audioSignals` (from Task 2), existing `drawMandalaStroke`, `drawArm`,
  `paletteHue`, `PALETTE_RANGES`, `symmetry`, `mirror`, `glowIntensity`, etc.
- Produces:
  - `audioBrushStep(): void` — advances the virtual brush head one frame and draws a stroke driven by audio
  - `beatFlash: boolean` (Task 5 toggles it); `flashPulse: number` internal decay

- [ ] **Step 1: Add virtual brush + beat-flash state**

After the `let hueShift = 0; let lastX = null, lastY = null;` lines, add:

```js
  // ---------- audio-driven virtual brush ----------
  let brushAngle = 0;      // sweeps around the centre over time
  let brushRadius = 0;     // eased current radius
  let prevBrushX = null, prevBrushY = null;
  let beatFlash = true;    // user toggle (Task 5)
  let flashPulse = 0;      // decays 1 -> 0 after each beat
```

- [ ] **Step 2: Drive the mandala from audio in draw()**

In `draw()`, REPLACE the cursor-drawing tail — the block from `if (lastX === null){`
through the end of the function:

```js
    if (lastX === null){
      lastX = mouseX; lastY = mouseY;
      return;
    }

    if (mouseX !== lastX || mouseY !== lastY){
      drawMandalaStroke(lastX, lastY, mouseX, mouseY);
    }
    lastX = mouseX; lastY = mouseY;
  }
```

with an audio brush step that keeps the cursor as an optional secondary brush:

```js
    audioBrushStep();

    // Cursor stays live as an optional secondary brush.
    if (lastX !== null && (mouseX !== lastX || mouseY !== lastY)){
      drawMandalaStroke(lastX, lastY, mouseX, mouseY);
    }
    lastX = mouseX; lastY = mouseY;
  }

  function audioBrushStep(){
    const cx = width / 2, cy = height / 2;
    const maxR = min(width, height) * 0.46;

    // beat pulse decays each frame; refresh on a kick
    if (audioSignals.beat && beatFlash) flashPulse = 1;
    flashPulse *= 0.90;

    // angular sweep speed rides the mids; bass swells the radius
    brushAngle += 0.06 + audioSignals.mids * 0.22;
    const targetR = maxR * (0.18 + audioSignals.bass * 0.9 + flashPulse * 0.15);
    brushRadius = AudioCore.ease(brushRadius, targetR, 0.25);

    // fine highs add a shimmer wobble to the radius
    const wobble = sin(brushAngle * 7) * audioSignals.highs * 24;
    const bx = cx + cos(brushAngle) * (brushRadius + wobble);
    const by = cy + sin(brushAngle) * (brushRadius + wobble);

    if (prevBrushX === null){ prevBrushX = bx; prevBrushY = by; }
    drawMandalaStroke(prevBrushX, prevBrushY, bx, by, true);
    prevBrushX = bx; prevBrushY = by;
  }
```

- [ ] **Step 3: Fold audio into stroke weight/colour/glow**

In `drawMandalaStroke`, change the signature and the three lines that compute
`sw`, the rainbow `hueShift` advance, and `shadowBlur`. Replace the header:

```js
  function drawMandalaStroke(x1, y1, x2, y2){
    const cx = width / 2, cy = height / 2;
    const dx = x2 - cx, dy = y2 - cy;
    const pdx = x1 - cx, pdy = y1 - cy;
    const speed = dist(x1, y1, x2, y2);

    let sw = brushSize + (reactToSpeed ? min(speed * 0.6, 22) : 0);
```

with (adds an `audioDriven` flag and audio-scaled weight):

```js
  function drawMandalaStroke(x1, y1, x2, y2, audioDriven){
    const cx = width / 2, cy = height / 2;
    const dx = x2 - cx, dy = y2 - cy;
    const pdx = x1 - cx, pdy = y1 - cy;
    const speed = dist(x1, y1, x2, y2);

    let sw = brushSize + (reactToSpeed ? min(speed * 0.6, 22) : 0);
    if (audioDriven){
      sw += audioSignals.bass * 16 + audioSignals.level * 6 + flashPulse * 8;
      sw = max(sw, 1);
    }
```

Then, in the SAME function, replace the glow line:

```js
    drawingContext.shadowBlur = glowIntensity;
```

with a level-scaled glow:

```js
    drawingContext.shadowBlur = glowIntensity + (audioDriven ? audioSignals.level * 22 : 0);
```

And in the rainbow branch, replace:

```js
      const t = ((hueShift + (reactToSpeed ? speed * 4 : 0)) % 360) / 360;
      strokeColour = color(paletteHue(t), 75, 100, 92);
      hueShift = (hueShift + 0.7) % 360;
```

with (highs push the hue faster when audio-driven):

```js
      const t = ((hueShift + (reactToSpeed ? speed * 4 : 0)) % 360) / 360;
      strokeColour = color(paletteHue(t), 75, 100, 92);
      hueShift = (hueShift + 0.7 + (audioDriven ? audioSignals.highs * 6 : 0)) % 360;
```

- [ ] **Step 4: Manual verification — the mandala reacts**

Run: `python -m http.server 8000`; open in Chrome; upload an MP3 with a clear beat.
Expected: the mandala continuously draws itself; **bass** swells the bloom and
thickens strokes, **beats** produce visible pulses, **mids** speed the sweep,
**highs** shimmer/brighten the hue. Moving the mouse still adds extra strokes.
Try a bass-heavy track vs. a sparse one — motion should visibly differ.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: drive the mandala from live audio (brush head + band mapping)"
```

---

### Task 5: Audio controls, music widget, and polish

**Files:**
- Modify: `index.html` (panel markup — new Audio section; music-widget wiring; sketch `<script>` — control handlers, `windowResized` brush reset)

**Interfaces:**
- Consumes: `reactivity`, `beatFlash`, `audioSignals`, `audioCtx`, `fileAudioEl`, `ytPlayer`.
- Produces: panel controls `#reactivity`, `#bassTreble`, `#beatFlash`; widget play/pause + volume rewired for the active source.

- [ ] **Step 1: Add the Audio panel section**

In `#panel`, immediately AFTER the `.panel-header` block and BEFORE
`<p class="section-label">Shape</p>`, insert:

```html
  <p class="section-label">Audio</p>

  <div class="control-group">
    <label>Reactivity <span id="reactivityVal">1.0</span></label>
    <input type="range" id="reactivity" min="0.2" max="3" step="0.1" value="1">
  </div>

  <div class="control-group">
    <label>Bass ⟷ Treble focus <span id="bassTrebleVal">0</span></label>
    <input type="range" id="bassTreble" min="-1" max="1" step="0.1" value="0">
  </div>

  <div class="control-group inline">
    <label><input type="checkbox" id="beatFlash" checked> Beat flash pulse</label>
  </div>

  <div class="divider"></div>
```

- [ ] **Step 2: Apply bass/treble focus in the signal update**

In `updateAudioSignals()` (Task 2), the `beat` and band values are already eased.
Add a `bassTreble` global and weight the bands. First add near the other audio
state: `let bassTreble = 0;`. Then in `updateAudioSignals`, replace the three
band-ease lines with focus-weighted versions:

```js
    const bassW = 1 + Math.max(0, -bassTreble) * 1.2;
    const trebW = 1 + Math.max(0,  bassTreble) * 1.2;
    audioSignals.bass  = AudioCore.ease(audioSignals.bass,  Math.min(bands.bass  * g * bassW, 1), f);
    audioSignals.mids  = AudioCore.ease(audioSignals.mids,  Math.min(bands.mids  * g, 1), f);
    audioSignals.highs = AudioCore.ease(audioSignals.highs, Math.min(bands.highs * g * trebW, 1), f);
    audioSignals.level = AudioCore.ease(audioSignals.level, Math.min(bands.level * g, 1), f);
```

- [ ] **Step 3: Wire the new controls**

In `wireUpPanel()`, after the existing `$('reactSpeed')`… handlers, add:

```js
    $('reactivity').addEventListener('input', (e) => {
      reactivity = parseFloat(e.target.value);
      $('reactivityVal').textContent = reactivity.toFixed(1);
    });
    $('bassTreble').addEventListener('input', (e) => {
      bassTreble = parseFloat(e.target.value);
      $('bassTrebleVal').textContent = bassTreble.toFixed(1);
    });
    $('beatFlash').addEventListener('change', (e) => { beatFlash = e.target.checked; });
```

- [ ] **Step 4: Rewire the music widget for the active source**

Replace the old music-toggle/volume block (previously inside `wireUpEntryAndMusic`,
now removed) — add a dedicated wiring function and call it from `setup()` right
after `wireUpEntryAndMusic();`. Add the call:

```js
    wireUpEntryAndMusic();
    wireUpMusicWidget();
```

and define:

```js
  function wireUpMusicWidget(){
    const $ = (id) => document.getElementById(id);
    $('musicToggle').addEventListener('click', () => {
      // File source: toggle the audio element. YouTube: toggle the iframe.
      if (fileAudioEl && !fileAudioEl.paused){ fileAudioEl.pause(); $('musicToggle').textContent = '▶'; return; }
      if (fileAudioEl && fileAudioEl.paused && fileAudioEl.src){ fileAudioEl.play(); $('musicToggle').textContent = '⏸'; return; }
      if (ytPlayer && ytPlayer.getPlayerState){
        const st = ytPlayer.getPlayerState(); // 1 = playing
        if (st === 1){ ytPlayer.pauseVideo(); $('musicToggle').textContent = '▶'; }
        else { ytPlayer.playVideo(); $('musicToggle').textContent = '⏸'; }
      }
    });
    $('musicVolume').addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (fileAudioEl) fileAudioEl.volume = v / 100;
      if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(v);
    });
  }
```

- [ ] **Step 5: Reset the brush on resize**

In `windowResized()`, after `lastX = null; lastY = null;`, add:

```js
    prevBrushX = null; prevBrushY = null;
```

- [ ] **Step 6: Manual verification — controls + widget**

Run: `python -m http.server 8000`; open in Chrome; start a file source.
- Drag **Reactivity** up → motion grows more violent; down → calmer.
- Drag **Bass⟷Treble focus** to −1 → bass bloom dominates; +1 → highs/hue shimmer dominate.
- Untick **Beat flash pulse** → beat pulses stop; re-tick → they return.
- Widget **⏸/▶** pauses/resumes the file (and a YouTube tab source's player); **volume**
  slider changes loudness for file/YouTube.
- Resize the window → no crash, brush recentres.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: audio panel controls, focus weighting, and source-aware widget"
```

---

### Task 6: README + credit refresh

**Files:**
- Modify: `README.md`; `index.html` (`#site-credit` copy/`.hint` text if stale)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update README**

Rewrite `README.md` to describe the visualizer: what it does, the three source
options, the Chrome/Edge tab-capture requirement + "tick Share tab audio" tip,
the file fallback, and that it's a static page (`python -m http.server` to run
locally). Keep the existing attribution/licence lines intact.

- [ ] **Step 2: Update in-app copy**

In `index.html`, update the `.hint` paragraph text (currently "Move your cursor
across the canvas to draw…") to reflect audio-driven behaviour, e.g. "The mandala
draws itself to your music — tweak the controls to taste. Move the cursor to add
your own strokes."

- [ ] **Step 3: Manual verification**

Re-open the page; confirm the hint text reads correctly and the panel still
scrolls. Skim README for accuracy.

- [ ] **Step 4: Commit**

```bash
git add README.md index.html
git commit -m "docs: describe the audio visualizer and its source options"
```

---

## Self-Review

**Spec coverage:**
- Web Audio analyser core → Task 2. ✓
- Source picker (YouTube embed / tab capture / file) → Task 3. ✓
- Reworked audio→mandala mapping reusing existing visuals → Task 4. ✓
- Three audio controls (reactivity, bass/treble, beat flash) → Task 5. ✓
- Feature-detection + error/fallback handling → Task 3 (Steps 4–5) + Task 2 (autoplay resume). ✓
- Beat detector, smoothing, YouTube-ID parse → Task 1 (unit-tested). ✓
- Music widget repurposed (source label, play/pause, volume) → Task 3 (`setMusicLabel`) + Task 5. ✓
- Keep all existing rendering machinery/controls → Tasks 4–5 reuse, do not remove. ✓
- Testing = automated for pure logic (Task 1) + manual for browser (Tasks 2–6). ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; every browser step has a concrete run command + expected observation. ✓

**Type consistency:** `audioSignals` fields (`bass/mids/highs/level/beat`) defined in Task 2 are the exact names read in Tasks 4–5. `AudioCore` method names match Task 1 exports. `drawMandalaStroke(x1,y1,x2,y2,audioDriven)` new 5th arg is added in Task 4 Step 3 and only called with it from `audioBrushStep`; existing 4-arg cursor calls still work (`audioDriven` is `undefined`/falsy). `reactivity`, `bassTreble`, `beatFlash`, `flashPulse` globals declared before use. ✓
