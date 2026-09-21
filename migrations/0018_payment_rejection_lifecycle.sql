-- Connect simulated payment rejection to the Split Payment aggregate.
-- The rejection remains a simulation event; it is not a claim about an official rejection code.

ALTER TABLE split_payments ADD COLUMN rejection_code TEXT;
ALTER TABLE split_payments ADD COLUMN rejection_scenario_id TEXT;
ALTER TABLE split_payments ADD COLUMN rejected_at TEXT;

ALTER TABLE payment_rejection_simulations ADD COLUMN payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_split_payments_rejection
  ON split_payments(tenant_id,status,rejected_at);

CREATE INDEX IF NOT EXISTS idx_payment_rejection_sim_payment
  ON payment_rejection_simulations(tenant_id,payment_id,created_at);
