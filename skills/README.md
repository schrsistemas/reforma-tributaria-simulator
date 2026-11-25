# Skills tributárias

Este diretório contém Skills compatíveis com a convenção de diretório `SKILL.md` (frontmatter YAML com \`name\` e \`description\`). Cada Skill é um módulo de instruções especializado; não é, por si só, um serviço remoto nem uma autorização para executar ferramentas.

## Skill principal

- \`tributario-orchestrator\` — roteia solicitações, coordena módulos e consolida respostas.

## Skills especializadas

- \`ibs-cbs-transicao\` — IBS, CBS, transição, destino e regras de incidência.
- \`imposto-seletivo\` — IS, hipóteses de incidência e tratamento específico.
- \`simples-nacional-regimes\` — Simples Nacional, MEI e interações com regimes.
- \`documentos-fiscais\` — documentos eletrônicos, campos, schemas e validações.
- \`split-payment\` — segregação, liquidação e reconciliação financeira.
- \`evidencia-legislacao-rag\` — pesquisa normativa, temporalidade e proveniência.
- \`calculo-fiscal-deterministico\` — preparação de entradas, execução e auditoria de cálculo.
- \`obrigacoes-compliance\` — obrigações acessórias, prazos e conformidade.

## Contrato de composição

A Skill principal carrega apenas os módulos necessários à tarefa. Módulos podem declarar dependências; o runtime do agente deve carregar os respectivos \`SKILL.md\` antes de delegar. O manifesto \`registry.json\` é o catálogo de roteamento desta implementação.

O Worker executa o roteamento determinístico do manifesto por `GET /api/v1/skills` e `POST /api/v1/skills/resolve`, incluindo seleção por gatilhos, dependências transitivas e ordenação. O host de agentes ainda deve carregar o conteúdo de cada `SKILL.md` e executar apenas ferramentas autorizadas. A existência dos arquivos não cria automaticamente novos conectores, MCP servers ou permissões. O manifesto também declara `toolBindings` por módulo; consulte `GET /api/v1/mcp/tools` para verificar se cada ferramenta está disponível ou exige configuração. O endpoint autenticado `POST /api/v1/skills/prepare` entrega os corpos Markdown selecionados, contexto fiscal e lista deduplicada de ferramentas; a execução pelo agente continua sob responsabilidade do host.

## Princípios

1. Fontes oficiais e evidências versionadas são a base normativa.
2. Vigência é distinta de publicação.
3. O LLM não inventa alíquotas, classificações, créditos ou datas.
4. Cálculo de produção usa o Fiscal Domain/RuleSet publicado; nunca cálculo mental do modelo.
5. O resultado deve informar data de referência, jurisdição, fontes, limitações e versão.
6. Ausência ou conflito de evidência deve ser declarado.
7. Uma Skill especializada não pode publicar ou alterar RuleSet sem o fluxo formal de aprovação.
