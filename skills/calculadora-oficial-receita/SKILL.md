---
name: calculadora-oficial-receita
description: Integra e valida os componentes oficiais de cálculo da Receita Federal para regime regular, Simples Nacional e geração de DANFSe, mantendo versões, hashes, proveniência e separação de execução.
---

# Calculadora oficial da Receita Federal

## Objetivo

Usar os componentes publicados pela Receita Federal e desenvolvidos com participação do Serpro como referência executável para os fluxos cobertos. Esta Skill não declara certificação fiscal, não transforma o código em norma vinculante e não presume suporte oficial.

## Componentes oficiais

- Regime regular: https://github.com/ReceitaFederal/calculadora-rtc-regime-regular
- Simples Nacional: https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional
- Gerador DANFSe: https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse

Consultar `docs/official-calculator-registry.json` para versões, commits atuais observados e hashes iniciais registrados na Portaria Cotec nº 342/2026. O hash inicial da Portaria não deve ser comparado com o HEAD atual sem checkout do commit inicial correspondente.

## Roteamento por domínio

1. Regime regular: usar a API oficial de regime geral e seus endpoints de observabilidade. Abrange CBS, IBS, Imposto Seletivo, bases unificadas, tabelas oficiais, CST/cClassTrib, NCM/NBS e grupos tributários de documentos.
2. Simples Nacional: usar o serviço específico do regime, incluindo observabilidade por item e consulta temporal de atividades. Não reutilizar o cálculo do regime regular.
3. DANFSe: usar o serviço Go dedicado para gerar PDF a partir de XML NFS-e. A geração do DANFSe não emite, autoriza ou substitui a NFS-e.

## Protocolo de execução

1. Fixar regime, modelo de documento, data do fato gerador, data da consulta e ambiente.
2. Verificar versão da aplicação e da base oficial antes do cálculo, quando o endpoint disponibilizar esses dados.
3. Usar apenas endpoint HTTPS explicitamente configurado e aprovado. Não inferir host de produção a partir de portas locais, exemplos ou ambiente piloto.
4. Preservar o request original, response integral, status HTTP, headers de versão/alerta, correlation ID e timestamp.
5. Para respostas de observabilidade, avaliar cada item individualmente. HTTP 200 não significa que todos os itens foram calculados.
6. Distinguir cálculo oficial executado, simulação, item não calculado, inconsistência de entrada e falha técnica.
7. Persistir a versão do código e da base, hash do artefato e proveniência no snapshot de auditoria.
8. Comparar o motor local com o oficial por testes de contrato e cenários de regressão; não ajustar diferenças de centavos sem compreender a política de arredondamento publicada.
9. Quando a API ou serviço oficial não estiver configurado, declarar indisponibilidade. Nunca simular uma resposta oficial.

## Integridade e licença

- A Portaria Cotec nº 342/2026 registra SHA-512 dos ZIPs iniciais e SHA-1 dos commits Git iniciais.
- Registrar separadamente o hash oficial inicial e o commit/versão atualmente utilizado.
- Preservar LICENSE, avisos de copyright e atribuições MIT quando redistribuir código.
- Dependências de terceiros permanecem sujeitas às respectivas licenças.
- Não afirmar que o código-fonte possui efeito normativo, garantia de suporte ou manutenção oficial.

## Limites de execução

- O código Java/Spring dos motores de cálculo e o serviço Go de DANFSe não são executados dentro do Cloudflare Worker TypeScript. Hospedá-los como serviços separados ou em ambiente controlado.
- Os proxies existentes do Worker para cálculo oficial não significam que o binário oficial foi incorporado ao Worker.
- O DANFSe exige transporte binário/XML e resposta PDF; não reutilizar proxy JSON/textual para esse fluxo.
- Ferramentas MCP só podem ser publicadas depois de existir executor real, schema de entrada/saída, autorização por tenant e testes de contrato.
- Não misturar resultados do motor local, resultados oficiais e estimativas hipotéticas.

## Resultado esperado

Informar o componente/serviço executado, versão, base de dados, commit ou hash verificado, regime, data de referência, status por item, warnings, memória de cálculo e limites observados. Se qualquer campo essencial não estiver disponível, explicitar a lacuna.
