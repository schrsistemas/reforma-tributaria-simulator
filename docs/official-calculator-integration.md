# Auditoria de cálculo tributário e integração com os componentes oficiais

**Status:** especificação técnica e critérios de validação; não é parecer jurídico ou certificação fiscal.

## Fontes de implementação oficiais

A Receita Federal publicou os repositórios em código aberto em 16/11/2026, sob licença MIT, conforme a notícia institucional e a Portaria Cotec nº 342/2026:

- Regime regular: https://github.com/ReceitaFederal/calculadora-rtc-regime-regular
- Simples Nacional: https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional
- Gerador DANFSe: https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse

A aplicação deve acompanhar versões e hashes oficiais, não copiar percentuais isolados para uma regra genérica.

## Versões e integridade verificadas em 25/11/2026

O manifesto `docs/official-calculator-registry.json` separa hashes iniciais registrados na Portaria Cotec nº 342/2026 dos commits atuais observados nos repositórios. Não compare o hash inicial da Portaria com o HEAD posterior.

| Componente | Versão atual observada | Commit observado |
|---|---:|---|
| Regime regular | 1.7.2 | `f1eebd7ce3157423b1a6aaca7dc1d6c3395452c4` |
| Simples Nacional | 1.0.2 | `a926d5a76095ac0295a6612a9a54db7ffead2396` |
| DANFSe Service | 1.0.0 | `8d79e6b2f7fad6375340afcb51c85ed370c64a14` |

A release 1.7.2 do regime regular alterou a política de arredondamento: valores publicados são arredondados no cálculo e as somas seguintes usam os valores exibidos. Isso afeta centavos, alíquotas efetivas, bases e totais. A versão 1.0.2 do Simples unificou a política de arredondamento com o projeto do regime regular e adicionou testes arquiteturais para impedir implementações paralelas. Os testes de equivalência devem usar os exemplos e as regras da versão exata, não tolerâncias genéricas de centavos.

## Integridade inicial registrada na Portaria

O manifesto registra os três SHA-512 dos ZIPs iniciais e os SHA-1 dos commits Git iniciais, conforme art. 2º da Portaria. O SHA-1 do commit Git identifica a árvore e o commit conforme as convenções Git; o SHA-512 identifica o ZIP indicado. São provas distintas e não intercambiáveis.

A titularidade permanece com a Receita Federal. A licença MIT permite uso e redistribuição nos termos da licença, preservando avisos de copyright e licença; dependências de terceiros mantêm suas licenças. A Portaria também esclarece que a publicação não cria suporte obrigatório, manutenção garantida ou efeito normativo vinculante.

## Política de implantação dos serviços

Os motores Java/Spring exigem Java 25 e banco SQLite gerado por scripts Flyway. O DANFSe é um serviço Go independente. Nenhum desses runtimes deve ser embutido diretamente no Worker TypeScript.

Os endpoints do regime regular agora exigem configuração explícita:
- `OFFICIAL_REGULAR_CALCULATOR_URL`: URL HTTPS completa para o endpoint oficial de cálculo do regime geral.
- `OFFICIAL_REGULAR_OBSERVABILITY_URL`: URL HTTPS completa para observabilidade do regime geral.

Os endpoints do Simples já exigem URLs HTTPS configuradas. Não há fallback automático para o host `piloto-cbs.tributos.gov.br`: endpoints de piloto/homologação não devem ser presumidos como produção. O serviço DANFSe ainda requer implantação externa e proxy dedicado com transporte XML/PDF binário; não reutilizar o proxy JSON atual.

## Separação obrigatória por regime

### Regime regular

Endpoints principais no código disponibilizado:

- `POST /api/calculadora/regime-geral`
- `POST /api/calculadora/observabilidade/regime-geral`
- `POST /api/calculadora/base-calculo/base-calculo-unificada`
- `POST /api/calculadora/base-calculo/base-calculo-unificada-nfse`
- `POST /api/calculadora/base-calculo/cbs-ibs-mercadorias`
- `POST /api/calculadora/base-calculo/is-mercadorias`
- Dados abertos: CST/cClassTrib, NCM, NBS, fundamentações legais, alíquotas e versão.

A operação usa data do fato gerador, município, UF e itens individualizados com classificação tributária, nomenclatura, componentes e alíquotas nominais conforme a vigência. A resposta de observabilidade informa estado por item e memória de cálculo. Não se deve reduzir o resultado a uma taxa agregada.

### Simples Nacional

Endpoint de observabilidade:

- `POST /api/calculadora/observabilidade/simples-nacional`
- `POST /api/calculadora/observabilidade/simples-nacional/nao-assistido`
- Consulta de atividades e códigos de erro conforme o README oficial.

