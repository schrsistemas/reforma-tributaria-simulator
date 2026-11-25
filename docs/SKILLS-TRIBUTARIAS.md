# Arquitetura das Skills tributárias

## Objetivo

Transformar o projeto em um conjunto de competências tributárias componíveis, com uma Skill orquestradora e módulos especializados. A unidade de composição é o diretório com \`SKILL.md\`; o catálogo de roteamento fica em \`skills/registry.json\`.

## Visão de arquitetura

\`\`\`text
                 Usuário / ERP / Agente
                           |
                           v
               tributario-orchestrator
                           |
              contexto fiscal compartilhado
                           |
       +-------------------+-------------------+
       |                   |                   |
       v                   v                   v
  IBS/CBS/IS          Simples/MEI       Documentos fiscais
       |                   |                   |
       +-------------------+-------------------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
      Evidência/RAG               Obrigações/Compliance
             |                           |
             +-------------+-------------+
                           |
                           v
              Cálculo determinístico
                           |
                           v
              Fiscal Domain / RuleSet
                           |
                           v
             Resultado + evidências + auditoria
                           |
             Split Payment / integrações
\`\`\`

## Skills criadas

| Skill | Responsabilidade |
|---|---|
| tributario-orchestrator | Intenção, roteamento e consolidação |
| ibs-cbs-transicao | IBS, CBS, transição, destino e créditos |
| imposto-seletivo | Incidência e regras de IS |
| simples-nacional-regimes | Simples, MEI e regimes |
| documentos-fiscais | XML, schemas, eventos e leiautes |
| split-payment | Segregação e reconciliação financeira |
| evidencia-legislacao-rag | Fonte, vigência e prova normativa |
| calculo-fiscal-deterministico | RuleSet e cálculo auditável |
| obrigacoes-compliance | Obrigações e prazos |

## Protocolo de composição

1. O host carrega \`skills/tributario-orchestrator/SKILL.md\`.
2. O orquestrador classifica a tarefa e consulta \`skills/registry.json\`.
3. O host carrega os módulos indicados e suas dependências.
4. Os módulos recebem o mesmo contexto: operação, data, jurisdição, regime, evidências e identificadores de correlação.
5. O módulo especializado retorna achados estruturados, evidências, advertências e limitações.
6. O orquestrador consolida sem apagar divergências entre módulos.
7. Cálculo exige motor determinístico e RuleSet aplicável; publicação normativa exige fluxo de aprovação.

### Contrato de retorno recomendado

\`\`\`json
{
  "skill": "ibs-cbs-transicao",
  "status": "SUPPORTED",
  "referenceDate": "YYYY-MM-DD",
  "jurisdiction": "FEDERAL",
  "findings": [],
  "evidence": [],
  "assumptions": [],
  "warnings": [],
  "unsupported": [],
  "requiresHumanReview": true
}
\`\`\`

O exemplo é um contrato recomendado para integração futura; não significa que todos os módulos já exponham endpoints com esse formato.

## Dispatcher determinístico implementado

O Worker de API possui agora uma primeira camada executável de roteamento, baseada no manifesto versionado:

- `GET /api/v1/skills` — lista o catálogo, os gatilhos, os caminhos e as dependências.
- `POST /api/v1/skills/resolve` — recebe uma consulta e devolve as Skills selecionadas, dependências transitivas e ordem determinística de carregamento.
- O endpoint de resolução exige autenticação de integração, tenant vinculado e os cabeçalhos de correlação já utilizados pela API.
- O matching normaliza acentos e caixa, suporta gatilhos em português e inglês, permite seleção explícita de Skills e elimina dependências duplicadas.
- O plano inclui a Skill orquestradora, marca cada módulo como correspondência ou dependência e sinaliza quando não existe correspondência especializada.
- Cada módulo declara `toolBindings` para ferramentas fiscais já catalogadas pela API, como `fiscal.search_evidence`, `fiscal.resolve_ruleset`, `fiscal.calculate` e `fiscal.get_document`. A disponibilidade operacional deve ser consultada em `GET /api/v1/mcp/tools`; bindings com `CONFIGURATION_REQUIRED` não devem ser tratados como executáveis.
- Ciclos, dependências ausentes, IDs desconhecidos e limites de composição são rejeitados.

Exemplo de chamada:

```http
POST /api/v1/skills/resolve
Authorization: Bearer <integration-token>
X-Zynkronyx-Tenant: <tenant-bound-to-token>
X-Correlation-Id: <correlation-id>
Content-Type: application/json

