# Auditoria de cálculo tributário e integração com os componentes oficiais

**Status:** especificação técnica e critérios de validação; não é parecer jurídico ou certificação fiscal.

## Fontes de implementação oficiais

A Receita Federal publicou os repositórios em código aberto em 16/11/2026, sob licença MIT, conforme a notícia institucional e a Portaria Cotec nº 342/2026:

- Regime regular: https://github.com/ReceitaFederal/calculadora-rtc-regime-regular
- Simples Nacional: https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional
- Gerador DANFSe: https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse

A aplicação deve acompanhar versões e hashes oficiais, não copiar percentuais isolados para uma regra genérica.

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

- `POST /api/observabilidade/simples-nacional`
- `POST /api/observabilidade/simples-nacional/nao-assistido`
- Consulta de atividades e códigos de erro conforme o README oficial.

O fluxo considera atividade/anexo, tipo de documento, cClassTrib, regime de apuração do IBS/CBS, vigência e os dados de receita/tributação pertinentes. É um motor separado do regime regular.

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
