import type { FiscalOperation, RuleSet, TaxResult } from '@rts/domain';
import { calculateTax } from '@rts/tax-engine';

export interface SimulationScenario {
  id: string;
  name: string;
  referenceDate: string;
  ruleSet: RuleSet;
  operation: FiscalOperation;
  expected?: Partial<Pick<TaxResult, 'taxableBase' | 'totalTax'>>;
}

export interface ScenarioResult {
  scenarioId: string;
  result: TaxResult;
  passed: boolean;
  failures: string[];
}

export function runScenario(scenario: SimulationScenario): ScenarioResult {
  if (scenario.ruleSet.effectiveFrom > scenario.referenceDate ||
      (scenario.ruleSet.effectiveTo && scenario.ruleSet.effectiveTo < scenario.referenceDate)) {
    return {
      scenarioId: scenario.id,
      result: calculateTax(scenario.operation, scenario.ruleSet.rules, scenario.ruleSet.version),
      passed: false,
      failures: ['ruleSet is outside scenario reference date']
    };
  }

  const result = calculateTax(scenario.operation, scenario.ruleSet.rules, scenario.ruleSet.version);
  const failures: string[] = [];

  if (scenario.expected?.taxableBase && result.taxableBase !== scenario.expected.taxableBase) failures.push('taxableBase mismatch');
  if (scenario.expected?.totalTax && result.totalTax !== scenario.expected.totalTax) failures.push('totalTax mismatch');

  return { scenarioId: scenario.id, result, passed: failures.length === 0, failures };
}
