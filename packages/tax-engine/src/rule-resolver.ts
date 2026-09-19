import type { RuleResolution, RuleResolutionContext, RuleSet } from '@rts/domain';

export function resolveRules(
  ruleSets: RuleSet[],
  context: RuleResolutionContext
): RuleResolution {
  const candidates = ruleSets.filter(set =>
    set.effectiveFrom <= context.referenceDate &&
    (!set.effectiveTo || context.referenceDate <= set.effectiveTo) &&
    (!context.ruleSetId || set.id === context.ruleSetId) &&
    (!context.ruleSetVersion || set.version === context.ruleSetVersion)
  );

  if (candidates.length === 0) {
    throw new Error('No applicable tax rule set for reference date');
  }

  if (candidates.length > 1) {
    throw new Error('Ambiguous tax rule set for reference date');
  }

  const ruleSet = candidates[0];
  if (ruleSet.status !== 'PUBLISHED' && !context.ruleSetId && !context.ruleSetVersion) {
    throw new Error('Default resolution only accepts PUBLISHED rule sets');
  }

  return {
    ruleSet,
    matchedRules: ruleSet.rules.filter(rule =>
      rule.validFrom <= context.referenceDate &&
      (!rule.validTo || context.referenceDate <= rule.validTo)
    ),
    warnings: []
  };
}
