# IA fiscal: RAG, MCP, LLM e refinamento

## Objetivo

O projeto usa IA como camada de consulta e assistência, nunca como fonte soberana da regra tributária.

A autoridade permanece nos atos e documentos oficiais. O motor determinístico calcula; o RAG recupera evidências; o MCP expõe capacidades com contratos; o LLM interpreta e redige uma resposta fundamentada.

## Arquitetura

Fonte oficial → coleta → normalização → hash → documento → fragmentação → RAG → recuperação temporal → reordenação → evidência → MCP → LLM → resposta fundamentada.

### Responsabilidades

- Motor tributário: cálculo determinístico.
- RAG: recuperação de evidências.
- MCP: contrato de ferramentas para Zynkronyx e clientes de IA.
- LLM: classificação, explicação, síntese e interface conversacional.
- Evidência: autoridade, URL, publicação, vigência, versão e hash.
- Humano: aprovação de mudanças regulatórias e publicação de regras.

## Ferramentas MCP

- `fiscal.search_evidence`
- `fiscal.get_document`
- `fiscal.resolve_ruleset`
- `fiscal.calculate`
- `fiscal.compare_calculation`
- `fiscal.get_split_payment_rules`
- `fiscal.get_snapshot`

Toda chamada transporta `requestId`, `correlationId`, `toolName`, tenant quando aplicável, entrada tipada e horário.

Toda resposta transporta identificação da requisição, correlação, resultado, advertências, estado e horário de conclusão.

## RAG com vigência

O ranking considera correspondência lexical, relevância, autoridade, versão, publicação e vigência. Quando houver `asOf`, uma evidência fora da vigência não pode ser tratada como regra aplicável.

Ciclo:

Coleta → alteração detectada → fragmentação → recuperação → avaliação → ajuste → nova avaliação.

Métricas: precisão, cobertura, erros factuais, erros temporais, latência, respostas sem evidência e divergência do cálculo determinístico.

## Fine-tuning

Legislação não deve ser armazenada no modelo.

Fine-tuning pode ser usado posteriormente para tarefas estáveis: classificação de documentos, extração estruturada, roteamento e classificação de impacto regulatório.

Cada exemplo mantém:

`entrada → alvo → evidências → versão do conjunto → aprovação`

## RAG + LLM

Regra central: sem evidência suficiente, não apresentar uma regra tributária como fato.

Uma resposta fundamentada deve carregar evidências, conjunto de regras quando houver, registro imutável quando houver, advertências e data de referência.

## Calculadora de Consumo

A Calculadora de Consumo do ambiente piloto da Receita Federal/CGIBS é tratada como referência externa.

Fluxo:

Portal → adaptador oficial → Calculadora de Consumo → resposta → normalização → comparação com motor próprio → evidência.

Calculadora:
https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/calculadora/simplificado

API:
https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/swagger-ui/index.html

## Split Payment

Cálculo tributário e fluxo financeiro são componentes diferentes.

A simulação demonstra valor bruto, IBS, CBS, líquido, parcelas, segregação, reconciliação e impacto temporal no capital de giro. A segregação não deve ser interpretada como criação de novo tributo.

## Zynkronyx

Zynkronyx permanece como plano de controle e integração.

Capacidades fiscais:

`FISCAL_SEARCH_EVIDENCE`
`FISCAL_RESOLVE_RULES`
`FISCAL_CALCULATE`
`FISCAL_COMPARE_CALCULATION`
`FISCAL_CREATE_SPLIT_PAYMENT`
`FISCAL_GET_SNAPSHOT`

Eventos:

`FISCAL_SIMULATION_COMPLETED`
`FISCAL_RULESET_PUBLISHED`
`FISCAL_DOCUMENT_VALIDATED`
`FISCAL_SPLIT_PAYMENT_CREATED`
`FISCAL_RECONCILIATION_FAILED`

## Segurança

Autenticação de integração, `X-Correlation-Id`, `Idempotency-Key` para mutações, isolamento por tenant, limite de payload, nenhum segredo no repositório, evidências com procedência e auditoria das ferramentas MCP.

Nenhuma decisão fiscal deve depender exclusivamente de texto gerado por LLM.

## Critério de produção

1. Evidência recuperada.
2. Vigência compatível.
3. Fonte identificada.
4. Regra resolvida.
5. Cálculo determinístico reproduzível.
6. Snapshot persistido quando aplicável.
7. Divergências explicitadas.
8. Avaliação automatizada aprovada.
