-- Split Payment operational lifecycle: settlement, supplier settlement and reconciliation.
ALTER TABLE split_payments ADD COLUMN supplier_settled_at TEXT;

CREATE INDEX IF NOT EXISTS idx_split_payments_tenant_status
  ON split_payments(tenant_id,status);

CREATE INDEX IF NOT EXISTS idx_split_payment_allocations_status
  ON split_payment_allocations(payment_id,status);
