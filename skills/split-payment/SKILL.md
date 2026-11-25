---
name: split-payment
description: Analisa Split Payment, segregação de IBS/CBS no pagamento, liquidação, estorno, reconciliação, conciliação financeira e impacto no fluxo de caixa.
---

# Split Payment

## Escopo

Tratar separadamente o cálculo tributário e o fluxo financeiro de segregação/recolhimento. Analisar modalidades, eventos de pagamento, liquidação, cancelamento, devolução, estorno, conciliação e capital de giro.

## Procedimento

1. Identificar operação, documento fiscal, valor bruto, tributos calculados e instrumento de pagamento.
2. Resolver a regra de Split Payment aplicável à data e modalidade com evidência oficial.
3. Distinguir valor tributário devido, valor segregado, valor liquidado ao fornecedor e saldo a reconciliar.
4. Modelar pagamentos parciais, múltiplos meios, cancelamentos, devoluções, estornos e divergências.
5. Validar idempotência, vínculo entre documento/pagamento/transação e trilha de auditoria.
6. Comparar o valor segregado com a memória fiscal e com o extrato/retorno do provedor.
7. Não presumir que todo pagamento ou modalidade segue o mesmo fluxo.

## Integração com o projeto

O repositório possui módulos de Split Payment, TEF, PIX e reconciliação. Use os contratos do domínio e persistência do Fiscal Domain; não replique o cálculo tributário na camada de pagamento.

## Saída

Exiba bruto, IBS, CBS, total segregado, líquido, eventos, divergências e status. Identifique a versão da regra e do cálculo. Se a implementação ainda não cobrir modalidade/caso, marque como não suportado em vez de simular conclusão.

## Dependências

\`ibs-cbs-transicao\`, \`documentos-fiscais\`, \`evidencia-legislacao-rag\` e \`calculo-fiscal-deterministico\`.
