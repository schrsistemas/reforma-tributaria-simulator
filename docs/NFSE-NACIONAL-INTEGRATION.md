# Integração NFS-e Nacional

**Estado desta especificação: 25/11/2026.** Este documento separa o que está confirmado na documentação oficial do que ainda depende de implementação e credenciamento. Não representa autorização para emitir documentos em nome de contribuintes.

## 1. Ambientes e leiautes

| Ambiente | Release comunicado como implantado | Schema/documentação publicada | Regra operacional |
|---|---|---|---|
| Produção oficial | NT 004 acrescida do domínio `tpRetPisConfins` da NT 007 | Documentação atual de produção e XSD v1.01 publicados para o leiaute vigente | Manter emissões no leiaute NT 004/007 até publicação formal de novo release em produção |
| Produção restrita | NT 009 v1.0 — release 1, conforme comunicado oficial de 25/11/2026 | A página de homologação também publica XSD PRODREST v1.01, associado aos ajustes do release 2 | Não selecionar v1.01 como contrato ativo apenas porque o XSD foi publicado; aguardar comunicado de implantação do release 2 e validar o runtime |
| Evolução para produção | Releases 1 a 3 da NT 009 previstos para 01/12/2026 no comunicado | Releases e esquemas são publicados progressivamente | Tratar como cronograma publicado, não como confirmação de implantação concluída |

**Distinção obrigatória:** a página de homologação atualizada em 20/10/2026 publica a NT 009 v1.01 e o XSD PRODREST v1.01. Entretanto, o comunicado oficial de 25/11/2026 informa que o ambiente de produção restrita está atualmente com a NT 009 v1.0, release 1; os ajustes da v1.01 pertencem ao release 2, a ser disponibilizado primeiro em produção restrita. Portanto, o repositório registra separadamente o release comunicado como implantado e o schema mais novo publicado. Nenhum dos dois é considerado runtime verificado até a execução de probe/contrato no serviço.

### IBS/CBS na produção

O comunicado do CGNFS-e de 29/10/2026 informa que o grupo IBS/CBS está aberto no ADN: sua ausência não provoca rejeição técnica por esse motivo específico. Se o contribuinte optar por preencher o grupo, todos os códigos, classificações e dados correlatos exigidos pelo leiaute precisam estar completos, inclusive os dados do adquirente/tomador quando aplicáveis.

**Regra do simulador:** omitir IBS/CBS não equivale a calcular tributos iguais a zero nem elimina obrigações legais. O motor deve manter separadas a obrigatoriedade jurídica do contribuinte, a possibilidade técnica de recepção e a decisão de informar voluntariamente os campos.

### Fontes da matriz

- [Comunicado CGNFS-e de 25/11/2026 — leiaute de produção, IBS/CBS e status da NT 009](https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/)
- [Documentação atual de produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual)
- [Documentação técnica de produção restrita](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita)

## 2. Portais e APIs oficiais

O portal oficial mantém APIs distintas. Não tratar a API de distribuição do ADN como se fosse o endpoint de emissão da SEFIN.

### Produção

