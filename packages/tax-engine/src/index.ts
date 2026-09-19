import type { FiscalOperation, TaxResult, TaxRule } from '@rts/domain';

function cents(value: string): bigint {
  const normalized = value.replace(',', '.');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
}

function money(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

function percentToBps(value: string): bigint {
  const normalized = value.replace(',', '.');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
}

export function calculateTax(operation: FiscalOperation, rules: TaxRule[], calculationVersion = '0.1.0'): TaxResult {
  const base = operation.items.reduce((sum, item) => sum + cents(item.quantity) * cents(item.unitPrice) / 100n, 0n);
  const taxes = { IBS: { base: money(base), ratePercent: '0.00', amount: '0.00' }, CBS: { base: money(base), ratePercent: '0.00', amount: '0.00' } } as TaxResult['taxes'];
  const ruleTrace = [] as TaxResult['ruleTrace'];

  for (const tax of ['IBS', 'CBS'] as const) {
    const rule = rules.find(r => r.tax === tax && r.validFrom <= operation.issuedAt && (!r.validTo || operation.issuedAt <= r.validTo));
    if (!rule) continue;
    const rateBps = percentToBps(rule.ratePercent);
    const amount = base * rateBps / 10000n;
    taxes[tax] = { base: money(base), ratePercent: rule.ratePercent, amount: money(amount) };
    ruleTrace.push({ ruleId: rule.id, tax, source: rule.source, version: rule.version });
  }

  const total = cents(taxes.IBS.amount) + cents(taxes.CBS.amount);
  return { operationId: operation.id, calculationVersion, taxes, totalTax: money(total), taxableBase: money(base), ruleTrace };
}
