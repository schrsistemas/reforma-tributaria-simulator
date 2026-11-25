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

O catálogo de fontes normativas é global e somente leitura pela API nesta versão. A migration 0004 registra fontes federais e nacionais iniciais: legislação federal, Receita Federal, NF-e, NFS-e, CONFAZ e Ministério da Fazenda. Isso é um registro de fontes oficiais, não uma afirmação de que os portais foram monitorados ou que documentos foram capturados.

A associação de instância ERP à empresa usa chave estrangeira composta pelo tenant, impedindo associação cruzada. A migration 0003 também reforça a integridade do vínculo entre eventos de integração e instâncias ERP, valida formato de CNPJ e SHA-256, adiciona índices e restringe alterações/exclusões de auditoria para o usuário runtime.

## Limites atuais

- O CRUD de usuários, convites, recuperação de senha e gestão de sessão ainda não está implementado.
- A ingestão de documentos normativos, captura de arquivos, OCR e revisão ainda não está implementada.
- Fontes e documentos normativos são somente leitura pela API.
- A migration não foi aplicada a um PostgreSQL real nesta etapa.
- Testes de API atuais usam mocks; não substituem testes reais de PostgreSQL/RLS.
- Nenhum deploy da API na VPS foi executado.

## Banco

Aplicar migrations em ordem numérica: 0001_fiscal_hub_core.sql, 0002_runtime_role.sql, 0003_integrity_constraints.sql e 0004_seed_normative_sources.sql. Use um usuário de migração separado. A API deve conectar como fiscal_hub_app, sem ownership, superuser ou BYPASSRLS.

## Execução local

1. Instale dependências com pnpm.
2. Configure DATABASE_URL e JWT_SECRET.
3. Aplique as quatro migrations em PostgreSQL descartável.
4. Defina a senha do fiscal_hub_app fora do repositório.
5. Provisione tenant e administrador com provision:admin usando credenciais administrativas temporárias.
6. Execute pnpm --filter @rts/fiscal-hub-api dev.

## Política de publicação

Os workflows de Cloudflare devem ser executados somente por workflow_dispatch. Commits e validações de CI não autorizam publicação automática em produção. A implantação do Hub na VPS exige aprovação operacional separada.