O fluxo considera atividade/anexo, tipo de documento, cClassTrib, regime de apuração do IBS/CBS, vigência e os dados de receita/tributação pertinentes. É um motor separado do regime regular.

## Adaptadores HTTP implementados

O Worker disponibiliza os seguintes caminhos, todos exigindo os cabeçalhos de integração `X-Correlation-Id`, `Idempotency-Key` e `X-Zynkronyx-Tenant`:

| Endpoint do simulador | Método | Destino |
|---|---|---|
| `/api/v1/official-calculator/regime-geral` | POST | URL HTTPS explícita em `OFFICIAL_REGULAR_CALCULATOR_URL` |
| `/api/v1/official-calculator/regime-geral/observabilidade` | POST | URL HTTPS explícita em `OFFICIAL_REGULAR_OBSERVABILITY_URL` |
| `/api/v1/official-calculator/simples-nacional/observabilidade` | POST | URL oficial configurada para observabilidade do Simples |
| `/api/v1/official-calculator/simples-nacional/atividades?data=AAAA-MM-DD` | GET | URL oficial configurada para consulta de atividades |

Os adaptadores são proxies HTTP: não recalculam nem transformam o JSON fiscal. Preservam o corpo e o status HTTP devolvidos pelo motor oficial, não armazenam respostas em cache e propagam os headers de alerta de dados simulados e de versão quando fornecidos pelo upstream. O timeout de chamada é de 20 segundos.

### Configuração do Simples Nacional

Os caminhos publicados pelo repositório oficial identificam a API, mas o endereço de implantação não deve ser inferido a partir da porta local de desenvolvimento. Configure os endpoints HTTPS completos no ambiente do Worker:

- `OFFICIAL_SIMPLE_OBSERVABILITY_URL`: endpoint completo de `POST /calculadora/observabilidade/simples-nacional`.
- `OFFICIAL_SIMPLE_ACTIVITIES_URL`: endpoint completo de `GET /calculadora/simples-nacional/atividades`.

Sem essas configurações, o Worker retorna HTTP 503 com o identificador de configuração ausente. Isso é intencional: evita direcionar dados fiscais a um host presumido ou a um ambiente de homologação incorreto. A URL de atividades recebe `data` e encaminha opcionalmente `anexo`, `tipoDocumento` e `cClassTrib`.

### Interpretação de respostas

- Para o endpoint de observabilidade do regime regular, inspecione o estado de cada item. HTTP 200 não significa que todos os itens foram calculados.
- Trate `CALCULADO`, `CALCULO_SIMULADO`, `INCONSISTENCIA_ENTRADA`, `NAO_IMPLEMENTADO` e `FALHA_TECNICA` como estados distintos.
- Em respostas do Simples, preserve os objetos de observabilidade e os códigos `VSN-`; não converta erros por item em sucesso fiscal.
- Registre o payload enviado, payload integral recebido, timestamp, correlation ID, status HTTP, headers de versão/alerta e hash do artefato oficial. O proxy não persiste esses dados automaticamente.
- Não use a estimativa local do sandbox como substituta de resposta oficial.

## Achados na revisão do simulador

1. A interface de produção tinha campos de taxa livres e cálculo `base × taxa` apresentado no contexto de uma calculadora oficial. Mesmo com aviso, isso induzia a uso como fórmula tributária.
2. O painel Next.js usava `Number` para valores monetários.
3. O motor genérico usava decimal fixo, mas selecionava a primeira regra IBS/CBS sem rejeitar regras sobrepostas.
4. O motor genérico não implementa classificação, componentes da base unificada, redução, IS, crédito, localidade ou regras de regime especial.

## Decisões

- Cenários livres permanecem no sandbox, identificados como hipotéticos.
- A tela de conferência deixa de produzir IBS/CBS fictícios: prepara somente uma base aritmética e compara valores oficiais fornecidos.
- A integração futura deve usar adaptadores separados para regime regular e Simples, sem compartilhar regra de cálculo.
- O componente oficial deve rodar como serviço/API próprio ou em ambiente controlado; não assumir que endpoints internos podem ser chamados pelo browser nem contornar CORS.
- Salvar request/response, data, versão da aplicação, versão da base, hash do artefato oficial e memória de cálculo no snapshot de auditoria.

## Design e engenharia web

A interface adota redução de ruído visual, hierarquia tipográfica, superfícies consistentes, foco visível, responsividade e conteúdo prioritário. Seguir as práticas de GoogleChrome/modern-web-guidance (acessibilidade, CSS moderno, layout responsivo, interação natural e desempenho) e usar UnSlop como checklist visual, não como fonte tributária.

Referências:
- https://github.com/GoogleChrome/modern-web-guidance
- https://github.com/heydamir/unslop
