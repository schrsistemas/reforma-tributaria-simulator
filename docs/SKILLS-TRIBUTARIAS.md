# Arquitetura das Skills tributárias

## Objetivo

Transformar o projeto em um conjunto de competências tributárias componíveis, com uma Skill orquestradora e módulos especializados. A unidade de composição é o diretório com \`SKILL.md\`; o catálogo de roteamento fica em \`skills/registry.json\`.

## Visão de arquitetura

\`\`\`text
                 Usuário / ERP / Agente
                           |
                           v
               tributario-orchestrator
                           |
              contexto fiscal compartilhado
                           |
       +-------------------+-------------------+
       |                   |                   |
       v                   v                   v
  IBS/CBS/IS          Simples/MEI       Documentos fiscais
       |                   |                   |
       +-------------------+-------------------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
      Evidência/RAG               Obrigações/Compliance
             |                           |
             +-------------+-------------+
                           |
                           v
              Cálculo determinístico
                           |
                           v
              Fiscal Domain / RuleSet
                           |
                           v
             Resultado + evidências + auditoria
                           |
             Split Payment / integrações
\`\`\`

## Skills criadas

| Skill | Responsabilidade |
|---|---|
| tributario-orchestrator | Intenção, roteamento e consolidação |
| ibs-cbs-transicao | IBS, CBS, transição, destino e créditos |
| imposto-seletivo | Incidência e regras de IS |
| simples-nacional-regimes | Simples, MEI e regimes |
| documentos-fiscais | XML, schemas, eventos e leiautes |
| split-payment | Segregação e reconciliação financeira |
| evidencia-legislacao-rag | Fonte, vigência e prova normativa |
| calculo-fiscal-deterministico | RuleSet e cálculo auditável |
| obrigacoes-compliance | Obrigações e prazos |

## Protocolo de composição

1. O host carrega \`skills/tributario-orchestrator/SKILL.md\`.
2. O orquestrador classifica a tarefa e consulta \`skills/registry.json\`.
3. O host carrega os módulos indicados e suas dependências.
4. Os módulos recebem o mesmo contexto: operação, data, jurisdição, regime, evidências e identificadores de correlação.
5. O módulo especializado retorna achados estruturados, evidências, advertências e limitações.
6. O orquestrador consolida sem apagar divergências entre módulos.
7. Cálculo exige motor determinístico e RuleSet aplicável; publicação normativa exige fluxo de aprovação.

### Contrato de retorno recomendado

\`\`\`json
{
  "skill": "ibs-cbs-transicao",
  "status": "SUPPORTED",
  "referenceDate": "YYYY-MM-DD",
  "jurisdiction": "FEDERAL",
  "findings": [],
  "evidence": [],
  "assumptions": [],
  "warnings": [],
  "unsupported": [],
  "requiresHumanReview": true
}
\`\`\`

O exemplo é um contrato recomendado para integração futura; não significa que todos os módulos já exponham endpoints com esse formato.

## Estado e limites reais

- Os arquivos \`SKILL.md\` e o manifesto estão versionados no GitHub.
- A convenção é compatível com runtimes que carregam Skills a partir de diretórios.
- A conexão automática depende do host/agente que descobre e carrega esses diretórios. O repositório ainda não instala Skills em outros agentes por conta própria.
- As ferramentas MCP são contratos/capacidades documentadas; disponibilidade operacional depende do servidor e das permissões do runtime.
- O motor atual \`@rts/tax-engine\` é um calculador genérico de IBS/CBS e declara limitações para CST/cClassTrib, NCM/NBS, alíquotas por localização, reduções, créditos, IS, Simples Nacional e bases específicas. As Skills não ampliam magicamente essa cobertura.
- Não há publicação automática de RuleSet por Skill.

## Próximas fases técnicas

1. Adicionar schemas JSON para entrada e retorno de cada Skill.
2. Criar um dispatcher no backend/agent host que leia o manifesto e carregue módulos por demanda.
3. Ligar cada módulo aos contratos MCP reais, com autenticação, autorização, timeout e auditoria.
4. Criar conjunto de avaliação por domínio, com casos positivos, negativos, conflito de fontes e vigência histórica.
5. Expor no dashboard quais Skills foram acionadas, fontes utilizadas, versões e limites.
6. Somente depois avaliar execução paralela de Skills e cache de resultados.

## Critério de pronto

Uma Skill só é considerada operacional quando tiver instruções, contrato de entrada/saída, ferramentas autorizadas, evidências, testes de avaliação e telemetria. A presença do \`SKILL.md\` comprova apenas a definição documental.
