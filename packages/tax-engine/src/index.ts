import type { FiscalOperation, RoundingMode, RoundingPolicy, TaxResult, TaxRule } from '@rts/domain';

type Scaled = { value: bigint; scale: number };
const DEFAULT_POLICY: RoundingPolicy = { scale: 2, mode: 'HALF_UP' };

function parseDecimal(input: string): Scaled {
  const normalized = input.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal: ${input}`);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  return { value: (negative ? -1n : 1n) * (BigInt(whole) * 10n ** BigInt(fraction.length) + BigInt(fraction || '0')), scale: fraction.length };
}

function rescale(value: Scaled, scale: number): bigint {
  if (value.scale === scale) return value.value;
  if (value.scale < scale) return value.value * 10n ** BigInt(scale - value.scale);
  return value.value / 10n ** BigInt(value.scale - scale);
}

function roundScaled(value: bigint, scale: number, target: number, mode: RoundingMode): bigint {
  if (scale <= target) return value * 10n ** BigInt(target - scale);
  const divisor = 10n ** BigInt(scale - target);
  const sign = value < 0n ? -1n : 1n;
  const absolute = value < 0n ? -value : value;
  const quotient = absolute / divisor;
  const remainder = absolute % divisor;
  let roundUp = false;
  if (mode === 'UP') roundUp = remainder !== 0n;
  else if (mode === 'HALF_UP') roundUp = remainder * 2n >= divisor;
  else if (mode === 'HALF_EVEN') roundUp = remainder * 2n > divisor || (remainder * 2n === divisor && quotient % 2n === 1n);
  return sign * (quotient + (roundUp ? 1n : 0n));
}

function format(value: bigint, scale: number): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  if (scale === 0) return sign + absolute.toString();
  const base = 10n ** BigInt(scale);
  return `${sign}${absolute / base}.${(absolute % base).toString().padStart(scale, '0')}`;
}

function multiply(left: Scaled, right: Scaled): Scaled {
  return { value: left.value * right.value, scale: left.scale + right.scale };
}

function percentageOf(base: Scaled, ratePercent: Scaled): Scaled {
  return { value: base.value * ratePercent.value, scale: base.scale + ratePercent.scale + 2 };
}

function toMoney(value: Scaled, policy: RoundingPolicy): string {
  return format(roundScaled(value.value, value.scale, policy.scale, policy.mode), policy.scale);
}

function validDate(date: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) throw new Error(`Invalid ${field}: ${date}`);
}

function applicableRule(rules: TaxRule[], tax: TaxRule['tax'], date: string): TaxRule | undefined {
  const matches = rules.filter(rule => rule.tax === tax && rule.validFrom <= date && (!rule.validTo || date <= rule.validTo));
  if (matches.length > 1) throw new Error(`Ambiguous ${tax} rules for ${date}: ${matches.map(rule => rule.id).join(', ')}`);
  return matches[0];
}

/**
 * Generic scenario calculator only; not an official tax computation engine.
 * It intentionally does not implement CST/cClassTrib, NCM/NBS, tax-location
 * rates, reductions, credits, IS, Simples Nacional or document-specific bases.
 */
export function calculateTax(operation: FiscalOperation, rules: TaxRule[], calculationVersion = '0.3.0'): TaxResult {
  if (!operation.id) throw new Error('Operation id is required');
  validDate(operation.issuedAt, 'operation.issuedAt');
  if (!Array.isArray(operation.items) || operation.items.length === 0) throw new Error('At least one operation item is required');

  const lineValues = operation.items.map(item => {
    const quantity = parseDecimal(item.quantity);
    const unitPrice = parseDecimal(item.unitPrice);
    if (quantity.value < 0n || unitPrice.value < 0n) throw new Error('Negative quantity or unit price');
    return multiply(quantity, unitPrice);
  });
  const baseScale = Math.max(2, ...lineValues.map(value => value.scale));
  const baseValue = lineValues.reduce((sum, value) => sum + rescale(value, baseScale), 0n);
  const base = toMoney({ value: baseValue, scale: baseScale }, DEFAULT_POLICY);

  const taxes: TaxResult['taxes'] = {
    IBS: { base, ratePercent: '0.00', amount: '0.00' },
    CBS: { base, ratePercent: '0.00', amount: '0.00' }
  };
  const ruleTrace: TaxResult['ruleTrace'] = [];
  let total = 0n;
  let resultPolicy = DEFAULT_POLICY;

  for (const tax of ['IBS', 'CBS'] as const) {
    const rule = applicableRule(rules, tax, operation.issuedAt);
    if (!rule) continue;
    const policy = rule.rounding ?? DEFAULT_POLICY;
    const rate = parseDecimal(rule.ratePercent);
    if (rate.value < 0n) throw new Error(`Negative rate is not supported: ${rule.id}`);
    const amount = toMoney(percentageOf(parseDecimal(base), rate), policy);
    taxes[tax] = { base, ratePercent: rule.ratePercent, amount };
    total += rescale(parseDecimal(amount), 2);
    ruleTrace.push({ ruleId: rule.id, tax, source: rule.source, version: rule.version });
    resultPolicy = policy;
  }

  return { operationId: operation.id, calculationVersion, taxes, totalTax: format(total, 2), taxableBase: base, ruleTrace, roundingPolicy: resultPolicy };
}
