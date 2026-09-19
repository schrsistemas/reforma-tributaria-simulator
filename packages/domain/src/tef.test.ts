import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionTef, transitionTef, tefStatusIsTerminal } from './tef.js';

test('TEF happy path', () => {
  let status = 'INITIATED' as const;
  status = transitionTef(status, 'AUTHORIZING');
  status = transitionTef(status, 'AUTHORIZED');
  status = transitionTef(status, 'CAPTURED');
  status = transitionTef(status, 'SETTLED');
  assert.equal(status, 'SETTLED');
  assert.equal(tefStatusIsTerminal(status), false);
});

test('TEF rejects invalid transitions', () => {
  assert.equal(canTransitionTef('INITIATED', 'SETTLED'), false);
  assert.throws(() => transitionTef('INITIATED', 'CAPTURED'));
  assert.equal(tefStatusIsTerminal('DECLINED'), true);
});

test('TEF supports simulated cancellation before capture', () => {
  assert.equal(transitionTef('INITIATED', 'CANCELLED'), 'CANCELLED');
  assert.equal(transitionTef('AUTHORIZED', 'CANCELLED'), 'CANCELLED');
});
