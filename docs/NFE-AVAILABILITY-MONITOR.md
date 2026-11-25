# Monitor de disponibilidade NF-e

O Worker oferece duas rotas autenticadas:

- `GET /api/v1/monitor/nfe`: consulta o painel oficial do Portal Nacional da NF-e, interpreta somente indicadores cuja cor esteja explicitamente identificada no HTML e retorna o snapshot.
- `GET /api/v1/monitor/nfe/history?limit=30`: consulta snapshots persistidos no D1, com limite entre 1 e 100.

Ambas exigem o contrato de integração existente: Bearer token, `X-Zynkronyx-Tenant` e `X-Correlation-Id`.

## Fonte e semântica

Fonte primária: https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx

Estados:
- `GREEN`: indicador explicitamente verde.
- `YELLOW`: indicador explicitamente amarelo.
- `RED`: indicador explicitamente vermelho.
- `UNKNOWN`: metadados da imagem não reconhecidos. Nunca converter para verde.

A data/hora exibida pelo portal é retornada separadamente de `checkedAt`, que representa quando o Worker fez a consulta.

## Santa Catarina

O snapshot destaca SVRS como autorizador normal e SVC-AN como contingência, conforme o roteamento publicado pelo Portal Nacional. O conjunto `santaCatarina.services` contém os indicadores da linha SVRS. A situação de contingência é disponibilizada na lista geral de autorizadores.

## Persistência

Aplicar `migrations/0023_nfe_availability_monitor.sql` no D1 do ambiente antes de habilitar histórico. Sem D1, a consulta ao painel continua funcionando e retorna `persistence.saved=false`. Se a tabela ainda não existir, a resposta mantém o snapshot e informa a falha de persistência; a rota não transforma isso em falso estado de indisponibilidade da SEFAZ.

## Limitação deliberada

O parser é conservador: se o Portal alterar nomes de imagens ou remover os atributos de cor, o indicador ficará `UNKNOWN`. Antes de automatizar alertas ou tomar decisões de emissão, validar os atributos reais do HTML em produção e ampliar testes com amostras recentes do portal. A consulta do painel mede a disponibilidade publicada pelo portal, não substitui a chamada SOAP autenticada de cada contribuinte ao WebService.

## Agendamento isolado

O Worker mantém dois crons independentes:

- `0 3 * * *`: coleta fiscal e governamental existente.
- `*/15 * * * *`: somente consulta do painel NF-e e gravação do snapshot.

O cron NF-e verifica o binding D1 antes de fazer qualquer requisição externa. Enquanto D1 não estiver configurado, encerra sem consumir chamadas ao Portal Nacional. A migration `0023` precisa estar aplicada antes de habilitar a persistência. Esse isolamento impede que a frequência de 15 minutos altere a cadência das fontes legislativas.