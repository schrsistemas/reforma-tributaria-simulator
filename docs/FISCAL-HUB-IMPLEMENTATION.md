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

O catálogo de fontes normativas é global e somente leitura pela API nesta versão. As migrations 0004–0008 registram fontes federais, nacionais, fiscais e regulatórias: Planalto, Receita Federal, Ministério da Fazenda, CONFAZ, SPED, NF-e/NFC-e, CT-e/CT-e OS, MDF-e, NFS-e/NFS-e Via, GNRE e ANTT/CIOT. O índice oficial do SPED também referencia BP-e, BP-e TM, NFCom, NF3e, DC-e, GTV-e, NFAg, NFGas e DeRE.

As categorias são separadas por natureza: documentos fiscais eletrônicos (DF-e), guias de arrecadação (GNRE), registros regulatórios de transporte (CIOT), documentação técnica, legislação e conteúdo explicativo. CIOT não é classificado como DF-e; GNRE não é classificada como nota fiscal. FAQs e páginas de orientação são fontes de referência, não atos normativos.

O catálogo registra URLs oficiais e permite monitorar disponibilidade/hash. Isso não significa que cada portal tenha um crawler específico, que documentos tenham sido capturados, ou que as páginas tenham sido validadas continuamente.

A associação de instância ERP à empresa usa chave estrangeira composta pelo tenant, impedindo associação cruzada. A migration 0003 também reforça a integridade do vínculo entre eventos de integração e instâncias ERP, valida formato de CNPJ e SHA-256, adiciona índices e restringe alterações/exclusões de auditoria para o usuário runtime.

## Limites atuais

- O CRUD de usuários, convites, recuperação de senha e gestão de sessão ainda não está implementado.
- Existe monitor de disponibilidade/hash dos portais e biblioteca de captura de artefatos oficiais. A captura recebe uma URL de documento explicitamente fornecida; ainda não existe descoberta automática de links, fila de candidatos, OCR ou fluxo de revisão/aprovação.
- Fontes e documentos normativos são somente leitura pela API.
- As migrations 0001–0008 ainda precisam ser aplicadas e validadas em PostgreSQL real.
- Testes de API atuais usam mocks; não substituem testes reais de PostgreSQL/RLS.
- O armazenamento S3 precisa ser provisionado e configurado.
- Nenhum deploy da API na VPS foi executado.

## Banco

Aplicar migrations em ordem numérica: 0001_fiscal_hub_core.sql até 0008_transport_and_fiscal_document_sources.sql. Use um usuário de migração separado. A API deve conectar como fiscal_hub_app, sem ownership, superuser ou BYPASSRLS.

## Execução local

1. Instale dependências com pnpm.
2. Configure DATABASE_URL e JWT_SECRET.
3. Aplique as migrations em PostgreSQL descartável.
4. Defina a senha do fiscal_hub_app fora do repositório.
5. Provisione tenant e administrador com provision:admin usando credenciais administrativas temporárias.
6. Execute pnpm --filter @rts/fiscal-hub-api dev.

## Política de publicação

Os workflows de Cloudflare devem ser executados somente por workflow_dispatch. Commits e validações de CI não autorizam publicação automática em produção. A implantação do Hub na VPS exige aprovação operacional separada.

## Monitor de fontes

O serviço `services/fiscal-normative-collector` verifica URLs cadastradas, restritas a uma allowlist exata de hosts HTTPS. Bloqueia redirects, limita timeout e tamanho de resposta, calcula SHA-256 e registra histórico em `fiscal.normative_source_checks`. Status CHANGED significa apenas que o conteúdo da página consultada mudou; não classifica nem identifica automaticamente um ato normativo novo. O monitor ainda depende de execução manual ou cron externo e não está publicado na VPS.
