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
    let sinceBeat = 1 - minGap;
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
