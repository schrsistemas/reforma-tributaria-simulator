# Operação de IA Fiscal

Fluxo: fonte oficial → coleta → documento/hash → parser → RAG → mudança → impacto → candidato → regressão → aprovação → RuleSet → motor determinístico → snapshot → explicação LLM.

Fonte indisponível: manter último documento validado e marcar coleta indisponível.

Conflito de versões: manter ambas e resolver por vigência; exigir revisão quando houver ambiguidade.

RAG sem evidência: informar insuficiência.

LLM divergente do cálculo: resultado determinístico prevalece e divergência é registrada.

MCP indisponível: informar indisponibilidade sem inventar resposta.

Observabilidade mínima: correlation_id, tenant_id quando aplicável, request_id, tool_name, ruleset_id, snapshot_id, duração, resultado e erro estruturado.

Zero-cost: nenhum fornecedor pago de IA é requisito arquitetural; modelos locais podem ser conectados por adaptadores.