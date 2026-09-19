# Fiscal Knowledge Loop — Data Model

O catálogo de conhecimento fiscal precisa separar fonte, evidência, interpretação, regra executável e publicação.

## Entidades

### fiscal_sources

Cadastro das fontes monitoradas.

Campos mínimos:

- `id`
- `authority`
- `name`
- `source_type`
- `official_url`
- `collection_method`
- `cadence`
- `enabled`
- `last_checked_at`
- `last_success_at`
- `last_hash`

### fiscal_evidence

Representa uma captura imutável de uma fonte.

Campos mínimos:

- `id`
- `source_id`
- `retrieved_at`
- `published_at`
- `official_identifier`
- `title`
- `canonical_url`
- `content_hash`
- `normalized_hash`
- `content_location`
- `status`

Uma nova captura nunca deve alterar o conteúdo de uma evidência anterior.

### fiscal_changes

Representa a diferença detectada entre evidências.

Campos mínimos:

- `id`
- `source_id`
- `previous_evidence_id`
- `current_evidence_id`
- `detected_at`
- `change_type`
- `impact_level`
- `diff_location`
- `status`

### fiscal_interpretations

Representa a análise humana ou jurídica de uma evidência.

Campos mínimos:

- `id`
- `evidence_id`
- `statement`
- `classification`
- `review_status`
- `reviewed_by`
- `reviewed_at`

Interpretação não é automaticamente regra executável.

### fiscal_rule_candidates

Representa uma possível alteração do catálogo executável.

Campos mínimos:

- `id`
- `evidence_id`
- `rule_set_id`
- `change_reason`
- `impact_level`
- `validation_status`
- `candidate_payload`

### rule_sets

É a unidade publicada consumida pelo motor fiscal.

Cada combinação `id + version` é imutável após publicação.

### publication_events

Registra quando e por que uma versão foi disponibilizada para produção.

Campos mínimos:

- `id`
- `rule_set_id`
- `rule_set_version`
- `published_at`
- `published_by`
- `validation_run_id`
- `approval_reference`

## Regra de dependência

A direção obrigatória é:

`source → evidence → change → interpretation → rule candidate → RuleSet → simulation`

Nunca:

`source → simulation`

Isso impede que uma alteração externa durante uma operação gere cálculo não reproduzível.

## Hashes

Devem existir pelo menos dois hashes:

- **content hash** — hash do conteúdo capturado;
- **normalized hash** — hash do conteúdo após normalização determinística.

O primeiro detecta alteração física do documento. O segundo reduz falsos positivos provocados por diferenças irrelevantes de apresentação.

## Conteúdo imutável

Quando possível, a evidência deve apontar para armazenamento imutável em R2, preservando:

- conteúdo original;
- metadados;
- hash;
- timestamp;
- URL de origem.

A URL oficial continua sendo a referência externa, mas não deve ser a única forma de recuperar uma evidência histórica.

## Multi-tenant

Fontes oficiais e RuleSets podem ser globais.

Resultados, cenários, auditoria operacional e configurações de integração devem permanecer tenant-scoped.

## Falha de coleta

Falhas devem gerar estado observável, não substituir a última evidência válida.

Exemplo:

`SOURCE_HEALTHY → COLLECTION_FAILED → RETRYING → SOURCE_HEALTHY`

A falha não promove nem remove RuleSets.

## Idempotência

A coleta deve usar uma chave derivada de:

`source_id + normalized_hash`

Uma captura idêntica não deve criar uma nova versão lógica do conhecimento.

## Auditoria

Toda alteração que possa chegar ao motor deve permitir navegar:

`resultado → RuleSet → regra → candidato → interpretação → mudança → evidência → fonte oficial`

Esse encadeamento é requisito de auditoria, não apenas recurso de interface.
