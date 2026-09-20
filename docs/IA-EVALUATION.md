# Avaliação de IA Fiscal

## Objetivo

Impedir que melhorias de RAG, MCP, prompt, modelo ou Fine-Tuning degradem a confiabilidade fiscal.

## Conjunto mínimo de avaliação

Cada caso possui:

- pergunta;
- `asOf`;
- jurisdição;
- evidências esperadas;
- fatos esperados;
- RuleSet esperado quando aplicável;
- resultado determinístico esperado quando aplicável.

## Classes obrigatórias

1. resposta explícita em um documento;
2. resposta distribuída em vários documentos;
3. conflito entre versões;
4. documento revogado;
5. informação ausente;
6. período futuro;
7. classificação tributária específica;
8. alteração de leiaute;
9. Split Payment;
10. divergência com Calculadora de Consumo.

## Gates

### Grounding

A resposta fundamentada precisa ter pelo menos uma evidência válida.

### Temporalidade

A evidência precisa ser compatível com `asOf`.

### Primariedade

Quando existe fonte primária aplicável, uma fonte secundária não deve substituir silenciosamente a primária.

### Ausência

Caso sem evidência deve produzir insuficiência.

### Determinismo

Quando a pergunta exigir valor tributário, o LLM não calcula por conta própria. Ele chama o motor determinístico e explica o resultado.

## Métricas

- Recall@1;
- Recall@3;
- Recall@5;
- precisão temporal;
- cobertura primária;
- taxa de grounding;
- taxa de alucinação;
- erro estruturado;
- concordância determinística;
- latência p50/p95;
- custo por consulta.

## Critério de aprovação

Uma versão somente pode substituir outra se não piorar os gates críticos de:

- grounding;
- temporalidade;
- fonte primária;
- concordância determinística.

Melhor fluência isoladamente não é critério suficiente.

## Fine-Tuning

Datasets de Fine-Tuning devem ser avaliados separadamente do catálogo normativo.

O dataset não pode substituir o RAG.

A versão do dataset deve aparecer no resultado de avaliação para permitir reprodução.


## Casos iniciais executáveis

| ID | Classe | Esperado |
|---|---|---|
| RAG-001 | regra vigente | recuperação com evidência primária e vigência compatível |
| RAG-002 | regra fora da vigência | exclusão quando `asOf` não estiver dentro da vigência |
| RAG-003 | jurisdição | filtro não mistura documentos de outra jurisdição |
| RAG-004 | fonte secundária | fonte primária recebe prioridade quando aplicável |
| RAG-005 | ausência | `grounded=false` e aviso de evidência insuficiente |
| RAG-006 | Split Payment | contexto recuperado não altera o cálculo determinístico |
| RAG-007 | Calculadora de Consumo | divergência gera comparação, nunca publicação automática de regra |
| RAG-008 | MCP | `requestId` e `correlationId` preservados no retorno |

### Estado da implementação

A recuperação já aplica filtro temporal, jurisdição, tipo documental e metadados de tópicos antes do resultado final. O ranking combina sinal lexical, autoridade, tipo documental e tópicos. Respostas sem hits não são marcadas como fundamentadas.

### Gate para Fine-Tuning

Nenhum Fine-Tuning deve ser promovido enquanto RAG-001 a RAG-008 não estiverem reproduzíveis e os gates críticos permanecerem estáveis entre versões.
