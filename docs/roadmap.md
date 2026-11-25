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
- [x] Implementar proxy XML/PDF binário com limite de entrada e timeout.
- [ ] Implantar DANFSe Go como serviço separado e configurar endpoint HTTPS.
- [ ] Criar suíte de regressão diferencial por regime e versão da base oficial.


## Monitoramento de fontes oficiais — Receita Federal

- [x] Registrar o feed oficial de notícias da Receita Federal como fonte de descoberta.
- [x] Registrar notícias RTC de 17 a 24/11/2026 com URL, data, tema e impactos.
- [x] Definir separação entre notícia (`NEWS_LEAD`) e evidência normativa primária.
- [ ] Obter e versionar o texto integral da Resolução CGSN nº 196/2026 e mapear vigência por artigo.
- [ ] Atualizar o motor/Skill do Simples Nacional com os efeitos confirmados da Resolução CGSN nº 196/2026.
- [ ] Validar Ato Conjunto RFB/CGIBS nº 4/2026 e cronograma dos campos CBS/IBS por DF-e.
- [ ] Avaliar documentação da API RAD e aguardar disponibilização efetiva do serviço antes de implementar integração de produção.
- [ ] Implementar monitoramento periódico do feed e detecção de alterações/novas notícias RTC.
