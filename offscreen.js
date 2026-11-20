'use strict';
chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== 'meridian.break.playCue') return;
  const sounds = {
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
  };
  const sound = sounds[message.sound] || sounds.chime;
  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(sound.volume, context.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + sound.duration / 1000 - 0.2);
  gain.connect(context.destination);
  for (const [frequency, delay, length, endFrequency, level = 1] of sound.notes) {
    const tone = context.createOscillator();
    tone.type = sound.type;
    tone.frequency.setValueAtTime(frequency, context.currentTime + delay);
    if (endFrequency) tone.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + delay + length);
    if (sound.perNoteEnvelope) {
      const noteGain = context.createGain();
      noteGain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      noteGain.gain.exponentialRampToValueAtTime(sound.volume * level, context.currentTime + delay + 0.004);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + length);
      tone.connect(noteGain);
      noteGain.connect(context.destination);
    } else {
      tone.connect(gain);
    }
    tone.start(context.currentTime + delay);
    tone.stop(context.currentTime + delay + length);
  }
  setTimeout(() => context.close(), sound.duration);
});
