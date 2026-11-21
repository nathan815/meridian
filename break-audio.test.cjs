'use strict';
const assert = require('node:assert/strict');
const {REPEAT_COUNT, REPEAT_GAP_MS, SOUNDS, createCuePlan} = require('./break-audio.js');

for (const [name, sound] of Object.entries(SOUNDS)) {
  const plan = createCuePlan(name);
  assert.equal(plan.starts.length, REPEAT_COUNT, `${name} should play three times`);
  assert.deepEqual(plan.starts, [
    0,
    sound.duration + REPEAT_GAP_MS,
    2 * (sound.duration + REPEAT_GAP_MS)
  ], `${name} repetitions should use the full sound duration plus the configured gap`);
  assert.equal(plan.duration, REPEAT_COUNT * sound.duration + (REPEAT_COUNT - 1) * REPEAT_GAP_MS);
  for (let index = 1; index < plan.starts.length; index++) {
    assert.equal(plan.starts[index] - (plan.starts[index - 1] + sound.duration), REPEAT_GAP_MS, `${name} repetitions must not overlap`);
  }
}

assert.equal(createCuePlan('unknown').sound, SOUNDS.chime, 'unknown sounds should retain the chime fallback');
console.log('Break reminder audio repeats sequentially for every sound length.');
