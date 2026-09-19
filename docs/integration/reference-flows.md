# Reference Integration Flows

These flows are implementation references, not hard-coded dependencies.

## Flow A — External command requiring fiscal calculation

```
External System
      |
      | operational event
      v
 Zynkronyx Connector
      |
      | normalize + authenticate + correlate
      v
 Zynkronyx Orchestrator
      |
      | FISCAL_CALCULATE
      v
 Fiscal Domain
      |
      | resolve RuleSet
      | calculate
      | persist snapshot
      v
 FISCAL_SIMULATION_COMPLETED
      |
      v
 Zynkronyx
      |
      +----> ERP
      +----> Marketplace
      +----> Finance
```

## Flow B — Fiscal domain discovers a new official rule

```
Official Government Source
          |
          v
 Fiscal Knowledge Collector
          |
          v
 Evidence + hash
          |
          v
 Change Detector
          |
          v
 Impact Analysis
          |
          v
 Review + Regression
          |
          v
 Published RuleSet
          |
          | FISCAL_RULESET_PUBLISHED
          v
      Zynkronyx
          |
          +----> affected integrations
          +----> tenant notifications
          +----> operational workflows
          +----> Control Center
```

## Flow C — Fiscal result delivery fails

A fiscal result must not be recalculated merely because its delivery failed.

```
Fiscal Domain
    |
    +--> persist immutable snapshot
    |
    +--> publish event
              |
              X delivery failure
              |
              v
          retry / replay
              |
              v
          Zynkronyx
```

The replay consumes the existing snapshot.

## Flow D — Zynkronyx delivery fails after external event

```
External System
      |
      v
 Zynkronyx
      |
      +--> durable integration state
      |
      +--> downstream command
                 |
                 X temporary failure
                 |
                 v
              retry
```

The external event must not be applied twice.

## Flow E — RuleSet changes but integrations do not

A fiscal RuleSet publication does not automatically mean every connected system must be modified.

Zynkronyx first evaluates impact:

`RuleSet → affected capabilities → affected connectors → required action`

Possible outcomes:

- informational;
- no integration change;
- configuration update;
- connector update;
- fiscal document update;
- manual intervention required.

## Flow F — Historical replay

Historical events must resolve to the historical fiscal snapshot.

```
Historical Event
      |
      v
Fiscal Snapshot ID
      |
      v
Existing Result + RuleSet Version
```

It must not silently execute today's rules against yesterday's operation.

## Transport independence

The same flow can be transported through HTTP, Queue, Workflow or another event mechanism.

The domain contract does not change.

## Operational invariant

Every flow must preserve:

- tenant;
- correlation;
- causation;
- idempotency;
- message identity;
- source;
- schema version;
- fiscal RuleSet version when applicable.
