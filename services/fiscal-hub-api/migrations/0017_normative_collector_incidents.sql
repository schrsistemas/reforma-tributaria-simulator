BEGIN;

CREATE TABLE fiscal.normative_collector_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key varchar(160) NOT NULL UNIQUE,
  incident_type varchar(60) NOT NULL,
  severity varchar(20) NOT NULL CHECK (severity IN ('WARNING','CRITICAL')),
  status varchar(20) NOT NULL CHECK (status IN ('OPEN','RESOLVED')),
  summary varchar(240) NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  CHECK ((status = 'OPEN' AND resolved_at IS NULL) OR (status = 'RESOLVED' AND resolved_at IS NOT NULL))
);

CREATE INDEX ix_normative_collector_incidents_status_recent
  ON fiscal.normative_collector_incidents(status, last_seen_at DESC);
CREATE INDEX ix_normative_collector_incidents_type_recent
  ON fiscal.normative_collector_incidents(incident_type, last_seen_at DESC);

CREATE TABLE fiscal.normative_collector_incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES fiscal.normative_collector_incidents(id),
  event_type varchar(20) NOT NULL CHECK (event_type IN ('OPENED','UPDATED','RESOLVED','REOPENED')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ix_normative_collector_incident_events_incident_time
  ON fiscal.normative_collector_incident_events(incident_id, occurred_at DESC);

GRANT SELECT, INSERT ON fiscal.normative_collector_incidents TO fiscal_hub_app;
GRANT UPDATE (severity, status, summary, last_seen_at, resolved_at, occurrence_count, metadata)
  ON fiscal.normative_collector_incidents TO fiscal_hub_app;
REVOKE DELETE ON fiscal.normative_collector_incidents FROM fiscal_hub_app;
GRANT SELECT, INSERT ON fiscal.normative_collector_incident_events TO fiscal_hub_app;
REVOKE UPDATE, DELETE ON fiscal.normative_collector_incident_events FROM fiscal_hub_app;

COMMENT ON TABLE fiscal.normative_collector_incidents IS
  'Deduplicated current operational incidents for normative collector workers.';
COMMENT ON TABLE fiscal.normative_collector_incident_events IS
  'Append-only lifecycle history for normative collector incidents.';

COMMIT;
