---
name: calculo-fiscal-deterministico
description: Prepara e executa cálculos fiscais por meio do motor determinístico e RuleSets versionados, com memória de cálculo e trilha de auditoria.
---

# Cálculo fiscal determinístico

## Regra central

O LLM não calcula tributo por conta própria. Ele valida os dados, resolve o RuleSet e chama o motor determinístico. A resposta precisa ser reproduzível.

## Entradas mínimas

- operação e identificador;
- data de emissão/fato gerador;
- itens, quantidades, preços, descontos e demais componentes de base;
- local de origem/destino quando aplicável;
- classificação fiscal e natureza da operação;
- regime do contribuinte;
- RuleSet/versão quando explicitamente definido.

Não preencher lacunas com valores presumidos.

## Sequência

1. Validar schema e unidades.
2. Resolver RuleSet publicado para a data da operação.
3. Rejeitar ausência ou ambiguidade de regras.
4. Executar \`fiscal.calculate\`/motor do domínio.
5. Registrar memória de cálculo, regra, fonte, arredondamento e versão.
6. Comparar com calculadora oficial quando a integração suportar o caso.
7. Expor divergências sem corrigir silenciosamente o resultado.

## Estado real do motor

O pacote \`@rts/tax-engine\` implementa atualmente um calculador genérico de cenário para IBS/CBS, com decimal BigInt e rastreio de regras. Seu próprio comentário declara que ainda não implementa CST/cClassTrib, NCM/NBS, alíquotas por localização, reduções, créditos, Imposto Seletivo, Simples Nacional nem bases específicas por documento.

Portanto:
- não apresentar o motor atual como calculadora tributária completa;
- não alegar suporte a tributo/regime que não esteja implementado e testado;
- para cenários fora da cobertura, retornar \`NOT_SUPPORTED\` ou encaminhar para análise sem cálculo;
- nunca substituir RuleSet publicado por conhecimento do LLM.

## Saída auditável

Entradas normalizadas, data, jurisdição, RuleSet id/versão, regras aplicadas, bases, taxas, valores, arredondamento, avisos, fonte e identificador do snapshot.
