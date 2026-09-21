import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSplitPaymentAmounts,
  isSplitPaymentInstrument,
  isSplitPaymentSettlementMode,
} from './split-payment.ts';

test('standard split deducts already-extinguished tax debt before segregation', () => {
  const result = calculateSplitPaymentAmounts({
    grossAmount: '12650.00',
    taxDebits: { IBS: '1325.00', CBS: '1325.00' },
    taxesAlreadyExtinguished: { IBS: '100.00', CBS: '200.00' },
  });

  assert.deepEqual(result.segregatedTaxes, { IBS: '1225.00', CBS: '1125.00' });
  assert.equal(result.supplierNetAmount, '10300.00');
});

test('zero taxes leave the full gross amount with the supplier', () => {
  const result = calculateSplitPaymentAmounts({
    grossAmount: '10000.00',
    taxDebits: {},
  });

  assert.equal(result.supplierNetAmount, '10000.00');
  assert.deepEqual(result.segregatedTaxes, { IBS: '0.00', CBS: '0.00' });
});

test('rejects extinguished tax debt above the fiscal debit', () => {
  assert.throws(
    () => calculateSplitPaymentAmounts({
      grossAmount: '1000.00',
      taxDebits: { IBS: '100.00', CBS: '50.00' },
      taxesAlreadyExtinguished: { IBS: '101.00' },
    }),
    /EXTINGUISHED_TAX_EXCEEDS_TAX_DEBIT/,
  );
});

test('rejects segregation above gross amount', () => {
  assert.throws(
    () => calculateSplitPaymentAmounts({
      grossAmount: '100.00',
      taxDebits: { IBS: '80.00', CBS: '30.00' },
    }),
    /ALLOCATIONS_EXCEED_GROSS_AMOUNT/,
  );
});

test('validates declared split context values', () => {
  assert.equal(isSplitPaymentInstrument('CARD'), true);
  assert.equal(isSplitPaymentInstrument('UNKNOWN'), false);
  assert.equal(isSplitPaymentSettlementMode('STANDARD'), true);
  assert.equal(isSplitPaymentSettlementMode('OTHER'), false);
});
