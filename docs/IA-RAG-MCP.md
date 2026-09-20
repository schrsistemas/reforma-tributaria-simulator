# IA Fiscal — RAG, MCP e LLM

## Objetivo
Arquitetura de IA do Reforma Tributária Simulator sem transferir decisões fiscais determinísticas para um modelo de linguagem.

## Separação de responsabilidades
Fonte oficial → coleta/evidência → RAG fiscal → LLM para contexto e explicação → MCP para ferramentas controladas → motor fiscal determinístico → snapshot e evidência.

O LLM não é a fonte de verdade tributária. O motor determinístico calcula; o RAG recupera evidência; o MCP expõe capacidades controladas.

## RAG
Cada documento deve manter document_id, órgão, tipo, URL oficial, publicação, atualização, vigência, hash, versão, texto normalizado, chunks e nível de evidência.

A recuperação deve priorizar fonte primária, vigência aplicável, versão válida, jurisdição, classificação e relevância semântica.

## MCP
Ferramentas previstas:
- fiscal.search_evidence
- fiscal.get_document
- fiscal.resolve_ruleset
- fiscal.calculate
- fiscal.compare_calculation
- fiscal.get_split_payment_rules
- fiscal.get_snapshot

MCP valida entrada, autorização, correlação, idempotência e auditoria. Não permite escrita arbitrária no catálogo fiscal.

## LLM
Permitido: resumir, localizar trechos, classificar documentos, sugerir impacto, explicar cálculo determinístico, gerar perguntas de revisão e comparar versões.

Não pode: inventar alíquotas, decidir vigência sem evidência, publicar RuleSet sozinho, substituir cálculo determinístico ou alterar histórico.

## Fine-tuning
RAG-first. Fine-tuning não deve memorizar legislação, pois legislação possui vigência e versões. Pode ser usado posteriormente para tarefas estáveis como classificação, extração estruturada e roteamento.

## Regra de ouro
RAG fornece contexto. MCP fornece capacidade controlada. LLM raciocina e explica. Motor determinístico decide o cálculo. Evidência sustenta a decisão.