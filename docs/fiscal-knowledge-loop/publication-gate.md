# Fiscal Rule Publication Gate

A source change never becomes a production RuleSet directly.

## Pipeline

```
Evidence
  ↓
Change
  ↓
Impact
  ↓
Candidate
  ↓
Regression
  ↓
Approval
  ↓
New RuleSet
  ↓
Publication Event
```

## Automatic gates

The publisher must reject a candidate when:

- source evidence is missing;
- source hash is inconsistent;
- required interpretation is missing;
- regression is not complete;
- critical regression failed;
- approval is missing;
- effective dates overlap an incompatible published RuleSet;
- RuleSet version is not immutable;
- source lineage cannot be reconstructed.

## Historical preservation

Publication creates:

`RuleSet(id,version=N+1)`

It never edits:

`RuleSet(id,version=N)`

Historical simulations continue to reference their original version.

## Emergency behavior

An emergency correction must still create a new version.

The system may mark the previous RuleSet as superseded for future calculations, but historical snapshots remain valid records.

## No silent downgrade

If the latest candidate is rejected, the previous valid published RuleSet remains available.

The system must expose:

- latest attempted update;
- rejection reason;
- currently published version;
- age of current production knowledge.

## Audit chain

Every publication must be traceable:

`publication → validation run → candidate → interpretation → change → evidence → source`

## Zynkronyx event

After successful publication:

`FISCAL_RULESET_PUBLISHED`

is emitted with the RuleSet identity, effective period and source lineage summary.

The event informs the integration plane. It does not transfer ownership of the fiscal rule.
