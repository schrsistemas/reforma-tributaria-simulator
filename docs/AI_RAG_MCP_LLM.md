# Arquitetura de IA — RAG, MCP, LLM e Refinamento

## 1. Objetivo

Este documento define a camada de conhecimento e assistência do Simulador da Reforma Tributária sem permitir que um LLM substitua o motor tributário determinístico.

Princípios:

- regra fiscal executável permanece determinística;
- fonte oficial é a autoridade de evidência;
- RAG recupera contexto, não inventa regra;
- MCP expõe capacidades controladas por contratos;
- LLM interpreta, explica e auxilia investigação;
- qualquer regra candidata passa por validação antes de publicação;
- respostas fiscais devem carregar evidência, vigência e versão.

## 2. Fluxo

Fonte oficial
→ coleta
→ normalização
→ documento/chunk
→ metadados
→ índice vetorial
→ recuperação híbrida
→ reranking
→ contexto citado
→ LLM
→ validação estrutural
→ resposta explicativa.

Para alteração regulatória:

Fonte
→ RegulatoryChange
→ ImpactAssessment
→ RuleCandidate
→ VALIDATING
→ APPROVED
→ RulePublication
→ conjunto de regras publicado.

## 3. RAG

Cada fragmento deve possuir:

- source_id;
- URL oficial;
- órgão;
- título;
- data de publicação;
- data de atualização;
- vigência;
- tipo documental;
- hash do conteúdo;
- versão;
- jurisdição;
- assunto;
- texto/chunk;
- referência de página/seção quando existir.

### Recuperação

Usar busca híbrida:

1. correspondência lexical/BM25 ou equivalente;
2. busca vetorial;
3. filtros por vigência, órgão, jurisdição e tipo;
4. reranking;
5. deduplicação por documento;
6. montagem do contexto com citações.

Não usar similaridade sem filtros temporais para decidir uma regra fiscal vigente.

## 4. MCP

O MCP deve expor operações pequenas, auditáveis e sem acesso arbitrário ao banco.

Contratos sugeridos:

- `fiscal.search_knowledge`
- `fiscal.get_source`
- `fiscal.resolve_rules`
- `fiscal.calculate`
- `fiscal.validate_document`
- `fiscal.create_snapshot`
- `fiscal.simulate_split_payment`
- `fiscal.compare_official_calculator`
- `fiscal.get_regulatory_changes`

Cada chamada recebe correlation_id e tenant/contexto quando aplicável.

Cada resposta deve informar:

- status;
- versão do contrato;
- correlation_id;
- resultado;
- evidências;
- warnings;
- timestamp.

## 5. LLM

O LLM não calcula imposto por conta própria.

Responsabilidades permitidas:

- explicar resultado;
- resumir fonte;
- localizar regra;
- comparar documentos;
- transformar pergunta em consulta estruturada;
- sugerir hipótese de regra;
- identificar inconsistências;
- produzir documentação.

Responsabilidades proibidas no domínio fiscal:

- inventar alíquota;
- inventar CST/cClassTrib;
- escolher regra sem evidência;
- substituir cálculo determinístico;
- transformar texto não oficial em regra publicada.

## 6. Refinamento / Fine-tuning

O projeto não deve começar por fine-tuning.

Ordem recomendada:

1. RAG com fontes oficiais;
2. contratos MCP;
3. conjunto de avaliações;
4. prompt/versionamento;
5. observabilidade;
6. coleta de erros reais;
7. somente então avaliar fine-tuning.

Fine-tuning deve melhorar comportamento de formato, classificação ou interpretação repetitiva. Ele não deve armazenar a legislação como fonte de verdade.

## 7. Conjunto de avaliação

Casos devem testar:

- pergunta com regra vigente;
- pergunta com regra revogada;
- conflito entre documentos;
- documento sem vigência;
- mudança de alíquota;
- CST/cClassTrib inexistente;
- operação interestadual;
- crédito;
- devolução;
- diferimento;
- monofasia;
- redução;
- Split Payment;
- comparação com calculadora oficial.

Métricas:

- precisão da recuperação;
- cobertura de evidência;
- taxa de alucinação;
- aderência ao esquema;
- consistência determinística;
- regressão entre versões.

## 8. Segurança

- nenhum segredo no repositório;
- nenhum token em prompts;
- MCP com allowlist de ferramentas;
- validação de entrada;
- limite de tamanho;
- timeout;
- idempotência;
- logs com correlation_id;
- mascaramento de dados pessoais;
- separação entre dados de usuário e conhecimento público.

## 9. Integração com a Calculadora de Consumo

A calculadora oficial é referência externa.

Fluxo:

`Operação → CST/cClassTrib → Calculadora oficial → resultado`

Em paralelo:

`Operação → Motor Fiscal → resultado próprio`

Depois:

`resultado oficial ↔ resultado próprio → divergência → evidência → análise`

Nenhuma divergência deve ser automaticamente convertida em alteração de regra.

## 10. Split Payment

O RAG fornece contexto normativo.

O motor determinístico calcula valores.

O módulo financeiro demonstra:

- valor bruto;
- IBS;
- CBS;
- valor líquido;
- parcelamento;
- liquidação;
- segregação;
- reconciliação;
- impacto de capital de giro.

O LLM pode explicar a diferença de liquidez, mas não deve alterar os valores calculados.

## 11. Controle de versões

Componentes versionados separadamente:

- fonte;
- chunk;
- índice;
- prompt;
- contrato MCP;
- modelo;
- conjunto de regras;
- motor de cálculo;
- conjunto de avaliação.

Um resultado fiscal deve conseguir responder:

> qual fonte, versão, regra, cálculo e modelo produziram esta explicação?

## 12. Critério de publicação

Uma regra candidata somente pode ser publicada quando:

- possui fonte oficial;
- possui vigência identificada;
- passou por validação;
- possui testes;
- não quebra regressões conhecidas;
- possui versão;
- possui evidência persistida.

## 13. Resultado esperado

A arquitetura final é:

Fontes Oficiais
→ Ciclo de Conhecimento
→ RAG
→ MCP
→ LLM
→ Motor Fiscal determinístico
→ Registro Imutável
→ Zynkronyx / integrações
→ explicação auditável.

O LLM é assistente da plataforma; não é a autoridade tributária.
