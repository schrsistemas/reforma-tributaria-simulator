CREATE INDEX IF NOT EXISTS idx_simulations_tenant_operation ON simulations(tenant_id,operation_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_resource ON idempotency_keys(resource_id);
