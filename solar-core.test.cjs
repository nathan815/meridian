'use strict';
const assert = require('node:assert/strict');
const solar = require('./solar-core.js');

const eastern = solar.representativeCoordinates('America/New_York');
const novemberEvening = new Date('2026-11-20T23:54:00Z');
const juneEvening = new Date('2026-06-20T22:54:00Z');

assert.deepEqual(eastern, [40.7128, -74.006]);
assert.equal(solar.solarState(novemberEvening, eastern).phase, 'night');
assert.equal(solar.solarState(juneEvening, eastern).phase, 'daylight');
assert.equal(solar.solarState(new Date('2026-11-20T21:35:00Z'), eastern).phase, 'dusk');

const paris = solar.representativeCoordinates('Europe/Paris', new Date('2026-01-15T12:00:00Z'));
assert.equal(paris[0], 50);
assert.equal(paris[1], 15);

console.log('Seasonal solar phases and representative clock locations passed.');
