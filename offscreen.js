'use strict';
function scheduleCue(context, sound, startMs) {
  const start = context.currentTime + startMs / 1000;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(sound.volume, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + sound.duration / 1000 - 0.2);
  gain.connect(context.destination);
  for (const [frequency, delay, length, endFrequency, level = 1] of sound.notes) {
    const tone = context.createOscillator();
    tone.type = sound.type;
    tone.frequency.setValueAtTime(frequency, start + delay);
    if (endFrequency) tone.frequency.exponentialRampToValueAtTime(endFrequency, start + delay + length);
    if (sound.perNoteEnvelope) {
      const noteGain = context.createGain();
      noteGain.gain.setValueAtTime(0.0001, start + delay);
      noteGain.gain.exponentialRampToValueAtTime(sound.volume * level, start + delay + 0.004);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + delay + length);
      tone.connect(noteGain);
      noteGain.connect(context.destination);
    } else {
      tone.connect(gain);
    }
    tone.start(start + delay);
    tone.stop(start + delay + length);
  }
}

async function playCue(selectedSound) {
  const plan = MeridianBreakAudio.createCuePlan(selectedSound);
  const context = new AudioContext();
  for (const start of plan.starts) scheduleCue(context, plan.sound, start);
  await new Promise(resolve => setTimeout(resolve, plan.duration));
  await context.close();
}

let playbackQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'meridian.break.playCue') return false;
  const playback = () => playCue(message.sound);
  playbackQueue = playbackQueue.then(playback, playback);
  playbackQueue.then(
    () => sendResponse({ok: true}),
    error => sendResponse({ok: false, error: error.message})
  );
  return true;
});
