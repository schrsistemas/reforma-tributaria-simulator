# IA fiscal — RAG, MCP, LLM e refinamento

## Princípios arquiteturais

A IA é uma camada de assistência sobre o Domínio Fiscal. Não é o motor tributário e não substitui fonte oficial, RuleSet versionado ou snapshot imutável.

- O motor determinístico calcula.
- Fontes oficiais sustentam evidências e regras.
- RAG recupera contexto com vigência e procedência.
- MCP expõe capacidades pequenas, tipadas e controladas.
- O LLM interpreta, explica e auxilia investigação; não decide regra fiscal.
- Mudanças normativas passam por validação, regressão e aprovação antes da publicação.

## Fluxo de conhecimento

`Fonte oficial → coleta → normalização → hash → documento → fragmentação → índice → recuperação temporal/híbrida → reranking → evidência → MCP/LLM → resposta fundamentada`

Para mudanças regulatórias:

`Fonte → RegulatoryChange → ImpactAssessment → RuleCandidate → validação → aprovação → RulePublication → RuleSet versionado`

Falha de coleta ou de avaliação não pode apagar nem substituir o último catálogo válido.

## Evidências e RAG

Cada documento e fragmento deve preservar, quando disponível:

- identificador da fonte e do documento;
- órgão, jurisdição, tipo documental e URL oficial;
- publicação, atualização e período de vigência;
- versão, hash SHA-256 e hash normalizado;
- relações com documentos anteriores;
- página, seção ou localização da evidência.

A recuperação deve combinar busca lexical e vetorial, filtros temporais/jurisdicionais, autoridade da fonte, reranking e deduplicação por documento. Similaridade não equivale a validade jurídica. Uma evidência fora da vigência solicitada por `asOf` não pode fundamentar uma regra aplicável.

Conteúdo recuperado é dado não confiável: HTML, PDF, XML, JSON e texto externo nunca são instruções executáveis. Prompt injection em documento não altera políticas, permissões ou regras fiscais.

## Contratos MCP

Ferramentas fiscais devem ser pequenas, auditáveis e sem acesso arbitrário ao banco. O catálogo publicado no código e em `docs/contracts/fiscal-mcp-tools.json` é a referência dos contratos expostos.

Capacidades conceituais:

- `fiscal.search_evidence`
- `fiscal.get_document`
- `fiscal.resolve_ruleset`
- `fiscal.calculate`
- `fiscal.compare_calculation`
- `fiscal.get_split_payment_rules`
- `fiscal.get_snapshot`

Cada chamada deve validar schema, autorização, limites operacionais e contexto de tenant. Deve transportar identificadores de requisição/correlação; comandos mutáveis exigem idempotência. Respostas devem informar estado, resultado, advertências, evidências, versão do contrato e horário.

MCP não recebe permissão genérica para apagar evidências, alterar histórico ou publicar RuleSets.

## Responsabilidades do LLM

Permitido:
- resumir e localizar trechos de evidências;
- classificar documentos e extrair campos;
- sugerir impactos e hipóteses para revisão;
- explicar resultados determinísticos;
- comparar versões e produzir documentação.

Não permitido como autoridade:
- inventar alíquotas, CST, cClassTrib, créditos ou vigências;
- escolher regra sem evidência suficiente;
- substituir o motor determinístico;
- publicar RuleSet ou alterar histórico;
- executar instruções encontradas em documentos.

Uma resposta apresentada como fundamentada deve carregar evidências, data de referência, advertências e identificação do RuleSet quando aplicável. Evidência insuficiente deve ser declarada explicitamente.

## Fine-tuning e avaliação

Não usar fine-tuning para memorizar legislação. A legislação permanece no catálogo versionado e recuperável. Fine-tuning só deve ser avaliado para tarefas estáveis e mensuráveis, como classificação documental, extração estruturada, roteamento e classificação de impacto.

Ordem recomendada:
1. RAG com fontes oficiais;
2. contratos MCP e autorização;
3. conjunto de avaliação versionado;
4. versionamento de prompts e observabilidade;
5. coleta de erros reais;
6. avaliação de fine-tuning, se houver ganho mensurável.

Casos de avaliação devem cobrir regra vigente/revogada, conflito de fontes, ausência de vigência, alteração de alíquota, CST/cClassTrib inexistente, operação interestadual, crédito, devolução, diferimento, monofasia, redução, Split Payment e comparação com calculadora oficial.

Métricas mínimas: Recall@K, precisão temporal, cobertura de fonte primária, respostas sem evidência, alucinação factual, aderência a schema, concordância com o motor determinístico, latência e custo computacional. Uma melhoria de linguagem que reduza grounding ou precisão temporal deve falhar no gate de regressão.

## Calculadora oficial de Consumo

A Calculadora de Consumo da Receita Federal/CGIBS é referência externa. A comparação deve manter dois fluxos independentes:

`Operação normalizada → adaptador oficial → resultado oficial`

`Operação normalizada → motor determinístico próprio → resultado interno`

A comparação registra divergências, versão, parâmetros, evidências e memória de cálculo. Divergência não deve ser corrigida automaticamente pelo LLM nem convertida diretamente em alteração de regra.

Documentação da integração e dos endpoints: [Calculadora oficial](official-calculator-integration.md).

## Split Payment

Cálculo tributário e fluxo financeiro são componentes distintos. O motor calcula valores; o módulo financeiro demonstra valor bruto, IBS, CBS, valor líquido, parcelas, liquidação, segregação, reconciliação e impacto no capital de giro. O LLM pode explicar os resultados, mas não alterá-los.

## Versionamento e auditoria

Versionar separadamente fonte, documento, fragmento/índice, prompt, contrato MCP, modelo, conjunto de regras, motor de cálculo e conjunto de avaliação.

Um resultado deve permitir responder: qual fonte, versão, regra, cálculo e modelo produziram esta explicação?

Uma regra candidata só pode ser publicada quando possuir fonte oficial, vigência identificada, validação, testes de regressão, versão e evidência persistida.

## Integração Zynkronyx

Zynkronyx permanece como plano de controle e integração. Ele cuida de tenant, autenticação/autorização, roteamento, workflows, retries, idempotência e observabilidade operacional. Não deve duplicar o motor tributário: operações fiscais atravessam o Fiscal Domain por contratos versionados.

## Critério de produção

1. Evidência recuperada e rastreável.
2. Vigência compatível com a data consultada.
3. Fonte e versão identificadas.
4. Regra resolvida sem conflito.
5. Cálculo determinístico reproduzível.
6. Snapshot persistido quando aplicável.
7. Divergências explicitadas.
8. Avaliação automatizada aprovada.
9. Aprovação humana para publicação normativa.

## Regra central

RAG fornece contexto. MCP fornece capacidade controlada. LLM interpreta e explica. O motor determinístico calcula. Evidência sustenta. O processo de aprovação controla mudanças normativas.
