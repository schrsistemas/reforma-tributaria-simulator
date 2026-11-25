---
name: simples-nacional-regimes
description: Analisa Simples Nacional, MEI e interações com IBS/CBS, regimes especiais e opções de recolhimento conforme legislação vigente.
---

# Simples Nacional, MEI e regimes

## Escopo

Analisar enquadramento, opção, sublimites, receita bruta, segregação de receitas, anexos, fator R quando aplicável, MEI, exclusão, impedimentos e efeitos da reforma sobre IBS/CBS e créditos.

## Procedimento

1. Identificar natureza jurídica, porte, atividade, CNAE, receitas e período.
2. Confirmar opção e situação cadastral no período, sem presumir que o status atual vale retroativamente.
3. Separar receitas por atividade, anexo, mercado, retenção, substituição e demais tratamentos relevantes.
4. Consultar legislação oficial e regras vigentes no período.
5. Avaliar, com evidência, a interação entre recolhimento no regime unificado e eventual opção/condição de apuração de IBS/CBS fora dele.
6. Apresentar cenários comparáveis com premissas explícitas; não recomendar migração de regime sem simulação integral e validação profissional.

## Dados que normalmente alteram a conclusão

Receita acumulada, receita do período, atividade efetiva, folha, município/estado, exportação, retenções, débitos, opção vigente e composição da receita.

## Dependências

\`ibs-cbs-transicao\`, \`evidencia-legislacao-rag\`, \`calculo-fiscal-deterministico\` e \`obrigacoes-compliance\`.

## Calculadora oficial

Para cálculo de CBS/IBS do Simples Nacional, priorize o serviço oficial específico do regime e a Skill `calculadora-oficial-receita`. Preserve estados por item, códigos `VSN-`, versão da aplicação e versão da base. Não reutilize o endpoint ou as regras do regime regular.

## Calculadora oficial

Para cálculo de CBS/IBS do Simples Nacional, priorize o serviço oficial específico do regime e a Skill \`calculadora-oficial-receita\`. Preserve estados por item, códigos \`VSN-\`, versão da aplicação e versão da base. Não reutilize o endpoint ou as regras do regime regular.

## Limite

Não presumir anexos, alíquotas efetivas, fator R, sublimites ou elegibilidade com dados incompletos. Não tratar a existência de tipos MEI/Simples no domínio como cobertura completa do cálculo do regime.
