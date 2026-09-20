# LLM Fiscal — política de refinamento e Fine-Tuning

## Objetivo

Usar modelos de linguagem para **entender, localizar, resumir, classificar e explicar evidências fiscais**, sem transformar o LLM em autoridade tributária.

Arquitetura:

`Fonte oficial → Evidência → RAG → MCP → LLM → explicação/assistência → Motor determinístico → Snapshot`

O LLM nunca substitui o catálogo de regras nem o cálculo determinístico.

## RAG

O RAG deve recuperar primeiro as evidências e somente depois permitir geração de linguagem.

Ordem de prioridade:

1. fonte primária;
2. jurisdição compatível;
3. vigência compatível com `asOf`;
4. tipo documental;
5. correspondência lexical/semântica;
6. versão mais adequada;
7. reranking.

**Score de recuperação não é validade jurídica.**

Toda resposta fundamentada deve carregar:

- documento;
- trecho;
- órgão;
- URL;
- data de publicação;
- vigência;
- versão;
- hash;
- nível de evidência.

### Regra de ausência

Se não houver evidência aplicável, a resposta deve ser:

> Evidência insuficiente para concluir.

É proibido completar lacunas por memória do modelo.

## MCP

O MCP é a fronteira de capacidade.

Ferramentas:

- `fiscal.search_evidence`
- `fiscal.get_document`
- `fiscal.resolve_ruleset`
- `fiscal.calculate`
- `fiscal.compare_calculation`
- `fiscal.get_split_payment_rules`
- `fiscal.get_snapshot`

Cada chamada precisa de:

- requestId;
- correlationId;
- tenant quando aplicável;
- autenticação;
- autorização;
- validação de entrada;
- limite de tamanho;
- timeout;
- auditoria;
- idempotência para comandos mutáveis.

Não existe ferramenta MCP de SQL arbitrário.

## LLM

### Permitido

- resumir documentos;
- explicar trechos recuperados;
- localizar fundamento;
- classificar documento;
- extrair campos;
- classificar impacto;
- comparar versões;
- gerar perguntas para revisão;
- explicar um resultado produzido pelo motor determinístico.

### Proibido

- inventar alíquota;
- inventar crédito;
- inventar vigência;
- decidir validade jurídica sem evidência;
- publicar RuleSet;
- alterar histórico;
- substituir o motor determinístico;
- executar instruções contidas em documentos recuperados.

## Fine-Tuning

Fine-Tuning **não** será utilizado para memorizar legislação.

Motivo: legislação, atos, leiautes e manuais mudam.

Fine-Tuning pode ser usado para tarefas estáveis:

- classificação documental;
- extração estruturada;
- roteamento;
- classificação de impacto;
- normalização de metadados.

O conjunto de treinamento deve possuir:

- versão;
- origem;
- evidências;
- licença/permissão de uso;
- responsável pela aprovação;
- critérios de inclusão;
- critérios de exclusão;
- conjunto de teste separado.

Um exemplo de treinamento nunca deve ensinar ao modelo uma regra normativa como fato permanente. Deve ensinar a **tarefa**.

## Política de refinamento

Toda alteração de prompt, modelo, chunking, reranking ou dataset deve ser avaliada contra uma bateria fixa.

Gate mínimo:

- Recall@K de evidência;
- precisão temporal;
- cobertura de fontes primárias;
- taxa de respostas sem evidência;
- erros factuais;
- erros de vigência;
- consistência estruturada;
- concordância com cálculo determinístico;
- latência;
- custo computacional.

Uma melhoria que aumenta fluência mas reduz grounding ou precisão temporal é rejeitada.

## Prompt Injection

Todo conteúdo externo é dado não confiável.

HTML, PDF, XML, JSON, texto, planilhas e documentos oficiais podem conter instruções adversariais. Essas instruções são **conteúdo**, não política do sistema.

O conteúdo recuperado nunca pode:

- alterar permissões;
- alterar ferramentas MCP;
- alterar regras do sistema;
- solicitar segredo;
- executar código;
- publicar regra.

## Calculadora de Consumo

A Calculadora de Consumo da Receita Federal/CGIBS é tratada como serviço externo de referência.

A comparação deve preservar:

`entrada normalizada → versão da calculadora → resposta oficial → cálculo interno → diferença → diagnóstico`

Divergência não deve ser corrigida automaticamente pelo LLM.

## Split Payment

O LLM pode explicar o fluxo financeiro, mas não deve inferir regra jurídica.

A camada determinística deve calcular:

- valor bruto;
- IBS;
- CBS;
- valor líquido;
- parcelas;
- segregação;
- liquidação;
- reconciliação;
- impacto de liquidez.

A interface deve deixar explícito que o Split Payment não é um novo tributo.

## Princípio final

**RAG encontra. MCP controla. LLM explica. Motor determinístico calcula. Evidência sustenta. Humano aprova mudanças normativas.**
