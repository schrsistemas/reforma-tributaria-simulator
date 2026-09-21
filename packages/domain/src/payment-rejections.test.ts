import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_METHODS, getPaymentMethod } from './payment-rejections.ts';

test('payment method catalog contains the six simulated codes', () => {
  assert.deepEqual(
    PAYMENT_METHODS.map((item) => item.code),
    ['15', '17', '18', '20', '23', '24'],
  );
});

test('payment method lookup resolves TEF code 24', () => {
  const method = getPaymentMethod('24');
  assert.equal(method?.rail, 'TEF');
  assert.equal(method?.name, 'TEF / Book Transfer');
});

test('unknown payment method is rejected by catalog lookup', () => {
  assert.equal(getPaymentMethod('99'), undefined);
});
