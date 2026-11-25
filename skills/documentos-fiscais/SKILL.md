---
name: documentos-fiscais
description: Analisa documentos fiscais eletrônicos, XML, eventos, schemas, campos, leiautes, validações e impactos de mudanças técnicas.
---

# Documentos fiscais eletrônicos

## Escopo

NF-e, NFC-e, CT-e, MDF-e, NFS-e, eventos, documentos auxiliares, XML, schemas XSD, notas técnicas, tabelas e integrações com autorizadores.

## Procedimento

1. Identificar modelo, versão, ambiente, UF/município, emitente, destinatário e data.
2. Obter schema, manual, nota técnica e tabela oficial aplicáveis à versão.
3. Validar estrutura XML, namespaces, tipos, cardinalidade, códigos e regras de negócio.
4. Relacionar campos tributários com CST, cClassTrib, NCM/NBS e grupos IBS/CBS/IS somente quando a documentação oficial suportar.
5. Distinguir rejeição de schema, rejeição de regra de negócio, contingência e indisponibilidade do autorizador.
6. Para mudanças de leiaute, comparar versões e listar campos incluídos, removidos, condicionais e impactos de integração.
7. Nunca inventar códigos de rejeição ou preencher valores fiscais por inferência.

## Integração

Use \`ibs-cbs-transicao\`, \`imposto-seletivo\`, \`simples-nacional-regimes\` e \`evidencia-legislacao-rag\` para interpretação tributária. O motor fiscal deve receber dados normalizados; o parser do XML não deve decidir regra tributária.

## Componente oficial de DANFSe

Para gerar a representação gráfica de NFS-e, use o serviço oficial DANFSe Go conforme a Skill `calculadora-oficial-receita`. A geração do PDF não emite nem autoriza a NFS-e. Transporte XML/PDF como conteúdo binário; não passe pelo proxy JSON de cálculos.

## Saída recomendada

- documento/modelo/versão;
- fonte técnica oficial;
- validações executadas;
- campos inválidos ou ausentes;
- regra de negócio relacionada;
- impacto para ERP/API;
- correção sugerida, sem alterar documento original silenciosamente.
