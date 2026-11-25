# RAG Fiscal — Especificação

Pipeline: Discover → Capture → Hash → Parse → Chunk → Classify → Index → Retrieve → Rerank → Cite.

## Metadados e vigência

Metadados mínimos: document_id, source_type, authority, published_at, published_at_source, effective_from, effective_from_source, effective_to, effective_to_source, version, content_hash, jurisdiction, topics e evidence_level.

A ingestão automática extrai datas somente quando:
- existe exatamente um identificador de instrumento normativo reconhecível no conteúdo;
- a data está em metadado estruturado de publicação, metadado HTML específico ou texto com rótulo explícito de publicação;
- o início/fim de vigência aparece em formulação normativa explícita.

Datas genéricas da página, datas de atualização e datas de coleta nunca são tratadas como publicação ou vigência legal. Quando a fonte não fornece publicação explícita, `published_at` recebe a data de captura apenas como fallback técnico e `published_at_source=RETRIEVAL_FALLBACK`. Esse valor não comprova publicação.

A busca histórica usa `effective_from` quando disponível. Sem esse campo, só admite `published_at` como limite inferior quando `published_at_source` confirma uma origem oficial (`JSON_LD`, `HTML_META` ou `EXPLICIT_TEXT`). Registros sem data legal comprovada são excluídos de consultas com `asOf`, em vez de serem presumidos aplicáveis. Fim de vigência só é preenchido com expressão explícita; ausência de data final não equivale a prova de vigência perpétua.

A extração é conservadora e não substitui validação jurídica nem parsing específico por tipo de ato. Páginas que agregam múltiplos atos não recebem datas atribuídas automaticamente.

## Chunking e evidência

Chunking deve evoluir para respeitar unidades semânticas: artigo, parágrafo, inciso, tabela, seção de manual, regra de leiaute e exemplo oficial. O chunking atual por caracteres com sobreposição é apenas uma estratégia operacional, não segmentação jurídica definitiva.

Se não houver evidência primária aplicável, o sistema deve sinalizar insuficiência em vez de completar por inferência.

Mudança documental cria nova versão. Nunca sobrescrever histórico.

## Migrações

As migrações `0021_rag_date_provenance.sql` e `0022_rag_effective_end_provenance.sql` registram a origem das datas. Aplicá-las em ordem após as migrações anteriores antes de habilitar a nova ingestão em D1. Registros antigos recebem `LEGACY_UNKNOWN` e não devem ser considerados temporalmente comprovados em consultas históricas.

## Testes obrigatórios

Testes obrigatórios: resposta explícita, resposta distribuída em documentos, conflito de versões, documento revogado, ausência de informação, período futuro, datas inválidas, página com múltiplos atos e classificação específica.

O teste de ausência é obrigatório: ausência de evidência deve produzir insuficiência, não invenção.
