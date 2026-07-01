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

test('createBeatDetector: no spurious beats on steady input', () => {
  const bd = AudioCore.createBeatDetector();
  let beats = 0;
  for (let i = 0; i < 60; i++) if (bd.push(0.3)) beats++;
  assert.strictEqual(beats, 0, 'steady input should never register a beat');
});

test('createBeatDetector: isolated spike after warmup fires once', () => {
  const bd = AudioCore.createBeatDetector({ sensitivity: 1.35, minGap: 6, warmup: 8 });
  for (let i = 0; i < 20; i++) bd.push(0.3); // establish baseline past warmup
  let fires = 0;
  if (bd.push(1.0)) fires++;                  // the spike
  for (let i = 0; i < 6; i++) if (bd.push(0.3)) fires++; // refractory + settle
  assert.strictEqual(fires, 1, 'one spike should produce exactly one beat');
});
