# Fine-tuning e avaliação de LLM

Estratégia inicial: RAG-first.

Fine-tuning é reservado para tarefas estáveis e mensuráveis: classificação documental, extração recorrente, normalização e roteamento.

Dataset deve conter origem, versão, tarefa, entrada, saída esperada e justificativa. Dados pessoais e segredos não entram no dataset.

Separar treino, validação e teste por documento e versão para evitar vazamento.

Gate: treino → avaliação fechada → red-team fiscal → comparação com baseline → aprovação → publicação.

Métricas: exact match, F1, precisão de citação, groundedness, taxa sem evidência, alucinação, latência e custo.

Um LLM fine-tuned continua subordinado ao catálogo de evidências e ao RuleSet versionado. Fine-tuning melhora comportamento; não cria autoridade normativa.