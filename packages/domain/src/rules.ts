import type { TaxRule } from './types.js';

export interface RuleSet {
  id: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceSet: string[];
  rules: TaxRule[];
  status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'RETIRED';
}

export interface RuleResolutionContext {
  referenceDate: string;
  ruleSetId?: string;
  ruleSetVersion?: string;
}

export interface RuleResolution {
  ruleSet: RuleSet;
  matchedRules: TaxRule[];
  warnings: string[];
}
