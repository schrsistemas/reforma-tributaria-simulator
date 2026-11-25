BEGIN;

-- Global operational telemetry, deliberately separate from tenant business data.
CREATE TABLE fiscal.normative_collector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name varchar(40) NOT NULL
    CHECK (worker_name IN ('SOURCE_MONITOR','ARTIFACT_DISCOVERY','ARTIFACT_CAPTURE')),
  run_status varchar(20) NOT NULL DEFAULT 'RUNNING'
    CHECK (run_status IN ('RUNNING','SUCCEEDED','FAILED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms bigint GENERATED ALWAYS AS (
    CASE WHEN finished_at IS NULL THEN NULL
         ELSE greatest(0, floor(extract(epoch FROM (finished_at - started_at)) * 1000)::bigint)
    END
  ) STORED,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(counters) = 'object'),
  failure_code varchar(80),
  CHECK (
    (run_status = 'RUNNING' AND finished_at IS NULL AND failure_code IS NULL)
    OR (run_status = 'SUCCEEDED' AND finished_at IS NOT NULL AND failure_code IS NULL)
    OR (run_status = 'FAILED' AND finished_at IS NOT NULL AND failure_code IS NOT NULL)
  )
);

CREATE INDEX ix_normative_collector_runs_recent
  ON fiscal.normative_collector_runs(started_at DESC);
CREATE INDEX ix_normative_collector_runs_worker_recent
  ON fiscal.normative_collector_runs(worker_name, started_at DESC);
CREATE INDEX ix_normative_collector_runs_stale
  ON fiscal.normative_collector_runs(started_at)
  WHERE run_status = 'RUNNING';

GRANT SELECT, INSERT ON fiscal.normative_collector_runs TO fiscal_hub_app;
REVOKE UPDATE, DELETE ON fiscal.normative_collector_runs FROM fiscal_hub_app;
GRANT UPDATE (run_status, finished_at, counters, failure_code)
  ON fiscal.normative_collector_runs TO fiscal_hub_app;

COMMENT ON TABLE fiscal.normative_collector_runs IS
  'Global execution ledger for normative source monitor, discovery and capture workers.';

COMMIT;
