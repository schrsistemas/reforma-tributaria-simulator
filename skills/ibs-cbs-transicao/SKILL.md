---
name: ibs-cbs-transicao
description: Analisa IBS, CBS e transição da tributação sobre o consumo, com foco em incidência, destino, créditos, regimes diferenciados e vigência normativa.
---

# IBS, CBS e transição

## Escopo

Especialização em IBS e CBS: hipótese de incidência, base de cálculo, local da operação/destino, sujeito passivo, alíquotas, reduções, não cumulatividade, créditos, devoluções, regimes diferenciados/específicos e cronograma de transição.

## Procedimento

1. Fixar a data da operação e a data \`asOf\` da análise.
2. Identificar natureza da operação, bem/serviço/direito, partes, destino e regime do fornecedor/adquirente.
3. Verificar o texto constitucional, legislação complementar, atos regulamentares e atos conjuntos aplicáveis.
4. Separar regra geral de exceções, regimes diferenciados e regimes específicos.
5. Verificar se o dispositivo já produz efeitos na data consultada; publicação não substitui início de vigência.
6. Para créditos, validar documento, destaque/registro, extinção do débito, vedação, estorno e vínculo com atividade, conforme a regra vigente.
7. Informar divergências e lacunas; não inferir alíquota efetiva a partir de percentuais de referência.

## Classificação de evidência

Diferencie:
- texto legal expresso;
- regulamentação;
- ato operacional;
- orientação oficial não normativa;
- interpretação técnica;
- hipótese ainda não confirmada.

## Integração

Para comparação com a implementação oficial da Receita, carregue também a Skill \`calculadora-oficial-receita\`. Delegue cálculo local à Skill \`calculo-fiscal-deterministico\`; documentos à \`documentos-fiscais\`; busca temporal à \`evidencia-legislacao-rag\`; Split Payment à \`split-payment\`.

## Limites

Não invente CST, cClassTrib, NCM/NBS, alíquota, crédito ou regra de transição. Não trate o motor atual como cobertura integral de IBS/CBS: o pacote \`@rts/tax-engine\` declara expressamente limitações para classificações, localização, reduções, créditos e bases específicas. Se a regra não estiver no RuleSet publicado, sinalize ausência de implementação.
