# Durable workflows

Workflow boundaries:

- simulate-operation
- split-payment
- reconcile-payment

Each workflow must persist checkpoints and accept a deterministic idempotency key.