{
  "query": "Preciso validar uma NF-e e analisar os efeitos de IBS e CBS",
  "maxSkills": 12
}
```

O dispatcher retorna os IDs e caminhos dos arquivos `SKILL.md`, a ordem de dependências, os módulos acionados e os `toolBindings` associados. **Ele ainda não carrega os corpos dos arquivos de instrução, não invoca um LLM e não executa ferramentas MCP**. Essa etapa depende do host/runtime de agentes. O retorno informa explicitamente `HOST_RUNTIME_REQUIRED` e `NOT_EXECUTED`; portanto, não deve ser confundido com uma análise tributária concluída.

## Runtime de preparação de Skills implementado

O Worker agora também empacota as instruções Markdown reais das Skills selecionadas e prepara um envelope consumível por um host de agentes.

- Fonte versionada: `skills/instructions.json`, sincronizada com os nove arquivos `SKILL.md`.
- Runtime: `workers/api/src/skill-runtime.ts`.
- Testes: `workers/api/src/skill-runtime.test.ts`.
- Endpoint: `POST /api/v1/skills/prepare`, autenticado pelo mesmo token e tenant vinculados usados pelos demais endpoints de integração.
- O pacote contém a consulta original, requestId, correlationId, contexto fiscal, plano ordenado, corpo integral das instruções, SHA do blob de cada arquivo e lista deduplicada de `toolBindings`. Binding não concede permissão: o host deve consultar `GET /api/v1/mcp/tools` e aplicar sua política de autorização antes de executar qualquer ferramenta.
- O contexto compartilhado aceita objeto JSON de até 64 KiB; a consulta tem limite de 4.000 caracteres.
- Ausência de instrução no bundle ou divergência entre path do manifesto e path do arquivo gera erro; não há fallback silencioso.

Exemplo:

```http
POST /api/v1/skills/prepare
Authorization: Bearer <integration-token>
X-Zynkronyx-Tenant: <tenant-bound-to-token>
X-Correlation-Id: <correlation-id>
Content-Type: application/json

