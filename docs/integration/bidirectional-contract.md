# Bidirectional Integration Contract

O Zynkronyx e o Fiscal Domain não são uma cadeia hierárquica fixa. A comunicação é bidirecional.

## Princípio

- **Command**: alguém solicita uma ação.
- **Event**: um domínio informa que algo aconteceu.
- **Query**: alguém consulta estado.
- **Webhook/Callback**: somente quando um protocolo externo exigir.

O produtor de uma mensagem é responsável por seu significado. O consumidor não deve reimplementar a lógica do produtor.

## Zynkronyx → Fiscal Domain

Exemplos de comandos:

- `FISCAL_CALCULATE`
- `FISCAL_VALIDATE_DOCUMENT`
- `FISCAL_RESOLVE_RULES`
- `FISCAL_CREATE_SPLIT_PAYMENT`
- `FISCAL_GET_SNAPSHOT`

O Zynkronyx pode iniciar esses comandos porque uma integração externa pode exigir uma operação fiscal.

## Fiscal Domain → Zynkronyx

Exemplos de eventos:

- `FISCAL_SIMULATION_COMPLETED`
- `FISCAL_RULESET_PUBLISHED`
- `FISCAL_DOCUMENT_VALIDATED`
- `FISCAL_SPLIT_PAYMENT_CREATED`
- `FISCAL_RECONCILIATION_FAILED`

O Fiscal Domain pode produzir esses eventos sem depender de uma solicitação imediata do Zynkronyx.

## Envelope

Todas as mensagens de integração devem possuir:

- `messageId`
- `messageType`
- `schemaVersion`
- `occurredAt`
- `correlationId`
- `tenantId`
- `idempotencyKey`
- `source`
- `payload`

## Idempotência

`messageId` identifica a mensagem.

`idempotencyKey` identifica a operação que não pode ser executada duas vezes.

Consumidores devem aceitar redelivery sem duplicar efeitos.

## Correlação

`correlationId` acompanha a operação ponta a ponta:

`ERP → Zynkronyx → Fiscal → Zynkronyx → ERP`

O mesmo ID deve permitir reconstruir a execução nos logs e auditorias.

## Tenant

O contexto de tenant deve ser propagado pelo Zynkronyx e validado no domínio receptor.

Nenhum consumidor deve confiar apenas no tenant enviado pelo payload se existir contexto autenticado independente.

## Regra de dependência

O Fiscal Domain não deve importar código interno do Zynkronyx.

O Zynkronyx não deve importar regras internas do Tax Engine.

A dependência compartilhada deve ser o **contrato de integração**, não a implementação.

## Transporte

O contrato não obriga um único transporte.

Pode utilizar:

- HTTP;
- Queue;
- Workflow;
- webhook;
- evento assíncrono;
- Service Binding quando aplicável.

A semântica da mensagem permanece igual.

## Falhas

Um evento não entregue não deve invalidar o resultado fiscal já persistido.

O produtor deve manter estado suficiente para retry/republicação.

O consumidor deve ser idempotente.

## Regra fundamental

O Zynkronyx é a central de integração, mas não precisa ser o proprietário de todos os eventos.

O Fiscal Domain é proprietário do conhecimento e resultado fiscal, mas não precisa conhecer todos os sistemas que consumirão esse resultado.

Isso permite integração em ambos os sentidos sem acoplamento circular.
