# Reforma Tributária Simulator

Simulador técnico de IBS, CBS, transição tributária e Split Payment, com regras versionadas, cenários reproduzíveis, auditoria e arquitetura Cloudflare.

## Arquitetura

- apps/web — dashboard mobile-first
- apps/api — API
- packages/tax-engine — motor determinístico
- packages/domain — domínio
- packages/schemas — contratos
- packages/scenarios — cenários
- workers/api — Cloudflare Worker
- workers/workflows — Cloudflare Workflows
- workers/queues — processamento assíncrono
- docs — legislação, arquitetura e decisões
- tests — unitários, integração e cenários

## Princípios

1. Regras tributárias versionadas por vigência e fonte.
2. Valores monetários sem ponto flutuante no domínio.
3. Resultados determinísticos e auditáveis.
4. Split Payment modelado como ledger/eventos.
5. Idempotência para operações financeiras.
6. Separação entre fato legal, parâmetro, hipótese e simulação.
7. CI/CD e testes automatizados.

## Status

Bootstrap inicial do laboratório de simulação fiscal.
