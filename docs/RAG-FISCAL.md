# RAG Fiscal — Especificação

Pipeline: Discover → Capture → Hash → Parse → Chunk → Classify → Index → Retrieve → Rerank → Cite.

Chunking deve respeitar unidades semânticas: artigo, parágrafo, inciso, tabela, seção de manual, regra de leiaute e exemplo oficial.

Metadados mínimos: document_id, source_type, authority, published_at, effective_from, effective_to, version, content_hash, jurisdiction, topics e evidence_level.

Se não houver evidência primária aplicável, o sistema deve sinalizar insuficiência em vez de completar por inferência.

Mudança documental cria nova versão. Nunca sobrescrever histórico.

Testes obrigatórios: resposta explícita, resposta distribuída em documentos, conflito de versões, documento revogado, ausência de informação, período futuro e classificação específica.

O teste de ausência é obrigatório: ausência de evidência deve produzir insuficiência, não invenção.