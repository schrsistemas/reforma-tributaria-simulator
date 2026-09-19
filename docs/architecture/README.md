# Architecture

## Runtime flow

Client -> Cloudflare Worker -> Tax Engine -> Scenario/Rules -> Result + Audit Event.

Financial events follow an independent durable workflow:

Payment -> Link Operation -> Calculate Tax -> Split -> Settle -> Reconcile.

No external provider is called directly from the tax engine. Integrations use adapters.
