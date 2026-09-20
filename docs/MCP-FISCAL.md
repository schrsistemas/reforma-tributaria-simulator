# MCP Fiscal — Contrato

Objetivo: disponibilizar ferramentas de domínio para agentes e interfaces de IA sem expor banco de dados ou internals.

Ferramentas:
- fiscal.search_evidence — consulta evidências oficiais.
- fiscal.resolve_ruleset — resolve RuleSet por contexto.
- fiscal.calculate — executa cálculo determinístico.
- fiscal.compare_calculation — compara resultados estruturados.
- fiscal.get_split_payment_rules — recupera regras do Pagamento dividido.
- fiscal.get_snapshot — recupera cálculo imutável e evidências.

Segurança: autenticação, autorização, validação de esquema, timeout, idempotência, correlação, auditoria e nenhuma escrita SQL arbitrária.

Zynkronyx continua Control Plane/Integration Plane. Fiscal Domain continua dono das regras e cálculos.