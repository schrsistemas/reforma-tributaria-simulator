# Fiscal Intelligence Hub — implementação inicial

## Decisões

- Monorepo: schrsistemas/reforma-tributaria-simulator.
- Branch: main; sem branches e sem Pull Requests.
- API central: Node.js 22+, TypeScript e Fastify.
- Persistência SaaS: PostgreSQL na VPS.
- Borda e publicação visual: Cloudflare.
- Painel: Next.js existente; workbench especializado Vue 3.
- Serviço auxiliar: Python/FastAPI para normalização e metadados.
- ERP: Delphi/FireDAC e agente desacoplado.

## Entrega administrativa e catálogo normativo

A API expõe listagem e cadastro de empresas, listagem e cadastro de instâncias ERP, autenticação por tenant e consulta do catálogo normativo e das versões de documentos. Cadastro de empresa e instância ERP exige papel OWNER ou ADMIN no token. O CNPJ passa por validação dos dígitos verificadores antes de chegar ao banco. Os cadastros gravam evento de auditoria na mesma transação da operação.

O catálogo de fontes normativas é global e somente leitura pela API. A fila de candidatos é consultável por usuários autenticados; decisões de aprovação/rejeição exigem OWNER ou ADMIN e geram auditoria. A migration 0011 revoga os privilégios DML amplos herdados por padrão pelo papel runtime e mantém apenas as colunas necessárias para descoberta, revisão e captura. As migrations 0004–0009 registram fontes federais, nacionais, fiscais e regulatórias: Planalto, Receita Federal, Ministério da Fazenda, CONFAZ, SPED, NF-e/NFC-e, CT-e/CT-e OS, MDF-e, NFS-e/NFS-e Via, GNRE e ANTT/CIOT. O índice oficial do SPED também referencia BP-e, BP-e TM, NFCom, NF3e, DC-e, GTV-e, NFAg, NFGas e DeRE.

As categorias são separadas por natureza: documentos fiscais eletrônicos (DF-e), guias de arrecadação (GNRE), registros regulatórios de transporte (CIOT), documentação técnica, legislação e conteúdo explicativo. CIOT não é classificado como DF-e; GNRE não é classificada como nota fiscal. FAQs e páginas de orientação são fontes de referência, não atos normativos.

O catálogo registra URLs oficiais e permite monitorar disponibilidade/hash. O coletor descobre links diretos `.pdf`, `.xsd`, `.xml` e `.json` nas páginas HTML oficiais, valida hosts pela allowlist exata e grava candidatos deduplicados em `fiscal.normative_artifact_candidates`. A descoberta não acessa os documentos encontrados.

Candidatos começam em `PENDING`. OWNER/ADMIN do tenant revisor pode aprovar ou rejeitar pela API. Cada decisão grava histórico imutável com estado anterior, decisão, usuário, observação e data, na mesma transação da atualização do candidato e do evento de auditoria. O histórico só pode ser consultado pelo tenant revisor. O worker `capture:approved` captura somente candidatos `APPROVED`. O ciclo é durável: grava metadados `PENDING` no PostgreSQL antes do upload, usa chave S3 determinística baseada no SHA-256 e muda para `CAPTURED` somente após confirmação do storage. Falhas de upload ficam como `ERROR`, preservam a linha de metadados e são retomadas com a mesma chave; o candidato continua `APPROVED` e recebe backoff exponencial entre 1 minuto e 24 horas. O worker não interpreta conteúdo nem publica regras tributárias.

A associação de instância ERP à empresa usa chave estrangeira composta pelo tenant, impedindo associação cruzada. A migration 0003 também reforça a integridade do vínculo entre eventos de integração e instâncias ERP, valida formato de CNPJ e SHA-256, adiciona índices e restringe alterações/exclusões de auditoria para o usuário runtime.

## Limites atuais

