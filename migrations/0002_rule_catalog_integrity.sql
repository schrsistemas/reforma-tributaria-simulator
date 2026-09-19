CREATE INDEX IF NOT EXISTS idx_ruleset_publication_window ON rule_sets(status,effective_from,effective_to);
CREATE INDEX IF NOT EXISTS idx_tax_rules_ruleset_window ON tax_rules(ruleset_id,ruleset_version,valid_from,valid_to);
