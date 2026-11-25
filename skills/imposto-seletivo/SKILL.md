---
name: imposto-seletivo
description: Pesquisa e analisa o Imposto Seletivo, seus bens e serviços alcançados, critérios de incidência, base, alíquotas e regras temporais com evidência oficial.
---

# Imposto Seletivo (IS)

## Escopo

Analisar incidência, contribuintes, momento do fato gerador, base de cálculo, alíquotas, classificação de produtos/serviços, hipóteses de não incidência, exportação, regimes e interação com IBS/CBS.

## Procedimento

1. Identificar produto/serviço com descrição técnica suficiente e classificação oficial disponível.
2. Fixar data, operação, origem/destino e participante.
3. Recuperar a norma legal e regulamentar vigente, incluindo anexos e tabelas de classificação.
4. Confirmar se o enquadramento depende de NCM, descrição, composição, finalidade ou outro critério legal.
5. Distinguir incidência do IS dos efeitos sobre IBS/CBS e de tributos legados durante a transição.
6. Registrar fonte, dispositivo, vigência e eventuais divergências de classificação.

## Regras de decisão

- Não enquadrar produto apenas por nome comercial.
- Não inferir NCM por semelhança textual.
- Não aplicar alíquota sem fonte e vigência verificadas.
- Se descrição/classificação for insuficiente, solicitar ficha técnica, NCM ou documentação pertinente.
- Cálculo somente via RuleSet e motor determinístico que implementem expressamente IS.

## Dependências

\`evidencia-legislacao-rag\`, \`calculo-fiscal-deterministico\` e, quando houver documento, \`documentos-fiscais\`.

## Limite de implementação

A implementação atual do \`@rts/tax-engine\` declara que não calcula IS. Esta Skill pode pesquisar e estruturar o enquadramento, mas não deve apresentar valor calculado como resultado do motor enquanto a cobertura determinística não existir.
