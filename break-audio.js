'use strict';
(() => {
  const REPEAT_COUNT = 3;
  const REPEAT_GAP_MS = 180;
  const SOUNDS = Object.freeze({
    chime: {type: 'sine', notes: [[523.25, 0, 0.42], [659.25, 0.22, 0.42]], volume: 0.055, duration: 1100},
    bell: {type: 'triangle', notes: [[783.99, 0, 0.58], [587.33, 0.28, 0.52]], volume: 0.045, duration: 1250},
    pulse: {type: 'sine', notes: [[349.23, 0, 0.22], [349.23, 0.34, 0.22], [440, 0.68, 0.3]], volume: 0.04, duration: 1200},
    woodblock: {type: 'triangle', notes: [[659.25, 0, 0.09], [523.25, 0.16, 0.08]], volume: 0.035, duration: 650},
    drop: {
      type: 'sine',
      notes: [[2400, 0, 0.035, 1200, 0.2], [1700, 0, 0.11, 700, 1], [780, 0.006, 0.34, 430, 0.45]],
      volume: 0.055,
      duration: 600,
      perNoteEnvelope: true
    },
    rising: {type: 'sine', notes: [[392, 0, 0.24], [493.88, 0.18, 0.28], [587.33, 0.38, 0.35]], volume: 0.043, duration: 1050}
  });

  function createCuePlan(selectedSound) {
    const sound = SOUNDS[selectedSound] || SOUNDS.chime;
    const starts = Array.from({length: REPEAT_COUNT}, (_, index) => index * (sound.duration + REPEAT_GAP_MS));
    return {
      sound,
      starts,
      duration: starts.at(-1) + sound.duration
    };
  }

  const api = {REPEAT_COUNT, REPEAT_GAP_MS, SOUNDS, createCuePlan};
  globalThis.MeridianBreakAudio = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