- [Emissor Nacional Web](https://www.nfse.gov.br/EmissorNacional/)
- [ADN — API Contribuintes](https://adn.nfse.gov.br/contribuintes/docs/index.html)
- [SEFIN Nacional — emissão/consulta](https://sefin.nfse.gov.br/SefinNacional/docs/index)
- [Parâmetros Municipais](https://adn.nfse.gov.br/parametrizacao/docs/index.html)

### Produção restrita

- [Emissor Nacional Web — restrita](https://www.producaorestrita.nfse.gov.br/EmissorNacional/)
- [ADN — API Contribuintes — restrita](https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html)
- [SEFIN Nacional — restrita](https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index)
- [Parâmetros Municipais — restrita](https://adn.producaorestrita.nfse.gov.br/parametrizacao/docs/index.html)

A matriz oficial de endpoints e ambientes está em [APIs — Produção Restrita e Produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao). O pacote de homologação publicado pode ser conferido em [Documentação Técnica (Homologação/testes)](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita). A documentação oficial de homologação/testes, atualizada em 20/10/2026, lista a NT 009 v1.01, anexos I/II PRODREST v1.01 e XSD PRODREST v1.01. O comunicado de 25/11/2026, contudo, identifica a v1.0 release 1 como o release atualmente implantado e a v1.01 como os ajustes do release 2. A publicação do schema não comprova que o endpoint já aceite o release 2. A produção restrita não gera documento fiscal com validade jurídica. Não compartilhar dados reais de clientes nos testes quando dados sintéticos forem suficientes.

### Catálogo de APIs no código

O pacote `@rts/domain` mantém o catálogo em `packages/domain/src/nfse-api-catalog.ts`, com perfis separados para `ADN_CONTRIBUTORS`, `SEFIN_NATIONAL` e `MUNICIPAL_PARAMETERS`, em produção e produção restrita. O catálogo guarda hosts e URLs oficiais de documentação; ele não inventa paths de operação nem substitui a importação dos OpenAPI.

O registro de leiautes em `packages/domain/src/nfse.ts` distingue:
- o release comunicado como implantado no ambiente;
- o schema mais recente publicado para homologação;
- a confirmação efetiva do runtime, que permanece `NOT_PROBED`.

Não selecionar automaticamente um XSD mais novo como contrato ativo sem confirmação do release implantado e validação contra o serviço.

## 3. Operações previstas no manual de contribuintes

O manual oficial descreve o fluxo de parâmetros municipais, recepção da DPS, consulta de NFS-e, consulta de DPS e registro/consulta de eventos.

| Operação | Método e rota | Finalidade |
|---|---|---|
| Convênio municipal | `GET /parametros_municipais/{codigoMunicipio}/convenio` | Verificar parâmetros de convênio |
| Parâmetros de serviço | `GET /parametros_municipais/{codigoMunicipio}/{codigoServico}` | Consultar alíquotas, regimes especiais e deduções/reduções |
| Parâmetros do contribuinte | `GET /parametros_municipais/{codigoMunicipio}/{CPF_CNPJ}` | Consultar retenções e benefícios conforme os serviços publicados |
| Emissão | `POST /nfse` | Enviar XML da DPS; processamento síncrono com NFS-e ou rejeição |
| Consulta NFS-e | `GET /nfse/{chaveAcesso}` | Recuperar documento pela chave |
| Consulta DPS | `GET /dps/{id}` | Recuperar a chave associada à DPS |
| Verificação DPS | `HEAD /dps/{id}` | Verificar se a NFS-e foi gerada |
| Registrar evento | `POST /nfse/{chaveAcesso}/eventos` | Enviar pedido de registro de evento |
| Consultar eventos | `GET /nfse/{chaveAcesso}/eventos` | Listar eventos vinculados à nota |

A tabela acima reproduz as operações descritas no Manual dos Contribuintes Emissor Público API v1.2 (outubro/2025), não substitui os contratos OpenAPI atualmente publicados. A página oficial de APIs, atualizada em 20/08/2026, separa os serviços de ADN, parametrização e SEFIN Nacional. Antes de gerar clientes HTTP, importar os OpenAPI diretamente dos Swagger oficiais de cada ambiente e comparar paths, schemas, cabeçalhos, autenticação e códigos de retorno. Não assumir que uma rota descrita em manual antigo continua idêntica no contrato vigente.

Fonte: [Manual dos Contribuintes — Emissor Público API](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfse.pdf).

## 4. Autenticação, assinatura e fronteira de confiança

O manual exige certificado digital válido em operações de consulta de DPS e descreve assinatura digital para pedidos de eventos. A identificação do certificado também é usada para validar a relação entre o solicitante e os atores da DPS.

A integração deve, portanto, possuir um adaptador de credenciais/certificados que:
- mantenha a chave privada fora do navegador e fora do código-fonte;
- faça a assinatura XML conforme os XSD e regras vigentes;
- implemente o canal TLS/certificado exigido pelo Swagger de cada ambiente;
- valide cadeia, validade e titularidade do certificado;
- registre apenas metadados e identificadores de auditoria, nunca o material privado;
- permita rotação e revogação sem alterar o motor tributário.

**Limite atual:** a API do simulador ainda não implementa transporte autenticado, assinatura XML nem emissão real de NFS-e. O link para o Emissor Web é apenas acesso externo. Não simular sucesso de autorização.

## 5. Arquitetura proposta no monorepo

Separar os componentes:

1. **NFS-e Domain** — contratos da DPS, NFS-e, eventos, identificadores, ambiente e perfil de leiaute.
2. **Layout Registry** — perfis versionados por ambiente, release e vigência; XSD e anexos associados por hash.
3. **Municipal Parameters Adapter** — consulta e cache com validade explícita dos parâmetros municipais.
4. **DPS Builder/Validator** — composição XML, validação XSD e regras locais; não substitui validação da SEFIN.
5. **Digital Signature Provider** — assinatura e acesso ao certificado em ambiente isolado.
6. **SEFIN Transport Adapter** — cliente HTTP para os endpoints oficiais, com timeout, correlation ID e classificação de erros.
7. **NFS-e Repository** — snapshots imutáveis de requisição/retorno, chave de acesso, protocolo e eventos, com proteção de dados.
8. **Fiscal Domain** — calcula e explica IBS/CBS; não deve ser acoplado à camada de transporte.

### Fluxo de emissão

```text
Operação de serviço
  -> Fiscal Domain resolve regras e tributos
  -> Layout Registry escolhe ambiente/release
  -> consulta parâmetros municipais
  -> DPS Builder compõe XML
  -> XSD + regras locais validam
  -> assinatura digital
  -> SEFIN Transport envia POST /nfse
  -> retorno: NFS-e ou rejeição
  -> persistência auditável
  -> consulta/eventos quando solicitados
```

## 6. Contrato de ambiente obrigatório

Toda requisição deve carregar, de forma explícita:

- `environment`: `PRODUCTION` ou `RESTRICTED`;
- `layoutId`: identificador imutável do perfil selecionado;
- `layoutVersion` e `release`;
- `municipalityCode`: código IBGE de sete dígitos;
- `issuerTaxId`;
- `dpsId`;
- `correlationId`;
- referência/hash dos XSD, anexos e parâmetros municipais utilizados.

Não inferir produção pela ausência de parâmetro. Não permitir que uma operação de homologação seja reenviada automaticamente à produção. O perfil documental não declara o runtime como confirmado: a integração deve fazer verificação explícita do contrato/versão ativa antes de habilitar transmissão.

## 7. Estratégia de implementação

### Fase 1 — concluída nesta etapa

- Entrada NFS-e Nacional no portal visual.
- Links para emissor, Swagger e documentação dos dois ambientes.
- Documentação de arquitetura, diferenças de leiaute e limites da integração.

### Fase 2 — próxima

- Importar OpenAPI e XSD de produção e produção restrita.
- Gerar contratos tipados e validadores.
- Criar testes de regressão de DPS com dados sintéticos.
- Implementar o Layout Registry e a matriz de versões.
- Criar consulta/cache de parâmetros municipais, sem credenciais de emissão.

### Fase 3 — integração autenticada

- Definir provedor de certificado e assinatura compatível com a infraestrutura.
- Implementar transporte autenticado e testes somente em produção restrita.
- Persistir request/response e eventos com trilha de auditoria.
- Exigir aprovação explícita antes de habilitar emissão em produção.

## 8. Critérios de aceite

- Nenhuma chamada de emissão é possível sem ambiente explícito.
- O XML gerado é validado pelo XSD do release selecionado.
- IBS/CBS não é marcado como zero quando omitido.
- Campo IBS/CBS preenchido parcialmente é rejeitado localmente quando o leiaute exigir completude.
- Produção e produção restrita possuem fixtures e testes separados.
- Erros HTTP, rejeições fiscais e falhas de transporte são estados distintos.
- Chaves privadas e certificados não aparecem em logs, respostas ou frontend.
- Nenhuma nota é apresentada como autorizada sem retorno positivo da SEFIN.

## 9. Referências oficiais

- [Emissor Nacional Web — Produção](https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2femissornacional)
- [APIs — Produção Restrita e Produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao)
- [Documentação atual de produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual)
- [Documentação técnica de produção restrita](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita)
- [Comunicado de 25/11/2026 sobre IBS/CBS e NT 009](https://www.gov.br/nfse/pt-br/noticias/nfs-e-nacional-confira-oas-rientacoes-sobre-leiaute-em-producao-regras-de-preenchimento-de-ibs-cbs-e-status-da-nota-tecnica-009/)
