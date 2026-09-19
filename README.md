# Reforma Tributária Simulator

Simulador técnico e plataforma de atualização contínua para IBS, CBS, IS, transição tributária, documentos fiscais e Split Payment.

> **Este projeto não possui um estado de "concluído".** Legislação, atos, regulamentos, notas técnicas, leiautes, cronogramas e integrações governamentais mudam ao longo do tempo. O sistema deve permanecer conectado a fontes oficiais, detectar mudanças, versionar evidências e impedir que uma regra nova substitua silenciosamente uma regra histórica.

## Objetivo

Transformar fontes fiscais oficiais em um catálogo versionado e auditável que possa alimentar o motor determinístico de cálculo e as integrações operacionais sem misturar interpretação jurídica com código executável.

## Ambiente visual de produção

A superfície visual está publicada em Cloudflare Pages e serve como ponto de teste funcional/visual:

**https://reforma-tributaria-simulator.pages.dev/**

O endereço acima é o endereço estável de produção do projeto. Deployments individuais do Cloudflare podem possuir URLs próprias de preview, mas não substituem o endereço de produção.

A publicação é automatizada por GitHub Actions. O workflow cria o projeto Pages quando necessário, publica `docs/` e verifica automaticamente o endpoint de produção antes de considerar o deploy bem-sucedido.

## Arquitetura

- **apps/web** — dashboard mobile-first e operação do simulador
- **apps/api** — API de domínio
- **packages/domain** — contratos e tipos fiscais
- **packages/tax-engine** — motor determinístico de cálculo
- **packages/schemas** — contratos JSON Schema
- **packages/scenarios** — cenários reproduzíveis
- **workers/api** — Cloudflare Worker de entrada
- **workers/workflows** — processamento durável
- **workers/queues** — ingestão e processamento assíncrono
- **docs** — superfície visual, arquitetura, legislação, fontes e decisões
- **tests** — testes unitários, integração, contrato e regressão

## Separação de responsabilidades

### Fiscal Domain

É o proprietário de:

- catálogo e versionamento de regras;
- resolução de RuleSet;
- cálculo determinístico;
- snapshots fiscais imutáveis;
- evidências fiscais;
- Knowledge Loop;
- Split Payment e reconciliação;
- regressão fiscal e gates de publicação.

### Zynkronyx

É o Control Plane / Integration Plane:

- tenant e contexto operacional;
- autenticação e autorização;
- integração entre sistemas;
- workflows operacionais;
- retries e idempotência;
- observabilidade e auditoria operacional;
- conectores externos.

Zynkronyx **não deve duplicar o motor tributário**. Quando uma operação exigir cálculo fiscal, o fluxo deve atravessar o Fiscal Domain por contrato de integração.

## Integração bidirecional

O contrato é transport-neutral e baseado em comandos/eventos versionados.

Comandos principais:

- `FISCAL_CALCULATE`
- `FISCAL_VALIDATE_DOCUMENT`
- `FISCAL_RESOLVE_RULES`
- `FISCAL_CREATE_SPLIT_PAYMENT`
- `FISCAL_GET_SNAPSHOT`

Eventos principais:

- `FISCAL_SIMULATION_COMPLETED`
- `FISCAL_RULESET_PUBLISHED`
- `FISCAL_DOCUMENT_VALIDATED`
- `FISCAL_SPLIT_PAYMENT_CREATED`
- `FISCAL_RECONCILIATION_FAILED`

Fluxo de referência:

```text
ERP / Marketplace / IoT
        |
        v
   Zynkronyx
        | command
        v
  Fiscal Domain
        | event
        v
   Zynkronyx
        |
        v
ERP / Financeiro / Marketplace
```

O caminho de conhecimento fiscal é separado do caminho operacional:

```text
Official Sources
       |
       v
Knowledge Loop
       |
       v
Evidence -> Change -> Impact -> Candidate
       |
       v
Regression -> Approval -> RuleSet -> Publication
```

## Princípio central: Fiscal Knowledge Loop

O sistema deve operar continuamente neste ciclo:

1. **Discover** — consultar fontes oficiais na internet.
2. **Capture** — registrar documento, URL, órgão, publicação, atualização e hash/evidência.
3. **Compare** — detectar mudanças em legislação, regulamentação, atos, notas técnicas, schemas e cronogramas.
4. **Classify** — separar fato normativo, parâmetro, obrigação técnica, interpretação, hipótese e informação ainda não validada.
5. **Review** — submeter mudança relevante à validação antes de publicação.
6. **Version** — criar novo RuleSet/artefato sem sobrescrever o histórico.
7. **Test** — executar regressão sobre cenários afetados.
8. **Publish** — publicar somente versões validadas.
9. **Monitor** — acompanhar novas alterações e integrações governamentais.
10. **Audit** — manter o vínculo entre resultado, regra, fonte e versão usada.

## Fontes oficiais prioritárias

A ingestão deve priorizar fontes primárias, especialmente Receita Federal, Comitê Gestor do IBS, Ministério da Fazenda, Planalto e portais oficiais de documentos fiscais.

## Regras de segurança fiscal

- Nunca alterar uma regra histórica em lugar.
- Nunca publicar automaticamente uma interpretação jurídica como regra fiscal executável.
- Toda regra publicada deve possuir vigência, fonte e versão.
- Toda simulação de produção deve registrar o RuleSet efetivamente utilizado.
- Toda mudança de fonte deve gerar impacto e regressão antes da publicação.
- Falha de atualização **não** deve apagar o último catálogo válido.
- Quando houver divergência entre fontes, manter as evidências e marcar o caso para revisão.
- O sistema deve poder responder: **"qual regra, de qual fonte e de qual versão produziu este resultado?"**