- O CRUD de usuários, convites, recuperação de senha e gestão de sessão ainda não está implementado.
- Existe monitor de disponibilidade/hash, descoberta de links de artefatos, fila de candidatos, revisão humana e worker de captura de candidatos aprovados. OCR, extração semântica, diff jurídico, análise de impacto e publicação automatizada de RuleSets ainda não estão implementados.
- Fontes e documentos normativos são somente leitura pela API.
- As migrations 0001–0014 ainda precisam ser aplicadas e validadas em PostgreSQL real.
- Testes de API atuais usam mocks; não substituem testes reais de PostgreSQL/RLS.
- O armazenamento S3 precisa ser provisionado e configurado.
- Nenhum deploy da API na VPS foi executado.

## Deploy Vercel — 25/11/2026

O projeto `fiscal-hub-api` possui deploy de produção na Vercel, conectado à branch `main`. O handler serverless padrão está no módulo `services/fiscal-hub-api/src/app.ts`; ele instancia o Fastify sob demanda, reutiliza a instância e o pool PostgreSQL em invocações aquecidas e não abre listener TCP.

- Domínio de produção: https://fiscal-hub-api.vercel.app
- Endpoint de liveness: `GET /health/live` — validado com HTTP 200.
- Endpoint de readiness: `GET /health/ready` — validado com HTTP 503 enquanto a conexão PostgreSQL não está configurada.
- O runtime da Vercel confirmou ausência de `DATABASE_URL` e `JWT_SECRET` no ambiente de produção. Até que essas variáveis sejam configuradas, as rotas funcionais respondem indisponibilidade de serviço; o endpoint de liveness permanece independente dessas dependências.
- A implantação na Vercel não equivale a uma implantação na VPS. Nenhum deploy da API na VPS foi executado.

Para ativar a API, configurar `DATABASE_URL` e `JWT_SECRET` no ambiente Production da Vercel. Configurar separadamente `MIGRATION_DATABASE_URL` para executar migrations com usuário proprietário de migração; não reutilizar o papel runtime `fiscal_hub_app` para DDL. Depois de aplicar e validar migrations 0001–0012 no PostgreSQL, repetir o health check de readiness e validar os endpoints autenticados.

## Banco

Aplicar migrations em ordem numérica: 0001_fiscal_hub_core.sql até 0014_normative_artifact_capture_lifecycle.sql. Use um usuário de migração separado. A API deve conectar como fiscal_hub_app, sem ownership, superuser ou BYPASSRLS.

## Execução local

1. Instale dependências com pnpm.
2. Configure DATABASE_URL, JWT_SECRET e FISCAL_SOURCE_ALLOWED_HOSTS.
3. Provisione o bucket S3-compatible e configure S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY e, se necessário, S3_ENDPOINT/S3_FORCE_PATH_STYLE.
4. Execute `pnpm --filter @rts/fiscal-hub-api migrate` com `MIGRATION_DATABASE_URL` apontando para um usuário migration-owner, inicialmente em PostgreSQL descartável.
5. Defina a senha do fiscal_hub_app fora do repositório.
6. Provisione tenant e administrador com provision:admin usando credenciais administrativas temporárias.
7. Execute pnpm --filter @rts/fiscal-hub-api dev.
8. Execute `pnpm --filter @rts/fiscal-normative-collector check:sources` e `discover:artifacts`; após revisão, execute `capture:approved`.

## Política de publicação

Os workflows de Cloudflare devem ser executados somente por workflow_dispatch. Commits e validações de CI não autorizam publicação automática em produção. A implantação do Hub na VPS exige aprovação operacional separada.

## Monitor de fontes

O serviço `services/fiscal-normative-collector` verifica URLs cadastradas, restritas a uma allowlist exata de hosts HTTPS. Bloqueia redirects, limita timeout e tamanho de resposta, calcula SHA-256 e registra histórico em `fiscal.normative_source_checks`. Status CHANGED significa apenas que o conteúdo da página consultada mudou; não classifica nem identifica automaticamente um ato normativo novo. O monitor, a descoberta e a captura dependem de execução manual ou cron externo e ainda não estão publicados na VPS. A captura exige bucket e credenciais S3 válidas; não foi executada contra infraestrutura real.
