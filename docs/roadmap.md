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


## Componentes oficiais da Receita Federal

- [x] Registrar repositórios oficiais e licença MIT.
- [x] Registrar SHA-512 dos ZIPs iniciais e SHA-1 dos commits iniciais da Portaria Cotec nº 342/2026.
- [x] Fixar commits/versões observados em 25/11/2026.
- [x] Criar Skill especializada para regime regular, Simples Nacional e DANFSe.
- [x] Remover fallback hardcoded para host piloto nos proxies do regime regular.
- [ ] Configurar e validar endpoints HTTPS de produção/homologação em ambiente Cloudflare.
- [ ] Implementar testes de contrato com fixtures oficiais versionadas.
- [ ] Expor ferramentas MCP oficiais após definição dos schemas completos e autorização.
- [ ] Implantar DANFSe Go como serviço separado e implementar proxy XML/PDF binário.
- [ ] Criar suíte de regressão diferencial por regime e versão da base oficial.
