# Fiscal Agent Host

## Estado

O módulo `workers/api/src/agent-host.ts` implementa o ciclo de execução independente de provedor. Ele é uma biblioteca interna, ainda não exposta por endpoint HTTP e ainda não conectada a um provedor LLM em produção.

Não existe configuração de modelo no `workers/api/wrangler.toml` nem adapter de provedor registrado no Worker. Por isso, o endpoint `POST /api/v1/skills/prepare` continua sendo apenas preparação de contexto e instruções; não se deve interpretar `PREPARED` como execução fiscal.

## Contratos

- `AgentModelProvider.generate`: adapter de modelo que recebe consulta, contexto, instruções selecionadas, histórico de ferramentas, índice de iteração e `AbortSignal`.
- `AgentToolRunner.execute`: executor de ferramentas já validadas pelo catálogo MCP e pela política de autorização do host.
- `runAgentHost`: ciclo limitado que coordena modelo e ferramentas, sem depender de SDK de fornecedor.

## Política de ferramentas

A lista executável é a interseção entre:

1. `toolBindings` do plano de Skills;
2. `authorizedTools` concedidas pelo host/tenant.

Bindings nunca concedem permissão. O executor concreto ainda deve validar o schema de entrada de cada ferramenta, aplicar isolamento por tenant, chamar somente operações internas permitidas e preservar a proveniência dos resultados. O Agent Host não transforma nomes de ferramentas em rotas HTTP nem executa chamadas arbitrárias.

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

## Próxima integração necessária

1. Implementar um adapter de modelo usando o provedor escolhido e sua configuração real.
2. Implementar um `AgentToolRunner` que mapeie somente ferramentas do catálogo para funções internas reais, com schema e autorização por tenant.
3. Expor uma rota autenticada após os dois adapters existirem.
4. Adicionar testes de integração com D1/RAG e as ferramentas fiscais reais.
5. Configurar e verificar secrets/bindings no ambiente Cloudflare antes de habilitar execução remota.

## Testes

Os testes unitários em `workers/api/src/agent-host.test.ts` usam provider e tool runner falsos. Eles cobrem autorização, sequência, erros, limites, timeout e rastreabilidade. A existência dos testes não significa que tenham sido executados; o resultado deve ser confirmado pelo comando de testes ou pelo CI.
