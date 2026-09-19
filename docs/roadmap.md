# Full Build Roadmap

## Foundation
- [x] Monorepo
- [x] Domain contracts
- [x] Deterministic tax engine
- [x] Rule resolver
- [x] Scenario runner
- [x] JSON Schema
- [x] Cloudflare Worker
- [x] Web dashboard
- [x] CI
- [x] Secret handling
- [x] Split-payment ledger contracts

## Fiscal engine
- [ ] tax base composition
- [ ] item classification
- [ ] IBS/CBS calculation rules
- [ ] credit calculation
- [ ] reductions/exemptions
- [ ] destination rules
- [ ] transition timeline
- [ ] rule conflict detection
- [ ] official source registry

## Fiscal documents
- [ ] NF-e
- [ ] NFC-e
- [ ] NFS-e
- [ ] XML normalization
- [ ] document validation

## Split Payment
- [x] ledger model
- [x] workflow contract
- [ ] installment allocation
- [ ] idempotency store
- [ ] reversal/refund
- [ ] reconciliation
- [ ] retry/dead-letter

## Cloudflare
- [x] Worker baseline
- [ ] Workflows runtime
- [ ] Queues runtime
- [ ] D1 persistence
- [ ] R2 documents
- [ ] observability
- [ ] auth
- [ ] rate limiting

## Web
- [x] mobile-first shell
- [ ] scenario form
- [ ] calculation breakdown
- [ ] before/after comparison
- [ ] transition timeline
- [ ] split-payment visualization
- [ ] audit trail
- [ ] export

## Quality
- [x] basic CI
- [ ] unit suite expansion
- [ ] property tests
- [ ] integration tests
- [ ] contract tests
- [ ] load tests
- [ ] security scanning