{
  "query": "Validar uma NF-e e analisar IBS, CBS e Split Payment",
  "context": {
    "operationDate": "2027-01-01",
    "jurisdiction": "BR",
    "taxpayer": { "regime": "REGULAR" }
  }
}
```

O retorno é um pacote de preparação, não um resultado tributário. Ele informa `execution: NOT_EXECUTED` e `nextStep: HOST_AGENT_EXECUTION_REQUIRED`. O host externo ainda deve interpretar as instruções, consultar a disponibilidade e as permissões de cada ferramenta, decidir quando chamar cada ferramenta e devolver resultados estruturados. A API não envia dados a um provedor LLM, não executa ferramentas por conta própria e não publica RuleSets.

## Estado e limites reais

- Os arquivos \`SKILL.md\` e o manifesto estão versionados no GitHub.
- A convenção é compatível com runtimes que carregam Skills a partir de diretórios.
- O Worker descobre o manifesto, seleciona Skills, resolve dependências e carrega os corpos `SKILL.md` do bundle versionado. O host/agente ainda precisa interpretar as instruções e executar ferramentas autorizadas; o repositório não instala Skills em agentes externos por conta própria.
- As ferramentas MCP são contratos/capacidades documentadas; disponibilidade operacional depende do servidor e das permissões do runtime.
- O motor atual \`@rts/tax-engine\` é um calculador genérico de IBS/CBS e declara limitações para CST/cClassTrib, NCM/NBS, alíquotas por localização, reduções, créditos, IS, Simples Nacional e bases específicas. As Skills não ampliam magicamente essa cobertura.
- Não há publicação automática de RuleSet por Skill.

## Próximas fases técnicas

1. Adicionar schemas JSON para entrada e retorno de cada Skill.
2. Conectar o dispatcher já criado ao host/runtime de agentes para carregar os corpos dos SKILL.md sob demanda.
3. Ligar cada módulo aos contratos MCP reais, com autorização por ferramenta, timeout, idempotência e auditoria.
4. Criar conjunto de avaliação por domínio, com casos positivos, negativos, conflito de fontes e vigência histórica.
5. Expor no dashboard quais Skills foram acionadas, fontes utilizadas, versões e limites.
6. Somente depois avaliar execução paralela de Skills e cache de resultados.

## Critério de pronto

Uma Skill só é considerada operacional quando tiver instruções, contrato de entrada/saída, ferramentas autorizadas, evidências, testes de avaliação e telemetria. A presença do \`SKILL.md\` comprova apenas a definição documental.


## Agent Host e execução de ferramentas fiscais

A execução agora possui três componentes internos:

- `workers/api/src/agent-host.ts`: ciclo limitado de modelo/ferramentas, com autorização por interseção de allowlists, timeout, limite de iterações e trilha de eventos.
- `workers/api/src/fiscal-tool-runner.ts`: executor interno das ferramentas MCP implementadas, sem chamadas HTTP recursivas.
- `workers/api/src/fiscal-agent-service.ts`: composição de preparação de Skills, instruções do bundle, bindings executáveis, autorização do host e Agent Host.

O catálogo `GET /api/v1/mcp/tools` descreve somente ferramentas que o endpoint `POST /api/v1/mcp/call` realmente executa. Cada ferramenta apresenta schema de entrada; campos extras, tipos incorretos e valores fora dos limites são rejeitados. Ferramentas dependentes de D1 informam `DATABASE_REQUIRED` quando a conexão não está disponível.

Ferramentas MCP conectadas ao runner:

- `fiscal.search_evidence`
- `fiscal.get_document`
- `fiscal.get_split_payment_rules`
- `fiscal.get_credit_eligibility_rules`
- `fiscal.evaluate_credit_eligibility`
- `fiscal.resolve_ruleset`

As declarações de ferramentas nas Skills que não constam desse catálogo — por exemplo, `fiscal.calculate` e `fiscal.compare_calculation` — não são automaticamente executáveis pelo Agent Host. Elas continuam associadas a outras rotas/capacidades e serão integradas ao runner somente após contrato, schema e testes próprios.

A função `runPreparedFiscalAgent` filtra os bindings pelo catálogo MCP real e cruza o resultado com `authorizedTools`, fornecido pela política do host. Se não houver Skill especializada, retorna `NO_MATCH` sem chamar o modelo.

**Limite atual:** a composição é uma biblioteca interna testada, não um endpoint público de execução. Não há adapter LLM registrado nem credenciais/configuração de provedor no Worker. O projeto ainda não executa agentes autônomos em produção. A preparação de Skills e a execução determinística das ferramentas conectadas já estão implementadas; a geração de linguagem por modelo permanece pendente.

### Próximas fases

1. Selecionar e configurar um provider LLM por meio de binding/secret no ambiente de execução.
2. Implementar o adapter do provider com suporte a tool calls estruturadas e validação de resposta.
3. Definir política de autorização de ferramentas por tenant no host, sem derivá-la do manifesto de Skills.
4. Expor endpoint autenticado somente depois da configuração do provider e da política.
5. Integrar gradualmente as demais capacidades HTTP (simulação, comparação oficial e pagamentos) com schemas e testes específicos.
6. Adicionar testes de integração em ambiente D1 isolado e avaliações tributárias com evidência oficial.
