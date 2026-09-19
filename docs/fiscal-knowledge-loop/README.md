# Fiscal Knowledge Loop

Este módulo transforma a atualização fiscal em uma capacidade permanente do produto.

## Regra arquitetural

O motor de cálculo não deve buscar legislação diretamente durante uma transação fiscal. A internet alimenta um **catálogo de conhecimento fiscal versionado**; o motor executa somente regras publicadas e imutáveis.

Fluxo:

`Fontes oficiais → Ingestão → Evidência → Diff → Classificação → Revisão → RuleSet → Regressão → Publicação → Motor → Auditoria`

## Fontes prioritárias

1. Receita Federal — Reforma Tributária do Consumo.
2. Comitê Gestor do IBS.
3. Ministério da Fazenda.
4. Planalto — legislação federal.
5. Portal Nacional da NFS-e.
6. Portais oficiais de documentos fiscais e atos técnicos aplicáveis.
7. Outras fontes oficiais estaduais/municipais quando uma regra do domínio exigir.

## Tipos de fonte

Cada fonte deve ser classificada:

- `LAW` — lei/lei complementar/decreto.
- `REGULATION` — regulamento.
- `ACT` — ato normativo.
- `TECHNICAL_NOTE` — nota técnica.
- `LAYOUT` — leiaute/schema fiscal.
- `OFFICIAL_GUIDANCE` — orientação oficial.
- `GOVERNMENT_API` — API ou serviço governamental.
- `CALENDAR` — cronograma de obrigatoriedade.
- `OTHER_OFFICIAL` — outra publicação oficial.

## Estados da evidência

- `DISCOVERED`
- `FETCHED`
- `CHANGED`
- `CLASSIFIED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `PUBLISHED`
- `SUPERSEDED`

Nenhuma evidência `DISCOVERED`, `FETCHED` ou `CHANGED` deve alterar o cálculo de produção.

## O que deve ser armazenado

Para cada evidência:

- `sourceId`
- órgão emissor
- tipo
- URL oficial
- título
- identificador oficial
- data de publicação
- data de atualização
- data de coleta
- hash do conteúdo
- versão/edição quando existir
- conteúdo ou referência imutável
- status
- RuleSets afetados
- cenários afetados
- responsável/revisor
- justificativa da alteração
- relação com evidências anteriores

## Detecção de mudança

A coleta deve ser idempotente.

Se o conteúdo normalizado produzir o mesmo hash, não criar uma nova versão.

Se o hash mudar:

1. preservar a evidência anterior;
2. criar nova evidência;
3. gerar diff;
4. identificar regras/cenários potencialmente afetados;
5. bloquear publicação automática;
6. executar regressão depois da classificação;
7. exigir aprovação conforme o nível de impacto.

## Níveis de impacto

### LOW

Alteração informativa sem impacto conhecido em cálculo, obrigação ou integração.

### MEDIUM

Mudança técnica, leiaute, campo, cronograma ou documentação que possa afetar integração.

### HIGH

Mudança de alíquota, base, crédito, redução, classificação, vigência, obrigação acessória ou regra de cálculo.

### CRITICAL

Mudança que possa alterar valores fiscais produzidos, liquidação, Split Payment, autorização/rejeição de documento ou comportamento de produção.

`HIGH` e `CRITICAL` exigem revisão explícita antes de publicação.

## Princípio de fallback

A indisponibilidade da internet ou de uma fonte oficial não pode apagar o último catálogo válido.

O sistema deve continuar calculando com a última versão publicada **quando juridicamente aplicável**, registrando a idade do catálogo e sinalizando a ausência de atualização.

Uma atualização nova também não deve substituir silenciosamente uma versão publicada. A publicação é uma operação de governança.

## Regra histórica

Uma simulação concluída deve permanecer reproduzível mesmo anos depois.

Por isso o snapshot deve guardar:

- RuleSet ID;
- RuleSet version;
- versão do motor;
- regras efetivamente utilizadas;
- fontes;
- vigências;
- parâmetros;
- cenário;
- resultado;
- timestamp;
- correlation ID.

## Atualização contínua

A plataforma deve possuir jobs periódicos de descoberta e também permitir execução manual.

Cadências iniciais sugeridas:

- fontes críticas: diária;
- documentação técnica com alterações frequentes: diária;
- legislação consolidada: diária;
- fontes de baixa volatilidade: semanal;
- execução manual: sempre disponível.

A cadência é operacional, não jurídica: uma fonte pode publicar alteração entre duas coletas.

## Princípio de internet

**Internet é fonte de atualização, não fonte direta de cálculo.**

O cálculo de produção deve depender de artefatos versionados e aprovados. Isso evita que uma indisponibilidade externa ou uma mudança inesperada durante uma emissão produza resultados não reproduzíveis.

## Resultado esperado

O Control Center do Zynkronyx deverá conseguir mostrar:

- última coleta por fonte;
- última alteração detectada;
- documentos aguardando revisão;
- RuleSets publicados;
- regras que mudaram;
- cenários quebrados pela mudança;
- integrações governamentais afetadas;
- risco operacional;
- histórico de publicação;
- idade do conhecimento fiscal em produção.