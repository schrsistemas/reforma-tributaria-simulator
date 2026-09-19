import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTax } from '../src/index.ts';

const operation = {
  id: 'OP-001',
  issuedAt: '2026-09-19',
  grossAmount: '1000.00',
  currency: 'BRL' as const,
  items: [{
    id: '1',
    description: 'Produto',
    quantity: '2',
    unitPrice: '500.00',
    taxProfile: { regime: 'NORMAL' }
  }]
};

const rules = [
  {
    id: 'IBS-TEST-01',
    tax: 'IBS' as const,
    validFrom: '2026-01-01',
    ratePercent: '10.00',
    source: 'TEST',
    version: '1'
  },
  {
    id: 'CBS-TEST-01',
    tax: 'CBS' as const,
    validFrom: '2026-01-01',
    ratePercent: '5.00',
    source: 'TEST',
    version: '1'
  }
];

test('calculates IBS and CBS without floating point arithmetic', () => {
  const result = calculateTax(operation, rules);
  assert.equal(result.taxableBase, '1000.00');
  assert.equal(result.taxes.IBS.amount, '100.00');
  assert.equal(result.taxes.CBS.amount, '50.00');
  assert.equal(result.totalTax, '150.00');
  assert.equal(result.ruleTrace.length, 2);
});

test('applies percentage rates as percent, not as a unit multiplier', () => {
  const result = calculateTax({...operation, items:[{...operation.items[0], quantity:'1', unitPrice:'123.45'}]}, [{...rules[0], ratePercent:'7.50'}]);
  assert.equal(result.taxes.IBS.amount, '9.26');
  assert.equal(result.totalTax, '9.26');
});

test('supports HALF_EVEN rounding at exact ties', () => {
  const result = calculateTax({...operation, grossAmount:'1.00', items:[{...operation.items[0], quantity:'1', unitPrice:'1.00'}]}, [{...rules[0], ratePercent:'0.50', rounding:{scale:0,mode:'HALF_EVEN'}}]);
  assert.equal(result.taxes.IBS.amount, '0');
});
