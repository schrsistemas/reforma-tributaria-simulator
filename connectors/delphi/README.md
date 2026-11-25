# Conector Delphi / FireDAC

Este diretório define a fronteira do conector ERP para Firebird 5.0.

## Contrato

- O ERP grava o evento na outbox local na mesma transação da operação de negócio.
- Um processo Delphi independente lê eventos pendentes e envia JSON por HTTPS à API.
- O envio usa um event_id estável como chave de idempotência.
- Confirmação HTTP de recebimento não equivale à conclusão do processamento fiscal.
- Falhas de rede mantêm o evento pendente; retries limitados usam backoff com jitter.
- Regras recebidas são verificadas por versão, hash, vigência e status antes do cache.

## Limites

O conector não calcula IBS/CBS/IS por conta própria e não interpreta documentos normativos. O motor fiscal central permanece responsável pelas regras aprovadas. O ERP preserva sua autonomia operacional quando o Hub estiver indisponível.

As units Delphi e o adaptador FireDAC serão implementados após congelamento do contrato de outbox/inbox e dos tipos de evento.
