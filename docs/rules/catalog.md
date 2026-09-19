# Production Rule Catalog

Production simulations resolve only `PUBLISHED` RuleSets whose effective interval contains the operation reference date.

A RuleSet is identified by `(id, version)`. Published versions are treated as immutable; corrections create a new version.

Resolution rejects zero matches and ambiguous default matches, then loads only rules valid on the reference date. The selected RuleSet/version and rule trace must be retained with the simulation.

The primary legal source for IBS/CBS is LC 214/2025 and its consolidated amendments. citeturn0search6
