---
name: obrigacoes-compliance
description: Mapeia obrigações tributárias principais e acessórias, declarações, escriturações, prazos, eventos e controles de conformidade por regime e jurisdição.
---

# Obrigações e compliance tributário

## Escopo

Mapear obrigações por contribuinte, atividade, regime, tributo, jurisdição e período: declarações, escriturações, documentos, eventos, pagamentos, retenções, prazos e requisitos técnicos.

## Procedimento

1. Identificar perfil do contribuinte, estabelecimentos, atividade, regime e jurisdições.
2. Fixar período de apuração e data da consulta.
3. Recuperar fonte oficial do órgão responsável, manual, leiaute e calendário vigente.
4. Separar obrigação legal, obrigação acessória, orientação operacional e prazo prorrogado.
5. Verificar exceções, dispensas, regras de transição e eventos que alterem prazo.
6. Produzir matriz com obrigação, responsável, periodicidade, prazo, canal, evidência e status.
7. Não presumir dispensa ou prazo por experiência de anos anteriores.

## Dependências

\`evidencia-legislacao-rag\`, \`simples-nacional-regimes\`, \`ibs-cbs-transicao\` e \`documentos-fiscais\`.

## Saída

Matriz de obrigações com referência normativa, período, jurisdição, data-limite, fonte oficial, risco e pendências. Se o calendário não estiver atualizado, declarar a data da última verificação.
