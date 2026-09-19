# Reforma Tributária Simulator

Simulador técnico e plataforma de atualização contínua para IBS, CBS, IS, transição tributária, documentos fiscais e Split Payment.

> **Este projeto não possui um estado de "concluído".** Legislação, atos, regulamentos, notas técnicas, leiautes, cronogramas e integrações governamentais mudam ao longo do tempo. O sistema deve permanecer conectado a fontes oficiais, detectar mudanças, versionar evidências e impedir que uma regra nova substitua silenciosamente uma regra histórica.

## Objetivo

Transformar fontes fiscais oficiais em um catálogo versionado e auditável que possa alimentar o motor determinístico de cálculo e as integrações operacionais sem misturar interpretação jurídica com código executável.

## Arquitetura

- **apps/web** — dashboard mobile-first e operação do simulador
- **apps/api** — API de domínio
- **packages/domain** — contratos e tipos fiscais
- **packages/tax-engine** — motor determinístico de cálculo
- **packages/schemas** — contratos JSON Schema
- **packages/scenarios** — cenários reproduzíveis
- **workers/api** — Cloudflare Worker de entrada
- **workers/workflows** — processamento durável
- **workers/queues** — ingestão e processamento assíncrono
- **docs** — arquitetura, legislação, fontes e decisões
- **tests** — testes unitários, integração, contrato e regressão

## Princípio central: Fiscal Knowledge Loop

O sistema deve operar continuamente neste ciclo:

1. **Discover** — consultar fontes oficiais na internet.
2. **Capture** — registrar documento, URL, órgão, publicação, atualização e hash/evidência.
3. **Compare** — detectar mudanças em legislação, regulamentação, atos, notas técnicas, schemas e cronogramas.
4. **Classify** — separar fato normativo, parâmetro, obrigação técnica, interpretação, hipótese e informação ainda não validada.
5. **Review** — submeter mudança relevante à validação antes de publicação.
6. **Version** — criar novo RuleSet/artefato sem sobrescrever o histórico.
7. **Test** — executar regressão sobre cenários afetados.
8. **Publish** — publicar somente versões validadas.
9. **Monitor** — acompanhar novas alterações e integrações governamentais.
10. **Audit** — manter o vínculo entre resultado, regra, fonte e versão usada.

## Fontes oficiais prioritárias

A ingestão deve priorizar fontes primárias, especialmente Receita Federal, Comitê Gestor do IBS, Ministério da Fazenda, Planalto e portais oficiais de documentos fiscais.

## Regras de segurança fiscal

- Nunca alterar uma regra histórica em lugar.
- Nunca publicar automaticamente uma interpretação jurídica como regra fiscal executável.
- Toda regra publicada deve possuir vigência, fonte e versão.
- Toda simulação de produção deve registrar o RuleSet efetivamente utilizado.
- Toda mudança de fonte deve gerar impacto e regressão antes da publicação.
- Falha de atualização **não** deve apagar o último catálogo válido.
- Quando houver divergência entre fontes, manter as evidências e marcar o caso para revisão.
- O sistema deve poder responder: **"qual regra, de qual fonte e de qual versão produziu este resultado?"**

## Status

**Plataforma em evolução contínua.** O roadmap é permanente e orientado por mudanças fiscais, técnicas e governamentais.

O próximo estágio estrutural é implementar o **Fiscal Knowledge Loop**: registry de fontes oficiais → ingestão → diff → evidência → revisão → RuleSet → regressão → publicação → auditoria → monitoramento contínuo.
