# Fiscal Agent Host

## Estado

O módulo `workers/api/src/agent-host.ts` implementa o ciclo de execução independente de provedor. `workers/api/src/fiscal-agent-service.ts` compõe a preparação das Skills com o Agent Host e o runner fiscal real. Essa composição é uma biblioteca interna: ainda não existe endpoint HTTP de execução nem provider LLM registrado no Worker.

Não existe configuração de modelo no `workers/api/wrangler.toml` nem adapter de provedor registrado no Worker. Por isso, o endpoint `POST /api/v1/skills/prepare` continua sendo apenas preparação de contexto e instruções; não se deve interpretar `PREPARED` como execução fiscal.

## Contratos

- `AgentModelProvider.generate`: adapter de modelo que recebe consulta, contexto, instruções selecionadas, histórico de ferramentas, índice de iteração e `AbortSignal`.
- `AgentToolRunner.execute`: executor de ferramentas já validadas pelo catálogo MCP e pela política de autorização do host.
- `runAgentHost`: ciclo limitado que coordena modelo e ferramentas, sem depender de SDK de fornecedor.

## Política de ferramentas

A lista executável é a interseção entre:

1. `toolBindings` do plano de Skills;
2. `authorizedTools` concedidas pelo host/tenant.

Bindings nunca concedem permissão. O executor concreto valida o schema de entrada de cada ferramenta, aplica a allowlist publicada e preserva a proveniência de tenant/request/correlation. O catálogo `workers/api/src/fiscal-tool-catalog.ts` contém somente ferramentas realmente implementadas no dispatcher MCP e publica schemas com `additionalProperties: false`. O runner `workers/api/src/fiscal-tool-runner.ts` implementa `executeFiscalTool` e `createFiscalAgentToolRunner`, consumindo diretamente as funções internas RAG, RuleSet e Fiscal Domain; ele não faz chamadas HTTP recursivas nem aceita nomes arbitrários.

## Limites padrão

| Controle | Padrão | Máximo |
|---|---:|---:|
| Iterações do modelo | 6 | 12 |
| Chamadas de ferramenta | 12 | 30 |
| Tempo total | 20 s | 60 s |

As chamadas são sequenciais para manter ordem determinística e trilha de auditoria. Falhas de ferramenta são devolvidas ao modelo como resultados de erro e também registradas em `warnings`. Timeout encerra a execução. Limites atingidos retornam `NEEDS_HUMAN_REVIEW`, nunca uma conclusão presumida.

## Resultado

O resultado contém estado (`COMPLETED`, `NEEDS_HUMAN_REVIEW` ou `FAILED`), resposta textual opcional, contadores, avisos, eventos ordenados e metadados de tenant/request/correlation.

`execution: EXECUTED` significa que o ciclo do Agent Host foi executado com os adapters injetados. Não significa que um cálculo fiscal tenha sido aprovado, que a legislação tenha sido confirmada ou que uma obrigação tenha sido transmitida.

## Ferramentas fiscais já conectadas

O runner executa as seguintes ferramentas MCP por funções internas:

- `fiscal.search_evidence` — pesquisa RAG com data de referência, jurisdição e proveniência.
- `fiscal.get_document` — recupera documento e chunks indexados.
- `fiscal.get_split_payment_rules` — pesquisa evidência normativa de Split Payment.
- `fiscal.get_credit_eligibility_rules` — retorna a matriz determinística de crédito.
- `fiscal.evaluate_credit_eligibility` — executa o avaliador do Fiscal Domain.
- `fiscal.resolve_ruleset` — resolve RuleSet publicado e vigente.

As ferramentas RAG/RuleSet exigem D1. A matriz e o avaliador determinístico não dependem de D1. O catálogo retorna `DATABASE_REQUIRED` quando a dependência não está ligada. As entradas são validadas antes da execução e propriedades não declaradas são rejeitadas.

## Próxima integração necessária

1. Implementar um adapter de modelo usando o provedor escolhido e sua configuração real.
2. Definir autorização efetiva de ferramentas por tenant no host; `toolBindings` continuam sendo apenas teto de capacidade.
3. Expor uma rota autenticada depois de registrar o provider e a política de autorização.
4. Adicionar testes de integração com D1/RAG e as ferramentas fiscais reais em ambiente de teste.
5. Configurar e verificar secrets/bindings no ambiente Cloudflare antes de habilitar execução remota.

## Composição de Skills e Agent Host

`runPreparedFiscalAgent` em `workers/api/src/fiscal-agent-service.ts` executa a sequência interna: prepara o plano, carrega instruções do bundle, filtra bindings para ferramentas presentes no catálogo MCP, cruza com a autorização efetiva fornecida pelo host e inicia o Agent Host. Pedidos sem Skill especializada retornam `NO_MATCH` sem invocar o modelo. A função exige um `AgentModelProvider` injetado; nenhum provider é presumido ou criado implicitamente.

## Testes

Os testes em `workers/api/src/agent-host.test.ts` usam provider e tool runner falsos e cobrem autorização, sequência, erros, limites, timeout e rastreabilidade. Os testes em `workers/api/src/fiscal-agent-service.test.ts` cobrem a composição com instruções reais do bundle e o avaliador determinístico. Os testes em `workers/api/src/fiscal-tool-catalog.test.ts` e `workers/api/src/fiscal-tool-runner.test.ts` cobrem schemas, disponibilidade D1, resultados sem evidência, RuleSet ausente e propagação de metadados. A aprovação deve ser confirmada pela CI do commit correspondente.
