# Queues

Queues handle asynchronous integration events.

Required metadata:
- eventId
- eventType
- schemaVersion
- occurredAt
- correlationId
- idempotencyKey
- aggregateId

Consumers must be idempotent and retry-safe.
