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
- Nenhum deploy, criação de recurso pago ou alteração de secrets está autorizado por esta entrega.

## Limites de autoridade

PostgreSQL será a fonte de verdade para tenants, empresas, documentos normativos, versões, regras e evidências do Hub. O D1 existente continua atendendo o Worker atual até migração planejada, validada e reversível. Não substituir D1 nem copiar dados sem plano específico.

O serviço Python somente normaliza texto e calcula metadados de integridade. Não interpreta legislação, classifica incidência, calcula tributos ou publica regras.

O simulador e o motor fiscal existentes permanecem preservados. Regras candidatas exigem evidência, revisão, testes e aprovação antes da publicação.

## API inicial

- GET /health/live — processo ativo.
- GET /health/ready — conectividade PostgreSQL.
- POST /v1/auth/login — autenticação por tenant, e-mail e senha.
- GET /v1/me — identidade do token.
- GET /v1/companies — empresas do tenant autenticado, protegidas por RLS.
- GET /v1/normative/documents — catálogo normativo.

Tokens de acesso expiram em 15 minutos. JWT_SECRET precisa ter pelo menos 32 caracteres. Senhas usam scrypt com salt aleatório. Não existe usuário inicial ou senha padrão; provisionamento administrativo será uma rotina controlada.

## Banco

A migration services/fiscal-hub-api/migrations/0001_fiscal_hub_core.sql cria schema fiscal, usuários, memberships, empresas, fontes, documentos, versões, regras, evidências, impactos, instâncias ERP, eventos e auditoria.

As tabelas operacionais multi-tenant aplicam Row Level Security. O usuário da aplicação não deve ser owner das tabelas nem possuir BYPASSRLS. Consultas tenant-scoped devem usar transação e set_config('app.tenant_id', ..., true).

## Execução local

1. Habilite Corepack e instale dependências com pnpm.
2. Copie services/fiscal-hub-api/.env.example para .env e configure DATABASE_URL e JWT_SECRET.
3. Aplique a migration em um PostgreSQL descartável.
4. Execute pnpm --filter @rts/fiscal-hub-api dev.
5. Rode os comandos test, typecheck e build do pacote da API.

## Próximas entregas

1. Provisionamento administrativo seguro e gestão de sessões/refresh tokens.
2. CRUD de tenants, empresas, fontes, documentos e versões.
3. Aprovação de versões de regras com evidências obrigatórias.
4. Coletor normativo e armazenamento de artefatos.
5. Integração da API com Next.js e Vue.
6. Adaptador Node.js/Firebird e units Delphi/FireDAC.
7. Testes de integração PostgreSQL, RLS, concorrência e idempotência.
8. Extração de PDF/OCR sob fila e limites de tamanho.
9. Deploy VPS e Cloudflare somente após aprovação operacional explícita.

## Validação

Os testes unitários usam mocks e não substituem testes de integração PostgreSQL. A migration deve ser aplicada primeiro em banco descartável. Nenhum deploy ou teste destrutivo em produção é realizado por esta implementação.
\n\n## Provisionamento inicial\n\nA API inclui o script services/fiscal-hub-api/scripts/provision-admin.ts. Ele exige variáveis BOOTSTRAP_* explícitas, cria tenant, usuário e membership OWNER/ADMIN em uma única transação e não imprime senha. Use conexão administrativa temporária e descarte as variáveis após a execução.\n

## Política de publicação

Os workflows de Cloudflare devem ser executados somente por workflow_dispatch. Commits e validações de CI não autorizam publicação automática em produção. A implantação do Hub na VPS também exige aprovação operacional separada.
