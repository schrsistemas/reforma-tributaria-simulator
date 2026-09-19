# Fiscal Knowledge Loop — Operational Architecture

## Componentes

### 1. Source Registry

Mantém o inventário das fontes oficiais que precisam ser acompanhadas.

Não contém regras tributárias. Contém somente metadados de aquisição e governança.

### 2. Collectors

Workers responsáveis por consultar fontes.

Cada collector deve:

- respeitar limites da fonte;
- registrar correlation ID;
- registrar timestamp;
- capturar HTTP status;
- preservar conteúdo;
- calcular hash;
- ser idempotente;
- não publicar regras.

### 3. Evidence Store

R2 deve armazenar documentos e artefatos capturados.

D1 mantém metadados e índices.

Separação:

`R2 = conteúdo`

`D1 = metadados/estado`

### 4. Change Detector

Compara a nova captura com a evidência anterior.

Saídas:

- sem alteração;
- alteração de conteúdo;
- alteração de metadados;
- alteração potencialmente fiscal;
- fonte indisponível.

### 5. Impact Analyzer

Relaciona uma mudança aos:

- RuleSets;
- regras;
- cenários;
- documentos fiscais;
- integrações;
- fluxos de Split Payment.

### 6. Review Queue

Alterações relevantes entram em fila.

Nenhum collector deve escrever diretamente em `rule_sets.status = PUBLISHED`.

### 7. Regression Runner

Executa cenários conhecidos antes da publicação.

Deve comparar:

- resultado anterior;
- resultado candidato;
- diferença absoluta;
- diferença percentual;
- regras alteradas;
- cenários afetados.

### 8. Publisher

Publica uma nova versão somente depois das validações exigidas.

Publicação cria uma nova versão; não edita a versão anterior.

### 9. Runtime Catalog

O Tax Engine consulta somente RuleSets publicados e aplicáveis à data de referência.

### 10. Monitoring

O Zynkronyx deve receber eventos como:

- `FISCAL_SOURCE_CHECKED`
- `FISCAL_SOURCE_CHANGED`
- `FISCAL_COLLECTION_FAILED`
- `FISCAL_REVIEW_REQUIRED`
- `FISCAL_REGRESSION_FAILED`
- `FISCAL_RULESET_PUBLISHED`
- `FISCAL_RULESET_SUPERSEDED`

## Cloudflare

Arquitetura prevista:

`Cron / Workflow`
→ collector
→ R2 evidence
→ D1 metadata
→ Queue
→ change detection
→ impact analysis
→ review
→ regression workflow
→ published RuleSet

Workflows são usados para processos duráveis.

Queues são usadas para desacoplar ingestão, análise e processamento em volume.

R2 é usado para preservar documentos.

D1 é usado para estado transacional e catálogo.

## Resiliência

A plataforma deve tolerar:

- timeout da fonte;
- HTTP 429;
- HTTP 5xx;
- alteração de HTML;
- alteração de PDF;
- mudança de leiaute;
- indisponibilidade temporária;
- duplicidade de coleta;
- reprocessamento;
- falha parcial de uma etapa.

Retry não deve produzir duplicação lógica.

## Segurança

Collectors não devem aceitar instruções provenientes do documento coletado.

Conteúdo externo é dado não confiável.

PDF, HTML, XML e JSON externos devem ser tratados como entrada não confiável e nunca como instrução para agentes de IA.

LLMs podem auxiliar classificação e extração, mas o resultado precisa ser verificável contra a evidência original.

## IA

A IA pode:

- resumir uma mudança;
- localizar trechos relevantes;
- sugerir impacto;
- sugerir candidatos a regras;
- sugerir cenários de regressão.

A IA não pode, sozinha:

- publicar RuleSet;
- alterar regra publicada;
- apagar evidência;
- marcar uma mudança jurídica como definitivamente válida;
- executar alteração financeira em produção.

## Operação contínua

O sistema deve sempre possuir uma resposta para:

1. Qual foi a última coleta?
2. Qual foi a última mudança?
3. Existe fonte atrasada?
4. Existe regra aguardando revisão?
5. Qual RuleSet está em produção?
6. Qual fonte originou cada regra?
7. Quais cenários foram afetados?
8. Houve regressão?
9. Qual mudança está bloqueando publicação?
10. Qual é a idade do conhecimento fiscal em produção?