## Infraestrutura zero-cost-first

O projeto é desenhado para permanecer executável sem depender de infraestrutura paga:

- GitHub + GitHub Actions;
- Cloudflare Pages para a superfície visual;
- Cloudflare Workers para APIs;
- Cloudflare D1 para persistência transacional;
- Cloudflare R2 para evidências;
- Cloudflare Queues para processamento assíncrono;
- Cloudflare Workflows para processamento durável;
- equivalentes locais/open source quando necessários para desenvolvimento.

Credenciais e IDs específicos de conta **não** pertencem ao repositório. Secrets de CI devem permanecer no mecanismo de secrets do GitHub.

## Status atual

**Plataforma em evolução contínua.**

Já existe uma superfície visual publicada em produção com:

- Dashboard de simulação;
- IBS/CBS e total;
- trace visual do cálculo;
- Radar Fiscal;
- representação do Knowledge Loop;
- visão de Arquitetura;
- separação Fiscal Domain ↔ Zynkronyx;
- pipeline de integração;
- workflow automatizado de publicação no Cloudflare Pages;
- verificação automática do endpoint de produção.

O motor determinístico, contratos, catálogo de regras, persistência e workflows continuam sendo desenvolvidos independentemente da camada visual.

## Próximo estágio

A evolução estrutural segue esta ordem:

```text
Fonte oficial
    -> evidência
    -> detecção de mudança
    -> impacto
    -> candidato de regra
    -> regressão
    -> aprovação
    -> RuleSet publicado
    -> cálculo
    -> snapshot
    -> auditoria
    -> integração Zynkronyx
```

A superfície visual é somente a interface de operação/teste. O **Fiscal Domain permanece a fonte de verdade fiscal**.


## Portal Nacional de Fontes Governamentais

O simulador está evoluindo para um portal de ligação com fontes oficiais federais, estaduais e municipais. A arquitetura agora separa:

```text
Authority -> Source -> Collector -> Evidence -> Document
                                      |
                                      v
                                  Change
                                      |
                                      v
                                   Impact
                                      |
                                      v
                              Candidate Rule
```

### Registro nacional

O repositório passou a possuir:

- `government_authorities` — órgãos e entidades publicadoras;
- `government_sources` — canais oficiais de publicação;
- `regulatory_documents` — documentos normativos versionados;
- `regulatory_relationships` — relações entre normas;
- `collector_health` — saúde e histórico dos coletores;
- contratos TypeScript em `packages/domain/src/government.ts`;
- contrato inicial de Collector em `workers/api/src/government-collectors.ts`.

A primeira carga real contempla fontes federais, Receita Federal/Reforma Tributária, atos conjuntos RFB/CGIBS, catálogo de APIs governamentais, legislação da SEF/SC e DOM/SC.

A base federal do Planalto oferece filtros por tipo de ato, situação, datas e origem. A Receita Federal mantém uma área própria de legislação da Reforma e publica atos conjuntos RFB/CGIBS e orientações técnicas. O catálogo Conecta Gov.br lista APIs governamentais e a API de Dados Abertos permite descoberta estruturada de datasets. Em Santa Catarina, a SEF mantém uma base pesquisável de legislação tributária; o DOM/SC informa publicação oficial para 1.039 entidades em 294 municípios. 

### Regra de expansão

O objetivo não é criar milhares de scrapers independentes.

Primeiro identificamos o **provedor/canal de publicação**. Se vários municípios usam o mesmo canal, um único Collector atende todos eles através do registro de autoridades e fontes.

Novos conectores somente serão criados quando o mecanismo de publicação realmente exigir outro adaptador.

### Fontes verificadas na implantação inicial

- Planalto — Base da Legislação Federal;
- Receita Federal — Legislação da Reforma Tributária;
- Receita Federal/CGIBS — Atos Conjuntos;
- Receita Federal — Orientações da Reforma Tributária;
- Conecta Gov.br — catálogo de APIs;
- SEF/SC — Legislações;
- DOM/SC — Diário Oficial dos Municípios.

As fontes permanecem como **evidência externa não confiável para execução**: o conteúdo coletado nunca deve executar instruções e nunca deve alterar diretamente um RuleSet publicado.


## Portal nacional de fontes governamentais — coleta inicial

A API agora expõe o catálogo nacional de fontes governamentais em `/api/v1/government/sources`, com filtros por nível de jurisdição e UF. Cada fonte pode ser submetida a uma coleta explícita em `/api/v1/government/sources/:id/collect`.

A primeira família de coletores implementada é HTTP/HTML/JSON/XML. A coleta:
- exige HTTPS para fontes oficiais;
- calcula hash SHA-256 do conteúdo e hash normalizado;
- registra latência e resultado em `collector_health`;
- atualiza o estado operacional da fonte em `government_sources`;
- isola falhas de uma fonte para não interromper as demais.

O agendador do Worker também executa a coleta das fontes governamentais habilitadas. A expansão para PDF, DOU, DOM, RSS, sitemap e APIs específicas deve reutilizar o mesmo contrato de `GovernmentCollector`, sem criar um scraper diferente para cada órgão.

Os documentos externos continuam sendo tratados como **dados não confiáveis**: nenhuma instrução encontrada em conteúdo governamental é executada e nenhuma coleta publica diretamente um RuleSet.


### Superfície visual atual

A produção em Cloudflare Pages mantém uma URL estável e agora possui navegação funcional entre Dashboard, Radar Fiscal, Fontes Governamentais e Arquitetura. O catálogo de fontes inclui pesquisa, filtro por jurisdição e abertura da fonte oficial. A interface não depende da API para navegação básica, permitindo inspeção visual enquanto D1/R2/Workers são provisionados.
