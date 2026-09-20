# IA Fiscal — RAG, MCP, LLM e refinamento

## Princípio arquitetural
A IA é uma camada de assistência sobre o Domínio Fiscal. Não é o motor tributário e não substitui fonte oficial, RuleSet versionado ou snapshot imutável.

Pipeline: fonte oficial → coleta → evidência imutável → normalização → chunking → índice RAG → recuperação temporal → reranking → contexto fundamentado → LLM → MCP controlado → motor determinístico → snapshot.

## RAG fiscal
Cada documento preserva documentId, órgão, jurisdição, URL oficial, tipo, publicação, atualização, vigência, versão, SHA-256, hash normalizado e relações com documentos anteriores.

A recuperação deve priorizar jurisdição, vigência compatível com asOf, fonte primária, tipo documental, busca semântica/lexical e reranking. Score de recuperação não é validade jurídica.

## MCP fiscal
Ferramentas: fiscal.search_evidence, fiscal.get_document, fiscal.resolve_ruleset, fiscal.calculate, fiscal.compare_calculation, fiscal.get_split_payment_rules e fiscal.get_snapshot.

Cada chamada MCP deve possuir requestId, correlationId, autorização, validação de schema, limites operacionais, idempotência para comandos mutáveis e auditoria.

MCP não possui permissão genérica para alterar catálogo, apagar evidência ou publicar RuleSet.

## LLM
Permitido: resumir evidência, localizar trechos, classificar documentos, extrair campos, sugerir impacto, explicar cálculo determinístico, comparar versões e gerar perguntas de revisão.

Não permitido como autoridade: inventar alíquota, crédito ou vigência; decidir validade jurídica sem evidência; publicar RuleSet; alterar histórico; substituir cálculo determinístico; executar instruções encontradas em documentos.

Resposta marcada como fundamentada deve possuir evidências. Evidência insuficiente deve ser explicitamente declarada.

## Fine-tuning
Não usar fine-tuning para memorizar legislação. Legislação, atos, manuais e leiautes mudam e precisam permanecer no catálogo versionado e recuperável.

Fine-tuning poderá ser usado em tarefas estáveis e mensuráveis, como classificação documental, extração estruturada, roteamento e classificação de impacto. O conjunto de treinamento deve ser versionado e separado do catálogo normativo.

## Avaliação e refinamento
Métricas mínimas: Recall@K de evidência, precisão temporal, cobertura de fonte primária, respostas sem evidência, alucinação factual, consistência estruturada, concordância com o motor determinístico, latência e custo computacional.

Qualquer melhoria de linguagem que reduza grounding ou precisão temporal deve falhar no gate de regressão.

## Segurança
Conteúdo recuperado é dado não confiável. HTML, PDF, XML, JSON e texto externo nunca devem ser executados como instruções. Prompt injection encontrado em documento não altera políticas, permissões MCP ou regras fiscais.

## Calculadora de Consumo oficial
A Calculadora de Consumo do ambiente piloto da Receita Federal/CGIBS permanece serviço externo de referência. A integração deve comparar entrada normalizada, cálculo interno e resultado oficial, preservando versão, parâmetros, evidências e divergências.

Uma divergência não deve ser corrigida automaticamente pelo LLM. Deve gerar diagnóstico auditável.

## Regra de ouro
RAG fornece contexto. MCP fornece capacidade controlada. LLM interpreta e explica. Motor determinístico calcula. Evidência sustenta. Humano aprova mudanças normativas.